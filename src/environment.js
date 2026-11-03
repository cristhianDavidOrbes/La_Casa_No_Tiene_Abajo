import { EquirectangularReflectionMapping, PMREMGenerator } from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { loadWithRetry } from './asset-loading.js';

// Semana 7: una imagen HDR 1K aporta luz y reflejos a los materiales PBR.
// HDRLoader es el nombre actual de RGBELoader en esta versión de Three.js.
export async function loadEnvironment(scene, renderer) {
  const hdr = await loadWithRetry('/assets/ending/abandoned_hall_01_1k.hdr', (url) =>
    new HDRLoader().loadAsync(url)
  );
  hdr.mapping = EquirectangularReflectionMapping;
  const generator = new PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(hdr);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.08;
  hdr.dispose();
  generator.dispose();
  // El fondo sigue siendo la casa real; los focos producen sombras y parpadeos.
  return environment;
}
