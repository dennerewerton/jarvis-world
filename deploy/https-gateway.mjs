import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ACTIVITY_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' https://cdn.discordapp.com data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://discord.com https://*.discord.com blob:",
  "worker-src 'self' blob:",
  'frame-ancestors https://discord.com https://*.discord.com',
].join('; ');

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const isLoopbackHost = host => (
  host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]'
);

const parsePort = (value, fallback, name) => {
  const port = Number.parseInt(value || String(fallback), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a TCP port between 1 and 65535.`);
  }
  return port;
};

const decodePathname = pathname => {
  try {
    return decodeURIComponent(pathname);
  } catch (error) {
    return pathname;
  }
};

export const selectUpstream = pathname => {
  const decoded = decodePathname(pathname);
  return decoded === '/worlds' || decoded.startsWith('/worlds/') ? 'realtime' : 'runtime';
};

export const isStandalonePath = pathname => (
  /^\/standalone(?:\.html)?\/?$/i.test(decodePathname(pathname))
);

export const secureResponseHeaders = (headers = {}, {tls = true, clearCache = false} = {}) => {
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(normalized) && normalized !== 'x-frame-options') {
      result[normalized] = value;
    }
  }
  result['content-security-policy'] = ACTIVITY_CSP;
  result['referrer-policy'] = 'no-referrer';
  result['x-content-type-options'] = 'nosniff';
  result['permissions-policy'] = 'camera=(), geolocation=(), microphone=()';
  result['cache-control'] = 'no-store';
  if (clearCache) result['clear-site-data'] = '"cache"';
  if (tls) result['strict-transport-security'] = 'max-age=31536000';
  return result;
};

export const loadGatewayConfig = (env = process.env) => {
  const tlsKeyPath = env.TLS_KEY_PATH?.trim() || '';
  const tlsCertPath = env.TLS_CERT_PATH?.trim() || '';
  const allowInsecureHttp = env.ALLOW_INSECURE_HTTP === 'true';
  const trustProxyTls = env.TRUST_PROXY_TLS === 'true';
  const publicHost = env.PUBLIC_HOST?.trim() || '0.0.0.0';
  if (Boolean(tlsKeyPath) !== Boolean(tlsCertPath)) {
    throw new Error('TLS_KEY_PATH and TLS_CERT_PATH must be configured together.');
  }
  if (tlsKeyPath && trustProxyTls) {
    throw new Error('Configure local TLS or trusted proxy TLS, not both.');
  }
  if (!tlsKeyPath && !trustProxyTls && !allowInsecureHttp) {
    throw new Error(
      'TLS certificate paths or TRUST_PROXY_TLS=true are required unless local HTTP is explicit.',
    );
  }
  if (allowInsecureHttp && !isLoopbackHost(publicHost)) {
    throw new Error('Insecure HTTP is restricted to a loopback PUBLIC_HOST.');
  }
  return {
    publicHost,
    publicPort: parsePort(env.PUBLIC_PORT, 3443, 'PUBLIC_PORT'),
    runtimeHost: env.WEBAVERSE_HTTP_HOST?.trim() || '127.0.0.1',
    runtimePort: parsePort(env.WEBAVERSE_HTTP_PORT, 3100, 'WEBAVERSE_HTTP_PORT'),
    realtimeHost: env.WEBAVERSE_WS_HOST?.trim() || '127.0.0.1',
    realtimePort: parsePort(env.WEBAVERSE_WS_PORT, 3101, 'WEBAVERSE_WS_PORT'),
    tlsKeyPath,
    tlsCertPath,
    tls: Boolean(tlsKeyPath),
    externalTls: Boolean(tlsKeyPath) || trustProxyTls,
  };
};

const upstreamHeaders = (request, {externalTls, upgrade = false}) => {
  const headers = {...request.headers};
  for (const name of HOP_BY_HOP_HEADERS) {
    if (!upgrade || (name !== 'connection' && name !== 'upgrade')) delete headers[name];
  }
  headers.host = request.headers.host || '';
  headers['x-forwarded-for'] = request.socket.remoteAddress || '';
  headers['x-forwarded-proto'] = externalTls ? 'https' : 'http';
  return headers;
};

const sendGatewayError = (response, statusCode, message, {externalTls}) => {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(statusCode, secureResponseHeaders({
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  }, {tls: externalTls}));
  response.end(message);
};

export const createGateway = config => {
  const targets = {
    runtime: {host: config.runtimeHost, port: config.runtimePort},
    realtime: {host: config.realtimeHost, port: config.realtimePort},
  };

  const handleRequest = (request, response) => {
    let pathname;
    try {
      pathname = new URL(request.url, 'http://gateway.local').pathname;
    } catch (error) {
      sendGatewayError(response, 400, 'bad request', config);
      return;
    }
    if (isStandalonePath(pathname)) {
      sendGatewayError(response, 404, 'not found', config);
      return;
    }
    if (pathname === '/__jarvis/client-error') {
      if (request.method !== 'POST') {
        sendGatewayError(response, 405, 'method not allowed', config);
        return;
      }
      const chunks = [];
      let size = 0;
      request.on('data', chunk => {
        size += chunk.length;
        if (size <= 16_384) chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > 16_384) {
          sendGatewayError(response, 413, 'payload too large', config);
          return;
        }
        try {
          const report = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const message = String(report?.message || 'unknown client error').slice(0, 1_000);
          const stack = String(report?.stack || '').slice(0, 8_000);
          console.error(`[Jarvis World client error] ${message}${stack ? `\n${stack}` : ''}`);
        } catch {
          console.error('[Jarvis World client error] malformed report');
        }
        response.writeHead(204, secureResponseHeaders({
          'cache-control': 'no-store',
        }, {tls: config.externalTls}));
        response.end();
      });
      return;
    }
    const target = targets[selectUpstream(pathname)];
    const proxyRequest = http.request({
      host: target.host,
      port: target.port,
      method: request.method,
      path: request.url,
      headers: upstreamHeaders(request, config),
    }, proxyResponse => {
      response.writeHead(
        proxyResponse.statusCode || 502,
        secureResponseHeaders(proxyResponse.headers, {
          tls: config.externalTls,
          clearCache: pathname === '/' || pathname === '/index.html',
        }),
      );
      proxyResponse.pipe(response);
    });
    proxyRequest.on('error', () => sendGatewayError(response, 502, 'upstream unavailable', config));
    request.on('aborted', () => proxyRequest.destroy());
    request.pipe(proxyRequest);
  };

  const server = config.tls
    ? https.createServer({
      key: fs.readFileSync(config.tlsKeyPath),
      cert: fs.readFileSync(config.tlsCertPath),
    }, handleRequest)
    : http.createServer(handleRequest);

  server.on('upgrade', (request, socket, head) => {
    let pathname;
    try {
      pathname = new URL(request.url, 'http://gateway.local').pathname;
    } catch (error) {
      socket.destroy();
      return;
    }
    if (selectUpstream(pathname) !== 'realtime') {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    const proxyRequest = http.request({
      host: config.realtimeHost,
      port: config.realtimePort,
      method: request.method,
      path: request.url,
      headers: upstreamHeaders(request, {...config, upgrade: true}),
    });
    proxyRequest.on('upgrade', (proxyResponse, upstreamSocket, upstreamHead) => {
      const statusMessage = proxyResponse.statusMessage || 'Switching Protocols';
      socket.write(`HTTP/1.1 ${proxyResponse.statusCode || 101} ${statusMessage}\r\n`);
      for (const [name, value] of Object.entries(proxyResponse.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) socket.write(`${name}: ${item}\r\n`);
        } else if (value !== undefined) {
          socket.write(`${name}: ${value}\r\n`);
        }
      }
      socket.write('\r\n');
      if (head.length) upstreamSocket.write(head);
      if (upstreamHead.length) socket.write(upstreamHead);
      upstreamSocket.on('error', () => socket.destroy());
      socket.on('error', () => upstreamSocket.destroy());
      socket.pipe(upstreamSocket).pipe(socket);
    });
    proxyRequest.on('response', proxyResponse => {
      socket.end(`HTTP/1.1 ${proxyResponse.statusCode || 502} Bad Gateway\r\nConnection: close\r\n\r\n`);
      proxyResponse.resume();
    });
    proxyRequest.on('error', () => {
      socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    });
    proxyRequest.end();
  });

  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  return server;
};

export const startGateway = async (config = loadGatewayConfig()) => {
  const server = createGateway(config);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.publicPort, config.publicHost, resolve);
  });
  const listenerScheme = config.tls ? 'https' : 'http';
  const edgeSuffix = !config.tls && config.externalTls ? ' (trusted HTTPS edge)' : '';
  console.log(
    `Jarvis Webaverse gateway listening on ${listenerScheme}://${config.publicHost}:${config.publicPort}${edgeSuffix}`,
  );
  const close = () => server.close(() => process.exit(0));
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  return server;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  startGateway().catch(error => {
    console.error(`Unable to start Jarvis Webaverse gateway: ${error.message}`);
    process.exitCode = 1;
  });
}
