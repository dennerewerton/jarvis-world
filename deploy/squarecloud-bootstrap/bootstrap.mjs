import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const upstreamRepository = 'https://github.com/webaverse/app.git';
const upstreamRevision = '561630539fe2055c117309c3d24c2cfc4d6763d5';
const release = 'fw70-pilot-2026-09-08.86';
const deploymentRoot = path.resolve('.');
const runtimeRoot = path.join(deploymentRoot, '.webaverse-runtime');
const patchesRoot = path.join(deploymentRoot, 'patches');
const cityAssetsRoot = path.join(deploymentRoot, 'city-assets');
const lastValidatedRuntimePatch = '0069-enable-activity-drag-camera.patch';
const readyMarker = path.join(runtimeRoot, `.ready-${release}`);

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {stdio: 'inherit', ...options});
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`${command} exited with ${signal || code}`));
    }
  });
});

const patchThreeRoot = threeRoot => {
  const threeModulePath = path.join(threeRoot, 'build', 'three.module.js');
  if (!fs.existsSync(threeModulePath)) return false;

  let source = fs.readFileSync(threeModulePath, 'utf8');
  const shimMarker = 'class CapsuleGeometry extends CylinderGeometry';
  if (!source.includes(shimMarker)) {
    const exportIndex = source.lastIndexOf('export {');
    if (exportIndex < 0) {
      throw new Error(`Unable to locate the Three ESM export block at ${threeModulePath}.`);
    }

    const shim = `
// Jarvis compatibility: Webaverse pins Three r134, which does not export
// THREE.CapsuleGeometry. Some runtime/client paths can still request it.
class CapsuleGeometry extends CylinderGeometry {
  constructor(radius = 1, length = 1, capSegments = 4, radialSegments = 8) {
    const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 1;
    const safeLength = Number.isFinite(length) ? Math.max(0, length) : 1;
    const safeRadialSegments = Number.isFinite(radialSegments)
      ? Math.max(3, Math.floor(radialSegments))
      : 8;
    super(
      safeRadius,
      safeRadius,
      safeLength + safeRadius * 2,
      safeRadialSegments,
      1,
      false,
    );
    this.type = 'CapsuleGeometry';
    this.parameters = {
      radius: safeRadius,
      length: safeLength,
      capSegments,
      radialSegments: safeRadialSegments,
    };
  }
}

`;

    source = `${source.slice(0, exportIndex)}${shim}${source.slice(exportIndex)}`;
    const patchedExportIndex = source.lastIndexOf('export {');
    source = `${source.slice(0, patchedExportIndex + 'export {'.length)} CapsuleGeometry,${source.slice(patchedExportIndex + 'export {'.length)}`;
    fs.writeFileSync(threeModulePath, source, 'utf8');
  }

  const verified = fs.readFileSync(threeModulePath, 'utf8');
  if (!verified.includes(shimMarker) || !verified.includes('export { CapsuleGeometry,')) {
    throw new Error(`Three CapsuleGeometry compatibility shim was not installed at ${threeModulePath}.`);
  }

  const threeUmdPath = path.join(threeRoot, 'build', 'three.js');
  if (fs.existsSync(threeUmdPath)) {
    let umd = fs.readFileSync(threeUmdPath, 'utf8');
    const umdMarker = 'exports.CapsuleGeometry = CapsuleGeometry;';
    if (!umd.includes(umdMarker)) {
      const cylinderExport = 'exports.CylinderGeometry = CylinderGeometry;';
      const cylinderExportIndex = umd.lastIndexOf(cylinderExport);
      if (cylinderExportIndex >= 0) {
        const shim = `
	// Jarvis compatibility for Three r134.
	class CapsuleGeometry extends CylinderGeometry {
		constructor(radius = 1, length = 1, capSegments = 4, radialSegments = 8) {
			const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 1;
			const safeLength = Number.isFinite(length) ? Math.max(0, length) : 1;
			const safeRadialSegments = Number.isFinite(radialSegments) ? Math.max(3, Math.floor(radialSegments)) : 8;
			super(safeRadius, safeRadius, safeLength + safeRadius * 2, safeRadialSegments, 1, false);
			this.type = 'CapsuleGeometry';
			this.parameters = {radius: safeRadius, length: safeLength, capSegments, radialSegments: safeRadialSegments};
		}
	}

`;
        umd = `${umd.slice(0, cylinderExportIndex)}${shim}${umd.slice(cylinderExportIndex)}`;
        const patchedCylinderExportIndex = umd.lastIndexOf(cylinderExport);
        const afterCylinderExport = patchedCylinderExportIndex + cylinderExport.length;
        umd = `${umd.slice(0, afterCylinderExport)}\n\texports.CapsuleGeometry = CapsuleGeometry;${umd.slice(afterCylinderExport)}`;
        fs.writeFileSync(threeUmdPath, umd, 'utf8');
      }
    }
  }

  return true;
};

