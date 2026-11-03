import * as T from 'three';

// Material reassignment on the downloaded Poly Haven mesh, not an extra display plane.
// The CRT glass is curved: retain its imported triangles and project video UVs onto them.
export function fitCRT(root, texture) {
  const glass = new T.MeshBasicMaterial({ map: texture, toneMapped: false });
  let count = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(),
      p = g.attributes.position,
      uv = g.attributes.uv,
      body = [],
      screen = [];
    for (let i = 0; i < p.count; i += 3) {
      let onGlass = true;
      for (let j = 0; j < 3; j++) {
        const k = i + j;
        onGlass &&=
          p.getX(k) >= -0.1544 &&
          p.getX(k) <= 0.1508 &&
          p.getY(k) >= 0.1443 &&
          p.getY(k) <= 0.3703 &&
          p.getZ(k) >= 0.0893;
      }
      const indices = onGlass ? screen : body;
      indices.push(i, i + 1, i + 2);
      if (onGlass)
        for (let j = 0; j < 3; j++) {
          const k = i + j;
          uv.setXY(k, (p.getX(k) + 0.1544) / 0.3052, (p.getY(k) - 0.1443) / 0.226);
        }
    }
    if (!screen.length) return;
    g.setIndex([...body, ...screen]);
    g.clearGroups();
    g.addGroup(0, body.length, 0);
    g.addGroup(body.length, screen.length, 1);
    o.geometry = g;
    o.material = [o.material, glass];
    count += screen.length / 3;
  });
  if (!count) throw new Error('No se encontraron los triángulos del cristal de la TV');
  root.userData.screenTriangles = count;
  return glass;
}

export const INCOMING_CLEARANCE = 0.23;
export function shellSpan(room) {
  const incoming = room.portals.find((p) => p.to < room.id),
    min = -5 + (incoming?.edge === -1 ? INCOMING_CLEARANCE : 0),
    max = 5 - (incoming?.edge === 1 ? INCOMING_CLEARANCE : 0);
  return { min, max, width: max - min, center: (max + min) / 2 };
}
