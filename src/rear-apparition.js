import {Vector3,MathUtils} from 'three';
import {collisionAt} from './physics.js';

// New encounter key also lets existing saves see the revised close-up scare.
export const REAR_HAUNT_ID='rear-workshop-close-v6';
export const REAR_REVEAL_SECONDS=.5;
export function shouldStartRearHaunt(state,roomTime){
 return state.room>=2&&state.room<=3&&state.relays[2]&&!state.rewound&&!state.inserted&&roomTime>1.2&&!state.haunts.includes(REAR_HAUNT_ID);
}

function candidateClear(player,point,room){
 if(collisionAt(point.x,point.z,0,room.colliders||[],.36))return false;
 const obstacles=room.colliders||[],distance=player.distanceTo(point),steps=Math.ceil(distance/.25);
 for(let i=1;i<steps;i++){
  const t=i/steps,x=MathUtils.lerp(player.x,point.x,t),z=MathUtils.lerp(player.z,point.z,t);
  if(obstacles.some(b=>b.enabled!==false&&b.minY<1.4&&b.maxY>1.4&&x>b.minX-.04&&x<b.maxX+.04&&z>b.minZ-.04&&z<b.maxZ+.04))return false;
 }
 return true;
}

// Keep the apparition behind the direction in which the player first entered
// the encounter. It follows translation, not rotation, so turning can reveal it.
export class RearApparition{
 constructor(player,backward,room,distance=1.25){
  this.distance=distance;this.room=room.id;this.offset=backward.clone().setY(0).normalize().multiplyScalar(distance);
  this.local=new Vector3();this.age=0;this.spotted=false;this.seenFor=0;
  this.position(player,room);
 }
 relocate(player,backward,room){
  this.room=room.id;this.offset.copy(backward).setY(0).normalize().multiplyScalar(this.distance);
  this.position(player,room);
 }
 position(player,room,dt=Infinity){
  if(this.spotted)return this.local;
  const direction=this.offset.clone().normalize(),candidates=[];
  for(const angle of [0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3])for(const distance of [this.offset.length(),.82]){
   const v=direction.clone().applyAxisAngle(new Vector3(0,1,0),angle).multiplyScalar(distance).add(player);
   v.x=MathUtils.clamp(v.x,-room.w/2+.8,room.w/2-.8);v.z=MathUtils.clamp(v.z,-room.d/2+.8,room.d/2-.8);v.y=0;
   const delta=v.clone().sub(player),length=delta.length();
   if(length<.65||delta.dot(direction)/length<.5||!candidateClear(player,v,room))continue;
   candidates.push(v);
  }
  const desired=candidates[0]||new Vector3(MathUtils.clamp(player.x+this.offset.x,-room.w/2+.8,room.w/2-.8),0,MathUtils.clamp(player.z+this.offset.z,-room.d/2+.8,room.d/2-.8));
  if(!Number.isFinite(dt))this.local.copy(desired);else this.local.add(desired.sub(this.local).clampLength(0,Math.max(.02,5*dt)));
  return this.local;
 }
 update(dt,observed){
  this.age+=dt;
  if(!this.spotted&&this.age>.55&&observed){this.spotted=true;this.seenFor=0;return 'spotted';}
  if(this.spotted){this.seenFor+=dt;if(this.seenFor>=REAR_REVEAL_SECONDS)return 'vanished';}
  return null;
 }
}
