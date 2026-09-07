import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const upstreamRepository = 'https://github.com/webaverse/app.git';
const upstreamRevision = '561630539fe2055c117309c3d24c2cfc4d6763d5';
const release = 'fw70-pilot-2026-09-07.55';
const deploymentRoot = path.resolve('.');
const runtimeRoot = path.join(deploymentRoot, '.webaverse-runtime');
const patchesRoot = path.join(deploymentRoot, 'patches');
const cityAssetsRoot = path.join(deploymentRoot, 'city-assets');
const lastValidatedRuntimePatch = '0052-isolate-dashboard-runtime.patch';
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
