import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {createGateway, loadGatewayConfig} from './https-gateway.mjs';

const runtimeRoot = process.cwd();

const applyPremiumHudOverride = () => {
  const sourceUrl = new URL('./runtime-overrides/JarvisPremiumHud.jsx', import.meta.url);
  const targetPath = path.join(runtimeRoot, 'src', 'JarvisPremiumHud.jsx');
  const appPath = path.join(runtimeRoot, 'src', 'components', 'app', 'App.jsx');

  let hudSource = fs.readFileSync(sourceUrl, 'utf8');
  hudSource = hudSource
    .replace("../../.webaverse-runtime/src/components/app", './components/app')
    .replace("../../.webaverse-runtime/src/jarvis-compat/ActivityShell.jsx", './jarvis-compat/ActivityShell.jsx')
    .replace("../../.webaverse-runtime/io-manager.js", '../io-manager.js')
    .replace("../../.webaverse-runtime/game.js", '../game.js')
    .replace("../../.webaverse-runtime/camera-manager.js", '../camera-manager.js');
  fs.writeFileSync(targetPath, hudSource, 'utf8');

  let appSource = fs.readFileSync(appPath, 'utf8');
  const oldImport = "import JarvisSocialDashboard from '../../JarvisSocialDashboard.jsx';";
  const newImport = "import JarvisPremiumHud from '../../JarvisPremiumHud.jsx';";
  if (appSource.includes(oldImport)) {
    appSource = appSource.replace(oldImport, newImport);
  } else if (!appSource.includes(newImport)) {
    throw new Error('Unable to locate Jarvis HUD import in App.jsx');
  }

  if (appSource.includes('<JarvisSocialDashboard />')) {
    appSource = appSource.replace('<JarvisSocialDashboard />', '<JarvisPremiumHud />');
  } else if (!appSource.includes('<JarvisPremiumHud />')) {
    throw new Error('Unable to locate Jarvis HUD render in App.jsx');
  }
  fs.writeFileSync(appPath, appSource, 'utf8');
  console.log('[Jarvis World] premium HUD runtime override installed directly (no git patch).');
};

const applyAvatarAndGizmoOverrides = () => {
  const avatarSource = new URL('../cosmetic-assets/skins/drop-noWeapon.vrm', import.meta.url);
  const avatarDir = path.join(runtimeRoot, 'avatars');
  const avatarTarget = path.join(avatarDir, 'default-male.vrm');
  if (!fs.existsSync(avatarSource)) {
    throw new Error('Jarvis bundled local-player avatar is missing: cosmetic-assets/skins/drop-noWeapon.vrm');
  }
  fs.mkdirSync(avatarDir, {recursive: true});
  fs.copyFileSync(avatarSource, avatarTarget);

  const constantsPath = path.join(runtimeRoot, 'constants.js');
  let constantsSource = fs.readFileSync(constantsPath, 'utf8');
  if (!constantsSource.includes("avatarUrl: './avatars/default-male.vrm'")) {
    constantsSource = constantsSource.replace(
      "avatarUrl: './avatars/scilly_drophunter_v31.7_fuji.vrm'",
      "avatarUrl: './avatars/default-male.vrm'",
    );
    fs.writeFileSync(constantsPath, constantsSource, 'utf8');
  }
  if (!fs.readFileSync(constantsPath, 'utf8').includes("avatarUrl: './avatars/default-male.vrm'")) {
    throw new Error('Unable to force the Jarvis local-player avatar URL.');
  }
  console.log('[Jarvis World] materialized bundled VRM for the local player.');

  const transformPath = path.join(runtimeRoot, 'transform-controls.js');
  let transformSource = fs.readFileSync(transformPath, 'utf8');
  const gizmoMarker = 'Jarvis runtime: legacy transform gizmo hidden at construction';
  if (!transformSource.includes(gizmoMarker)) {
    const original = '  transformControls.transformGizmo = new TransformGizmo();';
    const replacement = `${original}\n  transformControls.transformGizmo.visible = false; // ${gizmoMarker}`;
    if (!transformSource.includes(original)) {
      throw new Error('Unable to locate TransformGizmo construction.');
    }
    transformSource = transformSource.replace(original, replacement);
    fs.writeFileSync(transformPath, transformSource, 'utf8');
  }
  console.log('[Jarvis World] legacy transform gizmo hidden before first render.');
};

const installCameraRuntime = () => {
  const sourceUrl = new URL('./runtime-overrides/jarvis-camera-runtime.js', import.meta.url);
  const targetPath = path.join(runtimeRoot, 'jarvis-camera-runtime.js');
  const appPath = path.join(runtimeRoot, 'src', 'components', 'app', 'App.jsx');

  if (!fs.existsSync(sourceUrl)) {
    throw new Error('Jarvis standalone camera runtime override is missing.');
  }
  fs.copyFileSync(sourceUrl, targetPath);

  let appSource = fs.readFileSync(appPath, 'utf8');
  const cameraImport = "import '../../../jarvis-camera-runtime.js';";
  if (!appSource.includes(cameraImport)) {
    appSource = `${cameraImport}\n${appSource}`;
    fs.writeFileSync(appPath, appSource, 'utf8');
  }
  console.log('[Jarvis World] standalone edge-steering camera runtime installed.');
};

applyPremiumHudOverride();
applyAvatarAndGizmoOverrides();
installCameraRuntime();

const runtimeHttpPort = process.env.WEBAVERSE_HTTP_PORT || '3100';
const runtimeWsPort = process.env.WEBAVERSE_WS_PORT || '3101';
const publicPort = process.env.PORT || '80';
const publicHost = process.env.HOST || '0.0.0.0';

const runtime = spawn(process.execPath, ['index.mjs', '-p'], {
  env: {
    ...process.env,
    PORT: runtimeHttpPort,
    WS_PORT: runtimeWsPort,
    HTTP_ONLY: '1',
  },
  stdio: 'inherit',
});

runtime.once('error', error => {
  console.error(`Unable to start Webaverse runtime: ${error.message}`);
  process.exitCode = 1;
});

const gatewayConfig = loadGatewayConfig({
  ...process.env,
  PUBLIC_HOST: publicHost,
  PUBLIC_PORT: publicPort,
  TRUST_PROXY_TLS: 'true',
  WEBAVERSE_HTTP_HOST: '127.0.0.1',
  WEBAVERSE_HTTP_PORT: runtimeHttpPort,
  WEBAVERSE_WS_HOST: '127.0.0.1',
  WEBAVERSE_WS_PORT: runtimeWsPort,
});
const gateway = createGateway(gatewayConfig);

await new Promise((resolve, reject) => {
  gateway.once('error', reject);
  gateway.listen(gatewayConfig.publicPort, gatewayConfig.publicHost, resolve);
});
console.log(`Jarvis Webaverse listening behind the Square HTTPS edge on ${publicHost}:${publicPort}`);

let stopping = false;
const stop = exitCode => {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  if (!runtime.killed) runtime.kill('SIGTERM');
  gateway.close(() => process.exit());
};

runtime.once('exit', (code, signal) => {
  if (!stopping) {
    console.error(`Webaverse runtime exited (${signal || code || 0}).`);
    stop(code || 1);
  }
});
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
