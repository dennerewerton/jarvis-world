import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {createGateway, loadGatewayConfig} from './https-gateway.mjs';

const runtimeRoot = process.cwd();

const stabilizeWorldStartup = () => {
  const universePath = path.join(runtimeRoot, 'universe.js');
  const appPath = path.join(runtimeRoot, 'src', 'components', 'app', 'App.jsx');

  let universeSource = fs.readFileSync(universePath, 'utf8');
  const multiplayerWorldSpec = 'return {src: JARVIS_SHARED_SCENE, room: JARVIS_SHARED_ROOM};';
  const localWorldSpec = 'return {src: JARVIS_SHARED_SCENE};';

  // The shared-room path does not create the city locally. It waits for WSRTC to
  // populate world.appManager after the websocket opens. When Discord/Square does
  // not complete that hand-off, React/HUD stays alive over an empty transparent
  // WebGL canvas. Boot the authored city locally first; multiplayer can be layered
  // back on only after the room hand-off is made non-destructive.
  if (universeSource.includes(multiplayerWorldSpec)) {
    universeSource = universeSource.replace(multiplayerWorldSpec, localWorldSpec);
  } else if (!universeSource.includes(localWorldSpec)) {
    throw new Error('Unable to locate the Jarvis shared-world resolver in universe.js');
  }
  fs.writeFileSync(universePath, universeSource, 'utf8');

  // Awaiting the scene load is useful for diagnostics, but App.jsx is rewritten by
  // several validated runtime patches and its whitespace/body can legitimately vary.
  // Never make the deploy depend on an exact source-text match. Local city routing
  // above is the actual white-screen recovery; this instrumentation is best-effort.
  let appSource = fs.readFileSync(appPath, 'utf8');
  if (!appSource.includes('await jarvisWorldLoadPromise;')) {
    const worldStartupPattern = /universe\.handleUrlUpdate\(\);\s*await weba\.startLoop\(\);/;
    if (worldStartupPattern.test(appSource)) {
      appSource = appSource.replace(
        worldStartupPattern,
        'const jarvisWorldLoadPromise = universe.handleUrlUpdate();\n    await weba.startLoop();\n    await jarvisWorldLoadPromise;',
      );
      fs.writeFileSync(appPath, appSource, 'utf8');
      console.log('[Jarvis World] world-load diagnostics attached to App.jsx startup.');
    } else {
      console.warn('[Jarvis World] App.jsx world-load diagnostics skipped; deterministic local city routing remains active.');
    }
  }

  console.log('[Jarvis World] deterministic local city routing installed before HUD/camera overrides.');
};

