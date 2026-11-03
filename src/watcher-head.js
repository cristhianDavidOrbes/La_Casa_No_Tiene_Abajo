import { Ray } from 'three';

// A new staging marker lets older saves see the repaired full-body peek once.
export const WATCHER_HEAD_ID = 'watcher-head-v6';
export const WATCHER_HIDE_SECONDS = 0.5;
export const WATCHER_SCALE = 1.4;
export const WATCHER_RETREAT_METERS = 1.7;

// Stage on solid floor BESIDE the previous room's exit, where the player's
// backward look finds it. The side alternates with the gravity turn so the
// connecting wall does not hide it from the next room. Never use shaft center.
export function watcherThresholdSite(rooms, currentRoom) {
  if (currentRoom < 1) return null;
  const room = rooms[currentRoom - 1];
  const opening = room?.portals.find((p) => p.kind === 'floor' && p.to === currentRoom);
  if (!opening) return null;
  const side = currentRoom % 2 ? -1 : 1;
  return {
    room: room.id,
    edge: opening.edge,
    x: opening.x - 0.3,
    z: opening.z + side * (opening.d / 2 + 0.05),
    y: 0.55
  };
}

// Withdraw along the previous room's floor, away from its exit. Moving along
// that room's gravity axis would instead make the head enter the passage.
export function watcherRetreatHead(site, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const smooth = t * t * (3 - 2 * t);
  return { x: site.x - site.edge * WATCHER_RETREAT_METERS * smooth, y: site.y, z: site.z };
}

// Keep the entire imported skinned body and rig. A per-instance floor plane
// hides everything below the old room's floor, leaving head and shoulders.
export function configureWatcher(root, clipPlane) {
  root.scale.setScalar(WATCHER_SCALE);
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.castShadow = false;
    const configure = (material) => {
      const copy = material.clone();
      copy.clippingPlanes = [clipPlane];
      return copy;
    };
    o.material = Array.isArray(o.material) ? o.material.map(configure) : configure(o.material);
  });
}

// Looking at any exposed part counts, even if the center bone is behind the
// lip. Projection and occlusion are tested at range, not proximity to the rim.
export function watcherIsObserved(camera, points, tree) {
  camera.updateMatrixWorld(true);
  for (const point of points) {
    const screen = point.clone().project(camera),
      line = point.clone().sub(camera.position),
      distance = line.length();
    if (
      screen.z <= -1 ||
      screen.z >= 1 ||
      Math.abs(screen.x) > 0.88 ||
      Math.abs(screen.y) > 0.86 ||
      distance > 24
    )
      continue;
    const hit = tree?.rayIntersect(new Ray(camera.position.clone(), line.normalize()));
    if (!hit || hit.distance > distance - 0.045) return true;
  }
  return false;
}

// One persistent glimpse. Changing rooms moves the watcher to the next return
// threshold; looking directly at it makes it retreat into the old room.
export class WatcherHead {
  constructor() {
    this.room = -1;
    this.hiding = false;
    this.hideAge = 0;
    this.age = 0;
    this.done = false;
  }
  update(dt, { state, roomTime, observed }) {
    if (
      this.done ||
      state.haunts.includes(WATCHER_HEAD_ID) ||
      state.room < 1 ||
      state.rewound ||
      state.inserted
    )
      return 'inactive';
    if (this.room !== state.room) {
      this.room = state.room;
      this.age = 0;
    }
    this.age += dt;
    if (!this.hiding && roomTime > 0.45 && observed) {
      this.hiding = true;
      this.hideAge = 0;
      return 'noticed';
    }
    if (this.hiding) {
      this.hideAge += dt;
      if (this.hideAge >= WATCHER_HIDE_SECONDS) {
        this.done = true;
        return 'hidden';
      }
    }
    return 'watching';
  }
}
