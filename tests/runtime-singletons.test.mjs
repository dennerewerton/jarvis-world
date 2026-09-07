import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import test from 'node:test';

const patch = fs.readFileSync(new URL('../patches/0062-canonicalize-runtime-singletons.patch', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const block = patch.split('@@\n')[1].split('diff --git')[0];
const source = block.split('\n').filter(line => line.startsWith('+')).map(line => line.slice(1)).join('\n');
const {default: plugin, canonicalRuntimeImport} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('runtime tags are removed while loader semantics and UI retries remain intact', () => {
  assert.equal(canonicalRuntimeImport('./metaversefile-api.js?jarvis-runtime=66'), './metaversefile-api.js');
  assert.equal(canonicalRuntimeImport('../../../webaverse.js?jarvis-fw4=19&jarvis-runtime=66'), '../../../webaverse.js');
  assert.equal(canonicalRuntimeImport('./world.js?raw&jarvis-runtime=66'), './world.js?raw=');
  assert.equal(canonicalRuntimeImport('./App.jsx?jarvis-retry=1'), './App.jsx?jarvis-retry=1');
  assert.equal(canonicalRuntimeImport('https://example.com/world.js?jarvis-runtime=66'), 'https://example.com/world.js?jarvis-runtime=66');
});

test('Vite 2 resolves mixed imports to one frozen API instance', async () => {
  const require = createRequire(path.resolve(process.env.JARVIS_VITE_CHECKOUT || 'webaverse/app', 'package.json'));
  const vite = require('vite');
  assert.match(require('vite/package.json').version, /^2\./);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-singleton-test-'));
  let server;
  try {
    fs.writeFileSync(path.join(root, 'registry.js'), 'export default {};');
    fs.writeFileSync(path.join(root, 'metaversefile-api.js'), "import registry from './registry.js'; Object.defineProperty(registry, 'import', {value: () => 42}); Object.freeze(registry); export default registry;");
    fs.writeFileSync(path.join(root, 'entry.js'), "import a from './metaversefile-api.js'; import b from './metaversefile-api.js?jarvis-runtime=66'; export const same = a === b; export const value = b.import();");
    server = await vite.createServer({root, configFile: false, logLevel: 'silent', plugins: [plugin()], server: {middlewareMode: 'ssr', hmr: false}, optimizeDeps: {disabled: true}});
    const plain = await server.pluginContainer.resolveId('./metaversefile-api.js', path.join(root, 'entry.js'));
    const tagged = await server.pluginContainer.resolveId('./metaversefile-api.js?jarvis-runtime=66', path.join(root, 'entry.js'));
    assert.equal(tagged.id, plain.id);
    const result = await server.ssrLoadModule('/entry.js');
    assert.equal(result.same, true);
    assert.equal(result.value, 42);
    const browser = await server.transformRequest('/entry.js');
    assert.doesNotMatch(browser.code, /jarvis-runtime=66/);
  } finally {
    if (server) await server.close();
    fs.rmSync(root, {recursive: true, force: true});
  }
});
