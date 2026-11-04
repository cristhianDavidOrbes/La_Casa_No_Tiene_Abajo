import { Vector3, Ray } from 'three';
export function isCreatureObserved(camera, root, tree, { verticalPadding = 1.08 } = {}) {
  root.updateWorldMatrix(true, true);
  camera.updateMatrixWorld(true);
  const points = [];
  root.traverse((o) => {
    if (o.isBone && /(Head$|Neck$|Spine2$|Hips$|LeftHand$|RightHand$)/.test(o.name)) {
      const p = o.getWorldPosition(new Vector3());
      points.push(p);
      if (/Head$/.test(o.name)) {
        const up = new Vector3(0, 1, 0).transformDirection(root.matrixWorld);
        points.push(p.clone().addScaledVector(up, 0.16), p.clone().addScaledVector(up, -0.16));
      }
    }
  });
  if (!points.length) points.push(root.position.clone());
  for (const p of points) {
    const screen = p.clone().project(camera);
    if (
      screen.z < -1 ||
      screen.z > 1 ||
      Math.abs(screen.x) > 1.08 ||
      Math.abs(screen.y) > verticalPadding
    )
      continue;
    const dir = p.clone().sub(camera.position),
      distance = dir.length(),
      hit = tree?.rayIntersect(new Ray(camera.position.clone(), dir.normalize()));
    if (!hit || hit.distance > distance - 0.12) return true;
  }
  return false;
}
export class UnseenRetirement {
  constructor() {
    this.hiddenFor = 0;
  }
  update(dt, observed) {
    this.hiddenFor = observed ? 0 : this.hiddenFor + dt;
    return this.hiddenFor >= 0.45;
  }
}
// Let the selected three-second scream finish before suspending audio.
export const CAPTURE_DURATION = 3.1;
export function captureDistance(age) {
  const lunge = Math.min(1, Math.max(0, age / 0.18));
  return (
    2.8 - 2.42 * (1 - (1 - lunge) ** 3) + (age > 0.18 ? Math.abs(Math.sin(age * 23)) * 0.055 : 0)
  );
}
