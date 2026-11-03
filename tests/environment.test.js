import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,PerspectiveCamera,Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {Octree} from 'three/addons/math/Octree.js';
import {LEVELS,LINKS,endpoint,roomPortals,worldPosition,roomQuaternion} from '../src/level.js';
import {collisionWorld} from '../src/gravity.js';
import {Pursuer} from '../src/pursuer.js';
import {supportHeight,stepClimber,chooseSpawnRoom} from '../src/environment-navigation.js';
import {createPuzzle,puzzleAnswer,puzzleSolved,puzzleOrder,chairPose,validPuzzle} from '../src/orientation-puzzle.js';
import {fresh,parseSave,notes} from '../src/story.js';
import {probeContact} from '../src/surface-contact.js';
import {HauntDirector,UnseenRetirement,isCreatureObserved,captureDistance,CAPTURE_DURATION} from '../src/horror-director.js';
import {createCreatureRig} from '../src/creature-rig.js';
import {CreatureMotion} from '../src/creature-motion.js';
import {loadRig} from './load-rig.js';
const rooms=LEVELS.map(r=>({...r,portals:roomPortals(r.id),openPortals:roomPortals(r.id),colliders:[]}));
test('the route changes lateral position, with offset entry and exit in multiple rooms',()=>{assert.ok(LEVELS.some(r=>r.pos[2]!==0));assert.ok(rooms.filter(r=>r.portals.length===2&&Math.abs(r.portals[0].z-r.portals[1].z)>3).length>=2);});
test('random physical clues and order persist without exposing a fixed solution',()=>{const combinations=new Set();for(let i=0;i<30;i++){const s=fresh();assert.ok(validPuzzle(s.puzzle));assert.deepEqual(parseSave(JSON.stringify(s)).puzzle,s.puzzle);assert.ok(puzzleSolved(s.puzzle,puzzleAnswer(s.puzzle)));assert.ok(!puzzleSolved(s.puzzle,['SUELO','SUELO','SUELO']));combinations.add(JSON.stringify(s.puzzle.surfaces));assert.ok(!/SUELO|TECHO|PARED/.test(puzzleOrder(s.puzzle)));}assert.ok(combinations.size>1);assert.doesNotMatch(notes.procedure.body,/PARED, TECHO, SUELO/);});
test('chairs are attached to the selected physical surface',()=>{assert.equal(chairPose(1,'SUELO').position[1],0);assert.equal(chairPose(1,'TECHO').position[1],3.98);assert.equal(chairPose(1,'PARED').position[2],3.88);});
test('chair poses across all rooms and surfaces remain bounded, distinct and solvable',()=>{
 const perms=[['SUELO','PARED','TECHO'],['SUELO','TECHO','PARED'],['PARED','SUELO','TECHO'],['PARED','TECHO','SUELO'],['TECHO','SUELO','PARED'],['TECHO','PARED','SUELO']];
 for(const surfaces of perms){
  for(let r=0;r<3;r++){
   const pose=chairPose(r,surfaces[r]);
   const room=LEVELS[r];
   assert.ok(Math.abs(pose.position[0])<room.w/2,'X within room');
   assert.ok(Math.abs(pose.position[2])<room.d/2,'Z within room');
   assert.ok(pose.position[1]>=0&&pose.position[1]<=room.h,'Y within room');
  }
  const puzzle={surfaces,order:[2,0,1],observed:[]};
  assert.ok(validPuzzle(puzzle));
  const ans=puzzleAnswer(puzzle);
  assert.deepEqual(ans,[surfaces[2],surfaces[0],surfaces[1]]);
  assert.ok(puzzleSolved(puzzle,ans));
  assert.ok(!puzzleSolved(puzzle,[ans[1],ans[0],ans[2]]));
 }
});
test('stamina exhaustion requires 100% full recovery before sprinting again',()=>{
 let stamina=100,exhausted=false;
 const simulate=(wantsRun,dt)=>{
  const canRun=wantsRun&&!exhausted&&stamina>0,run=canRun;
  if(run){
   stamina=Math.max(0,stamina-22*dt);
   if(stamina<=0)exhausted=true;
  }else{
   stamina=Math.min(100,stamina+20*dt);
   if(stamina>=100)exhausted=false;
  }
  return {canRun,stamina,exhausted};
 };
 // Run until depleted
 for(let i=0;i<300&&stamina>0;i++)simulate(true,1/60);
 assert.equal(stamina,0);
 assert.equal(exhausted,true);
 // Recover partially to 50%: cannot run yet
 for(let i=0;i<150;i++)simulate(false,1/60);
 assert.ok(stamina>45&&stamina<55);
 assert.equal(exhausted,true);
 assert.equal(simulate(true,1/60).canRun,false,'cannot sprint while exhausted at 50%');
 // Recover to 95%: still cannot run
 for(let i=0;i<130;i++)simulate(false,1/60);
 assert.ok(stamina>=90&&stamina<100);
 assert.equal(exhausted,true);
 assert.equal(simulate(true,1/60).canRun,false,'cannot sprint while exhausted at 95%');
 // Recover to 100%: now exhausted clears!
 for(let i=0;i<30;i++)simulate(false,1/60);
 assert.equal(stamina,100);
 assert.equal(exhausted,false);
 assert.equal(simulate(true,1/60).canRun,true,'sprinting re-enabled at 100%');
 // Partial sprint stopping at 60% does NOT trigger exhausted
 for(let i=0;i<100;i++)simulate(true,1/60);
 assert.ok(stamina>50&&stamina<80);
 assert.equal(exhausted,false);
 assert.equal(simulate(true,1/60).canRun,true,'can sprint without waiting if not completely exhausted');
});
test('spawn never chooses the occupied or transitioning room',()=>{const s=fresh();s.relays=[true,true,true];for(let current=0;current<5;current++)for(let i=0;i<50;i++){const picked=chooseSpawnRoom(current,rooms,s,()=>i/50,[1]);assert.notEqual(picked,current);assert.notEqual(picked,1);}});
for(const [label,h] of [['caja',.65],['silla',.95],['mesa',.90]])test('climbs onto and down from '+label+' without teleporting through its top',()=>{
 const room={...rooms[0],openPortals:[],colliders:[{minX:-.5,maxX:.5,minY:0,maxY:h,minZ:-.5,maxZ:.5}]},p=new Vector3(0,0,1.4);let highest=0,largest=0;
 for(let i=0;i<280;i++){const before=p.clone();stepClimber(p,new Vector3(0,0,-1),.018,1/60,room);highest=Math.max(highest,p.y);largest=Math.max(largest,before.distanceTo(p));if(Math.abs(p.z)<.45)assert.ok(p.y>=h-.04);}
 assert.ok(highest>=h-.01);assert.ok(p.z<-.8);assert.equal(p.y,0);assert.ok(largest<.06);
});
test('surface probes distinguish a furniture top from its adjacent wall',()=>{
 const group=new Group(),mat=new MeshBasicMaterial();for(const [size,pos] of [[[2,.1,3],[0,-.05,0]],[[.1,2,3],[1.05,1,0]]]){const m=new Mesh(new BoxGeometry(...size),mat);m.position.set(...pos);group.add(m);}group.updateMatrixWorld(true);const tree=new Octree().fromGraphNode(group);
 const floor=probeContact(new Vector3(.3,0,0),new Vector3(0,1,0),tree,{origin:new Vector3(.3,.5,0),reach:1.4}),wall=probeContact(new Vector3(.99,.8,0),new Vector3(-1,0,0),tree,{origin:new Vector3(.6,.8,0),reach:1.4,alternates:[new Vector3(0,1,0)]});
 assert.ok(floor.normal.y>.9);assert.ok(wall.normal.x<-.9);
});
test('unseen retirement waits while watched and resets its hidden timer',()=>{const r=new UnseenRetirement();for(let i=0;i<20;i++)assert.equal(r.update(.2,true),false);assert.equal(r.update(.3,false),false);assert.equal(r.update(.1,true),false);assert.equal(r.update(.46,false),true);});
test('progressive haunt events happen before rewinding and do not vanish while watched',()=>{const state=fresh(),d=new HauntDirector();state.room=2;let event=d.update(.1,{state,roomTime:5});assert.equal(event.kind,'figure');event=d.update(10,{state,roomTime:15,observed:true});assert.ok(event);assert.equal(d.update(.5,{state,roomTime:16,observed:false}),null);assert.ok(state.haunts.includes('encounter-2'));assert.equal(d.update(1,{state,roomTime:20}),null);});
test('capture is a short face approach, not an immediate blackout',()=>{assert.ok(captureDistance(0)>captureDistance(.3));assert.ok(captureDistance(.6)>=.35);assert.ok(CAPTURE_DURATION>1&&CAPTURE_DURATION<2);});
test('bigger independent strides lift every extremity and keep IK bounded',async()=>{
 const root=createCreatureRig(await loadRig()),m=new CreatureMotion(root),max=[0,0,0,0];let independent=false,worst=0;
 for(let i=0;i<480;i++){root.position.z=i/60*1.5;m.update(1/60,{speed:1.5,time:i/60});m.swingAmounts.forEach((h,j)=>max[j]=Math.max(max[j],h));independent ||= m.swingAmounts.some(h=>h>.06)&&m.swingAmounts.some(h=>h<.01);worst=Math.max(worst,...m.errors);}
 assert.ok(max.every(h=>h>.11));assert.ok(independent);assert.ok(worst<.012);
});
test('all gravity passages keep the skinned creature finite with reachable independent contacts',async()=>{
 const root=createCreatureRig(await loadRig()),m=new CreatureMotion(root),tree=collisionWorld(rooms,{relays:[true,true,true]});let worst=0,mixed=0;
 for(const reverse of [false,true]){
  const e=new Pursuer(reverse?4:0);e.delay=0;m.reset();
  for(let i=0;i<18000&&e.room!==(reverse?0:4);i++){
   e.update(1/60,{rooms,tree,targetRoom:reverse?0:4,target:worldPosition(reverse?0:4,new Vector3(0,1.68,2))});
   root.position.copy(e.position);root.quaternion.copy(e.rotation);m.update(1/60,{speed:e.speed,time:e.awake,crouch:e.crouch,tree,contactUps:e.contactUps,climbing:e.climbing});
   worst=Math.max(worst,...m.errors);for(const p of m.targets)assert.ok(p.toArray().every(Number.isFinite));
   if(e.body&&m.contactNormals.some(n=>n.dot(m.contactNormals[0])<.8))mixed++;
  }
  assert.equal(e.room,reverse?0:4);
 }
 assert.ok(worst<.10,'worst IK '+worst);assert.ok(mixed>5,'independent wall/floor contacts '+mixed);
});