const installThreeCapsuleCompat = appRoot => {
  const candidates = [
    path.join(appRoot, 'packages', 'three'),
    path.join(appRoot, 'node_modules', 'three'),
  ];
  const seen = new Set();
  let patched = 0;
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const realPath = fs.realpathSync(candidate);
    if (seen.has(realPath)) continue;
    seen.add(realPath);
    if (patchThreeRoot(candidate)) patched += 1;
  }
  if (!patched) {
    throw new Error('No Three installation was available for CapsuleGeometry compatibility.');
  }
  console.log(`[Jarvis World] installed Three CapsuleGeometry compatibility shim in ${patched} resolved package root(s)`);
};

const hardenRealtimeUpdateDecoding = appRoot => {
  const serverPath = path.join(appRoot, 'packages', 'wsrtc', 'wsrtc-server.mjs');
  let source = fs.readFileSync(serverPath, 'utf8').replace(/\r\n/g, '\n');
  const marker = 'const alignedData = new Uint8Array(byteLength);';
  if (!source.includes(marker)) {
    const original = `          case MESSAGE.STATE_UPDATE: {
            const byteLength = dataView.getUint32(Uint32Array.BYTES_PER_ELEMENT, true);
            const data = new Uint8Array(e.data.buffer, e.data.byteOffset + 2 * Uint32Array.BYTES_PER_ELEMENT, byteLength);
            Z.applyUpdate(room.state, data, playerId);
            break;
          }`;
    const replacement = `          case MESSAGE.STATE_UPDATE: {
            const headerSize = 2 * Uint32Array.BYTES_PER_ELEMENT;
            const byteLength = dataView.getUint32(Uint32Array.BYTES_PER_ELEMENT, true);
            if (byteLength > e.data.byteLength - headerSize) {
              console.warn('rejected invalid realtime state update', {playerId, byteLength});
              ws.close(1008, 'Invalid realtime update');
              break;
            }
            const alignedData = new Uint8Array(byteLength);
            alignedData.set(new Uint8Array(e.data.buffer, e.data.byteOffset + headerSize, byteLength));
            try {
              Z.applyUpdate(room.state, alignedData, playerId);
            } catch (error) {
              console.warn('rejected invalid realtime state update', {playerId, error: error?.message || String(error)});
              ws.close(1008, 'Invalid realtime update');
            }
            break;
          }`;
    if (!source.includes(original)) throw new Error('Unable to locate wsrtc state handler.');
    source = source.replace(original, replacement);
    fs.writeFileSync(serverPath, source, 'utf8');
  }
  if (!fs.readFileSync(serverPath, 'utf8').includes(marker)) {
    throw new Error('Webaverse realtime update hardening was not installed.');
  }
  console.log('[Jarvis World] installed safe realtime update decoding.');
};

