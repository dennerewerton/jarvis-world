import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const deployRoot = fileURLToPath(new URL('../', import.meta.url));
const upstream = process.argv[2];
if (!upstream) throw new Error('Usage: node scripts/validate-runtime-patch-queue.mjs UPSTREAM_CHECKOUT');
const bootstrap = fs.readFileSync(path.join(deployRoot, 'deploy/squarecloud-bootstrap/bootstrap.mjs'), 'utf8');
const revision = bootstrap.match(/const upstreamRevision = '([^']+)';/)[1];
const lastPatch = bootstrap.match(/const lastValidatedRuntimePatch = '([^']+)';/)[1];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-patch-queue-'));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {maxBuffer: 256 * 1024 * 1024, ...options});
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')}: ${result.error || result.stderr?.toString()}`);
  }
  return result.stdout;
}
try {
  const archive = path.join(scratch, 'upstream.tar');
  run('git', ['-C', path.resolve(upstream), 'archive', '--output', archive, revision]);
  run('tar', ['-xf', archive, '-C', scratch]);
  fs.unlinkSync(archive);
  // A separate repository prevents git apply from discovering the deploy repo.
  run('git', ['init', scratch]);
  const patches = fs.readdirSync(path.join(deployRoot, 'patches'))
    .filter(name => name.endsWith('.patch') && name <= lastPatch).sort();
  for (const name of patches) {
    // Mirror Linux checkout semantics for old mixed-CRLF patch files on Windows.
    const input = fs.readFileSync(path.join(deployRoot, 'patches', name), 'utf8').replace(/\r\n/g, '\n');
    const args = ['-C', scratch, 'apply', '--ignore-space-change', '--whitespace=nowarn'];
    run('git', [...args, '--check', '-'], {input});
    run('git', [...args, '-'], {input});
  }
  for (const name of ['players-manager.js', 'player-avatar-binding.js']) {
    run(process.execPath, ['--check', path.join(scratch, name)]);
  }
  console.log(`PASS: ${patches.length} patches applied in order to ${revision}, through ${lastPatch}.`);
  console.log('This validates patch application and JavaScript syntax, not browser startup.');
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}
