import * as THREE from 'three';
import {Sky} from './Sky.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useLocalPlayer} = metaversefile;

export default () => {
  const app = useApp();
  
  const effectController = {
    turbidity: 20,
    rayleigh: 10,
    mieCoefficient: 0.1,
    mieDirectionalG: 0.9999,
    inclination: 0, // elevation / inclination
    azimuth: 0, // Facing front,
    // exposure: renderer.toneMappingExposure
  };
  const sun = new THREE.Vector3();
  useFrame(() => {
    var uniforms = skybox.material.uniforms;
    uniforms.turbidity.value = effectController.turbidity;
    uniforms.rayleigh.value = effectController.rayleigh;
    uniforms.mieCoefficient.value = effectController.mieCoefficient;
    uniforms.mieDirectionalG.value = effectController.mieDirectionalG;

    const {position} = useLocalPlayer().leftHand;
    // effectController.azimuth = (0.05 + ((Date.now() / 1000) * 0.1)) % 1;
    effectController.azimuth = Math.min(Math.max(-position.z / 30, -0.3), 0.3);
    var theta = Math.PI * (effectController.inclination - 0.5);
    var phi = 2 * Math.PI * (effectController.azimuth - 0.5);

    sun.x = Math.cos(phi);
    sun.y = Math.sin(phi) * Math.sin(theta);
    sun.z = Math.sin(phi) * Math.cos(theta);

    uniforms.sunPosition.value.copy(sun);
  });

  const skybox = new Sky();
  skybox.scale.setScalar(1000);
  app.add(skybox);
  skybox.updateMatrixWorld();
  app.setComponent('renderPriority', 'low');

  return app;
};