const diagnoseTotumSource = appRoot => {
  const target = path.join(appRoot, 'packages', 'totum', 'types', 'jsx.js');
  let source = fs.readFileSync(target, 'utf8');
  if (!source.includes('Totum source unavailable:')) {
    source = source.replace(
      'src = await res.text();',
      `if (!res.ok) throw new Error('Totum source unavailable: ' + res.status + ' ' + id);\n      src = await res.text();`,
    );
    fs.writeFileSync(target, source, 'utf8');
  }
  if (!source.includes('Totum normalized runtime URL')) {
    source = source.replace(
      'const res = await fetch(id);',
      `// Totum normalized runtime URL
      const runtimePrefix = '/application/.webaverse-runtime/';
      const runtimeIndex = id.indexOf(runtimePrefix);
      if (runtimeIndex !== -1) {
        id = id.slice(0, runtimeIndex) + '/' + id.slice(runtimeIndex + runtimePrefix.length);
      }
      const res = await fetch(id);`,
    );
    fs.writeFileSync(target, source, 'utf8');
  }
  console.log('[Jarvis World] installed Totum source diagnostics.');
};

const materializePublicRuntimeImports = appRoot => {
  const publicRoot = path.join(appRoot, 'public');
  const binRoot = path.join(appRoot, 'bin');
  fs.mkdirSync(binRoot, {recursive: true});
  for (const name of ['app-wasm-worker.js', 'app-wasm-worker.wasm', 'geometry.js', 'geometry.wasm', 'geometry.worker.js']) {
    const source = path.join(publicRoot, 'bin', name);
    const target = path.join(binRoot, name);
    if (!fs.existsSync(source)) throw new Error(`Missing public runtime import: ${source}`);
    fs.copyFileSync(source, target);
  }
  const soundSource = path.join(publicRoot, 'sounds', 'sound-files.json');
  const soundTarget = path.join(appRoot, 'sounds', 'sound-files.json');
  if (!fs.existsSync(soundSource)) throw new Error(`Missing public runtime import: ${soundSource}`);
  fs.mkdirSync(path.dirname(soundTarget), {recursive: true});
  fs.copyFileSync(soundSource, soundTarget);
  console.log('[Jarvis World] materialized Vite runtime imports outside public/.');
};

