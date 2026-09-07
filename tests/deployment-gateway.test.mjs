import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  isStandalonePath,
  loadGatewayConfig,
  secureResponseHeaders,
  selectUpstream,
} from '../deploy/https-gateway.mjs';
import {
  activityModulePaths,
  assertActivityHeaders,
  assertDeliveryHeaders,
  normalizeOrigin,
} from '../scripts/smoke-activity-host.mjs';

test('host smoke discovers quoted and unquoted same-origin modules', () => {
  const modules = activityModulePaths(`
    <script type=module src="/pre.js"></script>
    <script src='/assets/app.js' type='module'></script>
    <script type="module" src="https://example.com/external.js"></script>
    <script src="/classic.js"></script>
  `);
  assert.deepEqual(modules, ['/pre.js', '/assets/app.js']);
});

test('gateway routes room HTTP and WebSocket paths to realtime only', () => {
  assert.equal(selectUpstream('/'), 'runtime');
  assert.equal(selectUpstream('/assets/client.js'), 'runtime');
  assert.equal(selectUpstream('/worlds'), 'realtime');
  assert.equal(selectUpstream('/worlds/room-a'), 'realtime');
  assert.equal(selectUpstream('/worlds%2Froom-a'), 'realtime');
  assert.equal(selectUpstream('/worldship'), 'runtime');
});

test('standalone bypass paths are blocked at the public gateway', () => {
  assert.equal(isStandalonePath('/standalone'), true);
  assert.equal(isStandalonePath('/standalone/'), true);
  assert.equal(isStandalonePath('/standalone.html'), true);
  assert.equal(isStandalonePath('/%73tandalone%2Ehtml'), true);
  assert.equal(isStandalonePath('/STANDALONE'), true);
  assert.equal(isStandalonePath('/standalone.css'), false);
});

test('gateway fails closed without TLS unless local HTTP is explicit', () => {
  assert.throws(() => loadGatewayConfig({}), /TLS certificate paths or TRUST_PROXY_TLS/);
  assert.throws(
    () => loadGatewayConfig({ALLOW_INSECURE_HTTP: 'true'}),
    /restricted to a loopback PUBLIC_HOST/,
  );
  const config = loadGatewayConfig({
    ALLOW_INSECURE_HTTP: 'true',
    PUBLIC_HOST: '127.0.0.1',
  });
  assert.equal(config.tls, false);
  assert.equal(config.externalTls, false);
  assert.equal(config.runtimePort, 3100);
  assert.equal(config.realtimePort, 3101);
});

test('gateway accepts cleartext only behind an explicit trusted HTTPS edge', () => {
  const config = loadGatewayConfig({
    TRUST_PROXY_TLS: 'true',
    PUBLIC_HOST: '0.0.0.0',
    PUBLIC_PORT: '80',
  });
  assert.equal(config.tls, false);
  assert.equal(config.externalTls, true);
  assert.equal(config.publicPort, 80);
  assert.throws(
    () => loadGatewayConfig({
      TRUST_PROXY_TLS: 'true',
      TLS_KEY_PATH: 'key.pem',
      TLS_CERT_PATH: 'cert.pem',
    }),
    /not both/,
  );
});

test('gateway replaces frame headers with the Discord Activity CSP', () => {
  const headers = secureResponseHeaders({
    'x-frame-options': 'DENY',
    'cache-control': 'max-age=2678400',
  }, {tls: true});
  assert.equal(headers['x-frame-options'], undefined);
  assert.equal(headers['strict-transport-security'], 'max-age=31536000');
  assert.equal(headers['cache-control'], 'no-cache');
  assert.match(headers['content-security-policy'], /script-src 'self' 'wasm-unsafe-eval'/);
  assert.doesNotMatch(headers['content-security-policy'], /script-src[^;]*\s'unsafe-eval'/);
  assert.doesNotThrow(() => assertActivityHeaders(headers));
});

test('public smoke accepts HTTPS and rejects accidental HTTP by default', () => {
  assert.equal(normalizeOrigin('https://activity.example').origin, 'https://activity.example');
  assert.throws(() => normalizeOrigin('http://activity.example'), /must use HTTPS/);
  assert.throws(
    () => normalizeOrigin('http://activity.example', {allowHttp: true}),
    /restricted to loopback origins/,
  );
  assert.equal(
    normalizeOrigin('http://127.0.0.1:3202', {allowHttp: true}).origin,
    'http://127.0.0.1:3202',
  );
});

test('public smoke recognizes the Discord proxy CSP rewrite', () => {
  const origin = new URL('https://123.discordsays.com');
  const headers = {
    'content-security-policy': 'connect-src https://123.discordsays.com/ wss://123.discordsays.com/;',
  };
  assert.doesNotThrow(() => assertDeliveryHeaders(headers, origin));
  assert.throws(
    () => assertDeliveryHeaders({'content-security-policy': 'connect-src https://123.discordsays.com/;'}, origin),
    /same-origin HTTPS and WSS/,
  );
});

test('Square Cloud bootstrap exposes only the public Discord client id', () => {
  const deployRoot = 'webaverse/deploy/squarecloud-bootstrap';
  const config = fs.readFileSync('webaverse/squarecloud.app', 'utf8');
  const environment = fs.readFileSync(`${deployRoot}/public.env`, 'utf8');
  const bootstrap = fs.readFileSync(`${deployRoot}/bootstrap.mjs`, 'utf8');
  const buildScript = fs.readFileSync('webaverse/scripts/build-squarecloud-bootstrap.ps1', 'utf8');
  const deployPackage = JSON.parse(fs.readFileSync('webaverse/package.json', 'utf8'));
  assert.match(config, /MEMORY=1536/);
  assert.match(config, /START=node deploy\/squarecloud-bootstrap\/bootstrap\.mjs/);
  assert.match(environment, /^VITE_DISCORD_CLIENT_ID=\d+\s*$/);
  assert.doesNotMatch(`${config}\n${environment}`, /CLIENT_SECRET|SESSION_SECRET|BOT_TOKEN/);
  assert.match(bootstrap, /--ignore-space-change/);
  assert.match(bootstrap, /--include=dev/);
  assert.match(bootstrap, /packages', 'totum/);
  assert.equal(deployPackage.scripts.start, 'node deploy/squarecloud-bootstrap/bootstrap.mjs');
  assert.deepEqual(deployPackage.dependencies, undefined);
  assert.match(bootstrap, /https:\/\/github\.com\/webaverse\/app\.git/);
  assert.match(bootstrap, /561630539fe2055c117309c3d24c2cfc4d6763d5/);
  assert.match(buildScript, /\$cosmeticAssetsRoot/);
  assert.match(buildScript, /cosmetic-assets package\.json squarecloud\.app \.env/);
  assert.doesNotMatch(bootstrap, /dennerewerton|jarvis-bot\.git/);
  assert.equal(
    fs.existsSync('webaverse/patches/totum/0001-vite2-html-comment-compat.patch'),
    true,
  );
});
