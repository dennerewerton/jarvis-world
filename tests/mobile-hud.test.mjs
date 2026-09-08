import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const hud = fs.readFileSync('deploy/runtime-overrides/JarvisPremiumHud.jsx', 'utf8');
const launcher = fs.readFileSync('deploy/squarecloud-start.mjs', 'utf8');

test('mobile HUD is gated by touch-oriented mobile detection', () => {
  assert.match(hud, /const detectMobile = \(\) =>/);
  assert.match(hud, /navigator\.userAgentData\?\.mobile === true/);
  assert.match(hud, /touch && \(uaMobile \|\| ipad \|\| \(coarse && noHover\)\)/);
  assert.match(hud, /return mobile \? <MobileHud/);
});

test('mobile controls drive the canonical runtime input and camera', () => {
  assert.match(hud, /ioManager\.keys\.up = ny < -deadzone/);
  assert.match(hud, /ioManager\.keys\.shift = true/);
  assert.match(hud, /game\.jump\('jump'\)/);
  assert.match(hud, /cameraManager\.handleMouseMove/);
  assert.match(hud, /onPointerCancel=\{release\}/);
});

test('mobile layout provides safe-area and orientation handling', () => {
  assert.match(hud, /env\(safe-area-inset-left\)/);
  assert.match(hud, /@media\(orientation:portrait\)/);
  assert.match(hud, /touch-action:none/);
  assert.match(hud, /JARVIS CITY · MOBILE/);
});

test('runtime launcher rewrites every HUD dependency to runtime-local paths', () => {
  for (const dependency of ['io-manager.js', 'game.js', 'camera-manager.js']) {
    assert.match(launcher, new RegExp(`\\.webaverse-runtime/${dependency.replace('.', '\\.')}`));
  }

  const installedHud = hud
    .replace("../../.webaverse-runtime/src/components/app", './components/app')
    .replace("../../.webaverse-runtime/src/jarvis-compat/ActivityShell.jsx", './jarvis-compat/ActivityShell.jsx')
    .replace("../../.webaverse-runtime/io-manager.js", '../io-manager.js')
    .replace("../../.webaverse-runtime/game.js", '../game.js')
    .replace("../../.webaverse-runtime/camera-manager.js", '../camera-manager.js');
  assert.doesNotMatch(installedHud, /\.webaverse-runtime/);
  assert.match(installedHud, /import ioManager from '\.\.\/io-manager\.js'/);
  assert.match(installedHud, /import game from '\.\.\/game\.js'/);
  assert.match(installedHud, /import cameraManager from '\.\.\/camera-manager\.js'/);
});