const prepareRuntime = async () => {
  if (fs.existsSync(readyMarker)) return;
  console.log(`[Jarvis World] preparing ${release} through ${lastValidatedRuntimePatch}`);
  if (!fs.existsSync(path.join(patchesRoot, '0010-add-discord-activity-shell.patch'))) {
    throw new Error('Jarvis patch queue is missing from the deployment root.');
  }
  fs.rmSync(runtimeRoot, {recursive: true, force: true});
  fs.mkdirSync(runtimeRoot, {recursive: true});
  await run('git', ['init'], {cwd: runtimeRoot});
  await run('git', ['remote', 'add', 'origin', upstreamRepository], {cwd: runtimeRoot});
  await run('git', ['fetch', '--depth', '1', 'origin', upstreamRevision], {cwd: runtimeRoot});
  await run('git', ['checkout', '--detach', 'FETCH_HEAD'], {cwd: runtimeRoot});
  await run('git', [
    'submodule',
    'update',
    '--init',
    '--recursive',
    '--depth', '1',
  ], {cwd: runtimeRoot});
  const appRoot = runtimeRoot;
  const patches = fs.readdirSync(patchesRoot)
    .filter(name => name.endsWith('.patch') && name <= lastValidatedRuntimePatch)
    .sort();
  for (const patchName of patches) {
    const patchPath = path.join(patchesRoot, patchName);
    await run('git', [
      'apply',
      '--check',
      '--ignore-space-change',
      '--whitespace=nowarn',
      patchPath,
    ], {cwd: appRoot});
    await run('git', [
      'apply',
      '--ignore-space-change',
      '--whitespace=nowarn',
      patchPath,
    ], {cwd: appRoot});
  }

  installThreeCapsuleCompat(appRoot);
  materializePublicRuntimeImports(appRoot);
  hardenRealtimeUpdateDecoding(appRoot);
  diagnoseTotumSource(appRoot);

  const browserCompatPath = path.join(appRoot, 'jarvis-three-compat.js');
  if (!fs.existsSync(browserCompatPath)) {
    throw new Error('Browser Three compatibility module is missing after the Jarvis patch queue.');
  }
  const browserCompatSource = fs.readFileSync(browserCompatPath, 'utf8');
  if (!browserCompatSource.includes('class CapsuleGeometry extends BaseThree.CylinderGeometry')) {
    throw new Error('Browser Three compatibility module does not expose CapsuleGeometry.');
  }

  const characterControllerPath = path.join(appRoot, 'character-controller.js');
  const characterControllerSource = fs.readFileSync(characterControllerPath, 'utf8');
  if (characterControllerSource.includes('THREE.CapsuleGeometry')) {
    throw new Error('Unsupported direct THREE.CapsuleGeometry usage survived in character-controller.js.');
  }
  if (!characterControllerSource.includes(
    'new THREE.CylinderGeometry(0.22, 0.22, 1.36, 8)',
  )) {
    throw new Error('Jarvis remote-player fallback geometry patch is missing from the runtime.');
  }

  if (!fs.existsSync(cityAssetsRoot)) {
    throw new Error('Jarvis local city assets are missing from the deployment root.');
  }
  fs.cpSync(cityAssetsRoot, path.join(appRoot, 'public', 'assets', 'jarvis-world', '3d'), {
    recursive: true,
  });
  const totumRoot = path.join(appRoot, 'packages', 'totum');
  const totumPatchesRoot = path.join(patchesRoot, 'totum');
  const totumPatches = fs.readdirSync(totumPatchesRoot)
    .filter(name => name.endsWith('.patch'))
    .sort();
  for (const patchName of totumPatches) {
    const patchPath = path.join(totumPatchesRoot, patchName);
    await run('git', [
      'apply',
      '--check',
      '--ignore-space-change',
      '--whitespace=nowarn',
      patchPath,
    ], {cwd: totumRoot});
    await run('git', [
      'apply',
      '--ignore-space-change',
      '--whitespace=nowarn',
      patchPath,
    ], {cwd: totumRoot});
  }
  await run(process.execPath, ['--check', 'io-manager.js'], {cwd: appRoot});
  await run('npm', [
    'install',
    '--legacy-peer-deps',
    '--include=dev',
    '--no-audit',
    '--no-fund',
  ], {cwd: appRoot});

  installThreeCapsuleCompat(appRoot);

  await run(process.execPath, [
    '--input-type=module',
    '--eval',
    `import * as THREE from 'three';
if (typeof THREE.CapsuleGeometry !== 'function') {
  throw new Error('Resolved Three package does not export CapsuleGeometry');
}
const geometry = new THREE.CapsuleGeometry(0.22, 0.92, 4, 8);
if (!geometry || geometry.type !== 'CapsuleGeometry') {
  throw new Error('Resolved Three CapsuleGeometry constructor failed');
}
console.log('[Jarvis World] verified resolved Three CapsuleGeometry constructor');`,
  ], {cwd: appRoot});

  fs.writeFileSync(readyMarker, `${release}\n`, {encoding: 'utf8', flag: 'wx'});
};

await prepareRuntime();

const appRoot = runtimeRoot;
const startScript = path.join(
  deploymentRoot,
  'deploy',
  'squarecloud-start.mjs',
);
const runtime = spawn(process.execPath, [startScript], {
  cwd: appRoot,
  env: process.env,
  stdio: 'inherit',
});
runtime.once('error', error => {
  console.error(`Unable to launch the pinned Jarvis runtime: ${error.message}`);
  process.exitCode = 1;
});
runtime.once('exit', (code, signal) => {
  if (signal) console.error(`Pinned Jarvis runtime stopped by ${signal}.`);
  process.exit(code || (signal ? 1 : 0));
});

const stop = () => {
  if (!runtime.killed) runtime.kill('SIGTERM');
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