const installMobileRuntimeProxies = () => {
  // JarvisPremiumHud is imported by App.jsx during the UI bootstrap. Importing the
  // full io/game/camera singleton graph from that HUD at module-evaluation time can
  // re-enter Webaverse's player/avatar/renderer dependency chain. Keep the static
  // HUD graph lightweight and resolve canonical gameplay modules only on first touch.
  const ioProxyPath = path.join(runtimeRoot, 'jarvis-mobile-io-proxy.js');
  const gameProxyPath = path.join(runtimeRoot, 'jarvis-mobile-game-proxy.js');
  const cameraProxyPath = path.join(runtimeRoot, 'jarvis-mobile-camera-proxy.js');

  fs.writeFileSync(ioProxyPath, `let runtime = null;
let runtimePromise = null;
const shadowKeys = {up:false,down:false,left:false,right:false,shift:false,space:false};
const loadRuntime = () => {
  if (runtime) return Promise.resolve(runtime);
  if (!runtimePromise) {
    runtimePromise = import('./io-manager.js').then(module => {
      runtime = module.default;
      Object.assign(runtime.keys, shadowKeys);
      return runtime;
    }).catch(error => {
      runtimePromise = null;
      console.error('[Jarvis World] mobile input runtime failed to load:', error);
      throw error;
    });
  }
  return runtimePromise;
};
const keys = new Proxy(shadowKeys, {
  get(target, key) {
    return runtime?.keys?.[key] ?? target[key];
  },
  set(target, key, value) {
    target[key] = value;
    if (runtime?.keys) {
      runtime.keys[key] = value;
    } else {
      void loadRuntime().then(ioManager => {
        ioManager.keys[key] = target[key];
      }).catch(() => {});
    }
    return true;
  },
});
export default {keys};
`, 'utf8');

  fs.writeFileSync(gameProxyPath, `let runtime = null;
let runtimePromise = null;
const loadRuntime = () => {
  if (runtime) return Promise.resolve(runtime);
  if (!runtimePromise) {
    runtimePromise = import('./game.js').then(module => {
      runtime = module.default;
      return runtime;
    }).catch(error => {
      runtimePromise = null;
      console.error('[Jarvis World] mobile game runtime failed to load:', error);
      throw error;
    });
  }
  return runtimePromise;
};
const invoke = (method, args = []) => {
  if (runtime && typeof runtime[method] === 'function') return runtime[method](...args);
  void loadRuntime().then(game => {
    if (typeof game[method] === 'function') game[method](...args);
  }).catch(() => {});
  return undefined;
};
export default {
  isJumping() { return runtime?.isJumping?.() ?? false; },
  isDoubleJumping() { return runtime?.isDoubleJumping?.() ?? false; },
  jump(...args) { return invoke('jump', args); },
  doubleJump(...args) { return invoke('doubleJump', args); },
};
`, 'utf8');

  fs.writeFileSync(cameraProxyPath, `let runtime = null;
let runtimePromise = null;
const loadRuntime = () => {
  if (runtime) return Promise.resolve(runtime);
  if (!runtimePromise) {
    runtimePromise = import('./camera-manager.js').then(module => {
      runtime = module.default;
      return runtime;
    }).catch(error => {
      runtimePromise = null;
      console.error('[Jarvis World] mobile camera runtime failed to load:', error);
      throw error;
    });
  }
  return runtimePromise;
};
export default {
  handleMouseMove(event) {
    if (runtime) return runtime.handleMouseMove(event);
    void loadRuntime().then(cameraManager => cameraManager.handleMouseMove(event)).catch(() => {});
    return undefined;
  },
};
`, 'utf8');

  console.log('[Jarvis World] installed lazy mobile gameplay runtime proxies.');
};

const applyPremiumHudOverride = () => {
  const sourceUrl = new URL('./runtime-overrides/JarvisPremiumHud.jsx', import.meta.url);
  const targetPath = path.join(runtimeRoot, 'src', 'JarvisPremiumHud.jsx');
  const appPath = path.join(runtimeRoot, 'src', 'components', 'app', 'App.jsx');

  let hudSource = fs.readFileSync(sourceUrl, 'utf8');
  const replacements = [
    ["../../.webaverse-runtime/src/components/app", './components/app'],
    ["../../.webaverse-runtime/src/jarvis-compat/ActivityShell.jsx", './jarvis-compat/ActivityShell.jsx'],
    ["../../.webaverse-runtime/io-manager.js", '../jarvis-mobile-io-proxy.js'],
    ["../../.webaverse-runtime/game.js", '../jarvis-mobile-game-proxy.js'],
    ["../../.webaverse-runtime/camera-manager.js", '../jarvis-mobile-camera-proxy.js'],
  ];
  for (const [from, to] of replacements) {
    if (!hudSource.includes(from)) {
      throw new Error(`Unable to locate Jarvis HUD runtime dependency: ${from}`);
    }
    hudSource = hudSource.replace(from, to);
  }

  // Discord Desktop can expose touch/coarse-pointer media features even when the
  // actual client is a Windows desktop. Require an explicit mobile/iPad UA signal
  // so the touch HUD cannot accidentally replace the desktop HUD inside the iframe.
  const broadMobileGate = 'return touch && (uaMobile || ipad || (coarse && noHover));';
  const strictMobileGate = 'return touch && (uaMobile || ipad);';
  if (hudSource.includes(broadMobileGate)) {
    hudSource = hudSource.replace(broadMobileGate, strictMobileGate);
  } else if (!hudSource.includes(strictMobileGate)) {
    throw new Error('Unable to locate Jarvis mobile-device gate.');
  }

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
  console.log('[Jarvis World] premium HUD runtime override installed with isolated gameplay imports.');
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
  console.log('[Jarvis World] standalone edge-steering camera runtime installed in lazy singleton mode.');
};

stabilizeWorldStartup();
installMobileRuntimeProxies();
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
