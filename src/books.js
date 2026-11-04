import { Box3, Group, Vector3 } from 'three';

// Una geometría CC0 y seis portadas compartidas; cada ejemplar conserva su posición y física.
export const BOOK_COLORS = ['#482333', '#243d30', '#283951', '#4b3528', '#3f2b4a', '#323437'];
const models = new WeakMap();

export function createBook(model, height, variant = 0) {
  if (!models.has(model)) {
    const bounds = new Box3().setFromObject(model);
    models.set(model, {
      bounds,
      height: bounds.getSize(new Vector3()).y,
      materials: new Map()
    });
  }
  const shared = models.get(model);
  const root = new Group();
  root.name = 'libro-stendec';
  root.userData.asset = 'book-stendec';
  const mesh = model.clone(true);
  const scale = height / shared.height;
  const center = shared.bounds.getCenter(new Vector3());
  mesh.scale.setScalar(scale);
  mesh.position.set(-center.x * scale, -shared.bounds.min.y * scale, -center.z * scale);
  root.add(mesh);
  mesh.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = true;
    const materialFor = (source) => {
      const cover = source.name === 'book_cover';
      const color = cover ? BOOK_COLORS[variant % BOOK_COLORS.length] : '#b8ac91';
      const key = source.name + color;
      if (!shared.materials.has(key)) {
        const material = source.clone();
        material.color.set(color);
        material.roughness = cover ? 0.9 : 1;
        shared.materials.set(key, material);
      }
      return shared.materials.get(key);
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(materialFor)
      : materialFor(object.material);
  });
  return root;
}
