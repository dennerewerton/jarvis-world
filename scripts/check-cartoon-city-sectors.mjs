#!/usr/bin/env node
/** Validate the reproducible Cartoon City Free runtime derivative. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(projectRoot, 'activity3d/public/assets/jarvis-world/3d/cartoon-city-free-v1');
const manifestPath = path.join(root, 'city-manifest.json');
const failures = [];
const isSafeRelative = value => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.includes('..') && !value.includes('\\');
const requireFile = relative => {
  if (!isSafeRelative(relative) || !fs.existsSync(path.join(root, relative))) failures.push(`Missing or unsafe runtime file: ${relative}`);
};

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Missing Cartoon City manifest: ${manifestPath}`);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || manifest.source?.version !== '1.0') failures.push('Unexpected city manifest version.');
if (!/^[A-F0-9]{64}$/.test(manifest.source?.sha256 || '')) failures.push('The licensed source SHA-256 is missing.');
if (!Array.isArray(manifest.sectors) || manifest.sectors.length !== 12) failures.push('Expected exactly 12 demo-derived sectors.');
const shared = new Set((manifest.sharedTextures || []).map(entry => `shared/${entry.file}`));
for (const texture of shared) requireFile(texture);

for (const sector of manifest.sectors || []) {
  if (!/^(north|north-central|south-central|south)-(west|center|east)$/.test(sector.id || '')) failures.push(`Invalid sector id: ${sector.id}`);
  requireFile(sector.gltf);
  requireFile(sector.bin);
  const gltfPath = path.join(root, sector.gltf || '');
  if (!fs.existsSync(gltfPath)) continue;
  const gltf = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
  if (gltf.asset?.version !== '2.0') failures.push(`${sector.id}: not glTF 2.0.`);
  if (gltf.animations?.length || gltf.skins?.length || gltf.cameras?.length || gltf.extensions?.KHR_lights_punctual?.lights?.length) failures.push(`${sector.id}: contains unsupported dynamic authoring data.`);
  if (gltf.buffers?.length !== 1 || gltf.buffers[0]?.uri !== sector.bin) failures.push(`${sector.id}: must use exactly its declared local BIN.`);
  for (const image of gltf.images || []) {
    if (!shared.has(image.uri)) failures.push(`${sector.id}: image does not use an approved shared local texture: ${image.uri}`);
  }
  if ((gltf.nodes?.length || 0) !== sector.nodes || (gltf.meshes?.length || 0) !== sector.meshes || (gltf.materials?.length || 0) !== sector.materials || (gltf.textures?.length || 0) !== sector.textures) {
    failures.push(`${sector.id}: manifest structural metrics differ.`);
  }
}
if (failures.length) throw new Error(failures.join('\n'));
console.log(`Cartoon City sectors: ${manifest.sectors.length}; shared textures: ${shared.size}; validation failures: 0`);
