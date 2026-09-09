import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const launcher = fs.readFileSync('deploy/squarecloud-start.mjs', 'utf8');

test('Activity boots the authored city locally instead of waiting on the WSRTC room', () => {
  assert.match(launcher, /const multiplayerWorldSpec = 'return \{src: JARVIS_SHARED_SCENE, room: JARVIS_SHARED_ROOM\};'/);
  assert.match(launcher, /const localWorldSpec = 'return \{src: JARVIS_SHARED_SCENE\};'/);
  assert.match(launcher, /universeSource = universeSource\.replace\(multiplayerWorldSpec, localWorldSpec\)/);
});

test('App world-load diagnostics never block deployment when patched source differs', () => {
  assert.match(launcher, /const worldStartupPattern = \/universe\\\.handleUrlUpdate/);
  assert.match(launcher, /App\.jsx world-load diagnostics skipped/);
  assert.doesNotMatch(launcher, /throw new Error\('Unable to locate Webaverse world startup sequence in App\.jsx'\)/);
});

test('world startup stabilization runs before HUD and camera overrides', () => {
  const stabilize = launcher.indexOf('stabilizeWorldStartup();');
  const hud = launcher.indexOf('applyPremiumHudOverride();');
  const camera = launcher.indexOf('installCameraRuntime();');
  assert.ok(stabilize >= 0);
  assert.ok(hud > stabilize);
  assert.ok(camera > stabilize);
});
