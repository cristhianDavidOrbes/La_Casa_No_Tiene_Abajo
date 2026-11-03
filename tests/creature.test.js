import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Bone,Group,Vector3,Quaternion,Matrix4,Mesh,MeshBasicMaterial,BoxGeometry} from 'three';
import {Octree} from 'three/examples/jsm/math/Octree.js';
import {solveLimb,CreatureMotion} from '../src/creature-motion.js';
import {Pursuer} from '../src/pursuer.js';
import {LEVELS,roomPortals,worldPosition} from '../src/level.js';
import {collisionWorld} from '../src/gravity.js';
import {loadRig} from './load-rig.js';
import {createCreatureRig} from '../src/creature-rig.js';

test('delivered creature contains a real 55-joint skin and normalized weights',()=>{const b=fs.readFileSync(new URL('../public/assets/creature/el-inquilino-tripo-repaired.glb',import.meta.url)),length=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+length));assert.equal(j.skins[0].joints.length,55);const binary=20+length+8;for(const mesh of j.meshes)for(const p of mesh.primitives){assert.notEqual(p.attributes.JOINTS_0,undefined);const a=j.accessors[p.attributes.WEIGHTS_0],v=j.bufferViews[a.bufferView];for(let i=0;i<a.count;i++){let sum=0;for(let n=0;n<4;n++)sum+=b.readFloatLE(binary+(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||16)+n*4);assert.ok(Math.abs(sum-1)<.001);}}});
test('two-bone IK places the extremity on a reachable surface point',()=>{const root=new Group(),a=new Bone(),b=new Bone(),c=new Bone();root.add(a);a.add(b);b.add(c);b.position.y=1;c.position.y=1;root.updateMatrixWorld(true);const target=new Vector3(.8,1.3,.2);assert.ok(solveLimb(a,b,c,target,new Vector3(0,0,1))<1e-6);});
test('pursuer crosses all four rooms back without respawning or teleporting',()=>{const rooms=LEVELS.map(r=>({...r,portals:roomPortals(r.id),openPortals:roomPortals(r.id),colliders:[]})),tree=collisionWorld(rooms,{relays:[true,true,true]}),enemy=new Pursuer(4),target=worldPosition(0,new Vector3(0,1.68,0));enemy.delay=0;let maxMove=0,crouched=false;
 for(let i=0;i<18000&&enemy.room>0;i++){const old=enemy.position.clone();enemy.update(1/60,{rooms,targetRoom:0,target,tree});maxMove=Math.max(maxMove,enemy.position.distanceTo(old));crouched ||= enemy.crouch>.5;}
 assert.equal(enemy.room,0,JSON.stringify({room:enemy.room,x:enemy.x,z:enemy.z,body:enemy.body?.center.toArray()}));assert.equal(enemy.crossings,4);assert.ok(crouched);assert.ok(maxMove<.25,`maximum motion ${maxMove}`);
});

test('stepping over an obstacle moves extremities in a smooth continuous arc without teleportation',async()=>{
 const root=createCreatureRig(await loadRig()),m=new CreatureMotion(root);
 const group=new Group(),mat=new MeshBasicMaterial();
 group.add(new Mesh(new BoxGeometry(10,.1,10),mat));
 const box=new Mesh(new BoxGeometry(1,.65,1),mat);box.position.set(0,.65/2,1);group.add(box);
 group.updateMatrixWorld(true);
 const boxTree=new Octree().fromGraphNode(group);

 let maxPerFrameJump=0,prev=[null,null,null,null];
 for(let i=0;i<240;i++){
  root.position.set(0,0,i*.018);
  m.update(1/60,{speed:1.2,time:i/60,tree:boxTree});
  if(i>10){
   for(let j=0;j<4;j++){
    if(prev[j]){
     const d=m.targets[j].distanceTo(prev[j]);
     maxPerFrameJump=Math.max(maxPerFrameJump,d);
    }
    prev[j]=m.targets[j].clone();
   }
  }
 }
 assert.ok(maxPerFrameJump<.22,`max jump was ${maxPerFrameJump}`);
});

