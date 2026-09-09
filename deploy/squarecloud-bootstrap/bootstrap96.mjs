import fs from 'node:fs';
import path from 'node:path';

// Square Cloud keeps application storage between deploys. A patch that was
// deleted from Git can therefore survive in /application/patches and still be
// picked up by bootstrap.mjs because that bootstrap scans the directory.
// Keep the runtime queue pinned to the files that are actually part of the
// validated Jarvis World snapshot through 0072.
const validatedRuntimePatches = [
  '0001-disable-legacy-web3-bootstrap.patch',
  '0002-disable-retired-preauthenticator.patch',
  '0003-vite2-html-comment-compat.patch',
  '0004-disable-retired-voice-catalog.patch',
  '0005-disable-web3-wallet-autologin.patch',
  '0006-local-preview-and-no-wallet-iframe.patch',
  '0007-add-local-baseline-scene.patch',
  '0008-add-stable-local-baseline-world.patch',
  '0009-localize-visible-ui-pt-br.patch',
  '0010-add-discord-activity-shell.patch',
  '0011-default-to-local-baseline-scene.patch',
  '0012-preserve-vite-request-paths.patch',
  '0013-add-jarvis-read-only-bridge.patch',
  '0014-disable-production-vite-prebundle.patch',
  '0015-fix-pt-br-regexes.patch',
  '0016-retry-transient-runtime-import.patch',
  '0017-vendor-lore-model.patch',
  '0018-disable-legacy-web3-runtime.patch',
  '0019-stabilize-runtime-startup.patch',
  '0020-disable-pilot-offscreen-previews.patch',
  '0021-restore-vendored-street-scene.patch',
  '0022-game-only-shell.patch',
  '0023-restore-stable-local-baseline-scene.patch',
  '0024-enhance-stable-local-plaza.patch',
  '0025-replace-test-plaza-with-local-city.patch',
  '0026-lock-final-gameplay-controls.patch',
  '0027-social-parkour-runtime.patch',
  '0028-integrate-ithappy-cartoon-city.patch',
  '0029-guard-cartoon-city-runtime.patch',
  '0030-preload-jarvis-plaza-sectors.patch',
  '0031-fix-plaza-ground-z-fighting.patch',
  '0032-social-hud-and-remove-crosshair.patch',
  '0033-remove-hidden-editor-and-target-inputs.patch',
  '0034-prune-social-runtime-dependencies.patch',
  '0035-prune-social-loadout-runtime.patch',
  '0036-prune-social-story-and-npc-controls.patch',
  '0037-refine-jarvis-social-hud.patch',
  '0038-separate-social-arena-from-city.patch',
  '0039-prune-social-voice-and-avatar-preview.patch',
  '0040-stabilize-city-streaming-and-static-colliders.patch',
  '0041-enforce-safe-city-spawn-and-visible-hud.patch',
  '0042-force-clear-legacy-aim-markers.patch',
  '0043-premium-social-city-hud.patch',
  '0044-harden-city-physics-and-map-recovery.patch',
  '0045-disable-target-reticle-renderer.patch',
  '0046-reference-social-dashboard-hud.patch',
  '0047-restore-plaza-ground-and-sector-visibility.patch',
  '0048-shared-jarvis-city-multiplayer-room.patch',
  '0049-render-remote-avatars-without-voice.patch',
  '0050-show-remote-player-presence-fallback.patch',
  '0051-report-client-runtime-failures.patch',
  '0052-isolate-dashboard-runtime.patch',
  '0054-bust-stale-runtime-module-cache.patch',
  '0055-refresh-npc-character-runtime.patch',
  '0056-version-primary-activity-entry.patch',
  '0057-isolate-current-player-module-chain.patch',
  '0058-normalize-player-runtime-module-chain.patch',
  '0059-force-browser-three-compat-and-cache-bust.patch',
  '0060-report-client-runtime-stack.patch',
  '0061-break-player-avatar-manager-cycle.patch',
  '0062-canonicalize-runtime-singletons.patch',
  '0063-share-react-contexts-across-ui-entries.patch',
  '0064-keep-world-running-without-demo-avatar.patch',
  '0065-materialize-public-runtime-imports.patch',
  '0066-restore-social-pointer-lock.patch',
  '0067-disable-discord-pointer-lock.patch',
  '0068-disable-activity-click-pointer-lock.patch',
  '0069-enable-activity-drag-camera.patch',
  '0070-hide-legacy-gizmo.patch',
  '0071-restore-authorized-profile-dashboard.patch',
  '0072-toggle-game-camera-with-quote.patch',
];

const validatedSet = new Set(validatedRuntimePatches);
const deploymentRoot = path.resolve('.');
const patchesRoot = path.join(deploymentRoot, 'patches');

if (!fs.existsSync(patchesRoot)) {
  throw new Error(`Jarvis patch root is missing: ${patchesRoot}`);
}

for (const patchName of validatedRuntimePatches) {
  if (!fs.existsSync(path.join(patchesRoot, patchName))) {
    throw new Error(`Validated Jarvis runtime patch is missing from deploy: ${patchName}`);
  }
}

const staleRuntimePatches = fs.readdirSync(patchesRoot)
  .filter(name => name.endsWith('.patch'))
  .filter(name => {
    const prefix = Number.parseInt(name.slice(0, 4), 10);
    return Number.isFinite(prefix) && prefix <= 72 && !validatedSet.has(name);
  });

for (const patchName of staleRuntimePatches) {
  fs.rmSync(path.join(patchesRoot, patchName), {force: true});
  console.warn(`[Jarvis World] removed stale Square Cloud runtime patch: ${patchName}`);
}

const remainingRuntimePatches = fs.readdirSync(patchesRoot)
  .filter(name => name.endsWith('.patch'))
  .filter(name => Number.parseInt(name.slice(0, 4), 10) <= 72)
  .sort();

const unexpected = remainingRuntimePatches.filter(name => !validatedSet.has(name));
if (unexpected.length) {
  throw new Error(`Unexpected Jarvis runtime patches survived cleanup: ${unexpected.join(', ')}`);
}

const sourceUrl = new URL('./bootstrap.mjs', import.meta.url);
const generatedUrl = new URL('./.bootstrap96.generated.mjs', import.meta.url);
let source = fs.readFileSync(sourceUrl, 'utf8');

const oldRelease = "const release = 'fw70-pilot-2026-09-08.90';";
const newRelease = "const release = 'fw70-pilot-2026-09-08.96';";
const oldLastPatch = "const lastValidatedRuntimePatch = '0073-premium-svg-social-hud.patch';";
const newLastPatch = "const lastValidatedRuntimePatch = '0072-toggle-game-camera-with-quote.patch';";

if (!source.includes(oldRelease)) {
  throw new Error('Expected .90 release marker was not found in bootstrap.mjs');
}
if (!source.includes(oldLastPatch)) {
  throw new Error('Expected 0073 patch marker was not found in bootstrap.mjs');
}

source = source
  .replace(oldRelease, newRelease)
  .replace(oldLastPatch, newLastPatch)
  .replace(
    "for (const patchName of patches) {\n    const patchPath = path.join(patchesRoot, patchName);",
    "for (const patchName of patches) {\n    console.log(`[Jarvis World] applying runtime patch ${patchName}`);\n    const patchPath = path.join(patchesRoot, patchName);",
  );

fs.writeFileSync(generatedUrl, source, 'utf8');
console.log(`[Jarvis World] bootstrap .96 active: validated ${validatedRuntimePatches.length} runtime patches; stale Square Cloud patch files are excluded.`);
await import(`${generatedUrl.href}?release=96`);
