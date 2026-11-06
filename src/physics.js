import { Box3, Vector3 } from 'three';
const portalZones = new WeakMap();
const portalProbe = new Vector3();
// Geometry predicates for AI/placement only. Actual integration and contact
// resolution live exclusively in CannonPhysics; no parallel legacy solver.
export const EYE_HEIGHT = 1.68;
export const RADIUS = 0.24;
// SEMANA 9: zona de activación del acceso. Esta consulta no resuelve colisiones;
// solo decide si el jugador entró en la abertura. Cannon resuelve los contactos.
export function insideHole(x, z, hole, margin = 0) {
  if (!hole || hole.kind === 'wall') return false;
  let zones = portalZones.get(hole);
  if (!zones) {
    zones = new Map();
    portalZones.set(hole, zones);
  }
  let zone = zones.get(margin);
  if (!zone) {
    const halfW = (hole.w || hole.size) / 2 - margin,
      halfD = (hole.d || hole.size) / 2 - margin;
    zone = new Box3(
      new Vector3(hole.x - halfW, -1, hole.z - halfD),
      new Vector3(hole.x + halfW, 1, hole.z + halfD)
    );
    zones.set(margin, zone);
  }
  // Semana 10: AABB real con Box3, creada una vez y consultada sin asignaciones.
  portalProbe.set(x, 0, z);
  return (
    zone.containsPoint(portalProbe) &&
    x > zone.min.x &&
    x < zone.max.x &&
    z > zone.min.z &&
    z < zone.max.z
  );
}
export function collisionAt(x, z, feet, obstacles, radius = RADIUS) {
  return obstacles.some(
    (b) =>
      b.enabled !== false &&
      feet < b.maxY - 0.06 &&
      feet + EYE_HEIGHT > b.minY + 0.05 &&
      x + radius > b.minX &&
      x - radius < b.maxX &&
      z + radius > b.minZ &&
      z - radius < b.maxZ
  );
}
export const smoothstep = (t) => t * t * (3 - 2 * t);
