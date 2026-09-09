import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('deploy/runtime-overrides/jarvis-camera-runtime.js', 'utf8');

test('quote/backquote delegates to the canonical Webaverse camera manager', () => {
  assert.match(source, /manager\.requestPointerLock\(\)/);
  assert.match(source, /manager\.exitPointerLock\(\)/);
  assert.match(source, /manager\.pointerLockElement/);
  assert.match(source, /toggleCanonicalPointerLock/);
});

test('bridge never implements its own native Pointer Lock or mouse delta loop', () => {
  assert.doesNotMatch(source, /\.requestPointerLock\(\{unadjustedMovement/);
  assert.doesNotMatch(source, /movementX:/);
  assert.doesNotMatch(source, /movementY:/);
  assert.doesNotMatch(source, /handleMouseMove/);
  assert.doesNotMatch(source, /setPointerCapture/);
});

test('edge steering, soft focus, and custom sensitivity stay removed', () => {
  assert.doesNotMatch(source, /\bedgeFactor\b/);
  assert.doesNotMatch(source, /\bedgeX\b/);
  assert.doesNotMatch(source, /\bedgeY\b/);
  assert.doesNotMatch(source, /jarvisCameraFocus/);
  assert.doesNotMatch(source, /SOURCE_DEGREES_PER_COUNT/);
  assert.doesNotMatch(source, /requestAnimationFrame\(tick\)/);
});

test('legacy patched quote handler is suppressed before io-manager sees it', () => {
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /isQuoteToggle/);
});

test('camera manager is prewarmed only after interactive page activity', () => {
  assert.match(source, /window\.addEventListener\('load', prewarm/);
  assert.match(source, /window\.addEventListener\('pointermove', prewarm/);
  assert.doesNotMatch(source, /^import .*camera-manager/m);
});
