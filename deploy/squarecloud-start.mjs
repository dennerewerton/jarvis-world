import {spawn} from 'node:child_process';

import {createGateway, loadGatewayConfig} from './https-gateway.mjs';

const runtimeHttpPort = process.env.WEBAVERSE_HTTP_PORT || '3100';
const runtimeWsPort = process.env.WEBAVERSE_WS_PORT || '3101';
const publicPort = process.env.PORT || '80';
const publicHost = process.env.HOST || '0.0.0.0';

const runtime = spawn(process.execPath, ['index.mjs', '-p'], {
  env: {
    ...process.env,
    PORT: runtimeHttpPort,
    WS_PORT: runtimeWsPort,
    HTTP_ONLY: '1',
  },
  stdio: 'inherit',
});

runtime.once('error', error => {
  console.error(`Unable to start Webaverse runtime: ${error.message}`);
  process.exitCode = 1;
});

const gatewayConfig = loadGatewayConfig({
  ...process.env,
  PUBLIC_HOST: publicHost,
  PUBLIC_PORT: publicPort,
  TRUST_PROXY_TLS: 'true',
  WEBAVERSE_HTTP_HOST: '127.0.0.1',
  WEBAVERSE_HTTP_PORT: runtimeHttpPort,
  WEBAVERSE_WS_HOST: '127.0.0.1',
  WEBAVERSE_WS_PORT: runtimeWsPort,
});
const gateway = createGateway(gatewayConfig);

await new Promise((resolve, reject) => {
  gateway.once('error', reject);
  gateway.listen(gatewayConfig.publicPort, gatewayConfig.publicHost, resolve);
});
console.log(
  `Jarvis Webaverse listening behind the Square HTTPS edge on ${publicHost}:${publicPort}`,
);

let stopping = false;
const stop = exitCode => {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  if (!runtime.killed) runtime.kill('SIGTERM');
  gateway.close(() => process.exit());
};

runtime.once('exit', (code, signal) => {
  if (!stopping) {
    console.error(`Webaverse runtime exited (${signal || code || 0}).`);
    stop(code || 1);
  }
});
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
