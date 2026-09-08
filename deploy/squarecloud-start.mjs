import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {createGateway, loadGatewayConfig} from './https-gateway.mjs';

const applyPremiumHudOverride = () => {
  const runtimeRoot = process.cwd();
  const sourceUrl = new URL('./runtime-overrides/JarvisPremiumHud.jsx', import.meta.url);
  const targetPath = path.join(runtimeRoot, 'src', 'JarvisPremiumHud.jsx');
  const appPath = path.join(runtimeRoot, 'src', 'components', 'app', 'App.jsx');

  let hudSource = fs.readFileSync(sourceUrl, 'utf8');
  hudSource = hudSource
    .replace("../../.webaverse-runtime/src/components/app", './components/app')
    .replace("../../.webaverse-runtime/src/jarvis-compat/ActivityShell.jsx", './jarvis-compat/ActivityShell.jsx');
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

const applyGameplayRuntimeOverrides = () => {
  const runtimeRoot = process.cwd();

  // The pinned upstream does not contain the avatar file referenced by the old
  // fallback. Materialize a real VRM from the Jarvis cosmetic bundle before the
  // client starts, so the local player can finish avatar initialization.
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

  // Hide the old editor gizmo immediately when it is constructed. The later
  // update() guard remains in place as a second layer.
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

  // Native Pointer Lock is intentionally avoided in Discord Activities. Add an
  // edge-steering loop instead: ordinary mouse deltas rotate the camera, and
  // when the pointer reaches an edge the camera keeps rotating in that direction.
  const ioPath = path.join(runtimeRoot, 'io-manager.js');
  let ioSource = fs.readFileSync(ioPath, 'utf8');
  const edgeMarker = 'Jarvis edge-steering camera focus';
  if (!ioSource.includes(edgeMarker)) {
    const inputAnchor = 'ioManager.inputFocused = _inputFocused;';
    const inputReplacement = `${inputAnchor}\n\n// ${edgeMarker}\nioManager.jarvisCameraFocus = false;\nioManager.jarvisEdgeLookX = 0;\nioManager.jarvisEdgeLookY = 0;\nconst _setJarvisCameraFocus = focused => {\n  ioManager.jarvisCameraFocus = !!focused;\n  if (!ioManager.jarvisCameraFocus) {\n    ioManager.jarvisEdgeLookX = 0;\n    ioManager.jarvisEdgeLookY = 0;\n  }\n  const renderer = getRenderer();\n  const cursor = ioManager.jarvisCameraFocus ? 'none' : '';\n  renderer.domElement.style.cursor = cursor;\n  document.documentElement.style.cursor = cursor;\n  if (document.body) document.body.style.cursor = cursor;\n};\nconst _jarvisEdgeLookTick = () => {\n  if (ioManager.jarvisCameraFocus && !cameraManager.pointerLockElement) {\n    const x = ioManager.jarvisEdgeLookX;\n    const y = ioManager.jarvisEdgeLookY;\n    if (Math.abs(x) > 0.001 || Math.abs(y) > 0.001) {\n      cameraManager.handleMouseMove({\n        movementX: x * 13,\n        movementY: y * 10,\n      });\n    }\n  }\n  requestAnimationFrame(_jarvisEdgeLookTick);\n};\nrequestAnimationFrame(_jarvisEdgeLookTick);\nwindow.addEventListener('blur', () => _setJarvisCameraFocus(false));`;
    if (!ioSource.includes(inputAnchor)) {
      throw new Error('Unable to locate io-manager input focus anchor.');
    }
    ioSource = ioSource.replace(inputAnchor, inputReplacement);

    const toggleOriginal = `      ioManager.jarvisCameraFocus = !ioManager.jarvisCameraFocus;\n      const renderer = getRenderer();\n      renderer.domElement.style.cursor = ioManager.jarvisCameraFocus ? 'none' : '';\n      break;`;
    const toggleReplacement = `      _setJarvisCameraFocus(!ioManager.jarvisCameraFocus);\n      break;`;
    if (!ioSource.includes(toggleOriginal)) {
      throw new Error('Unable to locate Jarvis quote-key soft-focus toggle.');
    }
    ioSource = ioSource.replace(toggleOriginal, toggleReplacement);

    const moveOriginal = `    if (cameraManager.pointerLockElement || ioManager.jarvisCameraFocus) {\n      cameraManager.handleMouseMove(e);\n    } else {\n      // Pointer movement outside pointer lock never manipulates scene objects.\n    }`;
    const moveReplacement = `    if (cameraManager.pointerLockElement || ioManager.jarvisCameraFocus) {\n      cameraManager.handleMouseMove(e);\n      if (ioManager.jarvisCameraFocus && !cameraManager.pointerLockElement) {\n        const renderer = getRenderer();\n        const rect = renderer.domElement.getBoundingClientRect();\n        const margin = Math.max(36, Math.min(96, Math.min(rect.width, rect.height) * 0.12));\n        const edgeFactor = (value, min, max) => {\n          if (value < min + margin) return -Math.min(1, (min + margin - value) / margin);\n          if (value > max - margin) return Math.min(1, (value - (max - margin)) / margin);\n          return 0;\n        };\n        ioManager.jarvisEdgeLookX = edgeFactor(e.clientX, rect.left, rect.right);\n        ioManager.jarvisEdgeLookY = edgeFactor(e.clientY, rect.top, rect.bottom);\n      } else {\n        ioManager.jarvisEdgeLookX = 0;\n        ioManager.jarvisEdgeLookY = 0;\n      }\n    } else {\n      ioManager.jarvisEdgeLookX = 0;\n      ioManager.jarvisEdgeLookY = 0;\n      // Pointer movement outside camera focus never manipulates scene objects.\n    }`;
    if (!ioSource.includes(moveOriginal)) {
      throw new Error('Unable to locate Jarvis soft-focus mousemove block.');
    }
    ioSource = ioSource.replace(moveOriginal, moveReplacement);
    fs.writeFileSync(ioPath, ioSource, 'utf8');
  }
  console.log('[Jarvis World] edge-steering camera focus installed without native Pointer Lock.');
};

applyPremiumHudOverride();
applyGameplayRuntimeOverrides();

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
console.log(
  `Jarvis Webaverse listening behind the Square HTTPS edge on ${publicHost}:${publicPort}`,
);

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
