import { Group, Box3, Vector3 } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
export function createCreatureRig(asset) {
  const root = new Group(),
    model = clone(asset);
  root.add(model);
  root.updateMatrixWorld(true);
  model.traverse((o) => o.skeleton?.update());
  // 1.2 times the original 2.6 m game scale, as requested.
  const bounds = new Box3().setFromObject(model, true),
    size = bounds.getSize(new Vector3()),
    center = bounds.getCenter(new Vector3()),
    scale = 3.12 / size.y;
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  root.updateMatrixWorld(true);
  root.traverse((o) => o.skeleton?.update());
  return root;
}
