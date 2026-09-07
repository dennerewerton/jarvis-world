import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

const sceneNames = JSON.parse(fs.readFileSync('webaverse/app/scenes/scenes.json', 'utf8'));
const baselineScene = JSON.parse(
  fs.readFileSync('webaverse/app/scenes/jarvis-webaverse-baseline.scn', 'utf8'),
);
const stableBaselinePatch = fs.readFileSync(
  'webaverse/patches/0023-restore-stable-local-baseline-scene.patch',
  'utf8',
);
const enhancedPlazaPatch = fs.readFileSync(
  'webaverse/patches/0024-enhance-stable-local-plaza.patch',
  'utf8',
);
const localCityPatch = fs.readFileSync(
  'webaverse/patches/0025-replace-test-plaza-with-local-city.patch',
  'utf8',
);
const finalGameplayControlsPatch = fs.readFileSync(
  'webaverse/patches/0026-lock-final-gameplay-controls.patch',
  'utf8',
);
const socialParkourPatch = fs.readFileSync(
  'webaverse/patches/0027-social-parkour-runtime.patch',
  'utf8',
);
const cartoonCityPatch = fs.readFileSync(
  'webaverse/patches/0028-integrate-ithappy-cartoon-city.patch',
  'utf8',
);
const cartoonCityGuardPatch = fs.readFileSync(
  'webaverse/patches/0029-guard-cartoon-city-runtime.patch',
  'utf8',
);
const cartoonCityPlazaPreloadPatch = fs.readFileSync(
  'webaverse/patches/0030-preload-jarvis-plaza-sectors.patch',
  'utf8',
);
const cartoonCityGroundPatch = fs.readFileSync(
  'webaverse/patches/0031-fix-plaza-ground-z-fighting.patch',
  'utf8',
);
const socialHudPatch = fs.readFileSync(
  'webaverse/patches/0032-social-hud-and-remove-crosshair.patch',
  'utf8',
);
const socialInputPatch = fs.readFileSync(
  'webaverse/patches/0033-remove-hidden-editor-and-target-inputs.patch',
  'utf8',
);
const socialDependencyPrunePatch = fs.readFileSync(
  'webaverse/patches/0034-prune-social-runtime-dependencies.patch',
  'utf8',
);
const socialLoadoutPrunePatch = fs.readFileSync(
  'webaverse/patches/0035-prune-social-loadout-runtime.patch',
  'utf8',
);
const socialStoryAndNpcPrunePatch = fs.readFileSync(
  'webaverse/patches/0036-prune-social-story-and-npc-controls.patch',
  'utf8',
);
const refinedSocialHudPatch = fs.readFileSync(
  'webaverse/patches/0037-refine-jarvis-social-hud.patch',
  'utf8',
);
const separateArenaPatch = fs.readFileSync(
  'webaverse/patches/0038-separate-social-arena-from-city.patch',
  'utf8',
);
const stableCityStreamingPatch = fs.readFileSync(
  'webaverse/patches/0040-stabilize-city-streaming-and-static-colliders.patch',
  'utf8',
);
const safeCitySpawnPatch = fs.readFileSync(
  'webaverse/patches/0041-enforce-safe-city-spawn-and-visible-hud.patch',
  'utf8',
);
const aimMarkerRemovalPatch = fs.readFileSync(
  'webaverse/patches/0042-force-clear-legacy-aim-markers.patch',
  'utf8',
);
const premiumSocialHudPatch = fs.readFileSync(
  'webaverse/patches/0043-premium-social-city-hud.patch',
  'utf8',
);
const cityPhysicsHardeningPatch = fs.readFileSync(
  'webaverse/patches/0044-harden-city-physics-and-map-recovery.patch',
  'utf8',
);
const disabledTargetReticlePatch = fs.readFileSync(
  'webaverse/patches/0045-disable-target-reticle-renderer.patch',
  'utf8',
);
const referenceSocialDashboardPatch = fs.readFileSync(
  'webaverse/patches/0046-reference-social-dashboard-hud.patch',
  'utf8',
);
const plazaGroundVisibilityPatch = fs.readFileSync(
  'webaverse/patches/0047-restore-plaza-ground-and-sector-visibility.patch',
  'utf8',
);
const sharedCityMultiplayerPatch = fs.readFileSync(
  'webaverse/patches/0048-shared-jarvis-city-multiplayer-room.patch',
  'utf8',
);
const remoteAvatarWithoutVoicePatch = fs.readFileSync(
  'webaverse/patches/0049-render-remote-avatars-without-voice.patch',
  'utf8',
);
const remotePlayerPresenceFallbackPatch = fs.readFileSync(
  'webaverse/patches/0050-show-remote-player-presence-fallback.patch',
  'utf8',
);

