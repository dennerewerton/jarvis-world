import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('deploy/runtime-overrides/jarvis-camera-runtime.js', 'utf8');

test('camera bridge never renders a crosshair or custom cursor', () => {
  assert.doesNotMatch(source, /crosshair/);
  assert.doesNotMatch(source, /style\.cursor/);
  assert.doesNotMatch(source, /setCanvasCursor/);
  assert.doesNotMatch(source, /setGlobalCursor/);
});

test('cursor confinement is owned by canonical native Pointer Lock', () => {
  assert.match(source, /cameraManager\.requestPointerLock\(\)/);
  assert.match(source, /cameraManager\.exitPointerLock\(\)/);
  assert.match(source, /cameraManager\?\.pointerLockElement/);
});

test('no pointer-capture or edge-steering fallback remains', () => {
  assert.doesNotMatch(source, /setPointerCapture/);
  assert.doesNotMatch(source, /releasePointerCapture/);
  assert.doesNotMatch(source, /\bedgeFactor\b/);
  assert.doesNotMatch(source, /requestAnimationFrame\(tick\)/);
});
