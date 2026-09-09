import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const hud = fs.readFileSync('deploy/runtime-overrides/JarvisPremiumHud.jsx', 'utf8');
const launcher = fs.readFileSync('deploy/squarecloud-start.mjs', 'utf8');
const cameraRuntime = fs.readFileSync('deploy/runtime-overrides/jarvis-camera-runtime.js', 'utf8');

test('mobile HUD is gated by explicit mobile/iPad detection', () => {
  assert.match(hud, /const detectMobile = \(\) =>/);
  assert.match(hud, /navigator\.userAgentData\?\.mobile === true/);
  assert.match(launcher, /const broadMobileGate = 'return touch && \(uaMobile \|\| ipad \|\| \(coarse && noHover\)\);'/);
  assert.match(launcher, /return touch && \(uaMobile \|\| ipad\);/);
  assert.match(launcher, /hudSource = hudSource\.replace\(broadMobileGate, strictMobileGate\)/);
  assert.match(hud, /return mobile \? <MobileHud/);
});

test('mobile controls drive runtime proxies instead of eager gameplay singleton imports', () => {
  assert.match(hud, /ioManager\.keys\.up = ny < -deadzone/);
  assert.match(hud, /ioManager\.keys\.shift = true/);
  assert.match(hud, /game\.jump\('jump'\)/);
  assert.match(hud, /cameraManager\.handleMouseMove/);
  assert.match(hud, /onPointerCancel=\{release\}/);
  assert.match(launcher, /jarvis-mobile-io-proxy\.js/);
  assert.match(launcher, /jarvis-mobile-game-proxy\.js/);
  assert.match(launcher, /jarvis-mobile-camera-proxy\.js/);
});

test('mobile layout provides safe-area and orientation handling', () => {
  assert.match(hud, /env\(safe-area-inset-left\)/);
  assert.match(hud, /@media\(orientation:portrait\)/);
  assert.match(hud, /touch-action:none/);
  assert.match(hud, /JARVIS CITY · MOBILE/);
});

test('runtime launcher rewrites HUD dependencies to isolated runtime-local proxies', () => {
  for (const dependency of ['io-manager.js', 'game.js', 'camera-manager.js', 'jarvis-world-actions-proxy.js']) {
    assert.match(launcher, new RegExp(`\\.webaverse-runtime/${dependency.replace('.', '\\.')}`));
  }
  for (const proxy of ['jarvis-mobile-io-proxy.js', 'jarvis-mobile-game-proxy.js', 'jarvis-mobile-camera-proxy.js', 'jarvis-world-actions-proxy.js']) {
    assert.match(launcher, new RegExp(proxy.replace('.', '\\.')));
  }
  assert.match(launcher, /import\('\.\/io-manager\.js'\)/);
  assert.match(launcher, /import\('\.\/game\.js'\)/);
  assert.match(launcher, /import\('\.\/camera-manager\.js'\)/);
});

test('standalone camera runtime does not statically import Webaverse singletons', () => {
  assert.doesNotMatch(cameraRuntime, /^import .*io-manager/m);
  assert.doesNotMatch(cameraRuntime, /^import .*camera-manager/m);
  assert.doesNotMatch(cameraRuntime, /^import .*renderer/m);
  assert.match(cameraRuntime, /canonical synchronous Webaverse Pointer Lock is active/);
  assert.match(cameraRuntime, /intentionally has no input listeners and no imports/);
});

test('HUD menus render real content instead of the temporary integration placeholder', () => {
  assert.doesNotMatch(hud, /Conteúdo integrado ao Jarvis World/);
  assert.match(hud, /activityApi\.daily\(\)/);
  assert.match(hud, /activityApi\.shop\(\)/);
  assert.match(hud, /teleportToLocation\(location\)/);
  assert.match(hud, /setGraphicsQuality\(nextQuality\)/);
  assert.match(hud, /\['auto', 'Auto'\].*\['low', 'Baixo'\].*\['medium', 'Médio'\].*\['high', 'Alto'\]/);
});

test('profile avatar uses the same-origin Discord proxy and a visible fallback', () => {
  assert.match(hud, /const avatarProxySource = value =>/);
  assert.match(hud, /\/__jarvis\/avatar\?url=/);
  assert.match(hud, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(hud, /className="avatar-fallback"/);
  assert.match(hud, /<ProfileAvatar url=\{avatar\} name=\{name\}\/\>/);
});

test('menu action proxy keeps mutations local to canonical game runtime', () => {
  assert.match(launcher, /QUALITY_STORAGE_KEY = 'jarvis-world-graphics-quality'/);
  assert.match(launcher, /cityApp\.setComponent\('cityQuality', quality\)/);
  assert.match(launcher, /playersManager\.getLocalPlayer\(\)/);
  assert.match(launcher, /player\.setSpawnPoint\(/);
  assert.match(launcher, /import\('\.\/players-manager\.js'\)/);
  assert.match(launcher, /import\('\.\/world\.js'\)/);
});
