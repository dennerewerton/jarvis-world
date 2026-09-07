import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptRoot, '..', '..');
const cityRoot = path.join(
  repositoryRoot,
  'activity3d',
  'public',
  'assets',
  'jarvis-world',
  '3d',
  'cartoon-city-free-v1',
);

const manifest = JSON.parse(fs.readFileSync(path.join(cityRoot, 'city-manifest.json'), 'utf8'));
const counts = {
  roots: 0,
  roads: 0,
  tiles: 0,
  buildings: 0,
  fountains: 0,
  vehicles: 0,
  busStops: 0,
};
const roadPositions = [];
const rootKeys = new Set();
const plazaRequiredSectorIds = new Set([
  'north-west', 'north-center', 'north-east',
  'north-central-west', 'north-central-center', 'north-central-east',
  'south-central-west', 'south-central-center', 'south-central-east',
]);
const plazaSurfaceSectors = new Set();
const sectorBounds = {
  'north-west': [-70, -20, 37.5, 80],
  'north-center': [-20, 20, 37.5, 80],
  'north-east': [20, 70, 37.5, 80],
  'north-central-west': [-70, -20, 0, 37.5],
  'north-central-center': [-20, 20, 0, 37.5],
  'north-central-east': [20, 70, 0, 37.5],
  'south-central-west': [-70, -20, -37.5, 0],
  'south-central-center': [-20, 20, -37.5, 0],
  'south-central-east': [20, 70, -37.5, 0],
  'south-west': [-70, -20, -80, -37.5],
  'south-center': [-20, 20, -80, -37.5],
  'south-east': [20, 70, -80, -37.5],
};

for (const sector of manifest.sectors) {
  const gltfPath = path.join(cityRoot, sector.gltf);
  const gltf = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
  const scene = gltf.scenes[gltf.scene || 0];
  assert.ok(scene, `${sector.id}: default scene is missing`);
  const bounds = sectorBounds[sector.id];
  assert.ok(bounds, `${sector.id}: sector has no audited map boundary`);
  let walkingRoots = 0;
  let vehicleRoots = 0;

  for (const nodeIndex of scene.nodes) {
    const node = gltf.nodes[nodeIndex];
    const name = node.name || '';
    const position = node.translation || [0, 0, 0];
    counts.roots += 1;
    const rootKey = `${name}|${position.map(value => value.toFixed(4)).join(',')}`;
    assert.equal(rootKeys.has(rootKey), false, `${sector.id}: duplicate root ${rootKey}`);
    rootKeys.add(rootKey);

    assert.ok(
      position[0] >= bounds[0] - 0.01 && position[0] <= bounds[1] + 0.01,
      `${sector.id}: ${name} is assigned outside its X sector`,
    );
    assert.ok(
      position[2] >= bounds[2] - 0.01 && position[2] <= bounds[3] + 0.01,
      `${sector.id}: ${name} is assigned outside its Z sector`,
    );

    if (/^road_/i.test(name)) {
      counts.roads += 1;
      walkingRoots += 1;
      roadPositions.push(position);
      assert.ok(Math.abs(position[1]) <= 0.001, `${sector.id}: ${name} is not on the walking plane`);
    }
    if (/^Set_/i.test(name)) {
      counts.tiles += 1;
      walkingRoots += 1;
      assert.ok(Math.abs(position[1]) <= 0.001, `${sector.id}: ${name} is not on the walking plane`);
    }
    if (/Building/i.test(name)) counts.buildings += 1;
    if (/^Fountain_/i.test(name)) counts.fountains += 1;
    if (/^(Car_|Futuristic_Car_|Van\.)/i.test(name)) {
      counts.vehicles += 1;
      vehicleRoots += 1;
      assert.ok(position[1] >= -0.11 && position[1] <= 0.01, `${sector.id}: ${name} has an invalid vehicle ground offset`);
    }
    if (/^Bus_Stop_/i.test(name)) counts.busStops += 1;

    assert.ok(Math.abs(position[0]) <= 80, `${sector.id}: ${name} exceeds the authored X boundary`);
    assert.ok(Math.abs(position[2]) <= 80, `${sector.id}: ${name} exceeds the authored Z boundary`);
  }
  assert.ok(walkingRoots > 0, `${sector.id}: sector has no authored walking surface`);
  if (plazaRequiredSectorIds.has(sector.id)) plazaSurfaceSectors.add(sector.id);
  assert.ok(vehicleRoots === 0 || walkingRoots > 0, `${sector.id}: vehicles exist without an authored surface`);
}

assert.equal(manifest.sectors.length, 12, 'sector count changed');
assert.deepEqual(counts, {
  roots: 238,
  roads: 42,
  tiles: 38,
  buildings: 6,
  fountains: 2,
  vehicles: 21,
  busStops: 2,
});

const safeSpawnRoad = roadPositions.some(([x, y, z]) => (
  Math.abs(x - 7.5) < 0.001 &&
  Math.abs(y) < 0.001 &&
  Math.abs(z - 22.5) < 0.001
));
assert.ok(safeSpawnRoad, 'safe Plaza spawn is not backed by an authored road tile');
assert.deepEqual([...plazaSurfaceSectors].sort(), [...plazaRequiredSectorIds].sort(), 'the complete Plaza ring must keep visible walking surfaces');

console.log(
  `Cartoon City physics audit: ${manifest.sectors.length} sectors, ` +
  `${counts.roads + counts.tiles} walking tiles, ` +
  `${counts.buildings + counts.fountains + counts.vehicles + counts.busStops} solid roots.`,
);
