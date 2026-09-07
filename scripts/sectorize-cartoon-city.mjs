#!/usr/bin/env node
/**
 * Derive Webaverse-friendly sectors from the licensed ITHappy Cartoon City
 * Free demo. The layout comes exclusively from the demo scene's root nodes;
 * no streets, buildings or transforms are invented here.
 *
 * The output uses .gltf + compact sector .bin files and a single shared texture
 * directory. External texture URIs are local and content-addressed, avoiding a
 * 20 MB texture copy in every sector. This script is a development tool only.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const requireFromActivity = createRequire(path.resolve('activity3d/package.json'));
const sharp = requireFromActivity('sharp');

const EXPECTED_SOURCE_SHA256 = '689E0DE8BCAF27566170F2CBA646203BDF01B39622D546736F037A0BABB07EEC';
const EXPECTED_SOURCE_NAME = 'Cartoon_City_Free.glb';
const outputRoot = path.resolve('activity3d/public/assets/jarvis-world/3d/cartoon-city-free-v1');

const parseArgs = () => {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--source') {
    throw new Error('Usage: node webaverse/scripts/sectorize-cartoon-city.mjs --source <licensed-demo.glb>');
  }
  return path.resolve(args[1]);
};

const clone = value => JSON.parse(JSON.stringify(value));
const pad4 = value => (4 - (value % 4)) % 4;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

const readGlb = source => {
  const bytes = fs.readFileSync(source);
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('The source must be a GLB.');
  }
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error('The source must be a complete glTF 2.0 GLB.');
  }
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Missing GLB JSON chunk.');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  const binHeader = 20 + jsonLength + pad4(jsonLength);
  if (bytes.readUInt32LE(binHeader + 4) !== 0x004e4942) throw new Error('Missing GLB BIN chunk.');
  return {json, bin: bytes.subarray(binHeader + 8, binHeader + 8 + bytes.readUInt32LE(binHeader))};
};

const textureInfos = material => [
  material.pbrMetallicRoughness?.baseColorTexture,
  material.pbrMetallicRoughness?.metallicRoughnessTexture,
  material.normalTexture,
  material.occlusionTexture,
  material.emissiveTexture,
].filter(Boolean);

const collectNodeMeshes = (gltf, roots) => {
  const meshes = new Set();
  const walk = index => {
    const node = gltf.nodes[index];
    if (node.mesh !== undefined) meshes.add(node.mesh);
    for (const child of node.children || []) walk(child);
  };
  roots.forEach(walk);
  return meshes;
};

const sectorFor = ([x, , z]) => {
  const column = x < -20 ? 'west' : x < 20 ? 'center' : 'east';
  const row = z < -37.5 ? 'south' : z < 0 ? 'south-central' : z < 37.5 ? 'north-central' : 'north';
  return `${row}-${column}`;
};

const addAligned = (chunks, value) => {
  const offset = chunks.bytes;
  chunks.parts.push(value);
  chunks.bytes += value.length;
  const padding = pad4(chunks.bytes);
  if (padding) {
    chunks.parts.push(Buffer.alloc(padding));
    chunks.bytes += padding;
  }
  return offset;
};

const remapTextureInfo = (info, textureMap) => {
  if (info?.index !== undefined) info.index = textureMap.get(info.index);
};

const writeSector = ({gltf, bin, id, roots, sharedImages}) => {
  const usedMeshIds = collectNodeMeshes(gltf, roots);
  const usedMaterialIds = new Set();
  const usedAccessorIds = new Set();
  for (const meshId of usedMeshIds) {
    for (const primitive of gltf.meshes[meshId].primitives) {
      if (primitive.material !== undefined) usedMaterialIds.add(primitive.material);
      if (primitive.indices !== undefined) usedAccessorIds.add(primitive.indices);
      Object.values(primitive.attributes || {}).forEach(accessor => usedAccessorIds.add(accessor));
      for (const target of primitive.targets || []) Object.values(target).forEach(accessor => usedAccessorIds.add(accessor));
    }
  }

  const usedTextureIds = new Set();
  for (const materialId of usedMaterialIds) textureInfos(gltf.materials[materialId]).forEach(info => usedTextureIds.add(info.index));
  const usedImageIds = new Set([...usedTextureIds].map(textureId => gltf.textures[textureId].source));
  const usedSamplerIds = new Set([...usedTextureIds].map(textureId => gltf.textures[textureId].sampler).filter(value => value !== undefined));
  const usedBufferViewIds = new Set([...usedAccessorIds].map(accessorId => gltf.accessors[accessorId].bufferView));

  const chunks = {parts: [], bytes: 0};
  const bufferViewMap = new Map();
  for (const oldId of [...usedBufferViewIds].sort((a, b) => a - b)) {
    const old = gltf.bufferViews[oldId];
    const next = clone(old);
    next.buffer = 0;
    next.byteOffset = addAligned(chunks, bin.subarray(old.byteOffset || 0, (old.byteOffset || 0) + old.byteLength));
    bufferViewMap.set(oldId, bufferViewMap.size);
    chunks.bufferViews ??= [];
    chunks.bufferViews.push(next);
  }

  const accessorMap = new Map();
  const accessors = [];
  for (const oldId of [...usedAccessorIds].sort((a, b) => a - b)) {
    const next = clone(gltf.accessors[oldId]);
    next.bufferView = bufferViewMap.get(next.bufferView);
    accessorMap.set(oldId, accessors.length);
    accessors.push(next);
  }

  const materialMap = new Map();
  const materials = [];
  const textureMap = new Map();
  const textures = [];
  const imageMap = new Map();
  const images = [];
  const samplerMap = new Map();
  const samplers = [];
  for (const oldTextureId of [...usedTextureIds].sort((a, b) => a - b)) {
    const oldTexture = clone(gltf.textures[oldTextureId]);
    const oldImageId = oldTexture.source;
    if (!imageMap.has(oldImageId)) {
      imageMap.set(oldImageId, images.length);
      images.push({uri: `shared/${sharedImages.get(oldImageId).file}`, mimeType: sharedImages.get(oldImageId).mimeType});
    }
    oldTexture.source = imageMap.get(oldImageId);
    if (oldTexture.sampler !== undefined) {
      const oldSamplerId = oldTexture.sampler;
      if (!samplerMap.has(oldSamplerId)) {
        samplerMap.set(oldSamplerId, samplers.length);
        samplers.push(clone(gltf.samplers[oldSamplerId]));
      }
      oldTexture.sampler = samplerMap.get(oldSamplerId);
    }
    textureMap.set(oldTextureId, textures.length);
    textures.push(oldTexture);
  }
  for (const oldMaterialId of [...usedMaterialIds].sort((a, b) => a - b)) {
    const material = clone(gltf.materials[oldMaterialId]);
    textureInfos(material).forEach(info => remapTextureInfo(info, textureMap));
    materialMap.set(oldMaterialId, materials.length);
    materials.push(material);
  }

  const meshMap = new Map();
  const meshes = [];
  for (const oldMeshId of [...usedMeshIds].sort((a, b) => a - b)) {
    const mesh = clone(gltf.meshes[oldMeshId]);
    for (const primitive of mesh.primitives) {
      if (primitive.indices !== undefined) primitive.indices = accessorMap.get(primitive.indices);
      if (primitive.material !== undefined) primitive.material = materialMap.get(primitive.material);
      for (const [semantic, accessor] of Object.entries(primitive.attributes || {})) primitive.attributes[semantic] = accessorMap.get(accessor);
      for (const target of primitive.targets || []) for (const [semantic, accessor] of Object.entries(target)) target[semantic] = accessorMap.get(accessor);
    }
    meshMap.set(oldMeshId, meshes.length);
    meshes.push(mesh);
  }

  const nodeMap = new Map();
  const nodes = [];
  const copyNode = oldId => {
    if (nodeMap.has(oldId)) return nodeMap.get(oldId);
    const node = clone(gltf.nodes[oldId]);
    delete node.children;
    if (node.mesh !== undefined) node.mesh = meshMap.get(node.mesh);
    const nextId = nodes.length;
    nodeMap.set(oldId, nextId);
    nodes.push(node);
    const children = (gltf.nodes[oldId].children || []).map(copyNode);
    if (children.length) node.children = children;
    return nextId;
  };
  const sceneRoots = roots.map(copyNode);
  const document = {
    asset: {version: '2.0', generator: 'Jarvis Cartoon City sectorizer v1'},
    extensionsUsed: gltf.extensionsUsed,
    scenes: [{name: `Cartoon City Free — ${id}`, nodes: sceneRoots}],
    scene: 0,
    nodes,
    meshes,
    materials,
    textures,
    images,
    samplers,
    accessors,
    bufferViews: chunks.bufferViews || [],
    buffers: [{uri: `${id}.bin`, byteLength: chunks.bytes}],
  };
  return {document, buffer: Buffer.concat(chunks.parts, chunks.bytes), stats: {nodes: nodes.length, meshes: meshes.length, materials: materials.length, textures: textures.length, bytes: chunks.bytes}};
};

const main = async () => {
  const source = parseArgs();
  if (path.basename(source) !== EXPECTED_SOURCE_NAME) throw new Error(`Expected ${EXPECTED_SOURCE_NAME}.`);
  const sourceHash = hash(fs.readFileSync(source)).toUpperCase();
  if (sourceHash !== EXPECTED_SOURCE_SHA256) throw new Error('The licensed source hash does not match Cartoon City Free v1.0.');
  if (fs.existsSync(outputRoot)) throw new Error(`Refusing to overwrite existing output: ${outputRoot}`);

  const {json: gltf, bin} = readGlb(source);
  if ((gltf.animations || []).length || (gltf.skins || []).length || (gltf.cameras || []).length || gltf.extensions?.KHR_lights_punctual) {
    throw new Error('The static city sectorizer does not accept animated, skinned, camera, or light data.');
  }
  const roots = gltf.scenes?.[gltf.scene || 0]?.nodes;
  if (!roots?.length) throw new Error('The demo GLB has no active scene roots.');

  fs.mkdirSync(path.join(outputRoot, 'shared'), {recursive: true});
  const sharedImages = new Map();
  const writtenImages = new Map();
  for (const [index, image] of (gltf.images || []).entries()) {
    const view = gltf.bufferViews[image.bufferView];
    const sourceImage = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const sourceHash = hash(sourceImage);
    const preservePng = /Normal|Roughness/i.test(image.name || '');
    const extension = preservePng ? 'png' : 'webp';
    const file = `${sourceHash.slice(0, 16)}.${extension}`;
    if (!writtenImages.has(file)) {
      const output = path.join(outputRoot, 'shared', file);
      if (preservePng) fs.writeFileSync(output, sourceImage);
      else await sharp(sourceImage).webp({quality: 86, effort: 4}).toFile(output);
      writtenImages.set(file, true);
    }
    sharedImages.set(index, {file, mimeType: preservePng ? 'image/png' : 'image/webp'});
  }

  const sectorRoots = new Map();
  for (const root of roots) {
    const node = gltf.nodes[root];
    const id = sectorFor(node.translation || [0, 0, 0]);
    const bucket = sectorRoots.get(id) || [];
    bucket.push(root);
    sectorRoots.set(id, bucket);
  }
  const manifest = {
    schemaVersion: 1,
    source: {file: EXPECTED_SOURCE_NAME, sha256: sourceHash, version: '1.0'},
    coordinateSystem: 'ITHappy demo scene, metres, unchanged transforms',
    sectors: [],
    sharedTextures: [],
  };
  for (const [id, rootsForSector] of [...sectorRoots].sort(([left], [right]) => left.localeCompare(right))) {
    const sector = writeSector({gltf, bin, id, roots: rootsForSector, sharedImages});
    fs.writeFileSync(path.join(outputRoot, `${id}.gltf`), JSON.stringify(sector.document));
    fs.writeFileSync(path.join(outputRoot, `${id}.bin`), sector.buffer);
    manifest.sectors.push({id, gltf: `${id}.gltf`, bin: `${id}.bin`, rootNodes: rootsForSector.length, ...sector.stats});
  }
  for (const [sourceImage, value] of sharedImages) manifest.sharedTextures.push({sourceImage, ...value});
  fs.writeFileSync(path.join(outputRoot, 'city-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({outputRoot, sectors: manifest.sectors, sharedTextures: manifest.sharedTextures}, null, 2));
};

await main();
