import { Vector3 } from 'three';
import { LINKS, roomQuaternion, worldPosition, localPosition, endpoint } from './level.js';
import { EYE_HEIGHT, insideHole } from './physics.js';
import { CannonPhysics } from './cannon-physics.js';
const Y = new Vector3(0, 1, 0);
export function collisionWorld(rooms, state, { rebuild = false } = {}) {
  if (!rooms.cannonPhysics) rooms.cannonPhysics = new CannonPhysics(rooms, state);
  else if (rebuild) rooms.cannonPhysics.rebuild(state);
  rooms.cannonPhysics.state = state;
  return rooms.cannonPhysics;
}
export function makeGravityBody(
  portal,
  feet,
  verticalVelocity = 0,
  height = EYE_HEIGHT,
  actor = null
) {
  const frame = roomQuaternion(portal.room),
    up = Y.clone().applyQuaternion(frame),
    body = {
      height,
      portal,
      link: LINKS[portal.link],
      from: portal.room,
      field: portal.room,
      center: worldPosition(portal.room, feet).addScaledVector(up, height / 2),
      velocity: up.clone().multiplyScalar(verticalVelocity),
      frame,
      up,
      grounded: false,
      distance: 0,
      actor,
      changed: false
    };
  if (actor) actor.transition = body;
  return body;
}
// Commands the Cannon body; the common scene clock steps it exactly once.
export function stepGravityBody(body, input, dt, physics) {
  if (!body.actor) {
    body.actor = physics.createCharacter(
      body.center.clone().addScaledVector(body.up, -body.height / 2),
      body.from,
      { height: body.height, monster: body.height < EYE_HEIGHT }
    );
    body.actor.body.velocity.set(body.velocity.x, body.velocity.y, body.velocity.z);
    body.actor.transition = body;
  }
  const actor = body.actor,
    previous = body.center.clone();
  body.center.set(actor.body.position.x, actor.body.position.y, actor.body.position.z);
  body.velocity.set(actor.body.velocity.x, actor.body.velocity.y, actor.body.velocity.z);
  body.frame.copy(actor.frame);
  body.up.copy(actor.up);
  body.grounded = actor.grounded;
  body.distance += previous.distanceTo(body.center);
  const changed = body.changed,
    yaw = changed ? body.inputYaw : input.yaw;
  body.changed = false;
  const desired = new Vector3(
    input.side * Math.cos(yaw) - input.forward * Math.sin(yaw),
    0,
    -input.side * Math.sin(yaw) - input.forward * Math.cos(yaw)
  )
    .applyQuaternion(roomQuaternion(body.field))
    .multiplyScalar(input.speed || 2);
  actor.desired.copy(desired);
  actor.verticalMotor = null;
  actor.gravity = 13.8;
  if (input.jump && body.grounded) physics.jump(actor);
  return { changed, yaw };
}
export function gravityArrival(body) {
  const to = body.field;
  // Keep the physical/camera frame through the whole turn. Ending earlier made
  // the next walking frame snap the capsule, feet and camera to a different up.
  if (body.frame.angleTo(roomQuaternion(to)) > 0.025) return null;
  const p = localPosition(to, body.center),
    feet = p.clone().add(new Vector3(0, -(body.height || EYE_HEIGHT) / 2, 0));
  if (
    to === body.link.b &&
    p.x < 4.5 &&
    p.x > -4.5 &&
    p.y > (body.height || EYE_HEIGHT) / 2 - 0.18 &&
    p.y < 3.4
  )
    return { room: to, feet };
  const hole = endpoint(body.link, body.link.a);
  if (
    to === body.link.a &&
    p.y > (body.height || EYE_HEIGHT) / 2 - 0.18 &&
    p.y < 3.8 &&
    Math.abs(p.x) < 4.7 &&
    !insideHole(p.x, p.z, hole, -0.25)
  )
    return { room: to, feet };
  return null;
}
export function gravityEye(body) {
  return body.center.clone().addScaledVector(body.up, EYE_HEIGHT / 2);
}
