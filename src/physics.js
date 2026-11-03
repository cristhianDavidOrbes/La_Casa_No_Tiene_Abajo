// Geometry predicates for AI/placement only. Actual integration and contact
// resolution live exclusively in CannonPhysics; no parallel legacy solver.
export const EYE_HEIGHT=1.68;
export const RADIUS=.24;
export function insideHole(x,z,hole,margin=0){return !!hole&&hole.kind!=='wall'&&Math.abs(x-hole.x)<(hole.w||hole.size)/2-margin&&Math.abs(z-hole.z)<(hole.d||hole.size)/2-margin;}
export function collisionAt(x,z,feet,obstacles,radius=RADIUS){return obstacles.some(b=>b.enabled!==false&&feet<b.maxY-.06&&feet+EYE_HEIGHT>b.minY+.05&&x+radius>b.minX&&x-radius<b.maxX&&z+radius>b.minZ&&z-radius<b.maxZ);}
export const smoothstep=t=>t*t*(3-2*t);
