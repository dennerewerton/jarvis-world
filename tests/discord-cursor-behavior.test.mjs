import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const patch = fs.readFileSync('patches/0072-toggle-game-camera-with-quote.patch', 'utf8');
const override = fs.readFileSync('deploy/runtime-overrides/jarvis-camera-runtime.js', 'utf8');

test('Jarvis does not render a crosshair or custom cursor for camera focus', () => {
  assert.doesNotMatch(override, /style\.cursor/);
  assert.doesNotMatch(override, /setCanvasCursor/);
  assert.doesNotMatch(override, /setGlobalCursor/);
  assert.doesNotMatch(override, /setPointerCapture/);
});

test('cursor confinement is owned by Webaverse cameraManager pointer lock', () => {
  assert.match(patch, /cameraManager\.requestPointerLock\(\)/);
  assert.match(patch, /cameraManager\.exitPointerLock\(\)/);
  assert.match(patch, /cameraManager\.pointerLockElement/);
});

test('no soft-focus, pointer-capture, or edge-steering fallback remains in the standalone override', () => {
  assert.doesNotMatch(override, /jarvisCameraFocus/);
  assert.doesNotMatch(override, /setPointerCapture/);
  assert.doesNotMatch(override, /releasePointerCapture/);
  assert.doesNotMatch(override, /\bedgeFactor\b/);
  assert.doesNotMatch(override, /requestAnimationFrame\(tick\)/);
});