test('every root runtime patch has valid unified-diff syntax', () => {
  for (const patchPath of fs.readdirSync('webaverse/patches')
    .filter(name => name.endsWith('.patch'))
    .sort()
    .map(name => `webaverse/patches/${name}`)) {
    const result = childProcess.spawnSync('git', ['apply', '--numstat', patchPath], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${patchPath}: ${result.stderr}`);
  }
});

test('authenticated Activity players always enter the singleton shared city room', () => {
  assert.match(sharedCityMultiplayerPatch, /const JARVIS_SHARED_ROOM = 'jarvis-city';/);
  assert.match(sharedCityMultiplayerPatch, /const JARVIS_SHARED_SCENE = '\.\/scenes\/jarvis-cartoon-city\.scn';/);
  assert.match(sharedCityMultiplayerPatch, /const initialRoomNames = \[JARVIS_SHARED_ROOM\];/);
  assert.match(sharedCityMultiplayerPatch, /worldSpec = resolveJarvisWorldSpec\(worldSpec\);/);
  assert.match(sharedCityMultiplayerPatch, /return \{src: JARVIS_SHARED_SCENE, room: JARVIS_SHARED_ROOM\};/);
  assert.match(sharedCityMultiplayerPatch, /standalone\(\?:\\\.html\)\?/);
});

test('a missing voice descriptor cannot prevent a remote avatar from rendering', () => {
  assert.match(remoteAvatarWithoutVoicePatch, /const rawVoiceSpec = this\.playerMap\.get\('voiceSpec'\);/);
  assert.match(remoteAvatarWithoutVoicePatch, /typeof rawVoiceSpec === 'string' && rawVoiceSpec/);
  assert.match(remoteAvatarWithoutVoicePatch, /Voice is optional for a remote player and cannot hide its avatar\./);
  assert.match(remoteAvatarWithoutVoicePatch, /this\.syncAvatar\(\);/);
});

test('remote players get an immediate visible fallback while their avatar loads', () => {
  assert.match(remotePlayerPresenceFallbackPatch, /new THREE\.CylinderGeometry\(0\.22, 0\.22, 1\.36, 8\)/);
  assert.match(remotePlayerPresenceFallbackPatch, /const initialTransform = this\.playerMap\.get\('transform'\);/);
  assert.match(remotePlayerPresenceFallbackPatch, /this\.presenceMarker\.position\.copy\(this\.position\);/);
  assert.match(remotePlayerPresenceFallbackPatch, /this\.presenceMarker\.visible = !this\.avatar;/);
  assert.match(remotePlayerPresenceFallbackPatch, /this\.presenceMarker\.removeFromParent\(\);/);
});

test('patch queue establishes the streamed ITHappy Jarvis City scene', () => {
  assert.equal(sceneNames.includes('jarvis-webaverse-baseline.scn'), true);
  assert.equal(sceneNames.includes('street.scn'), true);
  assert.deepEqual(
    baselineScene.objects
      .map((object) => object.start_url)
      .filter(Boolean),
    [
      '../metaverse_modules/street-base/',
      '../metaverse_modules/street/',
      '../metaverse_modules/skybox/',
    ],
  );
  assert.match(
    stableBaselinePatch,
    /\+      "start_url": "\.\.\/metaverse_modules\/jarvis-baseline-world\/"/,
  );
  assert.match(enhancedPlazaPatch, /SphereGeometry\(95, 28, 18\)/);
  assert.match(enhancedPlazaPatch, /addBuilding\(building, app\)/);
  assert.match(localCityPatch, /jarvis-city-world/);
  assert.match(localCityPatch, /kenney-city-commercial-jarvis-tower\.glb/);
  assert.match(localCityPatch, /kenney-road-crossroad\.glb/);
  assert.match(localCityPatch, /"position": \[-9, 0\.02, -18\]/);
  assert.match(localCityPatch, /"position": \[0, 0\.035, 0\]/);
  assert.doesNotMatch(localCityPatch, /portal-frame\.glb/);
  assert.match(cartoonCityPatch, /"jarvis-cartoon-city\.scn"/);
  assert.match(cartoonCityPatch, /jarvis-cartoon-city-world/);
  assert.match(cartoonCityPatch, /cartoon-city-free-v1/);
  assert.match(cartoonCityPatch, /north-central-center/);
  assert.match(cartoonCityPatch, /QUALITY_LOAD_DISTANCE = \{low: 32, medium: 44, high: 64, auto: 48\}/);
  assert.match(cartoonCityPatch, /\[-12\.56, 2, 22\]/);
  assert.doesNotMatch(cartoonCityPatch, /kenney-city-commercial/);
  assert.match(cartoonCityGuardPatch, /A sector problem must not take down the authenticated Activity shell/);
  assert.match(cartoonCityPlazaPreloadPatch, /'north-central-center'/);
  assert.match(cartoonCityPlazaPreloadPatch, /'north-center'/);
  assert.match(cartoonCityPlazaPreloadPatch, /'north-central-west'/);
  assert.match(cartoonCityPlazaPreloadPatch, /'north-central-east'/);
  assert.match(cartoonCityPlazaPreloadPatch, /'south-central-center'/);
  assert.match(cartoonCityPlazaPreloadPatch, /The first frame can run before the avatar\/player transform is fully bound/);
  assert.match(cartoonCityPlazaPreloadPatch, /streaming will retry after a runtime error/);
  assert.match(cartoonCityGroundPatch, /ground\.position\.set\(0, -0\.75, 0\)/);
  assert.match(cartoonCityGroundPatch, /two coplanar surfaces do not flicker/);
  assert.match(socialHudPatch, /-import \{ Crosshair \} from '\.\.\/general\/crosshair';/);
  assert.match(socialHudPatch, /-                <Crosshair \/>/);
  assert.match(socialHudPatch, /\+                <SocialHud \/>/);
  assert.match(socialHudPatch, /jarvis-open-emotes/);
  assert.match(socialHudPatch, /Enter ou Chat para conversar/);
  assert.match(socialInputPatch, /case 192: \/\/ tilde \/ quote on Brazilian keyboard layouts/);
  assert.match(socialInputPatch, /Right mouse is intentionally inert in the social, non-combat world/);
  assert.match(socialInputPatch, /-import zTargeting from '\.\/z-targeting\.js';/);
  assert.match(socialInputPatch, /-  zTargeting\.update\(timestamp, timeDiff\);/);
  assert.match(socialDependencyPrunePatch, /-import zTargeting from '\.\/z-targeting\.js';/);
  assert.match(socialDependencyPrunePatch, /-        zTargeting\.waitForLoad\(\),/);
  assert.match(socialDependencyPrunePatch, /-import musicManager from '\.\/music-manager\.js';/);
  assert.match(socialLoadoutPrunePatch, /-import loadoutManager from '\.\/loadout-manager\.js';/);
  assert.match(socialLoadoutPrunePatch, /\+import loadoutManager from '\.\/jarvis-social-loadout\.js';/);
  assert.match(socialLoadoutPrunePatch, /hotbar, inventory, object-sprite or infobox renderer dependency graph/);
  assert.match(socialLoadoutPrunePatch, /getSelectedApp\(\) \{\s+\+    return null;/);
  assert.match(socialStoryAndNpcPrunePatch, /-import storyManager from '\.\/story\.js';/);
  assert.match(socialStoryAndNpcPrunePatch, /NPC possession is a retired development mode/);
  assert.match(socialStoryAndNpcPrunePatch, /-  if \(storyManager\.handleWheel\(e\)\) \{/);
  assert.match(socialStoryAndNpcPrunePatch, /cameraManager\.handleWheelEvent\(e\)/);
  assert.match(refinedSocialHudPatch, /Jarvis City/);
  assert.match(refinedSocialHudPatch, /CSS-only, so it adds no image or network cost/);
  assert.match(refinedSocialHudPatch, /aria-pressed=\{chatOpen\}/);
  assert.match(refinedSocialHudPatch, /prefers-reduced-motion/);
  assert.match(separateArenaPatch, /\[0, 0\.02, -108\]/);
  assert.match(separateArenaPatch, /separate social\/parkour destination south of the city/);
  assert.match(stableCityStreamingPatch, /const STREAM_UPDATE_INTERVAL = 250;/);
  assert.match(stableCityStreamingPatch, /const STATIC_COLLIDERS = \[/);
  assert.match(stableCityStreamingPatch, /Never unload during a walk/);
  assert.match(stableCityStreamingPatch, /-\s+} else if \(distance > loadDistance \+ UNLOAD_MARGIN\)/);
  assert.doesNotMatch(stableCityStreamingPatch, /\+\s+} else if \(distance > loadDistance \+ UNLOAD_MARGIN\)/);
  assert.match(stableCityStreamingPatch, /Load only one nearest eligible sector per tick/);
  assert.match(safeCitySpawnPatch, /SAFE_SPAWN_POSITION = new THREE\.Vector3\(7\.5, 2\.1, 22\.5\)/);
  assert.match(safeCitySpawnPatch, /localPlayer\.setSpawnPoint\(SAFE_SPAWN_POSITION, SAFE_SPAWN_QUATERNION\)/);
  assert.match(safeCitySpawnPatch, /"position": \[7\.5, 2\.1, 22\.5\]/);
  assert.match(safeCitySpawnPatch, /EXPLORAR<\/span><b>\/<\/b><span>SOCIAL/);
  assert.match(aimMarkerRemovalPatch, /e\.preventDefault\(\);/);
  assert.match(aimMarkerRemovalPatch, /localPlayer\.removeAction\('aim'\)/);
  assert.match(aimMarkerRemovalPatch, /prevents target-reticle geometry from rendering/);
  assert.match(premiumSocialHudPatch, /SocialHudPremium\.module\.css/);
  assert.match(premiumSocialHudPatch, /Digite uma mensagem/);
  assert.match(premiumSocialHudPatch, /Controles de movimento/);
  assert.match(premiumSocialHudPatch, /pointer-events: none/);
  assert.doesNotMatch(premiumSocialHudPatch, /wallet|inventory|mission|combat|experience/i);
  assert.match(cityPhysicsHardeningPatch, /WORLD_BOUNDARY_COLLIDERS/);
  assert.match(cityPhysicsHardeningPatch, /FALL_RECOVERY_Y/);
  assert.match(cityPhysicsHardeningPatch, /SECTOR_MAX_ATTEMPTS = 3/);
  assert.match(cityPhysicsHardeningPatch, /localPlayer\.characterPhysics\?\.reset\?\.\(\)/);
  assert.doesNotMatch(cityPhysicsHardeningPatch, /addGeometry\(group\)|MeshCollider/);
  assert.match(disabledTargetReticlePatch, /app = new THREE\.Object3D\(\)/);
  assert.match(disabledTargetReticlePatch, /app\.setReticles = \(\) => \{\}/);
  assert.match(disabledTargetReticlePatch, /No geometry,/);
  assert.doesNotMatch(disabledTargetReticlePatch, /^\+\s+useFrame\(/m);
  assert.match(referenceSocialDashboardPatch, /JarvisIdentityContext/);
  assert.match(referenceSocialDashboardPatch, /identity\?\.wallet\?\.balance/);
  assert.match(referenceSocialDashboardPatch, /activityApi\.daily\(\)/);
  assert.match(referenceSocialDashboardPatch, /activityApi\.shop\(\)/);
  assert.match(referenceSocialDashboardPatch, /JARVIS CITY - SOCIAL/);
  assert.match(referenceSocialDashboardPatch, /ATIVIDADES SOCIAIS/);
  assert.match(referenceSocialDashboardPatch, /Discord Activity/);
  assert.doesNotMatch(referenceSocialDashboardPatch, /invent[aá]rio|\bXP\b|\bNv\.|weapon|magic/i);
  assert.match(plazaGroundVisibilityPatch, /PLAZA_REQUIRED_SECTOR_IDS/);
  assert.match(plazaGroundVisibilityPatch, /required visual ground, regardless of the selected detail profile/);
  assert.match(plazaGroundVisibilityPatch, /node\.frustumCulled = !criticalGround/);
  assert.match(plazaGroundVisibilityPatch, /material\.depthWrite = true/);
  assert.match(plazaGroundVisibilityPatch, /CITY_DEVELOPMENT_VALIDATION/);
  assert.match(plazaGroundVisibilityPatch, /invalid ground offset/);
  assert.match(plazaGroundVisibilityPatch, /complete 3x3 Plaza ring before entry/);
});

test('game shell does not render editor or diagnostics controls', () => {
  const activityApp = fs.readFileSync(
    'webaverse/app/src/components/app/App.jsx',
    'utf8',
  );

  for (const component of [
    'ActionMenu',
    'Settings',
    'WorldObjectsList',
    'EditorMode',
    'MapGen',
    'DragAndDrop',
    'BuildVersion',
    'Stats',
  ]) {
    assert.doesNotMatch(activityApp, new RegExp(`<${component}(?:\\s|\\/)`));
  }
  assert.match(activityApp, /<PlayMode\s*\/>/);
  assert.match(activityApp, /<QuickMenu\s*\/>/);
});

test('final gameplay locks historical scene editing controls', () => {
  assert.match(finalGameplayControlsPatch, /const _isWorldEditingEnabled = \(\) => false;/);
  assert.match(finalGameplayControlsPatch, /scene export is unavailable in the final game/);
  assert.match(finalGameplayControlsPatch, /X is intentionally inert/);
  assert.match(finalGameplayControlsPatch, /Transform gizmos and the scene context menu are development-only/);
  assert.match(finalGameplayControlsPatch, /if \(!_isWorldEditingEnabled\(\)\) return;/);
  assert.match(finalGameplayControlsPatch, /this\.editMode = false;\n\+    return false;/);
  assert.match(finalGameplayControlsPatch, /\+\s+return null;/);
  assert.match(finalGameplayControlsPatch, /_isWorldEditingEnabled\(\) && !gameManager\.editMode/);
});

test('social parkour runtime excludes combat systems and RPG interface', () => {
  for (const manager of [
    'mobManager.update(timestamp, timeDiffCapped)',
    'hpManager.update(timestamp, timeDiffCapped)',
    'questManager.update(timestamp, timeDiffCapped)',
    'transformControls.update()',
    'loadoutManager.update(timestamp, timeDiffCapped)',
  ]) {
    assert.match(socialParkourPatch, new RegExp(`-\\s*${manager.replace(/[().]/g, '\\$&')}`));
  }
  assert.match(socialParkourPatch, /Equipped weapons, magic and combat actions are disabled in social mode/);
  assert.match(socialParkourPatch, /import SocialHeader from '\.\.\/\.\.\/SocialHeader\.jsx';/);
  assert.match(socialParkourPatch, /export const PlayMode = \(\) => <Chat \/>;/);
  assert.match(socialParkourPatch, /<JarvisUser \/>/);
  assert.match(
    socialParkourPatch,
    /@@ -0,0 \+1,12 @@\r?\n\+import React from 'react';[\s\S]*?\+}\r?\n/,
  );
});

test('runtime header uses Jarvis identity instead of the legacy Webaverse wallet login', () => {
  const header = fs.readFileSync('webaverse/app/src/Header.jsx', 'utf8');
  const jarvisUser = fs.readFileSync('webaverse/app/src/jarvis-compat/JarvisUser.jsx', 'utf8');
  assert.match(header, /<JarvisUser\s*\/>/);
  assert.doesNotMatch(header, /<User\b/);
  assert.match(jarvisUser, /JarvisIdentityContext/);
  assert.doesNotMatch(jarvisUser, /MetaMask|WebaWallet|CLIENT_SECRET|SESSION_SECRET/);
});

test('production runtime avoids Vite HMR and bounds dependency prebundling', () => {
  const server = fs.readFileSync('webaverse/app/index.mjs', 'utf8');
  assert.match(server, /import metaversefilePlugin from 'metaversefile\/plugins\/rollup\.js'/);
  assert.match(server, /configFile: isProduction \? false : undefined/);
  assert.match(server, /plugins: isProduction \? \[metaversefilePlugin\(\)\] : undefined/);
  assert.match(server, /middlewareMode: isProduction \? 'ssr' : 'html'/);
  assert.match(server, /hmr: isProduction \? false/);
  assert.match(server, /optimizeDeps: isProduction \? \{\s+entries: \[\],\s+include:/);
  assert.match(server, /'react',\s+'react-dom',\s+'@discord\/embedded-app-sdk'/);
  for (const dependency of [
    'classnames',
    'troika-three-text',
    '@react-three/fiber',
    'json-6',
    '@shaderfrog/glsl-parser',
    'maxrects-packer',
    'smile2emoji',
  ]) {
    assert.equal(server.includes(`'${dependency}'`), true);
  }
  assert.doesNotMatch(server, /optimizeDeps: isProduction \? \{disabled: true\}/);
  assert.match(server, /app\.get\('\/'/);
});

test('Portuguese localization keeps executable whitespace regexes', () => {
  const localization = fs.readFileSync('webaverse/app/src/jarvis-compat/pt-BR.js', 'utf8');
  assert.match(localization, /value\.match\(\/\^\(\\s\*\)\(\.\*\?\)\(\\s\*\)\$\/s\)/);
  assert.doesNotMatch(localization, /value\.match\(\/\^\(\\\\s\*\)/);
  assert.match(localization, /\^World Tokens\\s\*\\\(\(\\d\+\)\\\)\$/);
});

test('runtime retries only transient dynamic module failures with bounded URLs', () => {
  const entry = fs.readFileSync('webaverse/app/src/main.jsx', 'utf8');
  assert.match(entry, /Failed to fetch dynamically imported module/);
  assert.match(entry, /Importing a module script failed/);
  assert.match(entry, /Outdated Optimize Dep/);
  assert.match(entry, /components\/app\/App\.jsx\?jarvis-retry=1/);
  assert.match(entry, /components\/app\/App\.jsx\?jarvis-retry=2/);
  assert.match(entry, /delay: 2_000/);
  assert.match(entry, /delay: 5_000/);
});

test('runtime self-hosts executable dependencies and keeps legacy Web3 inert', () => {
  const server = fs.readFileSync('webaverse/app/index.mjs', 'utf8');
  const loreModel = fs.readFileSync('webaverse/app/ai/lore/lore-model.js', 'utf8');
  const metaversefileApi = fs.readFileSync('webaverse/app/metaversefile-api.js', 'utf8');
  const webaverse = fs.readFileSync('webaverse/app/webaverse.js', 'utf8');

  assert.match(server, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.doesNotMatch(server, /script-src[^;]*\s'unsafe-eval'/);
  assert.doesNotMatch(loreModel, /https:\/\/webaverse\.github\.io\/lore-engine/);
  assert.match(loreModel, /export const defaultPlayerName = "Anon"/);
  assert.doesNotMatch(metaversefileApi, /from '.\/blockchain\.js'/);
  assert.match(metaversefileApi, /useWeb3\(\) \{\s+return null;/);
  assert.doesNotMatch(webaverse, /blockchain\.bindInterface|from '.\/blockchain\.js'/);
});

test('runtime startup does not depend on the retired particle catalog', async () => {
  const particles = fs.readFileSync('webaverse/app/particle-system.js', 'utf8');
  const jarvisParticles = fs.readFileSync(
    'webaverse/app/jarvis-particle-system.js',
    'utf8',
  );
  const activityApp = fs.readFileSync(
    'webaverse/app/src/components/app/App.jsx',
    'utf8',
  );
  const infobox = fs.readFileSync(
    'webaverse/app/src/components/play-mode/infobox/Infobox.jsx',
    'utf8',
  );

  assert.doesNotMatch(particles, /webaverse\.github\.io\/fx-textures|fetch\(particlesJsonUrl\)/);
  assert.match(particles, /const particlesJson = \[\]/);
  assert.match(particles, /particle texture is unavailable/);
  assert.match(infobox, /infoboxRenderer\.removeCanvas\(canvas\)/);
  assert.doesNotMatch(infobox, /infoBoxRenderer/);
  assert.match(
    fs.readFileSync('webaverse/app/metaversefile-api.js', 'utf8'),
    /jarvis-particle-system\.js/,
  );
  assert.match(
    fs.readFileSync('webaverse/app/webaverse.js', 'utf8'),
    /jarvis-particle-system\.js/,
  );
  assert.match(activityApp, /webaverse\.js\?jarvis-fw4=19/);
  assert.match(activityApp, /metaversefileApi from '\.\.\/\.\.\/\.\.\/metaversefile-api';/);
  assert.doesNotMatch(jarvisParticles, /fetch\(|fx-textures/);
  assert.match(jarvisParticles, /waitForLoad\(\) \{\s+return Promise\.resolve\(\)/);
  const {default: particleSystemManager} = await import(
    '../app/jarvis-particle-system.js'
  );
  await particleSystemManager.waitForLoad();
  assert.doesNotThrow(() => particleSystemManager.update(0, 0));
  assert.throws(
    () => particleSystemManager.createParticleSystem({particleNames: []}),
    /unavailable in the Jarvis World pilot/,
  );
  assert.match(
    fs.readFileSync('webaverse/app/src/components/play-mode/infobox/index.jsx', 'utf8'),
    /Infobox\.jsx\?jarvis-fw4=1/,
  );
});

test('pilot keeps optional offscreen previews inert at runtime startup', () => {
  const avatarIcon = fs.readFileSync('webaverse/app/src/AvatarIcon.jsx', 'utf8');
  const spritesheets = fs.readFileSync('webaverse/app/spritesheet-manager.js', 'utf8');
  const avatarIconer = fs.readFileSync('webaverse/app/jarvis-avatar-iconer.js', 'utf8');
  const offscreenEngine = fs.readFileSync(
    'webaverse/app/jarvis-offscreen-engine-manager.js',
    'utf8',
  );

  assert.match(avatarIcon, /jarvis-avatar-iconer\.js/);
  assert.match(avatarIcon, /<PlaceholderImg/);
  assert.match(spritesheets, /jarvis-offscreen-engine-manager\.js/);
  assert.doesNotMatch(spritesheets, /from '\.\/offscreen-engine-manager\.js'/);
  assert.match(spritesheets, /getSpriteSheetForApp\(app\)/);
  assert.match(avatarIconer, /this\.enabled = false/);
  assert.doesNotMatch(avatarIconer, /offscreen|createFunction|iframe/);
  assert.match(offscreenEngine, /return async \(\) => null/);
  assert.doesNotMatch(offscreenEngine, /iframe|MessageChannel|\/@proxy\/|data:/);
});

test('Cartoon City runtime sectors are validated and contain no remote assets', () => {
  const result = childProcess.spawnSync(
    process.execPath,
    ['webaverse/scripts/check-cartoon-city-sectors.mjs'],
    {encoding: 'utf8'},
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Cartoon City sectors: 12/);
  const manifest = JSON.parse(fs.readFileSync(
    'activity3d/public/assets/jarvis-world/3d/cartoon-city-free-v1/city-manifest.json',
    'utf8',
  ));
  assert.equal(manifest.source.sha256, '689E0DE8BCAF27566170F2CBA646203BDF01B39622D546736F037A0BABB07EEC');
  assert.equal(manifest.sectors.length, 12);
  assert.equal(manifest.sharedTextures.length, 10);
});

test('Cartoon City authored map and physics assumptions stay aligned', () => {
  childProcess.execFileSync(process.execPath, ['webaverse/scripts/check-cartoon-city-physics.mjs'], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });
});
