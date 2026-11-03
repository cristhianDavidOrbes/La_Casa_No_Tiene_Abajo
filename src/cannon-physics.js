import * as C from 'cannon-es';
import {Vector3,Quaternion,Box3} from 'three';
import {LINKS,roomQuaternion,worldPosition,localPosition} from './level.js';
import {shellBoxes,connectorBoxes} from './architecture.js';
import {ENTRY_DOOR} from './entry-door.js';
const Y=new Vector3(0,1,0),STEP=1/120;
export const PHYSICS_GROUP={scene:1,player:2,monster:4,book:8};
const cv=v=>new C.Vec3(v.x,v.y,v.z),cq=q=>new C.Quaternion(q.x,q.y,q.z,q.w);
const tv=v=>new Vector3(v.x,v.y,v.z);
// Bounds in the model's own axes, not an inverse-transformed world AABB.
// Rotating a world AABB back inflates it and makes props collide in empty space.
function modelBounds(root){
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),bounds=new Box3();
 root.traverse(node=>{if(!node.isMesh||!node.geometry)return;if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();bounds.union(node.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld)));});
 if(bounds.isEmpty())bounds.set(new Vector3(-.001,-.001,-.001),new Vector3(.001,.001,.001));
 const scale=root.getWorldScale(new Vector3());scale.set(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z));
 return {size:bounds.getSize(new Vector3()).multiply(scale),offset:bounds.getCenter(new Vector3()).multiply(scale),center:root.localToWorld(bounds.getCenter(new Vector3()))};
}

