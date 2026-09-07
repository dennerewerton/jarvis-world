import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const request = (
  origin,
  pathname,
  {headers = {}, rejectUnauthorized = true, timeoutMs = 10_000} = {},
) => new Promise((resolve, reject) => {
  const transport = origin.protocol === 'https:' ? https : http;
  const req = transport.request(new URL(pathname, origin), {
    method: 'GET',
    headers: {'user-agent': 'jarvis-world-fw4-smoke', ...headers},
    rejectUnauthorized,
  }, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => resolve({
      status: response.statusCode || 0,
      headers: response.headers,
      body: Buffer.concat(chunks).toString('utf8'),
    }));
  });
  req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout requesting ${pathname}`)));
  req.on('error', reject);
  req.end();
});

export const normalizeOrigin = (value, {allowHttp = false} = {}) => {
  const origin = new URL(value);
  if (origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Origin must not contain a path, query or fragment.');
  }
  if (origin.protocol !== 'https:' && !(allowHttp && origin.protocol === 'http:')) {
    throw new Error('Activity host must use HTTPS. Use --allow-http only for a local proxy smoke.');
  }
  const isLoopback = origin.hostname === '127.0.0.1'
    || origin.hostname === 'localhost'
    || origin.hostname === '[::1]';
  if (origin.protocol === 'http:' && !isLoopback) {
    throw new Error('Insecure HTTP smoke tests are restricted to loopback origins.');
  }
  return origin;
};

export const assertActivityHeaders = headers => {
  const csp = String(headers['content-security-policy'] || '');
  if (!csp.includes('frame-ancestors https://discord.com https://*.discord.com')) {
    throw new Error('CSP does not allow the Discord Activity frame ancestors.');
  }
  const xFrameOptions = String(headers['x-frame-options'] || '').toLowerCase();
  if (xFrameOptions.includes('deny') || xFrameOptions.includes('sameorigin')) {
    throw new Error('X-Frame-Options blocks the Discord Activity iframe.');
  }
};

export const assertDeliveryHeaders = (headers, origin) => {
  if (!origin.hostname.endsWith('.discordsays.com')) {
    assertActivityHeaders(headers);
    return;
  }
  const csp = String(headers['content-security-policy'] || '');
  if (!csp.includes(`https://${origin.host}/`) || !csp.includes(`wss://${origin.host}/`)) {
    throw new Error('Discord proxy CSP does not allow same-origin HTTPS and WSS delivery.');
  }
};

const htmlAttribute = (attributes, name) => {
  const match = attributes.match(new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    'i',
  ));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
};

export const activityModulePaths = html => Array.from(
  String(html || '').matchAll(/<script\b([^>]*)>/gi),
  match => match[1],
)
  .filter(attributes => htmlAttribute(attributes, 'type').toLowerCase() === 'module')
  .map(attributes => htmlAttribute(attributes, 'src'))
  .filter(source => source.startsWith('/') && !source.startsWith('//'));

const assertStatus = (result, expected, label) => {
  if (result.status !== expected) {
    throw new Error(`${label} returned HTTP ${result.status}; expected ${expected}.`);
  }
};

const requestEventually = async (
  origin,
  pathname,
  expectedStatus,
  {attempts = 5, headers = {}, rejectUnauthorized = true} = {},
) => {
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await request(origin, pathname, {headers, rejectUnauthorized});
    if (result.status === expectedStatus) return result;
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 400));
  }
  return result;
};

