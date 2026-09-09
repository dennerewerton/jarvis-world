import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('deploy/runtime-overrides/jarvis-camera-runtime.js', 'utf8');

test('competitive camera uses Pointer Lock and never edge-steers', () => {
  assert.match(source, /requestPointerLock\(\{unadjustedMovement: true\}\)/);
  assert.match(source, /pointerlockchange/);
  assert.match(source, /document\.pointerLockElement/);
  assert.doesNotMatch(source, /\bedgeFactor\b/);
  assert.doesNotMatch(source, /\bedgeX\b/);
  assert.doesNotMatch(source, /\bedgeY\b/);
  assert.doesNotMatch(source, /requestAnimationFrame\(tick\)/);
});

test('mouse deltas use CS-style sensitivity semantics without smoothing', () => {
  assert.match(source, /SOURCE_DEGREES_PER_COUNT = 0\.022/);
  assert.match(source, /WEBAVERSE_DEGREES_PER_COUNT = 0\.18/);
  assert.match(source, /DEFAULT_SENSITIVITY = 2\.0/);
  assert.match(source, /movementX: movementX \* scale/);
  assert.match(source, /movementY: movementY \* scale/);
});

test('sensitivity is persistent and can be integrated into Settings later', () => {
  assert.match(source, /jarvis\.mouseSensitivity/);
  assert.match(source, /window\.jarvisMouseLook/);
  assert.match(source, /jarvis:set-mouse-sensitivity/);
});

test('world canvas click captures mouse while HUD clicks stay interactive', () => {
  assert.match(source, /target\?\.tagName === 'CANVAS'/);
  assert.match(source, /event\.button !== 0/);
});
