import * as THREE from 'three';
import { prepareShaders } from './shader-loading.js';

const textureSlots = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'lightMap'
];

// Preparar copias ligeras comparte geometrías y materiales, sin tocar la partida.
export class RenderPreparation {
  constructor(renderer, sourceScene, canPrepare = () => true) {
    this.renderer = renderer;
    this.canPrepare = canPrepare;
    this.lastBackgroundWork = 0;
    this.scene = new THREE.Scene();
    this.scene.background = sourceScene.background;
    this.scene.environment = sourceScene.environment;
    this.scene.environmentIntensity = sourceScene.environmentIntensity;
    // Compartir la niebla evita invalidar los materiales al alternar escenas.
    this.scene.fog = sourceScene.fog;
    this.camera = new THREE.PerspectiveCamera(68, 1.5, 0.045, 180);
    this.textures = new Set();
    // Mantener la misma cantidad de luces permite reutilizar los programas del juego.
    sourceScene.traverseVisible((object) => {
      if (!object.isLight) return;
      const light = object.clone(false);
      light.position.copy(object.getWorldPosition(new THREE.Vector3()));
      light.quaternion.copy(object.getWorldQuaternion(new THREE.Quaternion()));
      if (object.target) {
        light.target = new THREE.Object3D();
        light.target.position.copy(object.target.getWorldPosition(new THREE.Vector3()));
        this.scene.add(light.target);
      }
      this.scene.add(light);
    });
  }

  pause(background) {
    return new Promise((resolve) => {
      if (!background) return requestAnimationFrame(resolve);
      const schedule = () => {
        const attempt = (deadline) => {
          const now = performance.now();
          if (
            this.canPrepare() &&
            (!deadline || deadline.timeRemaining() >= 5) &&
            now - this.lastBackgroundWork >= 120
          ) {
            this.lastBackgroundWork = now;
            resolve();
          } else setTimeout(schedule, 120);
        };
        if (typeof requestIdleCallback === 'function')
          requestIdleCallback(attempt, { timeout: 1000 });
        else requestAnimationFrame(() => attempt(null));
      };
      setTimeout(schedule, 120);
    });
  }

  async prepare(roots, { background = false, onProgress = () => {} } = {}) {
    const objects = [];
    for (const root of roots)
      root.traverse((o) => {
        if (o.isMesh || o.isPoints || o.isLine || o.isSprite) objects.push(o);
      });
    // Durante la partida se preparan menos objetos, solo cuando sobra tiempo.
    const batchSize = background ? 4 : 8;
    for (let start = 0; start < objects.length; start += batchSize) {
      await this.pause(background);
      const batch = new THREE.Group();
      for (const object of objects.slice(start, start + batchSize)) {
        object.updateWorldMatrix(true, false);
        const copy = object.clone(false);
        copy.visible = true;
        copy.frustumCulled = false;
        copy.matrixAutoUpdate = false;
        copy.matrix.copy(object.matrixWorld);
        batch.add(copy);
        const materials = Array.isArray(copy.material) ? copy.material : [copy.material];
        for (const material of materials)
          for (const slot of textureSlots) {
            const texture = material[slot];
            if (!texture?.image || this.textures.has(texture)) continue;
            await this.pause(background);
            this.renderer.initTexture(texture);
            this.textures.add(texture);
          }
      }
      this.scene.add(batch);
      try {
        await prepareShaders(this.renderer, this.scene, this.camera);
        this.draw();
      } finally {
        this.scene.remove(batch);
      }
      onProgress(Math.min(start + batchSize, objects.length) / Math.max(1, objects.length));
    }
  }

  draw(scene = this.scene, camera = this.camera, shadows = false) {
    const renderer = this.renderer;
    const scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest();
    const autoClear = renderer.autoClear;
    const shadowUpdate = renderer.shadowMap.needsUpdate;
    const autoUpdate = renderer.shadowMap.autoUpdate;
    try {
      // Las sombras de la partida conservan su mapa; la preparación no las recalcula.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = shadows;
      // Subir las mallas con cero píxeles visibles conserva la imagen de la partida.
      // Usar el mismo lienzo también evita otra variante de color de cada shader.
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      renderer.setScissor(0, 0, 0, 0);
      renderer.render(scene, camera);
    } finally {
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.autoClear = autoClear;
      renderer.shadowMap.needsUpdate = shadowUpdate;
      renderer.shadowMap.autoUpdate = autoUpdate;
    }
  }

  dispose() {
    this.textures.clear();
    this.scene.clear();
  }
}