// One simulation clock for players, creatures, furniture and loose props.
// World gravity is zero: each body receives the force for its current room.
export class CannonPhysics{
 constructor(rooms,state){
  this.rooms=rooms;this.state=state;this.accumulator=0;this.actors=new Set();this.props=new Set();this.statics=[];this.doors=[];this.pickups=[];
  this.world=new C.World({gravity:new C.Vec3(0,0,0),allowSleep:true});
  this.world.broadphase=new C.SAPBroadphase(this.world);this.world.solver.iterations=12;this.world.solver.tolerance=.00001;
  this.world.frictionGravity=new C.Vec3(0,-13.8,0);
  this.sceneMaterial=new C.Material('house');this.actorMaterial=new C.Material('character');this.bookMaterial=new C.Material('paper-and-cover');
  this.world.addContactMaterial(new C.ContactMaterial(this.sceneMaterial,this.actorMaterial,{friction:0,restitution:0,contactEquationStiffness:1e8,contactEquationRelaxation:3}));
  this.world.addContactMaterial(new C.ContactMaterial(this.sceneMaterial,this.bookMaterial,{friction:.48,restitution:.20}));
  this.world.addContactMaterial(new C.ContactMaterial(this.bookMaterial,this.bookMaterial,{friction:.5,restitution:.12}));
  this.world.addContactMaterial(new C.ContactMaterial(this.actorMaterial,this.bookMaterial,{friction:.15,restitution:0}));
  this.rebuild(state);
 }
 box(size,position,rotation,metadata={}){
  const body=new C.Body({mass:0,material:this.sceneMaterial,shape:new C.Box(new C.Vec3(...size.map(n=>Math.max(.002,n)/2))),position:cv(position),quaternion:cq(rotation),collisionFilterGroup:PHYSICS_GROUP.scene,collisionFilterMask:-1});
  body.game=metadata;this.world.addBody(body);this.statics.push(body);return body;
 }
 rebuild(state){
  this.state=state;for(const body of this.statics)this.world.removeBody(body);this.statics=[];this.doors=[];this.pickups=[];
  for(const room of this.rooms){
   room.physics=this;
   const add=(box,metadata={})=>this.box(box.size,worldPosition(room.id,new Vector3(...box.pos)),roomQuaternion(room.id),{room:room.id,...metadata});
   for(const box of shellBoxes(room))add(box);
   if(room.entryDoor){
    const d=ENTRY_DOOR,pivot=room.entryDoor.pivot,center=new Vector3(d.width/2,d.height/2,0);pivot.updateWorldMatrix(true,true);
    const leaf=this.box([d.width-.04,d.height-.045,d.thickness],pivot.localToWorld(center.clone()),pivot.getWorldQuaternion(new Quaternion()),{room:room.id,door:true});
    leaf.type=C.Body.KINEMATIC;leaf.updateMassProperties();this.doors.push({body:leaf,pivot,center});
    // Keep the threshold/porch supported, but leave the folded archive and
    // broadcast room clear: their world bounds reach z=7.34, x=6.86..23.58.
    // The broad yard resumes beyond them, with a small collision clearance.
    for(const [x0,x1,z0,z1] of [[-80,6.7,6,7.5],[23.8,80,6,7.5],[-80,80,7.5,146]]){
     add({size:[x1-x0,.2,z1-z0],pos:[(x0+x1)/2,-.1,(z0+z1)/2]},{exterior:true});
    }
   }
   for(const portal of room.portals)if(portal.kind==='floor'&&portal.cover){
    portal.cover.updateWorldMatrix(true,true);
    const leaf=this.box([1.975,.065,2.475],portal.cover.localToWorld(new Vector3(0,.0325,0)),roomQuaternion(room.id),{gate:portal.link,room:room.id});
    leaf.type=C.Body.KINEMATIC;leaf.updateMassProperties();this.doors.push({body:leaf,pivot:portal.cover,center:new Vector3(0,.0325,0),portal});
   }
   for(const bounds of room.colliders){
    if(bounds.enabled===false||bounds.mesh===room.locker?.model)continue;
    add({size:[bounds.maxX-bounds.minX,bounds.maxY-bounds.minY,bounds.maxZ-bounds.minZ],pos:[(bounds.minX+bounds.maxX)/2,(bounds.minY+bounds.maxY)/2,(bounds.minZ+bounds.maxZ)/2]},{mesh:bounds.mesh});
   }
   const locker=room.locker;
   if(locker?.active){
    locker.model.updateWorldMatrix(true,true);
    const modelQ=locker.model.getWorldQuaternion(new Quaternion());
    for(const [size,point] of [[[.035,1.99,.74],[-.49,1.10,-.045]],[[.035,1.99,.74],[.49,1.10,-.045]],[[.98,1.99,.035],[0,1.10,-.395]],[[.98,.035,.74],[0,.12,-.045]],[[.98,.035,.74],[0,2.08,-.045]]])this.box(size,locker.model.localToWorld(new Vector3(...point)),modelQ,{room:room.id,locker:true});
    // A hinged kinematic leaf: driven by the existing opening interaction,
    // but its collision surface moves with the actual door, not an AABB.
    const leaf=this.box([.92,1.91,.025],locker.door.localToWorld(new Vector3(.46,1.105,.0125)),locker.door.getWorldQuaternion(new Quaternion()),{room:room.id,door:true});
    leaf.removeShape(leaf.shapes[0]);
    for(const [size,offset] of [[[.92,1.10,.025],[0,-.405,0]],[[.92,.36,.025],[0,.775,0]],[[.13,.45,.025],[-.395,.37,0]],[[.13,.45,.025],[.395,.37,0]],[[.66,.016,.035],[0,.29,0]],[[.66,.016,.035],[0,.45,0]]])leaf.addShape(new C.Box(new C.Vec3(...size.map(n=>n/2))),new C.Vec3(...offset));
    leaf.type=C.Body.KINEMATIC;leaf.updateMassProperties();this.doors.push({body:leaf,pivot:locker.door,center:new Vector3(.46,1.105,.0125)});
   }
  }
  // Pickups and notes rest in authored positions, but are real static bodies
  // until collected/hidden. They aren't random falling decoration.
  for(const room of this.rooms)for(const item of room.interactions){
   if(!item.mesh||!['flashlight','fuse','tape','note'].includes(item.type))continue;
   const {size,center}=modelBounds(item.mesh);
   const body=this.box(size.toArray(),center,item.mesh.getWorldQuaternion(new Quaternion()),{room:room.id,pickup:item.id});this.pickups.push({body,item});
  }
  for(const link of LINKS)for(const box of connectorBoxes(link))this.box(box.size,worldPosition(link.a,new Vector3(...box.pos)),roomQuaternion(link.a),{connector:link.id});
  this.world.broadphase.dirty=true;
 }
 createCharacter(feet,room,{height=1.68,radius=.24,monster=false}={}){
  const frame=roomQuaternion(room),up=Y.clone().applyQuaternion(frame),body=new C.Body({mass:monster?95:80,material:this.actorMaterial,fixedRotation:true,allowSleep:false,linearDamping:0,angularDamping:1,collisionFilterGroup:monster?PHYSICS_GROUP.monster:PHYSICS_GROUP.player,collisionFilterMask:PHYSICS_GROUP.scene|PHYSICS_GROUP.book});
  const actor={body,height:0,radius,room,frame,up,gravityUp:up.clone(),contacts:[],desired:new Vector3(),gravity:13.8,grounded:false,enabled:true,transition:null,verticalMotor:null,physics:this};
  this.resizeCharacter(actor,height);body.position.copy(cv(feet.clone().addScaledVector(up,height/2)));body.quaternion.copy(cq(frame));body.updateMassProperties();body.aabbNeedsUpdate=true;this.world.addBody(body);this.actors.add(actor);return actor;
 }
 resizeCharacter(actor,height){
  if(Math.abs(actor.height-height)<.02)return;
  const feet=this.feet(actor),body=actor.body,r=actor.radius,length=Math.max(.02,height-2*r);
  while(body.shapes.length)body.removeShape(body.shapes[0]);
  body.addShape(new C.Cylinder(r,r,length,12));body.addShape(new C.Sphere(r),new C.Vec3(0,length/2,0));body.addShape(new C.Sphere(r),new C.Vec3(0,-length/2,0));
  actor.height=height;body.position.copy(cv(feet.addScaledVector(actor.up,height/2)));body.updateMassProperties();body.aabbNeedsUpdate=true;
 }
 feet(actor){return tv(actor.body.position).addScaledVector(actor.up,-actor.height/2);}
 configure(actor,{frame=actor.frame,desired=new Vector3(),gravity=13.8,gravityUp=null,verticalMotor=null,preserveFeet=true}={}){
  const feet=this.feet(actor),oldUp=actor.up.clone();actor.frame.copy(frame);actor.up.copy(Y).applyQuaternion(frame);actor.desired.copy(desired);actor.gravity=gravity;actor.verticalMotor=verticalMotor;
  actor.body.quaternion.copy(cq(frame));
  actor.gravityUp.copy(gravityUp??actor.up).normalize();
  // On a wall/ceiling normal change, rotate around the physical center. Rotating
  // around the ceiling contact would put an upright capsule above the ceiling.
  if(preserveFeet&&oldUp.dot(actor.up)>.95)actor.body.position.copy(cv(feet.addScaledVector(actor.up,actor.height/2)));
  actor.body.aabbNeedsUpdate=true;
 }
 teleport(actor,feet,room){actor.room=room;actor.transition=null;actor.frame.copy(roomQuaternion(room));actor.up.copy(Y).applyQuaternion(actor.frame);actor.gravityUp.copy(actor.up);actor.contacts=[];actor.body.position.copy(cv(feet.clone().addScaledVector(actor.up,actor.height/2)));actor.body.quaternion.copy(cq(actor.frame));actor.body.velocity.setZero();actor.body.angularVelocity.setZero();actor.body.force.setZero();actor.body.torque.setZero();actor.desired.set(0,0,0);actor.verticalMotor=null;actor.grounded=false;actor.body.aabbNeedsUpdate=true;actor.body.wakeUp();this.world.broadphase.dirty=true;}
 enable(actor,on){if(!actor)return;actor.enabled=on;actor.body.collisionFilterMask=on?PHYSICS_GROUP.scene|PHYSICS_GROUP.book:0;if(!on){actor.desired.set(0,0,0);actor.body.velocity.setZero();actor.body.force.setZero();}}
 removeCharacter(actor){if(!actor)return;this.world.removeBody(actor.body);this.actors.delete(actor);}
 jump(actor,speed=4.5){if(!actor?.enabled||!actor.grounded)return false;const v=tv(actor.body.velocity),vertical=v.dot(actor.up);actor.body.velocity.copy(cv(v.addScaledVector(actor.up,speed-vertical)));actor.grounded=false;actor.body.wakeUp();return true;}
 createProp(root,room,{mass=.35,material=this.bookMaterial,onImpact=null}={}){
  const {size,offset}=modelBounds(root),body=new C.Body({mass,material,position:cv(root.getWorldPosition(new Vector3())),quaternion:cq(root.getWorldQuaternion(new Quaternion())),allowSleep:true,sleepSpeedLimit:.15,sleepTimeLimit:.7,linearDamping:.04,angularDamping:.12,collisionFilterGroup:PHYSICS_GROUP.book,collisionFilterMask:PHYSICS_GROUP.scene|PHYSICS_GROUP.book|PHYSICS_GROUP.player|PHYSICS_GROUP.monster});
  body.addShape(new C.Box(new C.Vec3(Math.max(.002,size.x)/2,Math.max(.002,size.y)/2,Math.max(.002,size.z)/2)),cv(offset));
  const prop={root,body,room,active:false};body.type=C.Body.KINEMATIC;body.collisionFilterMask=0;body.updateMassProperties();
  if(onImpact)body.addEventListener('collide',event=>{if(prop.active&&Math.abs(event.contact.getImpactVelocityAlongNormal())>1.1)onImpact(tv(body.position));});
  this.props.add(prop);this.world.addBody(body);return prop;
 }
 launchProp(prop,velocity,spin){prop.body.type=C.Body.DYNAMIC;prop.body.collisionFilterMask=15;prop.body.updateMassProperties();prop.body.velocity.copy(cv(velocity));prop.body.angularVelocity.copy(cv(spin));prop.body.wakeUp();prop.active=true;}
 resetProp(prop){prop.active=false;prop.body.type=C.Body.KINEMATIC;prop.body.collisionFilterMask=0;prop.body.velocity.setZero();prop.body.angularVelocity.setZero();prop.body.force.setZero();prop.body.updateMassProperties();prop.root.updateWorldMatrix(true,true);prop.body.position.copy(cv(prop.root.getWorldPosition(new Vector3())));prop.body.quaternion.copy(cq(prop.root.getWorldQuaternion(new Quaternion())));prop.body.aabbNeedsUpdate=true;}
 gravityField(prop){
  let field=prop.room;const center=tv(prop.body.position);
  for(const link of LINKS){if(field!==link.a&&field!==link.b)continue;const p=localPosition(link.a,center),holeX=link.edgeA*4;if(Math.abs(p.x-holeX)>1.15||Math.abs(p.z-link.zA)>1.4)continue;if(p.y<-.96)field=link.b;else if(p.y>.3)field=link.a;}
  prop.room=field;return Y.clone().applyQuaternion(roomQuaternion(field));
 }
 step(dt){
  for(const door of this.doors){door.pivot.updateWorldMatrix(true,true);const p=door.pivot.localToWorld(door.center.clone());door.body.position.copy(cv(p));door.body.quaternion.copy(cq(door.pivot.getWorldQuaternion(new Quaternion())));door.body.collisionFilterMask=door.pivot.visible?-1:0;door.body.aabbNeedsUpdate=true;}
  this.world.broadphase.dirty=true;
  for(const pickup of this.pickups){const item=pickup.item,used=item.type==='flashlight'?this.state.flashlight:item.type==='fuse'?this.state.fuse||this.state.relays[0]:item.type==='tape'?this.state.tape:false;pickup.body.collisionFilterMask=used?0:-1;}
  this.accumulator=Math.min(.05,this.accumulator+Math.max(0,dt));
  while(this.accumulator>=STEP){
   for(const actor of this.actors){
    if(!actor.enabled)continue;
    const transition=actor.transition;
    if(transition){
     const p=localPosition(transition.link.a,tv(actor.body.position));let field=transition.field;
     if(p.y<-.96)field=transition.link.b;else if(p.y>.3)field=transition.link.a;
     if(field!==transition.field){transition.field=field;transition.changed=true;transition.inputYaw=field===transition.link.b?Math.PI/2:(transition.link.edgeA>0?Math.PI/2:-Math.PI/2);if(field===transition.link.a){const n=Y.clone().applyQuaternion(roomQuaternion(field)),v=tv(actor.body.velocity);actor.body.velocity.copy(cv(v.addScaledVector(n,Math.max(0,5.8-v.dot(n)))));}}
     actor.frame.rotateTowards(roomQuaternion(field),5.5*STEP);actor.up.copy(Y).applyQuaternion(actor.frame);actor.body.quaternion.copy(cq(actor.frame));actor.room=field;actor.body.aabbNeedsUpdate=true;
     actor.gravityUp.copy(Y).applyQuaternion(roomQuaternion(field));
    }
    // Force scaling must never mutate the actor's unit up vector. It is also
    // used to locate the feet/camera and to split velocity on the next step.
    const forceUp=transition?Y.clone().applyQuaternion(roomQuaternion(transition.field)):actor.gravityUp.clone();
    const v=tv(actor.body.velocity),vertical=v.dot(forceUp),tangent=v.clone().addScaledVector(forceUp,-vertical),desired=actor.desired.clone().addScaledVector(forceUp,-actor.desired.dot(forceUp));
    v.addScaledVector(desired.sub(tangent),Math.min(1,(actor.grounded?24:14)*STEP));
    if(actor.verticalMotor!==null)v.addScaledVector(forceUp,actor.verticalMotor-v.dot(forceUp));
    actor.body.velocity.copy(cv(v));actor.body.force.copy(cv(forceUp.multiplyScalar(-actor.gravity*actor.body.mass)));
   }
   for(const prop of this.props)if(prop.active&&prop.body.sleepState!==C.Body.SLEEPING)prop.body.force.copy(cv(this.gravityField(prop).multiplyScalar(-13.8*prop.body.mass)));
   this.world.step(STEP);this.accumulator-=STEP;
   for(const actor of this.actors){
    actor.grounded=false;actor.contacts=[];if(!actor.enabled)continue;
    const supportUp=actor.transition?Y.clone().applyQuaternion(roomQuaternion(actor.transition.field)):actor.gravityUp;
    for(const contact of this.world.contacts){
     if(!contact.enabled)continue;const sign=contact.bi===actor.body?-1:contact.bj===actor.body?1:0;if(!sign)continue;
     const normal=tv(contact.ni).multiplyScalar(sign),other=sign===-1?contact.bj:contact.bi,offset=sign===-1?contact.rj:contact.ri;
     actor.contacts.push({normal,point:tv(other.position).add(tv(offset)),body:other});
     if(normal.dot(supportUp)>.55)actor.grounded=true;
    }
   }
  }
 }
 syncProp(prop){if(!prop.active)return;const p=tv(prop.body.position),q=new Quaternion(prop.body.quaternion.x,prop.body.quaternion.y,prop.body.quaternion.z,prop.body.quaternion.w);prop.root.position.copy(prop.root.parent.worldToLocal(p));prop.root.quaternion.copy(prop.root.parent.getWorldQuaternion(new Quaternion()).invert().multiply(q));}
 // Limbs may only plant on solid scene surfaces, not loose books or pickups.
 // Filter while raycasting, rather than rejecting the closest hit afterwards.
 raySurface(ray,maxDistance=2,{normal=null,minDot=.35,room=null,architectureOnly=false}={}){
  let nearest=null;const end=ray.origin.clone().addScaledVector(ray.direction,maxDistance);
  this.world.raycastAll(cv(ray.origin),cv(end),{collisionFilterMask:PHYSICS_GROUP.scene,skipBackfaces:true},hit=>{
   const body=hit.body,meta=body.game??{};
   if(meta.pickup||body.collisionFilterMask===0||(room!==null&&meta.room!==room)||(architectureOnly&&(meta.mesh||meta.locker||meta.door||meta.gate!==undefined)))return;
   if(normal&&tv(hit.hitNormalWorld).dot(normal)<minDot)return;
   if(!nearest||hit.distance<nearest.distance)nearest=this.surfaceResult(hit);
  });return nearest??false;
 }
 rayIntersect(ray,maxDistance=90){
  const hit=new C.RaycastResult(),end=ray.origin.clone().addScaledVector(ray.direction,maxDistance);
  if(!this.world.raycastClosest(cv(ray.origin),cv(end),{collisionFilterMask:PHYSICS_GROUP.scene|PHYSICS_GROUP.book,skipBackfaces:true},hit))return false;
  return this.surfaceResult(hit);
 }
 surfaceResult(hit){
  const normal=tv(hit.hitNormalWorld),point=tv(hit.hitPointWorld),body=hit.body,shape=hit.shape;
  const triangle={getNormal:target=>target.copy(normal),closestPointToPoint:(p,target)=>{
   if(shape instanceof C.Box){const local=body.pointToLocalFrame(cv(p)),n=body.vectorToLocalFrame(cv(normal)),half=shape.halfExtents,offset=body.shapeOffsets[body.shapes.indexOf(shape)]??new C.Vec3();local.vsub(offset,local);local.x=Math.max(-half.x,Math.min(half.x,local.x));local.y=Math.max(-half.y,Math.min(half.y,local.y));local.z=Math.max(-half.z,Math.min(half.z,local.z));const axis=Math.abs(n.x)>.9?'x':Math.abs(n.y)>.9?'y':'z';local[axis]=Math.sign(n[axis])*half[axis];local.vadd(offset,local);return target.copy(tv(body.pointToWorldFrame(local)));}
   return target.copy(p).addScaledVector(normal,-p.clone().sub(point).dot(normal));
  }};
  return {distance:hit.distance,position:point,normal,body,triangle};
 }
}
