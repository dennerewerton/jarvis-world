import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('deploy/runtime-overrides/jarvis-camera-runtime.js', 'utf8');

test('embedded Discord Activities never call native Pointer Lock', () => {
  assert.match(source, /const isEmbeddedActivity = \(\) =>/);
  assert.match(source, /if \(isEmbeddedActivity\(\)\) \{\s*setKeyboardFocused\(true\);/s);
  assert.match(source, /requestPointerLock\(\{unadjustedMovement: true\}\)/);
});

test('competitive camera never edge-steers or rotates autonomously', () => {
  assert.doesNotMatch(source, /\bedgeFactor\b/);
  assert.doesNotMatch(source, /\bedgeX\b/);
  assert.doesNotMatch(source, /\bedgeY\b/);
  assert.doesNotMatch(source, /requestAnimationFrame\(tick\)/);
});

test('mouse deltas use CS-style sensitivity semantics without smoothing or duplicate rotation', () => {
  assert.match(source, /SOURCE_DEGREES_PER_COUNT = 0\.022/);
  assert.match(source, /WEBAVERSE_DEGREES_PER_COUNT = 0\.18/);
  assert.match(source, /DEFAULT_SENSITIVITY = 2\.0/);
  assert.match(source, /movementX: dx \* scale/);
  assert.match(source, /movementY: dy \* scale/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
});

test('quote key restores keyboard-focused camera look inside Discord', () => {
  assert.match(source, /const isQuoteToggle = event =>/);
  assert.match(source, /toggleFocus\(\)/);
  assert.match(source, /setKeyboardFocused\(true\)/);
  assert.match(source, /const keyboardLook = keyboardFocused/);
  assert.match(source, /if \(isEmbeddedActivity\(\) && !dragging && !keyboardLook\) return;/);
});

test('safe Activity mode also supports right-drag Pointer Capture at edges', () => {
  assert.match(source, /setPointerCapture/);
  assert.match(source, /dragPointerId/);
  assert.match(source, /event\.button === 2/);
  assert.match(source, /releasePointerCapture/);
});

test('quote focus hides the normal cursor on canvas without crosshair', () => {
  assert.match(source, /setCanvasCursor\('none'\)/);
  assert.doesNotMatch(source, /crosshair/);
});

test('sensitivity is persistent and exposed for Settings integration', () => {
  assert.match(source, /jarvis\.mouseSensitivity/);
  assert.match(source, /window\.jarvisMouseLook/);
  assert.match(source, /jarvis:set-mouse-sensitivity/);
  assert.match(source, /isKeyboardFocused/);
});
