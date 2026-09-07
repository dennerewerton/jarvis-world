#!/usr/bin/env node
/**
 * Inspect a GLB produced from the licensed Cartoon City Free demo.
 *
 * This is intentionally an inspector, not an optimizer or publisher. It keeps
 * the source out of runtime and gives the reviewer the metrics needed to decide
 * whether to split the city into sectors before it is allowed into the scene.
 */
import fs from 'node:fs';
import path from 'node:path';

const usage = () => {
  console.error('Usage: node webaverse/scripts/inspect-cartoon-city-glb.mjs <licensed-demo.glb>');
  process.exitCode = 2;
};

const input = process.argv[2];
if (!input || process.argv.length !== 3) usage();

const source = path.resolve(input);
if (path.extname(source).toLowerCase() !== '.glb' || !fs.existsSync(source)) {
  throw new Error(`Expected an existing .glb file: ${source}`);
}

const bytes = fs.readFileSync(source);
if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') {
  throw new Error('The input is not a binary glTF (GLB) file.');
}
const version = bytes.readUInt32LE(4);
const declaredLength = bytes.readUInt32LE(8);
const jsonChunkLength = bytes.readUInt32LE(12);
const jsonChunkType = bytes.readUInt32LE(16);
if (version !== 2 || declaredLength !== bytes.length || jsonChunkType !== 0x4e4f534a) {
  throw new Error('Expected a complete glTF 2.0 GLB with a JSON chunk.');
}
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonChunkLength));
const primitiveStats = (gltf.meshes || []).flatMap(mesh => mesh.primitives || []);
const triangles = primitiveStats.reduce((total, primitive) => {
  const accessor = gltf.accessors?.[primitive.indices];
  return total + (accessor?.count ? Math.floor(accessor.count / 3) : 0);
}, 0);
const images = gltf.images || [];
const externalUris = [
  ...(gltf.buffers || []).map(buffer => buffer.uri),
  ...images.map(image => image.uri),
].filter(Boolean);

console.log(JSON.stringify({
  schemaVersion: 1,
  source,
  bytes: bytes.length,
  gltfVersion: gltf.asset?.version,
  scenes: gltf.scenes?.length || 0,
  nodes: gltf.nodes?.length || 0,
  meshes: gltf.meshes?.length || 0,
  primitives: primitiveStats.length,
  triangles,
  materials: gltf.materials?.length || 0,
  textures: gltf.textures?.length || 0,
  images: images.length,
  animations: gltf.animations?.length || 0,
  cameras: gltf.cameras?.length || 0,
  lights: gltf.extensions?.KHR_lights_punctual?.lights?.length || 0,
  externalUris,
  selfContained: externalUris.length === 0,
}, null, 2));
