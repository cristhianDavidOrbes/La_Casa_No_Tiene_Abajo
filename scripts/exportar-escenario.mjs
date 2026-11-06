// Semana 8: mismas medidas para Blender y para los cuerpos estáticos de Cannon.
import fs from 'node:fs';
import { LEVELS, LINKS, worldPosition } from '../src/level.js';
import { shellBoxes, connectorBoxes } from '../src/architecture.js';
import { ENTRY_DOOR } from '../src/entry-door.js';
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
for (const room of LEVELS) {
  for (const box of shellBoxes(room)) add(room, box);
  for (const z of [-room.d / 2 + 0.045, room.d / 2 - 0.045]) {
    const spans =
      room.id === 0 && z > 0
        ? [
            [-5, ENTRY_DOOR.hingeX],
            [ENTRY_DOOR.hingeX + ENTRY_DOOR.width, 5]
          ]
        : [[-5, 5]];
    for (const [a, b] of spans)
      add(room, { size: [b - a, 0.18, 0.12], pos: [(a + b) / 2, 0.09, z], material: 'wood' });
    add(room, { size: [10, 0.16, 0.12], pos: [0, room.h - 0.08, z] });
  }
}
for (const link of LINKS) for (const box of connectorBoxes(link)) add(LEVELS[link.a], box, true);
fs.writeFileSync(
  new URL('../blender/escenario.json', import.meta.url),
  JSON.stringify({ rooms: LEVELS, boxes }, null, 2)
);
console.log(`${boxes.length} módulos estructurales: cinco habitaciones y cuatro conexiones.`);
