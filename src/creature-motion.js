import {Vector3,Quaternion,Matrix4,Ray,MathUtils} from 'three';
import {probeContact,reachableContact} from './surface-contact.js';
const X=new Vector3(1,0,0),Y=new Vector3(0,1,0),Z=new Vector3(0,0,1);
const pos=bone=>bone.getWorldPosition(new Vector3());
function orient(bone,world){bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);}
function aim(bone,current,target){if(current.lengthSq()<1e-12||target.lengthSq()<1e-12)return;orient(bone,new Quaternion().setFromUnitVectors(current.normalize(),target.normalize()).multiply(bone.getWorldQuaternion(new Quaternion())));}
export function solveLimb(upper,lower,end,target,pole,minExtension=0){
 const a=pos(upper),b=pos(lower),c=pos(end),l1=a.distanceTo(b),l2=b.distanceTo(c),offset=target.clone().sub(a),d=MathUtils.clamp(offset.length(),Math.max(Math.abs(l1-l2)+.0001,(l1+l2)*minExtension),l1+l2-.0001),dir=offset.lengthSq()>1e-10?offset.normalize():c.clone().sub(a).normalize();
 const bend=pole.clone().sub(a);bend.addScaledVector(dir,-bend.dot(dir)).normalize();if(bend.lengthSq()<.01)bend.crossVectors(dir,Math.abs(dir.x)<.8?X:Z).normalize();
 const along=(l1*l1-l2*l2+d*d)/(2*d),elbow=a.clone().addScaledVector(dir,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
 aim(upper,b.sub(a),elbow.sub(a));aim(lower,pos(end).sub(pos(lower)),a.addScaledVector(dir,d).sub(pos(lower)));
 return pos(end).distanceTo(target);
}
// World-space planted contacts and an independent sinusoidal swing for every limb.
export class CreatureMotion{
 constructor(root){
  this.root=root;this.bones={};this.rest=[];this.feet=[];this.crouch=0;this.phase=0;this.contacts=0;this.headYaw=0;this.headPitch=0;this.targets=[];this.errors=[];this.contactNormals=[];this.supported=[];this.swingAmounts=[];this.lastUp=new Vector3();
  root.updateWorldMatrix(true,true);const inv=root.getWorldQuaternion(new Quaternion()).invert();
  root.traverse(o=>{if(o.isBone){const name=o.name.replace(/^mixamorig[:_]?/i,'');this.bones[name]=o;this.rest.push({bone:o,q:o.quaternion.clone(),p:o.position.clone(),rootQ:inv.clone().multiply(o.getWorldQuaternion(new Quaternion()))});}});
  const b=this.bones;for(const name of ['Hips','Spine','Spine2','Neck','Head','LeftArm','RightArm','LeftForeArm','LeftHand','RightHand','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot'])if(!b[name])throw Error('Falta hueso Tripo/Mixamo: '+name);
  this.standingHip=root.worldToLocal(pos(b.Hips)).y;
  this.restQ=new Map(this.rest.map(r=>[r.bone,r.rootQ]));this.limbs=[];
  for(const side of ['Left','Right'])for(const hand of [false,true]){
   const end=b[side+(hand?'Hand':'Foot')],tip=b[side+(hand?'HandMiddle2':'ToeBase')],endPos=root.worldToLocal(pos(end));let rotation=this.restQ.get(end).clone();
   if(hand){
    const forward=root.worldToLocal(pos(tip)).sub(endPos).normalize(),index=root.worldToLocal(pos(b[side+'HandIndex2'])).sub(endPos),normal=new Vector3().crossVectors(index,forward).normalize();if(normal.z<0)normal.negate();
    const across=new Vector3().crossVectors(normal,forward).normalize();normal.crossVectors(forward,across).normalize();
    rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(across,normal,forward)).invert().multiply(rotation);
   }
   const delta=rotation.clone().multiply(this.restQ.get(end).clone().invert());let low=0;
   root.traverse(o=>{if(!o.isSkinnedMesh)return;const a=o.geometry.attributes;for(let i=0;i<a.position.count;i++){let weight=0;for(let k=0;k<4;k++){const bone=o.skeleton.bones[a.skinIndex.getComponent(i,k)],name=bone?.name.replace(/^mixamorig[:_]?/i,'');if(name?.startsWith(side+(hand?'Hand':'Foot'))||(!hand&&name?.includes(side+'Toe')))weight+=a.skinWeight.getComponent(i,k);}if(weight>.45){const p=root.worldToLocal(o.getVertexPosition(i,new Vector3()).applyMatrix4(o.matrixWorld)).sub(endPos).applyQuaternion(delta);low=Math.min(low,p.y);}}});
   this.limbs.push({hand,sign:side==='Left'?1:-1,upper:b[side+(hand?'Arm':'UpLeg')],lower:b[side+(hand?'ForeArm':'Leg')],end,rotation,sole:Math.max(.025,-low+.012)});
  }
 }
 point(v){return this.root.localToWorld(v);}
 reset(){this.feet=[];this.lastUp.set(0,0,0);this.lastRootPosition=null;this.lastRootQuaternion=null;this.contactNormals=[];this.phase=0;this.crouch=0;this.bipedal=0;}
 surface(point,up,tree){if(!tree)return point;const hit=tree.rayIntersect(new Ray(point.clone().addScaledVector(up,.9),up.clone().negate()));return hit&&hit.distance<2.6&&hit.triangle.getNormal(new Vector3()).dot(up)>.25?hit.position.clone():point;}
  update(dt,{time=0,speed=0,crouch=0,tree=null,lookTarget=null,stunned=false,contactUps=[],supportUp=null,travelDirection=null,climbing=false,bipedal=0,jumpscare=0,menace=0}={}){
  this.bipedal=MathUtils.damp(this.bipedal??0,climbing?0:bipedal,climbing?16:8,dt);
  this.crouch=MathUtils.damp(this.crouch,crouch,8,dt);this.phase+=speed*dt;this.contacts=0;this.targets=[];this.errors=[];this.contactNormals=[];this.supported=[];this.swingAmounts=[];
  for(const r of this.rest){r.bone.quaternion.copy(r.q);r.bone.position.copy(r.p);}
  this.root.updateWorldMatrix(true,true);
  const b=this.bones,rootQ=this.root.getWorldQuaternion(new Quaternion()),rootPosition=this.root.getWorldPosition(new Vector3()),up=Y.clone().applyQuaternion(rootQ),turning=this.lastUp.lengthSq()>0&&up.dot(this.lastUp)<.9995;
  // A relocation or a large gravity correction invalidates old world anchors.
  if(this.lastRootPosition&&(rootPosition.distanceTo(this.lastRootPosition)>.75||rootQ.angleTo(this.lastRootQuaternion)>.65))this.feet=[];
  this.lastRootPosition=rootPosition.clone();this.lastRootQuaternion=rootQ.clone();this.lastUp.copy(up);
  const supportNormal=supportUp?.clone().normalize()??up;
  // All measurements are in the creature/room frame, never global world Y.
  const contactScale=1.2;
  const size=1.2,lean=menace>0?.015:MathUtils.lerp(1.40+this.crouch*.06,.16+this.crouch*.18,this.bipedal),shiver=menace>0?0:stunned?Math.sin(time*31)*.008:Math.sin(time*1.7)*.008;
  const hipY=menace>0?this.standingHip-.018:(MathUtils.lerp(.63-this.crouch*.10,1.43-this.crouch*.22,this.bipedal)+shiver)*size;
  b.Hips.position.copy(b.Hips.parent.worldToLocal(this.point(new Vector3(0,hipY,menace>0?0:MathUtils.lerp(-.24,-.06,this.bipedal)*size))));
  orient(b.Hips,rootQ.clone().multiply(new Quaternion().setFromAxisAngle(X,lean)).multiply(this.restQ.get(b.Hips)));
  for(let i=0;i<this.limbs.length;i++){
   const l=this.limbs[i],origin=pos(l.upper),reach=origin.distanceTo(pos(l.lower))+pos(l.lower).distanceTo(pos(l.end))-.003;
   const minExtension=l.hand?.28:.52;
   const nominal=this.point(new Vector3(l.sign*(l.hand?.39:.30)*contactScale,0,(l.hand?.72:MathUtils.lerp(-1.08,-.12,this.bipedal))*contactScale));let f=this.feet[i];
   // Each extremity stays on its own side of the body. This is evaluated in
   // the current creature frame, including wall and ceiling locomotion.
   const acceptPoint=point=>{
    const local=this.root.worldToLocal(point.clone());
    return local.x*l.sign>=(l.hand?.10:.09)&&local.z>=(l.hand?-.15:-1.95)&&local.z<=(l.hand?1.75:MathUtils.lerp(.12,.65,this.bipedal));
   };
   const options={origin,reach,minReach:reach*minExtension,sole:l.sole,acceptPoint,previousNormal:f?.normal,alternates:contactUps,adaptive:climbing||turning,rootQ,sign:l.sign,hand:l.hand};
   const desired=probeContact(nominal,supportNormal,tree,options);
   if(!f)f=this.feet[i]={planted:desired.point.clone(),from:desired.point.clone(),to:desired.point.clone(),progress:1,normal:desired.normal.clone(),stance:this.bipedal};
   const plantedDistance=f.planted.clone().addScaledVector(f.normal,l.sole).distanceTo(origin);
   const active=Math.floor(this.phase*1.5)%4,order=[0,3,2,1],lag=f.planted.distanceTo(desired.point),surfaceChanged=desired.supported&&f.normal.dot(desired.normal)<.85,unreachable=plantedDistance>reach||plantedDistance<reach*minExtension||!acceptPoint(f.planted),stanceChanged=Math.abs(this.bipedal-f.stance)>.12;
   if(unreachable&&desired.supported){
    // Do not swing from an anchor that has crossed through the torso during
    // a turn; start the recovery at the current limb's safe anatomical side.
    f.planted.copy(desired.point);f.from.copy(desired.point);f.to.copy(desired.point);f.progress=1;f.normal.copy(desired.normal);f.stance=this.bipedal;
   }
   if(!stunned&&menace<=0&&!unreachable&&desired.supported&&f.progress>=1&&((lag>.46&&(order[active]===i||lag>1.28))||(lag>.2&&stanceChanged)||surfaceChanged)){
    f.from.copy(f.planted);
    const ahead=nominal.clone(),forward=travelDirection?.clone()??Z.clone().applyQuaternion(rootQ);
    forward.addScaledVector(supportNormal,-forward.dot(supportNormal));
    if(speed>.1&&forward.lengthSq()>.001)ahead.addScaledVector(forward.normalize(),Math.min(l.hand?.36:.52,reach*.35));
    const landing=probeContact(ahead,supportNormal,tree,options);
    f.to.copy(landing.supported?landing.point:desired.point);
    f.progress=0;f.stance=this.bipedal;
   }
   let lift=0;
   if(f.progress<1&&!stunned){
    const stepRate=(2.8+speed*.55)*Math.max(1,lag/.85);
    f.progress=Math.min(1,f.progress+dt*stepRate);
    const t=f.progress*f.progress*(3-2*f.progress);
    const normalTurn=new Quaternion().setFromUnitVectors(f.normal,desired.normal);
    const stepNormal=f.normal.clone().applyQuaternion(new Quaternion().slerp(normalTurn,t)).normalize();
    const heightDiff=f.to.clone().sub(f.from).dot(stepNormal);
    const baseClearance=turning?.10:(l.hand?.30:.24);
    const obstacleClearance=Math.abs(heightDiff)>.04?Math.min(.4,Math.abs(heightDiff)*.5+.12):0;
    const liftAmount=Math.max(baseClearance,obstacleClearance);
    lift=Math.sin(Math.PI*f.progress)*liftAmount;
    f.planted.copy(f.from).lerp(f.to,t).addScaledVector(stepNormal,lift);
    if(tree){
     const ray=new Ray(f.planted.clone().addScaledVector(stepNormal,.4),stepNormal.clone().negate());
     const over=tree.raySurface?tree.raySurface(ray,.4,{normal:stepNormal}):tree.rayIntersect(ray,.4);
     if(over&&over.distance<.4&&over.triangle.getNormal(new Vector3()).dot(stepNormal)>.25){
      const corrected=over.position.clone().addScaledVector(stepNormal,.02),delta=corrected.sub(f.planted);
      f.planted.add(delta.clampLength(0,.12));
     }
    }
   }
   this.swingAmounts.push(lift);
   let contact;
   if(f.progress<1){
    contact={point:f.planted.clone(),normal:f.normal.clone(),triangle:null,supported:false};
   } else {
    contact=probeContact(f.planted,supportNormal,tree,options);
    if(!contact.supported&&desired.supported){
     f.planted.lerp(desired.point,Math.min(1,12*dt));
     contact=probeContact(f.planted,supportNormal,tree,options);
    }
   }
   const resolved=reachableContact(contact,origin,reach,l.sole);
   let target=f.progress<1?f.planted.clone().addScaledVector(f.normal,l.sole):resolved.target;
   if(l.hand&&jumpscare>0){
    if(lookTarget){
     const toCam=lookTarget.clone().sub(pos(b.Head)).normalize();
     const camUp=Y.clone().applyQuaternion(rootQ);
     const camRight=new Vector3().crossVectors(toCam,camUp).normalize();
     const sideOffset=(l.sign>0?1:-1)*(0.22-Math.min(.06,time*.08)+Math.sin(time*24+l.sign)*.025);
     const vertOffset=-0.05+Math.cos(time*19+l.sign)*.035;
     const fwdOffset=Math.sin(time*15)*.025;
     target=lookTarget.clone().addScaledVector(toCam,-0.24+fwdOffset).addScaledVector(camRight,sideOffset).addScaledVector(camUp,vertOffset);
    } else {
     target=this.point(new Vector3(l.sign*.26+Math.sin(time*24+l.sign)*.04,1.18+Math.cos(time*21+l.sign)*.04,1.15+Math.sin(time*16)*.08));
    }
   } else if(l.hand&&menace>0){
    const right=X.clone().applyQuaternion(rootQ),forward=Z.clone().applyQuaternion(rootQ);
    const raised=origin.clone().addScaledVector(up,reach*.68+.055*Math.sin(time*23+i*1.7)).addScaledVector(right,l.sign*(.22+.055*Math.sin(time*17+i))).addScaledVector(forward,.38+.055*Math.sin(time*29+i*2.1));
    target.lerp(raised,menace);
   } else if(l.hand&&this.bipedal>.35){
    const bReach=this.point(new Vector3(l.sign*(.32+Math.sin(time*2.5+l.sign)*.04)*size,(.82+Math.cos(time*2.1+l.sign)*.06)*size,(.62+(speed>.1?.28:0))*size));
    target=target.clone().lerp(bReach,Math.min(1,(this.bipedal-.35)/.4));
   }
   if(!l.hand&&menace>0)target=origin.clone().addScaledVector(up,-reach*.9995);
   // Never replace a planted world contact by the IK's reach-clamped target.
   // That would move the anchor into empty space while the root turns.
   if(f.progress>=1&&contact.supported)f.planted.copy(contact.point);
   const normalTurn=new Quaternion().setFromUnitVectors(f.normal,contact.normal);
   f.normal.applyQuaternion(new Quaternion().slerp(normalTurn,1-Math.exp(-18*dt))).normalize();
   const right=X.clone().applyQuaternion(rootQ),forward=Z.clone().applyQuaternion(rootQ);
   const pole=l.hand&&menace>0?origin.clone().addScaledVector(right,l.sign*.8).addScaledVector(up,.12):origin.clone().addScaledVector(right,l.sign*(l.hand?.75:.35)).addScaledVector(forward,l.hand?-.28:.65).addScaledVector(up,l.hand?-.2:.5);
   // A missing surface uses a relaxed reachable pose, never a point behind
   // the opposite shoulder/hip. Anatomical bounds also apply while airborne.
   if(menace<=0&&jumpscare<=0&&!acceptPoint(target))target.copy(nominal).addScaledVector(supportNormal,l.sole);
   let extension=target.clone().sub(origin);
   if(extension.length()<reach*minExtension){if(extension.lengthSq()<1e-8)extension.copy(up).negate();target.copy(origin).add(extension.setLength(reach*minExtension));}
   if(target.distanceTo(origin)>reach){const offset=target.clone().sub(origin).setLength(reach);target.copy(origin).add(offset);}
   if(f.target&&menace<=0&&jumpscare<=0){
    // Retarget the support immediately, but move the visible limb gradually.
    // Project an old anchor onto its own anatomical side before blending: a
    // turn must neither retain a crossed limb nor teleport it to a new step.
    const previous=f.target.clone();
    if(!acceptPoint(previous)){
     const local=this.root.worldToLocal(previous);
     local.x=l.sign*Math.max(l.hand?.10:.09,local.x*l.sign);
     local.z=MathUtils.clamp(local.z,l.hand?-.15:-1.95,l.hand?1.75:MathUtils.lerp(.12,.65,this.bipedal));
     this.root.localToWorld(previous);
    }
    const delta=target.clone().sub(previous).clampLength(0,.12+speed*dt);
    target.copy(previous).add(delta);
    if(target.distanceTo(origin)>reach){const offset=target.clone().sub(origin).setLength(reach);target.copy(origin).add(offset);}
   }
   f.target=target.clone();
   extension=target.clone().sub(origin);if(extension.length()<reach*minExtension)target.copy(origin).add(extension.setLength(reach*minExtension));
   const error=solveLimb(l.upper,l.lower,l.end,target,pole,minExtension);
   if(l.hand&&(jumpscare>0||menace>0)&&lookTarget){
    const toCam=lookTarget.clone().sub(target).normalize();
    const handUp=Y.clone().applyQuaternion(rootQ);
    const handRight=new Vector3().crossVectors(handUp,toCam).normalize();
    const clawRot=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(handRight,handUp,toCam));
    orient(l.end,clawRot.multiply(l.rotation));
   } else {
    const align=new Quaternion().setFromUnitVectors(up,f.normal);
    orient(l.end,align.multiply(rootQ.clone()).multiply(l.rotation));
   }
   const planted=resolved.supported&&lift<.01&&target.distanceTo(resolved.target)<.04;
   this.targets.push(target);this.errors.push(error);this.contactNormals.push(f.normal.clone());this.supported.push(planted);if(error<.08&&planted)this.contacts++;
  }
  let yaw=0,pitch=-.06;
  if(lookTarget){const dir=lookTarget.clone().sub(pos(b.Head)).applyQuaternion(rootQ.clone().invert());yaw=MathUtils.clamp(Math.atan2(dir.x,dir.z),-1.05,1.05);pitch=MathUtils.clamp(-Math.atan2(dir.y,Math.hypot(dir.x,dir.z)),-.50,.45);}
  if(jumpscare>0){
   const twitchY=(Math.sin(time*32)>.35?.32:-.22)*Math.sin(time*55);
   const twitchP=(Math.cos(time*28)>.3?.25:-.3)*Math.cos(time*48);
   yaw=MathUtils.clamp(yaw+twitchY,-1.3,1.3);
   pitch=MathUtils.clamp(pitch+twitchP,-.8,.8);
  }else if(menace>0){
   yaw=MathUtils.clamp(yaw+menace*(Math.sin(time*19)*.25+Math.sin(time*37)*.13),-1.3,1.3);
   pitch=MathUtils.clamp(pitch+menace*(Math.cos(time*23)*.23+Math.sin(time*47)*.09),-.8,.8);
  }
  this.headYaw=MathUtils.damp(this.headYaw,yaw,stunned?2:(jumpscare>0?22:menace>0?18:7),dt);
  this.headPitch=MathUtils.damp(this.headPitch,pitch,jumpscare>0?22:menace>0?18:7,dt);
  const roll=jumpscare>0?Math.sin(time*29)*.25:menace>0?menace*(Math.sin(time*21)*.24+Math.sin(time*43)*.09):(stunned?.1:Math.sin(time*.43)*.065);
  const gaze=new Quaternion().setFromAxisAngle(Y,this.headYaw).multiply(new Quaternion().setFromAxisAngle(X,this.headPitch)).multiply(new Quaternion().setFromAxisAngle(Z,roll));orient(b.Neck,rootQ.clone().multiply(gaze).multiply(this.restQ.get(b.Neck)));
  for(const side of ['Left','Right'])for(const finger of ['Index','Middle','Ring','Pinky','Thumb']){
   const bone=b[side+'Hand'+finger+'2'];
   if(bone){
    const flex=jumpscare>0?(.45+.4*Math.sin(time*26+finger.length*2)):menace>0?menace*(.32+.25*Math.sin(time*18+finger.length*2)):(this.bipedal>.3?.14+.08*Math.sin(time*3.8+finger.length):.025*(1+Math.sin(time*1.9+finger.length)));
    bone.quaternion.multiply(new Quaternion().setFromAxisAngle(X,flex));
   }
  }
  this.root.updateWorldMatrix(true,true);
 }
}
