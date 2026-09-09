import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const launcher = fs.readFileSync('deploy/squarecloud-start.mjs', 'utf8');

test('Activity boots the authored city locally instead of waiting on the WSRTC room', () => {
  assert.match(launcher, /const multiplayerWorldSpec = 'return \{src: JARVIS_SHARED_SCENE, room: JARVIS_SHARED_ROOM\};'/);
  assert.match(launcher, /const localWorldSpec = 'return \{src: JARVIS_SHARED_SCENE\};'/);
  assert.match(launcher, /universeSource = universeSource\.replace\(multiplayerWorldSpec, localWorldSpec\)/);
});

test('world loading remains parallel with loop start but failures are awaited', () => {
  assert.match(launcher, /const jarvisWorldLoadPromise = universe\.handleUrlUpdate\(\)/);
  assert.match(launcher, /await weba\.startLoop\(\)/);
  assert.match(launcher, /await jarvisWorldLoadPromise/);
});

test('world startup stabilization runs before HUD and camera overrides', () => {
  const stabilize = launcher.indexOf('stabilizeWorldStartup();');
  const hud = launcher.indexOf('applyPremiumHudOverride();');
  const camera = launcher.indexOf('installCameraRuntime();');
  assert.ok(stabilize >= 0);
  assert.ok(hud > stabilize);
  assert.ok(camera > stabilize);
});