test('wall and ceiling climbing maintains orientation and 4-limb IK contact',async()=>{
 const root=createCreatureRig(await loadRig()),m=new CreatureMotion(root);
 const rooms=LEVELS.map(r=>({...r,portals:roomPortals(r.id),openPortals:roomPortals(r.id),colliders:[]})),tree=collisionWorld(rooms,{relays:[true,true,true]});
 function orient(norm,fwd){
  const up=norm.clone().normalize();let f=fwd.clone().addScaledVector(up,-fwd.dot(up)).normalize();
  const r=new Vector3().crossVectors(up,f).normalize();f.crossVectors(r,up).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(r,up,f));
 }

 // Wall test (left wall of room 0)
 root.position.set(-4.75,2,0);
 root.quaternion.copy(orient(new Vector3(1,0,0),new Vector3(0,0,1)));
 m.reset();
 for(let i=0;i<30;i++)m.update(1/60,{speed:1,time:i/60,tree,climbing:true});
 assert.ok(Math.max(...m.errors)<.015,'wall IK error');
 assert.ok(m.contactNormals.some(n=>n.x>.85),'at least one limb contacts wall');
 assert.ok(m.supported.every((supported,i)=>supported||m.swingAmounts[i]>.01),'all limbs are supported or visibly stepping');

 // Ceiling test (ceiling of room 0)
 root.position.set(0,3.8,0);
 root.quaternion.copy(orient(new Vector3(0,-1,0),new Vector3(0,0,1)));
 m.reset();
 for(let i=0;i<30;i++)m.update(1/60,{speed:1,time:i/60,tree,climbing:true});
 assert.ok(Math.max(...m.errors)<.015,'ceiling IK error');
 assert.ok(m.contactNormals.some(n=>n.y<-.85),'at least one limb contacts ceiling');
 assert.ok(m.supported.every((supported,i)=>supported||m.swingAmounts[i]>.01),'all limbs are supported or visibly stepping');
});

test('hands maintain firm support without floating during portal crossings',async()=>{
 const root=createCreatureRig(await loadRig()),m=new CreatureMotion(root);
 const rooms=LEVELS.map(r=>({...r,portals:roomPortals(r.id),openPortals:roomPortals(r.id),colliders:[]})),tree=collisionWorld(rooms,{relays:[true,true,true]});
 for(const reverse of [false,true]){
  const e=new Pursuer(reverse?4:0);e.delay=0;m.reset();
  let unsupportedFrames=0,totalSteps=0;
  for(let i=0;i<18000&&e.room!==(reverse?0:4);i++){
   e.update(1/60,{rooms,tree,targetRoom:reverse?0:4,target:worldPosition(reverse?0:4,new Vector3(0,1.68,2))});
   root.position.copy(e.position);root.quaternion.copy(e.rotation);
   m.update(1/60,{speed:e.speed,time:e.awake,crouch:e.crouch,tree,contactUps:e.contactUps,climbing:e.climbing});
   totalSteps++;
   if(!m.supported[1]&&m.swingAmounts[1]<.01)unsupportedFrames++;
   if(!m.supported[3]&&m.swingAmounts[3]<.01)unsupportedFrames++;
  }
  assert.ok(unsupportedFrames/totalSteps<.08,`unsupported ratio was ${unsupportedFrames}/${totalSteps}`);
 }
});

test('pursuit speeds satisfy: bipedal catches walking player, quadrupedal rushes when far',async()=>{
 const {pursuitSpeed}=await import('../src/pursuer.js');
 assert.ok(pursuitSpeed(3,false,0,true)>=2.4,'bipedal speed is faster than player walk 2.0');
 assert.ok(pursuitSpeed(12,false,0,false)>=5.5,'far quadrupedal speed is faster than player sprint 3.55');
 assert.ok(pursuitSpeed(3,false,0,false)<1.6,'stalking quadrupedal stays slow when bipedal is false');
});

