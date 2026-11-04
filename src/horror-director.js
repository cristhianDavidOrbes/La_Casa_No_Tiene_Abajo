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
export class HauntDirector {
  constructor() {
    this.active = null;
  }
  reset() {
    this.active = null;
  }
  update(dt, { state, roomTime, observed = false }) {
    if (state.rewound || state.inserted) {
      this.active = null;
      return null;
    }
    const id = 'encounter-' + state.room;
    if (
      !this.active &&
      state.room < 4 &&
      !state.haunts.includes(id) &&
      roomTime > (state.room === 0 ? 6 : 4) &&
      (state.room !== 0 || state.watched || state.relays[0])
    ) {
      this.active = {
        id,
        room: state.room,
        kind: ['knock', 'drag', 'figure', 'figure'][state.room],
        age: 0,
        started: true
      };
    }
    const a = this.active;
    if (!a) return null;
    if (a.room !== state.room && !observed) {
      if (!state.haunts.includes(a.id)) state.haunts.push(a.id);
      this.active = null;
      return null;
    }
    a.age += dt;
    const result = { ...a };
    a.started = false;
    const duration = a.kind === 'figure' ? 5 : 5.5;
    // Apparitions remain as long as they are being watched; no visible pop-out.
    if (a.age > duration && (a.kind !== 'figure' || !observed)) {
      state.haunts.push(a.id);
      this.active = null;
      return null;
    }
    return result;
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
