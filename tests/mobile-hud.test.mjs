import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const hud = fs.readFileSync('deploy/runtime-overrides/JarvisPremiumHud.jsx', 'utf8');
const launcher = fs.readFileSync('deploy/squarecloud-start.mjs', 'utf8');
const cameraRuntime = fs.readFileSync('deploy/runtime-overrides/jarvis-camera-runtime.js', 'utf8');

test('mobile HUD is gated by explicit mobile/iPad detection', () => {
  assert.match(hud, /const detectMobile = \(\) =>/);
  assert.match(hud, /navigator\.userAgentData\?\.mobile === true/);
  assert.match(launcher, /return touch && \(uaMobile \|\| ipad\);/);
  assert.doesNotMatch(launcher, /touch && \(uaMobile \|\| ipad \|\| \(coarse && noHover\)\)/);
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
  for (const dependency of ['io-manager.js', 'game.js', 'camera-manager.js']) {
    assert.match(launcher, new RegExp(`\\.webaverse-runtime/${dependency.replace('.', '\\.')}`));
  }
  for (const proxy of ['jarvis-mobile-io-proxy.js', 'jarvis-mobile-game-proxy.js', 'jarvis-mobile-camera-proxy.js']) {
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
  assert.match(cameraRuntime, /import\('\.\/io-manager\.js'\)/);
  assert.match(cameraRuntime, /import\('\.\/camera-manager\.js'\)/);
  assert.match(cameraRuntime, /import\('\.\/renderer\.js'\)/);
  assert.match(cameraRuntime, /lazy singleton mode/);
});
