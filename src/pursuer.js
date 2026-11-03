import { Vector3, Quaternion, Matrix4, MathUtils, Ray } from 'three';
import { LEVELS, roomQuaternion, localPosition, worldPosition, portalOpen } from './level.js';
import { insideHole } from './physics.js';
import { makeGravityBody, stepGravityBody, gravityArrival } from './gravity.js';
import { traversable, supportHeight, planClimbMotion } from './environment-navigation.js';
const Y = new Vector3(0, 1, 0);
export function wallDistance(room, x, z) {
  return Math.min(room.w / 2 - Math.abs(x), room.d / 2 - Math.abs(z));
}
class Heap {
  constructor() {
    this.items = [];
  }
  push(n) {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (a[p].f <= n.f) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = n;
  }
  pop() {
    const a = this.items,
      first = a[0],
      last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].f < a[c].f) c++;
        if (a[c].f >= last.f) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = last;
    }
    return first;
  }
}
export function navigationPath(room, start, goal, portal, wallBias = 1.8) {
  const step = 0.32,
    key = (x, z) => x + ',' + z,
    s = [Math.round(start.x / step), Math.round(start.z / step)],
    end = [Math.round(goal.x / step), Math.round(goal.z / step)],
    queue = new Heap(),
    parents = new Map([[key(...s), null]]),
    cost = new Map([[key(...s), 0]]);
  let found = null;
  queue.push({ x: s[0], z: s[1], g: 0, f: 0 });
  for (let i = 0; queue.items.length && i < 6000; i++) {
    const n = queue.pop(),
      k = key(n.x, n.z);
    if (n.g !== cost.get(k)) continue;
    if (Math.hypot(n.x - end[0], n.z - end[1]) < 1.4) {
      found = [n.x, n.z];
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const x = n.x + dx,
        z = n.z + dz,
        nk = key(x, z);
      if (!traversable(room, x * step, z * step, portal)) continue;
      const height = supportHeight(room, x * step, z * step),
        g =
          n.g +
          1 +
          Math.max(0, wallDistance(room, x * step, z * step) - 0.8) * wallBias +
          height * 0.12;
      if (g < (cost.get(nk) ?? Infinity)) {
        cost.set(nk, g);
        parents.set(nk, [n.x, n.z]);
        queue.push({ x, z, g, f: g + Math.abs(x - end[0]) + Math.abs(z - end[1]) });
      }
    }
  }
  if (!found) return [];
  const path = [];
  while (found) {
    path.push(
      new Vector3(
        found[0] * step,
        supportHeight(room, found[0] * step, found[1] * step),
        found[1] * step
      )
    );
    found = parents.get(key(...found));
  }
  return path.reverse().slice(1).concat(goal.clone());
}
export function pursuitSpeed(distance, otherRoom, time, bipedal = false) {
  const far = otherRoom || distance > 7;
  if (far) return MathUtils.lerp(4.5, 7.2, MathUtils.clamp((distance - 7) / 10, 0, 1));
  if (bipedal) return MathUtils.lerp(2.4, 2.75, Math.sin(time * 2.4) * 0.5 + 0.5);
  return MathUtils.lerp(0.85, 1.55, Math.pow(0.5 + 0.5 * Math.sin(time * 2.4), 4));
}
export function attackRoute(random = Math.random) {
  return random() < 0.6 ? 'ceiling' : 'ground';
}
export class Pursuer {
  constructor(room, point = new Vector3(-4.15, 0, 1.8), random = Math.random) {
    this.random = random;
    this.room = room;
    this.x = point.x;
    this.z = point.z;
    this.y = point.y;
    this.vy = 0;
    this.delay = 9;
    this.awake = 0;
    this.body = null;
    this.path = [];
    this.pathTime = 0;
    this.yaw = 0;
    this.crouch = 0;
    this.bipedal = 0;
    this.speed = 0;
    this.drive = 0;
    this.stunRemaining = 0;
    this.position = worldPosition(room, point);
    this.rotation = roomQuaternion(room);
    this.crossings = 0;
    this.climbing = false;
    this.contactUps = [];
    this.surfaceNormal = new Vector3(0, 1, 0);
    this.surfaceMode = 'ground';
    this.surfaceCooldown = 3 + random() * 3;
    this.surfaceWall = null;
    this.surfaceAge = 0;
  }
  stun(seconds = 3) {
    this.stunRemaining = Math.max(this.stunRemaining, seconds);
    this.drive = 0;
    this.speed = 0;
    if (this.physicsActor) {
      this.physicsActor.desired.set(0, 0, 0);
      this.physicsActor.body.velocity.setZero();
    }
  }
  climbSurface(surface) {
    const room = LEVELS[this.room];
    if (surface === 'PARED') {
      this.x = -room.w / 2 + 0.45;
      this.y = 2.2;
      this.surfaceNormal.set(1, 0, 0);
      this.climbing = true;
      this.bipedal = 0;
    } else if (surface === 'TECHO') {
      this.y = room.h - 0.25;
      this.surfaceNormal.set(0, -1, 0);
      this.climbing = true;
      this.bipedal = 0;
    } else {
      this.y = 0;
      this.surfaceNormal.set(0, 1, 0);
      this.climbing = false;
    }
    this.position.copy(worldPosition(this.room, new Vector3(this.x, this.y, this.z)));
  }
  chooseWall(room, p, tree) {
    const q = roomQuaternion(this.room),
      sides = [
        { axis: 'x', value: -room.w / 2, normal: new Vector3(1, 0, 0) },
        { axis: 'x', value: room.w / 2, normal: new Vector3(-1, 0, 0) },
        { axis: 'z', value: -room.d / 2, normal: new Vector3(0, 0, 1) },
        { axis: 'z', value: room.d / 2, normal: new Vector3(0, 0, -1) }
      ],
      candidates = [];
    // Probe a real section of wall and approach it through the navigation grid.
    // A doorway, window or a bookcase cannot become a fictitious climbing plane.
    for (const side of sides)
      for (const offset of [0, -1.2, 1.2]) {
        const point = p.clone(),
          other = side.axis === 'x' ? 'z' : 'x',
          limit = other === 'x' ? room.w / 2 : room.d / 2;
        point[side.axis] = side.value + side.normal[side.axis] * 0.55;
        point[other] = MathUtils.clamp(point[other] + offset, -limit + 0.7, limit - 0.7);
        point.y = 0.75;
        const normal = side.normal.clone().applyQuaternion(q),
          hit = tree.raySurface(
            new Ray(worldPosition(this.room, point), normal.clone().negate()),
            0.8,
            { normal, room: this.room, architectureOnly: true }
          );
        point.y = supportHeight(room, point.x, point.z);
        if (!hit || !traversable(room, point.x, point.z, null)) continue;
        const path = navigationPath(room, p, point, null, 0.3);
        if (!path.length) continue;
        candidates.push({ ...side, point, distance: p.distanceTo(point), path });
      }
    return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
  }
  setSurface(mode) {
    this.surfaceMode = mode;
    this.surfaceAge = 0;
    this.path = [];
    this.pathTime = 0;
    this.lostSupport = 0;
  }
  advanceSurface(dt, room, p, goal, targetRoom, tree, attack = true) {
    this.surfaceCooldown = Math.max(0, this.surfaceCooldown - dt);
    this.surfaceAge += dt;
    if (
      this.surfaceMode === 'ground' &&
      attack &&
      this.room === targetRoom &&
      this.surfaceCooldown === 0 &&
      p.distanceTo(goal) > 3.2
    ) {
      this.surfaceCooldown = 4 + this.random() * 2;
      if (attackRoute(this.random) === 'ceiling') {
        this.surfaceWall = this.chooseWall(room, p, tree);
        if (this.surfaceWall) {
          this.setSurface('approach');
          this.path = this.surfaceWall.path;
          this.pathTime = 1;
        }
      }
    }
    if (this.room !== targetRoom && this.surfaceMode !== 'ground' && this.surfaceMode !== 'dive')
      this.setSurface(this.surfaceMode === 'approach' ? 'ground' : 'dive');
    const q = roomQuaternion(this.room),
      center = localPosition(this.room, new Vector3().copy(this.physicsActor.body.position));
    if (this.surfaceMode === 'approach') {
      const side = this.surfaceWall,
        n = side.normal.clone().applyQuaternion(q);
      const hit = tree.raySurface(
        new Ray(worldPosition(this.room, center), n.clone().negate()),
        0.85,
        { normal: n, room: this.room, architectureOnly: true }
      );
      if (hit && hit.distance < 0.7 && this.physicsActor.height < 1.3) this.setSurface('wall');
      else if (this.surfaceAge > 7 || (this.stalledFor ?? 0) > 1.3) {
        this.setSurface('ground');
        this.surfaceCooldown = 5;
      } else return { goal: side.point };
    }
    if (this.surfaceMode === 'wall') {
      const side = this.surfaceWall,
        normal = side.normal.clone().applyQuaternion(q);
      const hit = tree.raySurface(
        new Ray(worldPosition(this.room, center), normal.clone().negate()),
        1.05,
        { normal, room: this.room, architectureOnly: true }
      );
      this.lostSupport = hit ? 0 : (this.lostSupport ?? 0) + dt;
      const ceiling = tree.raySurface(
        new Ray(worldPosition(this.room, center), Y.clone().applyQuaternion(q)),
        0.85,
        { normal: Y.clone().negate().applyQuaternion(q), room: this.room }
      );
      if (ceiling && ceiling.distance < 0.7) {
        this.setSurface('ceiling');
      } else if (this.lostSupport > 0.45 || this.surfaceAge > 4) {
        this.setSurface('dive');
      } else {
        this.surfaceNormal.copy(side.normal);
        const velocity = new Vector3(0, 4.1, 0),
          other = side.axis === 'x' ? 'z' : 'x';
        velocity[other] = MathUtils.clamp((goal[other] - p[other]) * 2, -2.2, 2.2);
        return { velocity };
      }
    }
    if (this.surfaceMode === 'ceiling') {
      const n = Y.clone().negate().applyQuaternion(q),
        hit = tree.raySurface(new Ray(worldPosition(this.room, center), n.clone().negate()), 1.1, {
          normal: n,
          room: this.room
        });
      this.lostSupport = hit ? 0 : (this.lostSupport ?? 0) + dt;
      const direction = goal.clone().sub(p);
      direction.y = 0;
      if (direction.length() < 1.6 || this.surfaceAge > 5.5 || this.lostSupport > 0.45)
        this.setSurface('dive');
      else {
        this.surfaceNormal.set(0, -1, 0);
        return { velocity: direction.clampLength(0, 1).multiplyScalar(6.2) };
      }
    }
    if (this.surfaceMode === 'dive') {
      this.surfaceNormal.copy(Y);
      if (
        this.physicsActor.grounded &&
        center.y < this.physicsActor.height / 2 + supportHeight(room, p.x, p.z) + 0.2
      ) {
        this.setSurface('ground');
        this.surfaceCooldown = 5 + this.random() * 4;
      } else {
        const direction = goal.clone().sub(p);
        direction.y = 0;
        return { velocity: direction.clampLength(0, 1).multiplyScalar(3.8) };
      }
    }
    this.surfaceNormal.copy(Y);
    return null;
  }
  update(dt, { rooms, targetRoom, target, tree, frozen = false, attack = true }) {
    this.speed = 0;
    this.awake += dt;
    this.delay = Math.max(0, this.delay - dt);
    this.stunRemaining = Math.max(0, this.stunRemaining - dt);
    if (!this.physicsActor)
      this.physicsActor = tree.createCharacter(this.position, this.room, {
        height: 1.12,
        radius: 0.2,
        monster: true
      });
    tree.enable(this.physicsActor, this.delay <= 0);
    const physicalVelocity = new Vector3().copy(this.physicsActor.body.velocity),
      gravityUp = this.physicsActor.gravityUp;
    this.travelDirection = physicalVelocity
      .clone()
      .addScaledVector(gravityUp, -physicalVelocity.dot(gravityUp));
    this.speed = Math.min(8.5, this.travelDirection.length());
    this.position.copy(tree.feet(this.physicsActor));
    if (frozen || this.delay > 0 || this.stunRemaining > 0) {
      this.physicsActor.desired.set(0, 0, 0);
      this.physicsActor.verticalMotor = null;
      return;
    }
    if (!this.body) {
      const physical = localPosition(this.room, tree.feet(this.physicsActor));
      this.x = physical.x;
      this.y = physical.y;
      this.z = physical.z;
      this.position.copy(tree.feet(this.physicsActor));
    }
    if (this.lastTargetRoom !== targetRoom) {
      this.lastTargetRoom = targetRoom;
      this.path = [];
      this.pathTime = 0;
      this.stalledFor = 0;
    }
    if (this.body) {
      const speed = this.body.field === this.body.link.a ? 2 : 1.55,
        result = stepGravityBody(
          this.body,
          { side: 0, forward: 1, yaw: this.yaw, speed },
          dt,
          tree
        );
      this.yaw = result.yaw;
      this.speed = speed;
      this.position.copy(this.body.center).addScaledVector(this.body.up, -this.body.height / 2);
      this.supportUp = this.body.up.clone();
      this.rotation
        .copy(this.body.frame)
        .multiply(new Quaternion().setFromAxisAngle(Y, this.yaw + Math.PI));
      this.crouch = 1;
      this.bipedal = 0;
      const frameA = roomQuaternion(this.body.link.a);
      this.contactUps = [
        ...[this.body.link.a, this.body.link.b].map((id) =>
          Y.clone().applyQuaternion(roomQuaternion(id))
        ),
        new Vector3(1, 0, 0).applyQuaternion(frameA),
        new Vector3(-1, 0, 0).applyQuaternion(frameA),
        new Vector3(0, 0, 1).applyQuaternion(frameA),
        new Vector3(0, 0, -1).applyQuaternion(frameA)
      ];
      this.climbing = true;
      const arrival = gravityArrival(this.body);
      if (arrival) {
        if (arrival.room !== this.room) this.crossings++;
        this.room = arrival.room;
        this.physicsActor.transition = null;
        this.physicsActor.room = this.room;
        const feet = localPosition(this.room, tree.feet(this.physicsActor));
        this.x = feet.x;
        this.y = feet.y;
        this.z = feet.z;
        this.body = null;
        this.path = [];
        this.pathTime = 0;
        this.surfaceMode = 'ground';
        this.surfaceCooldown = 2.5;
        this.surfaceNormal.set(0, 1, 0);
      }
      return;
    }
    const room = rooms[this.room],
      roomQ = roomQuaternion(this.room),
      up = Y.clone().applyQuaternion(roomQ);
    const portal =
      this.room === targetRoom
        ? null
        : room.portals.find(
            (p) =>
              p.to === (targetRoom < this.room ? this.room - 1 : this.room + 1) &&
              portalOpen(p, { relays: [true, true, true] })
          );
    const goal = portal
      ? new Vector3(portal.kind === 'wall' ? 4.72 : portal.x, 0, portal.z)
      : localPosition(this.room, target);
    goal.y = supportHeight(room, goal.x, goal.z);
    const p = new Vector3(this.x, this.y, this.z),
      start = p.clone(),
      distance = Math.hypot(p.x - goal.x, p.z - goal.z),
      distToTarget = this.position.distanceTo(target);
    this.crouch = portal && distance < 2.4 ? 1 : 0;
    const ceiling = tree.raySurface(
      new Ray(this.position.clone().addScaledVector(up, 0.1), up),
      3.2,
      { normal: up.clone().negate() }
    );
    const clearance =
      (this.surfaceMode === 'ground' || this.surfaceMode === 'approach') && ceiling
        ? ceiling.distance + 0.1
        : Infinity;
    this.crouch = Math.max(this.crouch, MathUtils.clamp((1.35 - clearance) / 0.45, 0, 1));
    const surface = this.advanceSurface(dt, room, p, goal, targetRoom, tree, attack);
    let velocity = surface?.velocity?.clone() ?? new Vector3(),
      lift = null;
    this.climbing = this.surfaceMode === 'wall' || this.surfaceMode === 'ceiling';
    if (!surface?.velocity) {
      const pathGoal = surface?.goal ?? goal;
      this.pathTime -= dt;
      if (this.pathTime <= 0) {
        this.path = navigationPath(
          room,
          p,
          pathGoal,
          portal,
          (this.stalledFor ?? 0) > 0.4 ? 0 : 1.8
        );
        this.pathTime = 0.9;
      }
      while (this.path.length > 1 && Math.hypot(p.x - this.path[0].x, p.z - this.path[0].z) < 0.24)
        this.path.shift();
      const next = this.path[0] || pathGoal,
        direction = next.clone().sub(p);
      direction.y = 0;
      const pace =
        this.surfaceMode === 'approach'
          ? 3.2
          : pursuitSpeed(distToTarget, this.room !== targetRoom, this.awake, this.bipedal > 0.5);
      this.drive = MathUtils.damp(this.drive, pace, pace < this.drive ? 7 : 2.5, dt);
      if (direction.length() > 0.09) {
        const amount = Math.min(direction.length(), this.drive * dt);
        direction.normalize();
        const step = planClimbMotion(p, direction, amount, dt, room, portal);
        this.mounting = step.climbing;
        velocity
          .copy(p)
          .sub(start)
          .multiplyScalar(1 / Math.max(dt, 0.0001));
        if (step.climbing && p.y > start.y + 0.001) lift = velocity.y;
        velocity.y = 0;
      } else this.mounting = false;
    } else this.mounting = false;
    // Only actual displacement advances the gait and determines a blocked route.
    const actualTravel = this.previousPhysical?.distanceTo(start) ?? 1;
    this.stalledFor =
      velocity.length() > 0.15 && actualTravel < 0.0015 ? (this.stalledFor ?? 0) + dt : 0;
    if (this.stalledFor > 0.35) this.pathTime = Math.min(this.pathTime, 0.1);
    // The upright skin is about 2.92 m tall; reserve head clearance for that
    // measured pose instead of allowing it through a shorter 2.65 m capsule.
    const canStand =
      distToTarget < 7 &&
      this.room === targetRoom &&
      clearance > 3.08 &&
      this.crouch < 0.2 &&
      this.surfaceMode === 'ground' &&
      !this.mounting;
    this.bipedal = MathUtils.damp(this.bipedal, canStand ? 1 : 0, 5, dt);
    // Smooth posture changes; no instant replacement of a tall capsule by a short one.
    const height = MathUtils.damp(
      this.physicsActor.height,
      MathUtils.lerp(1.12, 2.98, this.bipedal),
      8,
      dt
    );
    tree.resizeCharacter(this.physicsActor, Math.min(height, Math.max(0.85, clearance - 0.12)));
    const norm = this.surfaceNormal.clone().normalize();
    let fwd = velocity.clone().addScaledVector(norm, -velocity.dot(norm));
    if (fwd.lengthSq() < 0.001)
      fwd = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).addScaledVector(
        norm,
        -new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).dot(norm)
      );
    if (fwd.lengthSq() < 0.001) fwd = Math.abs(norm.y) < 0.8 ? Y.clone() : new Vector3(0, 0, 1);
    fwd.normalize();
    if (Math.hypot(fwd.x, fwd.z) > 0.01) this.yaw = Math.atan2(fwd.x, fwd.z);
    const right = new Vector3().crossVectors(norm, fwd).normalize();
    fwd.crossVectors(right, norm).normalize();
    const targetQ = roomQ
      .clone()
      .multiply(new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, norm, fwd)));
    this.rotation.rotateTowards(targetQ, dt * 5);
    this.supportUp = norm.clone().applyQuaternion(roomQ);
    this.contactUps = [
      this.supportUp.clone(),
      up,
      ...this.physicsActor.contacts.map((c) => c.normal.clone())
    ];
    tree.configure(this.physicsActor, {
      frame: this.rotation,
      gravityUp: this.supportUp,
      desired: velocity.applyQuaternion(roomQ),
      verticalMotor: lift,
      preserveFeet: this.surfaceMode === 'ground' || this.surfaceMode === 'approach'
    });
    this.previousPhysical = start.clone();
    this.position.copy(tree.feet(this.physicsActor));
    const actual = localPosition(this.room, this.position);
    this.x = actual.x;
    this.y = actual.y;
    this.z = actual.z;
    this.vy = physicalVelocity.dot(up);
    const gap = portal?.kind === 'floor' && insideHole(actual.x, actual.z, portal);
    if (
      portal &&
      ((portal.kind === 'wall' && actual.x > 4.61 && Math.abs(actual.z - portal.z) < 0.9) ||
        (portal.kind === 'floor' && gap && actual.y < -0.18))
    ) {
      tree.resizeCharacter(this.physicsActor, 1.12);
      const feet = localPosition(this.room, tree.feet(this.physicsActor));
      this.body = makeGravityBody(portal, feet, this.vy, 1.12, this.physicsActor);
      this.yaw = portal.kind === 'wall' ? -Math.PI / 2 : (-portal.edge * Math.PI) / 2;
    }
  }
}
