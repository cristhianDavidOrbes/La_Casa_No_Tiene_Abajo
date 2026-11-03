import {roomPortals,connectorShape} from './level.js';
import {ENTRY_DOOR} from './entry-door.js';
// Dimensions are shared by downloaded visible modules and invisible collision proxies.
export function shellBoxes(room){
 const out=[],add=(name,size,pos,material='plaster')=>out.push({name,size,pos,material});
 const holes=roomPortals(room.id).filter(p=>p.kind==='floor');
 const xs=[-5,5,...holes.flatMap(h=>[h.x-1,h.x+1])].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b),zs=[-room.d/2,room.d/2,...holes.flatMap(h=>[h.z-1.25,h.z+1.25])].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;if(holes.some(h=>Math.abs(x-h.x)<1&&Math.abs(z-h.z)<1.25))continue;add('floorFull',[xs[i+1]-xs[i],.18,zs[j+1]-zs[j]],[x,-.09,z],room.id===0||room.id===3?'wood':'plaster');}
 add('floorFull',[10,.18,room.d],[0,room.h+.09,0]);
 for(const z of [-room.d/2-.07,room.d/2+.07]){
  if(room.id===0&&z>0){const d=ENTRY_DOOR;for(const [a,b] of [[-5,d.hingeX],[d.hingeX+d.width,5]])add('wall',[b-a,room.h,.14],[(a+b)/2,room.h/2,z]);add('wall',[d.width,room.h-d.height,.14],[d.x,(room.h+d.height)/2,z]);}
  else add('wall',[10,room.h,.14],[0,room.h/2,z]);
 }
 for(const edge of [-1,1]){
  if(room.id===0&&edge===-1){for(const [z0,z1] of [[-6,.22],[2.58,6]])add('wall',[.14,4,z1-z0],[-5.07,2,(z0+z1)/2]);add('wall',[.14,1.2,2.36],[-5.07,.6,1.4]);add('wall',[.14,1.05,2.36],[-5.07,3.475,1.4]);}
  else if(room.id>0&&edge===1){const p=roomPortals(room.id).find(p=>p.kind==='wall');for(const [a,b] of [[-room.d/2,p.z-1.25],[p.z+1.25,room.d/2]])add('wall',[.14,4,b-a],[5.07,2,(a+b)/2]);add('wall',[.14,2,2.5],[5.07,3,p.z]);}
  else add('wall',[.14,room.h,room.d],[edge*5.07,room.h/2,0]);
 }
 return out;
}
export function connectorBoxes(link){const s=connectorShape(link);return [
 {name:'wall',size:[.14,link.gap-.32,2.5],pos:[s.left-.07,-(link.gap+.04)/2,s.z]},
 {name:'wall',size:[.14,link.gap-.18,2.5],pos:[s.right+.07,-(link.gap+.18)/2,s.z]},
 ...[-1,1].map(sign=>({name:'wall',size:[2,link.gap-.32,.14],pos:[s.a,-(link.gap+.04)/2,s.z+sign*1.32]}))
 ];}
