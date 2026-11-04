import * as THREE from 'three';
import { RenderPreparation } from './render-preparation.js';

// Cámara del taller: escenario propio y materiales separados para no alterar la partida.
export class Surveillance {
  constructor(world, environment, target) {
    this.ready = false;
    this.target = target;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070d0b');
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.12;
    const source = world.rooms[2].group;
    this.room = source.clone(true);
    this.room.visible = true;
    const originals = [],
      copies = [],
      materials = new Map();
    source.traverse((o) => originals.push(o));
    this.room.traverse((o) => copies.push(o));
    this.nodes = originals.map((original, i) => [original, copies[i]]);
    this.room.traverse((o) => {
      if (o.isLight) o.visible = false;
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = false;
      const separate = (m) => {
        if (!materials.has(m)) {
          const copy = m.clone();
          copy.onBeforeCompile = m.onBeforeCompile;
          copy.customProgramCacheKey = () => m.customProgramCacheKey();
          materials.set(m, copy);
        }
        return materials.get(m);
      };
      o.material = Array.isArray(o.material) ? o.material.map(separate) : separate(o.material);
    });
    this.scene.add(this.room, new THREE.AmbientLight('#a4b6ac', 0.35));
    const light = new THREE.PointLight('#bacab7', 45, 18, 2);
    light.position.copy(world.worldPoint(2, new THREE.Vector3(0, 3.3, 0)));
    this.scene.add(light);
    this.camera = new THREE.PerspectiveCamera(75, 4 / 3, 0.08, 30);
    this.camera.position.copy(world.worldPoint(2, new THREE.Vector3(-4.3, 3.3, 3.2)));
    this.camera.up.copy(new THREE.Vector3(0, 1, 0).applyQuaternion(source.quaternion));
    this.camera.lookAt(world.worldPoint(2, new THREE.Vector3(0, 1, -1)));
  }
  async prepare(renderer, canPrepare) {
    const preparation = new RenderPreparation(renderer, this.scene, canPrepare, this.target);
    try {
      await preparation.prepare([this.room], { background: true });
      this.ready = true;
    } finally {
      preparation.dispose();
    }
  }
  render(renderer) {
    for (const [source, copy] of this.nodes) {
      if (source.isLight) continue;
      copy.position.copy(source.position);
      copy.quaternion.copy(source.quaternion);
      copy.scale.copy(source.scale);
      copy.matrix.copy(source.matrix);
      copy.visible = source.visible;
    }
    this.room.visible = true;
    const target = renderer.getRenderTarget(),
      shadows = renderer.shadowMap.needsUpdate;
    try {
      renderer.shadowMap.needsUpdate = false;
      renderer.setRenderTarget(this.target);
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.setRenderTarget(target);
      renderer.shadowMap.needsUpdate = shadows;
    }
  }
}