test('creature uses bipedal walk when near player and fast quadrupedal crawl when far or low ceiling',()=>{
 const rooms=LEVELS.map(r=>({...r,portals:roomPortals(r.id),openPortals:roomPortals(r.id),colliders:[]})),tree=collisionWorld(rooms,{relays:[true,true,true]});
 const e=new Pursuer(0,new Vector3(0,0,0));e.delay=0;
 const targetNear=worldPosition(0,new Vector3(0,1.68,3.5));
 for(let i=0;i<60;i++)e.update(1/60,{rooms,targetRoom:0,target:targetNear,tree});
 assert.ok(e.bipedal>0.5,'switches to bipedal when close to player');
 const targetFar=worldPosition(0,new Vector3(0,1.68,12));
 for(let i=0;i<60;i++)e.update(1/60,{rooms,targetRoom:0,target:targetFar,tree});
 assert.ok(e.bipedal<0.2,'switches to quadrupedal crawl when far');
});

test('jumpscare frames clawing hands within view frustum and maintains IK reachability',async()=>{
 const {PerspectiveCamera}=await import('three');
 const {captureDistance}=await import('../src/horror-director.js');
 const root=createCreatureRig(await loadRig()),m=new CreatureMotion(root);
 const cam=new PerspectiveCamera(68,16/9,.045,90);cam.position.set(0,1.68,0);cam.updateMatrixWorld(true);
 const forward=new Vector3(0,0,-1),up=new Vector3(0,1,0);
 root.quaternion.copy(cam.quaternion);root.position.copy(cam.position).addScaledVector(forward,1);
 m.update(1/60,{time:.5,jumpscare:.5,lookTarget:cam.position});
 const head=m.bones.Head.getWorldPosition(new Vector3()),desired=cam.position.clone().addScaledVector(forward,captureDistance(.3)).addScaledVector(up,-.04);
 root.position.add(desired.sub(head));root.updateWorldMatrix(true,true);
 m.update(1/60,{time:.5,jumpscare:.5,lookTarget:cam.position});
 for(let i=0;i<4;i++){
  if(!m.limbs[i].hand)continue;
  const proj=m.targets[i].clone().project(cam);
  assert.ok(proj.z<1.0,'hand is in front of camera plane');
  assert.ok(Math.abs(proj.x)<1.0,'hand is within horizontal screen bounds');
  assert.ok(m.errors[i]<.03,'hand IK error is within threshold');
 }
});

test('close apparition raises both hands above its shoulders with a bent, restless pose',async()=>{
 const root=createCreatureRig(await loadRig()),motion=new CreatureMotion(root);
 motion.bipedal=1;
 motion.update(1/60,{time:.8,bipedal:1,menace:1,lookTarget:new Vector3(0,1.68,1)});
 for(const [side,index] of [['Left',1],['Right',3]]){
  const shoulder=motion.bones[side+'Arm'].getWorldPosition(new Vector3());
  assert.ok(motion.targets[index].y>shoulder.y+.1,`${side} hand must be raised`);
  assert.ok(motion.targets[index].distanceTo(shoulder)<.9,`${side} arm must stay bent`);
 }
 assert.ok(motion.errors.every(Number.isFinite));
});

test('entrance watcher keeps its arms down and peeks below eye height',async()=>{
 const root=createCreatureRig(await loadRig()),motion=new CreatureMotion(root);
 root.position.y=-1.4;motion.bipedal=1;
 motion.update(1/60,{time:.8,bipedal:1,lookTarget:new Vector3(0,1.68,2)});
 const head=motion.bones.Head.getWorldPosition(new Vector3());
 assert.ok(head.y>.5&&head.y<1.6,`head height ${head.y}`);
 for(const [side,index] of [['Left',1],['Right',3]]){
  const shoulder=motion.bones[side+'Arm'].getWorldPosition(new Vector3());
  assert.ok(motion.targets[index].y<shoulder.y-.25,`${side} arm must hang below shoulder`);
 }
});


