import {Vector3} from 'three';
import {insideHole} from './physics.js';
export const CLIMB_HEIGHT=1.32,CRAWL_HEIGHT=.95;
const overlaps=(c,x,z,r)=>x+r>c.minX&&x-r<c.maxX&&z+r>c.minZ&&z-r<c.maxZ;
// Furniture is a stepped height field, not a ground-level obstacle to ignore.
export function supportHeight(room,x,z,r=.18){
 let y=0;for(const c of room.colliders)if(c.enabled!==false&&c.minY<.22&&c.maxY<=CLIMB_HEIGHT&&overlaps(c,x,z,r))y=Math.max(y,c.maxY);
 return y;
}
function boundaryExcess(room,x,z,portal){
 const mouth=portal&&Math.abs(z-portal.z)<.86&&Math.abs(x-portal.x)<1.1;
 return Math.max(0,Math.abs(x)-(mouth?4.77:room.w/2-.42))+Math.max(0,Math.abs(z)-(room.d/2-.56));
}
function obstacleClear(room,x,z,portal){
 if(room.openPortals.some(p=>p.link!==portal?.link&&insideHole(x,z,p,-.12)))return false;
 const y=supportHeight(room,x,z,.20);
 return !room.colliders.some(c=>c.enabled!==false&&!(c.minY<.22&&c.maxY<=CLIMB_HEIGHT)&&overlaps(c,x,z,.28)&&c.maxY>y+.06&&c.minY<y+CRAWL_HEIGHT);
}
export function traversable(room,x,z,portal){return boundaryExcess(room,x,z,portal)===0&&obstacleClear(room,x,z,portal);}
// AI motor goal only. Cannon solves the actual displacement and contacts.
export function planClimbMotion(p,direction,amount,dt,room,portal){
 let moving=false,climbing=false;
 const count=Math.max(1,Math.ceil(amount/.06));
 for(let i=0;i<count;i++){
  const next=p.clone().addScaledVector(direction,amount/count);
  if(!traversable(room,next.x,next.z,portal)){
   // A wall descent can start outside the navigation inset. Allow small steps
   // back inward, while still respecting furniture, holes and the actual shell.
   const recovering=boundaryExcess(room,p.x,p.z,portal)>boundaryExcess(room,next.x,next.z,portal);
   if(!recovering||Math.abs(next.x)>room.w/2-.14||Math.abs(next.z)>room.d/2-.14||!obstacleClear(room,next.x,next.z,portal))break;
  }
  const support=supportHeight(room,next.x,next.z,.23);
  if(support>p.y+.035){p.y=Math.min(support,p.y+2.2*dt/count);climbing=true;if(p.y<support-.035)continue;}
  p.x=next.x;p.z=next.z;moving=true;
 }
 const support=supportHeight(room,p.x,p.z,.23);
 // Stay elevated while raising onto the leading edge; lower only after clearing it.
 // Do not manually integrate a fall; the rigid body owns gravity.
 return {moving,climbing,support};
}
export function spawnPoint(room,random=Math.random){
 const candidates=[];
 for(const x of [-4.05,4.05])for(const z of [-2.6,0,2.6]){
  if(traversable(room,x,z)&&!room.portals.some(p=>Math.hypot(x-p.x,z-p.z)<1.6))candidates.push(new Vector3(x,supportHeight(room,x,z),z));
 }
 return candidates.length?candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]:new Vector3(...room.spawn);
}
export function chooseSpawnRoom(current,rooms,state,random=Math.random,exclude=[]){
 const available=rooms.filter(r=>r.id!==current&&!exclude.includes(r.id)&&(r.id===0||state.relays.slice(0,Math.min(r.id,3)).every(Boolean)));
 if(!available.length)return null;
 return available[Math.min(available.length-1,Math.floor(random()*available.length))].id;
}
