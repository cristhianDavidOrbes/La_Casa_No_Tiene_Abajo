// Apoyos del monstruo: lanzar un rayo y usar la superficie que devuelve Cannon.
import { Vector3, Ray, MathUtils } from 'three';
const Y = new Vector3(0, 1, 0);
// Each limb owns its supporting normal. A gravity turn never rotates four planted
// hands/feet as a single rigid plane.
export function probeContact(
  point,
  up,
  tree,
  {
    origin = null,
    reach = 2,
    minReach = 0,
    sole = 0,
    acceptPoint = null,
    previousNormal = null,
    alternates = [],
    adaptive = false,
    rootQ = null,
    sign = 1,
    hand = false
  } = {}
) {
  const validPoint = (p, normal) => {
    const distance = origin ? p.clone().addScaledVector(normal, sole).distanceTo(origin) : 0;
    return (
      (!origin || (distance <= reach - 0.008 && distance >= minReach)) &&
      (!acceptPoint || acceptPoint(p))
    );
  };
  if (!tree)
    return {
      point: point.clone(),
      normal: up.clone(),
      triangle: null,
      supported: validPoint(point, up)
    };
  const cast = (ray, distance, normal = null) =>
    tree.raySurface
      ? tree.raySurface(ray, distance, { normal, minDot: 0.35 })
      : tree.rayIntersect(ray, distance);
  let best = null,
    score = Infinity;
  const consider = (hit) => {
    if (!hit) return;
    const normal = hit.triangle.getNormal(new Vector3()).normalize();
    if (!validPoint(hit.position, normal) || normal.dot(up) < -0.35) return;
    if (origin && origin.clone().sub(hit.position).dot(normal) < -0.04) return;
    const distance = point.distanceTo(hit.position);
    const value =
      distance + 0.22 * (1 - normal.dot(up)) + (previousNormal?.dot(normal) < 0.5 ? 0.14 : 0);
    if (value < score) {
      best = { point: hit.position.clone(), normal, triangle: hit.triangle, supported: true };
      score = value;
    }
  };
  const normals = [up, ...alternates];
  if (previousNormal) normals.push(previousNormal);
  if (adaptive) {
    normals.push(
      new Vector3(1, 0, 0),
      new Vector3(-1, 0, 0),
      new Vector3(0, 0, 1),
      new Vector3(0, 0, -1),
      new Vector3(0, 1, 0),
      new Vector3(0, -1, 0)
    );
  }
  const unique = [];
  for (const normal of normals) {
    const n = normal.clone().normalize();
    if (unique.some((x) => x.dot(n) > 0.995)) continue;
    unique.push(n);
    const hit = cast(new Ray(point.clone().addScaledVector(n, 0.65), n.clone().negate()), 1.35, n);
    if (hit && hit.triangle.getNormal(new Vector3()).dot(n) > 0.35) consider(hit);
  }
  if (origin && !best) {
    const dirs = [];
    const toward = point.clone().sub(origin);
    if (toward.lengthSq() > 0.001) dirs.push(toward.normalize());
    dirs.push(up.clone().negate());
    if (rootQ) {
      const lat = new Vector3(sign, 0, 0).applyQuaternion(rootQ),
        fwd = new Vector3(0, 0, hand ? 1 : -0.7).applyQuaternion(rootQ);
      dirs.push(
        lat,
        lat.clone().add(fwd).normalize(),
        lat.clone().addScaledVector(up, -0.5).normalize(),
        fwd.clone().addScaledVector(up, -0.5).normalize(),
        lat.clone().negate(),
        up.clone()
      );
    }
    for (const alt of alternates) dirs.push(alt.clone().negate());
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const v = new Vector3(Math.cos(a), Math.sin(a), 0);
      if (rootQ) v.applyQuaternion(rootQ);
      dirs.push(
        (toward.lengthSq() > 0.001 ? toward.clone().normalize() : up.clone().negate())
          .addScaledVector(v, 0.7)
          .normalize()
      );
    }
    for (const dir of dirs) consider(cast(new Ray(origin.clone(), dir), reach - 0.015));
  }
  return best ?? { point: point.clone(), normal: up.clone(), triangle: null, supported: false };
}
export function reachableContact(contact, origin, reach, sole) {
  const n = contact.normal,
    target = contact.point.clone().addScaledVector(n, sole),
    offset = target.clone().sub(origin),
    height = offset.dot(n),
    planar = offset.clone().addScaledVector(n, -height);
  if (Math.abs(height) > reach)
    return { target: origin.clone().add(offset.setLength(reach)), supported: false };
  const radius = Math.sqrt(Math.max(0, reach * reach - height * height));
  if (planar.length() > radius) planar.setLength(radius);
  target.copy(origin).addScaledVector(n, height).add(planar);
  if (contact.triangle) {
    const onPlane = target.clone().addScaledVector(n, -sole);
    contact.triangle.closestPointToPoint(onPlane, onPlane);
    target.copy(onPlane).addScaledVector(n, sole);
  }
  if (target.distanceTo(origin) > reach + 0.012)
    return { target: origin.clone().add(target.sub(origin).setLength(reach)), supported: false };
  return { target, supported: contact.supported };
}
