import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const upstreamRepository = 'https://github.com/webaverse/app.git';
const upstreamRevision = '561630539fe2055c117309c3d24c2cfc4d6763d5';
const release = 'fw70-pilot-2026-09-07.65';
const deploymentRoot = path.resolve('.');
const runtimeRoot = path.join(deploymentRoot, '.webaverse-runtime');
const patchesRoot = path.join(deploymentRoot, 'patches');
const cityAssetsRoot = path.join(deploymentRoot, 'city-assets');
const lastValidatedRuntimePatch = '0058-normalize-player-runtime-module-chain.patch';
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

const installThreeCapsuleCompat = appRoot => {
  const threeModulePath = path.join(appRoot, 'packages', 'three', 'build', 'three.module.js');
  if (!fs.existsSync(threeModulePath)) {
    throw new Error('Pinned Three ESM build is missing from the Webaverse runtime.');
  }

  let source = fs.readFileSync(threeModulePath, 'utf8');
  const shimMarker = 'class CapsuleGeometry extends CylinderGeometry';
  if (!source.includes(shimMarker)) {
    const exportIndex = source.lastIndexOf('export {');
    if (exportIndex < 0) {
      throw new Error('Unable to locate the Three ESM export block for CapsuleGeometry compatibility.');
    }

    const shim = `
// Jarvis compatibility: Webaverse pins Three r134, which does not export
// THREE.CapsuleGeometry. Some runtime/client paths can still request it.
// Keep the public constructor available without upgrading the renderer stack.
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
    throw new Error('Three CapsuleGeometry compatibility shim was not installed correctly.');
  }

  // Vite uses the ESM build above, but also keep the CommonJS/UMD entry safe for
  // packages that resolve Three through package.json "main" during startup.
  const threeUmdPath = path.join(appRoot, 'packages', 'three', 'build', 'three.js');
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

  console.log('[Jarvis World] installed Three CapsuleGeometry compatibility shim');
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
    // Square Cloud keeps application storage between deploys. Do not allow a
    // stale or partially uploaded future patch from an older ZIP to execute.
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

  // The pinned Webaverse renderer uses Three r134. Install a compatibility
  // constructor at the dependency boundary so any remaining legacy or cached
  // module that asks for THREE.CapsuleGeometry cannot crash the Activity.
  installThreeCapsuleCompat(appRoot);

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

  const installedThreeModulePath = path.join(
    appRoot,
    'node_modules',
    'three',
    'build',
    'three.module.js',
  );
  if (
    !fs.existsSync(installedThreeModulePath)
    || !fs.readFileSync(installedThreeModulePath, 'utf8').includes(
      'class CapsuleGeometry extends CylinderGeometry',
    )
  ) {
    throw new Error('Installed Three package lost the Jarvis CapsuleGeometry compatibility shim.');
  }

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
