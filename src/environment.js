import { EquirectangularReflectionMapping, PMREMGenerator } from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { loadWithRetry } from './asset-loading.js';

// SEMANA 7, diapositivas 6–7 y 15: IBL ilumina y refleja mediante una imagen HDR.
// Se utiliza resolución 1K y una sola textura de entorno compartida por la casa.
// HDRLoader es el nombre actual de RGBELoader en esta versión de Three.js.
export async function loadEnvironment(scene, renderer) {
  const hdr = await loadWithRetry('/textures/abandoned_hall_01_1k.hdr', (url) =>
    new HDRLoader().loadAsync(url)
  );
  hdr.mapping = EquirectangularReflectionMapping;
  const generator = new PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(hdr);
  // scene.environment ilumina los materiales PBR; no sustituye la vista de la casa.
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.08;
  hdr.dispose();
  generator.dispose();
  // El fondo sigue siendo la casa real; los focos producen sombras y parpadeos.
  return environment;
}
