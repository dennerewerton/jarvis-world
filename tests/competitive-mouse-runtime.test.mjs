import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const patch = fs.readFileSync('patches/0072-toggle-game-camera-with-quote.patch', 'utf8');
const override = fs.readFileSync('deploy/runtime-overrides/jarvis-camera-runtime.js', 'utf8');
const bootstrap = fs.readFileSync('deploy/squarecloud-bootstrap/bootstrap97.mjs', 'utf8');

test('quote/backquote toggles canonical Webaverse Pointer Lock synchronously inside io-manager', () => {
  assert.match(patch, /case 192:/);
  assert.match(patch, /cameraManager\.pointerLockElement/);
  assert.match(patch, /cameraManager\.exitPointerLock\(\)/);
  assert.match(patch, /cameraManager\.requestPointerLock\(\)/);
  assert.match(patch, /synchronous user/);
});

test('mousemove is owned only by canonical pointer lock state', () => {
  assert.match(patch, /if \(cameraManager\.pointerLockElement\)/);
  assert.doesNotMatch(patch, /\+\s+if \(cameraManager\.pointerLockElement \|\| ioManager\.jarvisCameraFocus\)/);
  assert.doesNotMatch(patch, /\+\s+if \(cameraManager\.pointerLockElement \|\| \(e\.buttons & 1\)\)/);
});

test('standalone camera override cannot intercept keyboard or mouse input', () => {
  assert.doesNotMatch(override, /addEventListener/);
  assert.doesNotMatch(override, /requestPointerLock\(/);
  assert.doesNotMatch(override, /handleMouseMove/);
  assert.match(override, /canonical synchronous Webaverse Pointer Lock is active/);
});

test('bootstrap 97 forces a new runtime build with the rewritten 0072 patch', () => {
  assert.match(bootstrap, /fw70-pilot-2026-09-09\.97/);
  assert.match(bootstrap, /0072-toggle-game-camera-with-quote\.patch/);
  assert.match(bootstrap, /synchronous canonical Pointer Lock patch is active/);
});
