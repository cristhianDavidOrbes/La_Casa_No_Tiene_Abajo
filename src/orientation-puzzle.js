export const SURFACES = ['SUELO', 'PARED', 'TECHO'];
export const CLUE_ROOMS = ['SALA', 'PASILLO', 'TALLER'];
function shuffled(a, random) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export function createPuzzle(random = Math.random) {
  return { surfaces: shuffled(SURFACES, random), order: shuffled([0, 1, 2], random), observed: [] };
}
export function validPuzzle(p) {
  return (
    !!p &&
    Array.isArray(p.surfaces) &&
    p.surfaces.length === 3 &&
    new Set(p.surfaces).size === 3 &&
    p.surfaces.every((s) => SURFACES.includes(s)) &&
    Array.isArray(p.order) &&
    p.order.length === 3 &&
    [...p.order].sort().join(',') === '0,1,2'
  );
}
export const puzzleAnswer = (p) => p.order.map((i) => p.surfaces[i]);
export const puzzleOrder = (p) => p.order.map((i) => CLUE_ROOMS[i]).join(' → ');
export const puzzleSolved = (p, input) =>
  input.length === 3 && input.every((s, i) => s === puzzleAnswer(p)[i]);
export function chairPose(room, surface) {
  if (surface === 'TECHO') return { position: [1.3, 3.98, 1.0], rotation: [Math.PI, 0, 0.08] };
  if (surface === 'PARED')
    return { position: [1.1, 2.25, room === 0 ? 5.88 : 3.88], rotation: [-Math.PI / 2, 0, 0] };
  return { position: [2.0, 0, room === 0 ? 2.6 : 1.3], rotation: [0, -0.7, 0] };
}
