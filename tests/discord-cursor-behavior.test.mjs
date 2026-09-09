import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('deploy/runtime-overrides/jarvis-camera-runtime.js', 'utf8');

test('Discord embedded mode never shows a crosshair cursor', () => {
  assert.doesNotMatch(source, /setCanvasCursor\(['"]crosshair['"]\)/);
  assert.doesNotMatch(source, /style\.cursor\s*=\s*['"]crosshair['"]/);
  assert.match(source, /no crosshair/);
});

test('embedded Activity camera control is drag-captured instead of free edge look', () => {
  assert.match(source, /if \(event\.button === 2\)/);
  assert.match(source, /setPointerCapture\?\.\(event\.pointerId\)/);
  assert.match(source, /dragPointerId !== null/);
  assert.match(source, /if \(isEmbeddedActivity\(\) && !dragging\) return;/);
});

test('cursor is hidden only while captured camera drag is active', () => {
  assert.match(source, /setGlobalCursor\('none'\)/);
  assert.match(source, /setGlobalCursor\(''\)/);
  assert.match(source, /releasePointerCapture/);
});

test('edge steering and autonomous rotation stay removed', () => {
  assert.doesNotMatch(source, /\bedgeFactor\b/);
  assert.doesNotMatch(source, /\bedgeX\b/);
  assert.doesNotMatch(source, /\bedgeY\b/);
  assert.doesNotMatch(source, /requestAnimationFrame\(tick\)/);
});
