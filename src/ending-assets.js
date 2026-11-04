import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadPool, loadWithRetry } from './asset-loading.js';

// Fully resident before the start button is enabled: no loading at the exit.
export async function loadEndingAssets(progress = () => {}) {
  const assets = {},
    loader = new GLTFLoader(),
    textureLoader = new THREE.TextureLoader();
  let done = 0;
  const models = [
    ['protagonist', 'protagonist.glb'],
    ['house', 'house.glb'],
    ['neighborHouse', 'neighbor-house.glb']
  ];
  await loadPool(models, async ([key, file]) => {
    assets[key] = await loadWithRetry('/assets/ending/' + file, (url) => loader.loadAsync(url));
    progress(++done, 9);
  });
  assets.ground = {};
  await loadPool(
    [
      ['map', 'diffuse'],
      ['normalMap', 'normal'],
      ['roughnessMap', 'roughness']
    ],
    async ([slot, name]) => {
      const texture = await loadWithRetry('/assets/ending/ground_' + name + '.jpg', (url) =>
        textureLoader.loadAsync(url)
      );
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(24, 24);
      texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      assets.ground[slot] = texture;
      progress(++done, 9);
    }
  );
  assets.asphalt = {};
  await loadPool(
    [
      ['map', 'diff'],
      ['normalMap', 'nor_gl'],
      ['arm', 'arm']
    ],
    async ([slot, suffix]) => {
      const texture = await loadWithRetry('/assets/road/asphalt_02_' + suffix + '_1k.jpg', (url) =>
        textureLoader.loadAsync(url)
      );
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(44, 2);
      texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      assets.asphalt[slot] = texture;
      progress(++done, 9);
    }
  );
  return assets;
}
