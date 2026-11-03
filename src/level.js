import { Quaternion, Vector3 } from 'three';
export const LEVELS = [
  {
    id: 0,
    name: '01 / SALA DE JULIÁN',
    w: 10,
    d: 12,
    h: 4,
    pos: [0, 0, 0],
    angle: 0,
    spawn: [0, 0, 4.7],
    yaw: 0
  },
  {
    id: 1,
    name: '02 / PASILLO DE SERVICIO',
    w: 10,
    d: 8,
    h: 4,
    pos: [5, -7.4, 3.2],
    angle: Math.PI / 2,
    spawn: [3.15, 0, 0],
    yaw: Math.PI / 2
  },
  {
    id: 2,
    name: '03 / TALLER DE JULIÁN',
    w: 10,
    d: 8,
    h: 4,
    pos: [16.4, -10.4, 3.2],
    angle: Math.PI,
    spawn: [3.15, 0, 0],
    yaw: Math.PI / 2
  },
  {
    id: 3,
    name: '04 / ARCHIVO FAMILIAR',
    w: 10,
    d: 8,
    h: 4,
    pos: [19.4, -3, 3.2],
    angle: Math.PI * 1.5,
    spawn: [3.15, 0, 0],
    yaw: Math.PI / 2
  },
  {
    id: 4,
    name: '05 / CUARTO DE EMISIÓN',
    w: 10,
    d: 8,
    h: 4,
    pos: [12, 0, 3.2],
    angle: Math.PI * 2,
    spawn: [3.15, 0, 0],
    yaw: Math.PI / 2
  }
];
export const LINKS = [
  { id: 0, a: 0, b: 1, edgeA: 1, edgeB: 1, zA: 1.6, zB: -1.6, gate: 0, gap: 2.4 },
  { id: 1, a: 1, b: 2, edgeA: -1, edgeB: 1, zA: 1.6, zB: 1.6, gate: 1, gap: 6.4 },
  { id: 2, a: 2, b: 3, edgeA: -1, edgeB: 1, zA: -1.6, zB: -1.6, gate: 2, gap: 2.4 },
  { id: 3, a: 3, b: 4, edgeA: -1, edgeB: 1, zA: 1.6, zB: 1.6, gate: null, gap: 2.4 }
];
export function endpoint(link, room) {
  const outgoing = room === link.a,
    edge = outgoing ? link.edgeA : link.edgeB;
  return {
    link: link.id,
    room,
    to: outgoing ? link.b : link.a,
    kind: outgoing ? 'floor' : 'wall',
    edge,
    x: outgoing ? edge * 4 : 5,
    z: outgoing ? link.zA : link.zB,
    w: 2,
    d: 2.5,
    size: 2,
    gate: link.gate
  };
}
export const roomPortals = (room) =>
  LINKS.filter((l) => l.a === room || l.b === room).map((l) => endpoint(l, room));
export const portalOpen = (portal, state) => portal.gate === null || state.relays[portal.gate];
export const worldPosition = (room, local) =>
  local
    .clone()
    .applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), LEVELS[room].angle))
    .add(new Vector3(...LEVELS[room].pos));
export function arrivalFor(portal) {
  const other = endpoint(LINKS[portal.link], portal.to);
  return {
    position: [other.kind === 'wall' ? 3.15 : other.edge * 2.55, 0, other.z],
    yaw: other.edge > 0 ? Math.PI / 2 : -Math.PI / 2
  };
}
export function connectorShape(link) {
  const a = endpoint(link, link.a).x;
  return { a, left: a - 1, right: a + 1, top: 0, bottom: -link.gap, halfDepth: 1.25, z: link.zA };
}
export const roomQuaternion = (id) =>
  new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), LEVELS[id].angle);
export const localPosition = (room, world) =>
  world
    .clone()
    .sub(new Vector3(...LEVELS[room].pos))
    .applyQuaternion(roomQuaternion(room).invert());
