// Semana 8: mismas medidas para Blender y para los cuerpos estáticos de Cannon.
import fs from 'node:fs';
import { LEVELS, LINKS, worldPosition } from '../src/level.js';
import { shellBoxes, connectorBoxes } from '../src/architecture.js';
import { Vector3 } from 'three';
const boxes = [];
function add(room, box, connector = false) {
  const corners = [];
  for (const [x, y, z] of [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1]
  ]) {
    const local = new Vector3(
      box.pos[0] + (x * box.size[0]) / 2,
      box.pos[1] + (y * box.size[1]) / 2,
      box.pos[2] + (z * box.size[2]) / 2
    );
    corners.push({ local: local.toArray(), world: worldPosition(room.id, local).toArray() });
  }
  boxes.push({
    room: room.id,
    material: box.material === 'wood' ? 'wood' : connector ? 'connector' : 'wall',
    corners
  });
}
const wallDepth = 0.14;
function extendEdge(box, axis, edge) {
  const sign = Math.sign(edge);
  const end = box.pos[axis] + (sign * box.size[axis]) / 2;
  if (Math.abs(end - edge) > 0.00001) return;
  box.size[axis] += wallDepth;
  box.pos[axis] += (sign * wallDepth) / 2;
}
for (const room of LEVELS) {
  for (const box of shellBoxes(room)) {
    // Cerrar las esquinas por fuera, conservando las caras interiores y los huecos.
    for (const x of [-room.w / 2, room.w / 2]) extendEdge(box, 0, x);
    if (box.name === 'floorFull')
      for (const z of [-room.d / 2, room.d / 2]) extendEdge(box, 2, z);
    add(room, box);
  }
}
for (const link of LINKS) {
  for (const box of connectorBoxes(link)) {
    box.size[1] = link.gap;
    box.pos[1] = -link.gap / 2;
    if (box.size[2] === wallDepth) box.size[0] += 2 * wallDepth;
    add(LEVELS[link.a], box, true);
  }
}
fs.writeFileSync(
  new URL('../blender/escenario.json', import.meta.url),
  JSON.stringify({ rooms: LEVELS, boxes }, null, 2)
);
console.log(`${boxes.length} módulos estructurales: cinco habitaciones y cuatro conexiones.`);