const websocketHandshake = (
  origin,
  {rejectUnauthorized = true, timeoutMs = 10_000} = {},
) => new Promise((resolve, reject) => {
  const transport = origin.protocol === 'https:' ? https : http;
  const room = `fw4-smoke-${crypto.randomBytes(6).toString('hex')}`;
  const playerId = `smoke-${crypto.randomBytes(6).toString('hex')}`;
  const target = new URL(`/worlds/${room}?playerId=${playerId}`, origin);
  const req = transport.request(target, {
    rejectUnauthorized,
    headers: {
      Connection: 'Upgrade',
      Upgrade: 'websocket',
      'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
      'Sec-WebSocket-Version': '13',
      'User-Agent': 'jarvis-world-fw4-smoke',
    },
  });
  const timer = setTimeout(() => req.destroy(new Error('WebSocket handshake timed out.')), timeoutMs);
  req.on('upgrade', (response, socket) => {
    clearTimeout(timer);
    if (response.statusCode !== 101) {
      socket.destroy();
      reject(new Error(`WebSocket upgrade returned HTTP ${response.statusCode}.`));
      return;
    }
    socket.destroy();
    resolve();
  });
  req.on('response', response => {
    clearTimeout(timer);
    response.resume();
    reject(new Error(`WebSocket upgrade was refused with HTTP ${response.statusCode}.`));
  });
  req.on('error', error => {
    clearTimeout(timer);
    reject(error);
  });
  req.end();
});

export const smokeActivityHost = async (origin, {rejectUnauthorized = true} = {}) => {
  const root = await requestEventually(origin, '/', 200, {
    headers: {accept: 'text/html'},
    rejectUnauthorized,
  });
  assertStatus(root, 200, 'Activity root');
  assertDeliveryHeaders(root.headers, origin);
  if (!root.body.includes('/src/main.jsx') && !root.body.includes('Jarvis World')) {
    throw new Error('Activity root does not look like the Jarvis Webaverse shell.');
  }
  const modulePaths = activityModulePaths(root.body);
  if (modulePaths.length === 0) {
    throw new Error('Activity root does not expose a same-origin JavaScript module.');
  }
  for (const modulePath of modulePaths) {
    const module = await request(origin, modulePath, {
      headers: {accept: 'text/javascript,*/*;q=0.1'},
      rejectUnauthorized,
    });
    assertStatus(module, 200, `Activity module ${modulePath}`);
    const contentType = String(module.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('text/html') || /^\s*<!doctype\s+html/i.test(module.body)) {
      throw new Error(`Activity module ${modulePath} returned HTML instead of JavaScript.`);
    }
  }

  assertStatus(await request(origin, '/standalone', {
    headers: {accept: 'text/html'},
    rejectUnauthorized,
  }), 404, 'Standalone route');
  assertStatus(await request(origin, '/standalone.html', {
    headers: {accept: 'text/html'},
    rejectUnauthorized,
  }), 404, 'Standalone HTML route');

  const worlds = await requestEventually(origin, '/worlds/', 200, {
    headers: {accept: 'application/json'},
    rejectUnauthorized,
  });
  assertStatus(worlds, 200, 'Worlds API');
  const rooms = JSON.parse(worlds.body);
  if (!Array.isArray(rooms)) throw new Error('Worlds API did not return a JSON array.');

  await websocketHandshake(origin, {rejectUnauthorized});
  return {
    root: root.status,
    modules: modulePaths.length,
    standalone: 404,
    worlds: worlds.status,
    websocket: 101,
  };
};

const parseArgs = argv => {
  const allowHttp = argv.includes('--allow-http');
  const allowSelfSigned = argv.includes('--allow-self-signed');
  const originIndex = argv.indexOf('--origin');
  if (originIndex === -1 || !argv[originIndex + 1]) {
    throw new Error('Usage: node smoke-activity-host.mjs --origin https://activity.example');
  }
  const origin = normalizeOrigin(argv[originIndex + 1], {allowHttp});
  const isLoopback = origin.hostname === '127.0.0.1'
    || origin.hostname === 'localhost'
    || origin.hostname === '[::1]';
  if (allowSelfSigned && !isLoopback) {
    throw new Error('--allow-self-signed is restricted to loopback smoke tests.');
  }
  return {origin, rejectUnauthorized: !allowSelfSigned};
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  Promise.resolve()
    .then(() => parseArgs(process.argv.slice(2)))
    .then(({origin, rejectUnauthorized}) => smokeActivityHost(origin, {rejectUnauthorized}))
    .then(result => console.log(`FW-4 host smoke passed: ${JSON.stringify(result)}`))
    .catch(error => {
      console.error(`FW-4 host smoke failed: ${error.message}`);
      process.exitCode = 1;
    });
}
