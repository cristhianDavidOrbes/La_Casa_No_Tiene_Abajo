import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Ray,Plane,PerspectiveCamera} from 'three';
import {RearApparition,REAR_HAUNT_ID,shouldStartRearHaunt} from '../src/rear-apparition.js';
import {WatcherHead,WATCHER_HEAD_ID,WATCHER_SCALE,WATCHER_RETREAT_METERS,watcherThresholdSite,watcherRetreatHead,configureWatcher,watcherIsObserved} from '../src/watcher-head.js';
import {createCreatureRig} from '../src/creature-rig.js';
import {CreatureMotion} from '../src/creature-motion.js';
import {LEVELS,roomPortals,worldPosition} from '../src/level.js';
import {collisionWorld} from '../src/gravity.js';
import {fresh} from '../src/story.js';
import {loadRig} from './load-rig.js';

const room={w:10,d:8};
test('apparition follows translation behind the original facing, not the new facing',()=>{
 const player=new Vector3(0,0,0),a=new RearApparition(player,new Vector3(0,0,1),room);
 assert.ok(a.local.z>1.1&&a.local.z<1.3);
 player.set(1.2,0,-.6);a.position(player,room);
 assert.ok(Math.abs(a.local.x-1.2)<1e-6);
 assert.ok(Math.abs(a.local.z-.65)<1e-6);
 assert.equal(a.update(.6,false),null);
 assert.equal(a.spotted,false);
});
test('apparition remains visible for 0.5 seconds after being seen',()=>{
 const player=new Vector3(0,0,0),a=new RearApparition(player,new Vector3(0,0,1),room);
 assert.equal(a.update(.6,true),'spotted');
 player.x=2;a.position(player,room);assert.equal(a.local.x,0,'stops tracking once seen');
 assert.equal(a.update(.49,true),null);
 assert.equal(a.update(.01,true),'vanished');
});
test('apparition starts when the chair puzzle is solved, before the tape is collected',()=>{
 const state=fresh();state.room=2;
 assert.equal(shouldStartRearHaunt(state,25),false);
 state.relays[2]=true;
 assert.equal(shouldStartRearHaunt(state,25),true);
 state.room=3;assert.equal(shouldStartRearHaunt(state,2),true,'can still begin if the player crossed unseen');
 state.tape=true;assert.equal(shouldStartRearHaunt(state,2),true,'an older save can still show the encounter if the tape was already collected');
 state.haunts.push(REAR_HAUNT_ID);assert.equal(shouldStartRearHaunt(state,2),false);
});
test('apparition keeps a usable position behind the player near an entry wall',()=>{
 const player=new Vector3(3.15,0,0),a=new RearApparition(player,new Vector3(1,0,0),{id:2,w:10,d:8,colliders:[]});
 const delta=a.local.clone().sub(player);
 assert.ok(delta.length()>=.65&&delta.length()<1.3);
 assert.ok(delta.x/delta.length()>.5);
});
test('watching head follows later entrances until seen, without disabling the monster',()=>{
 const state=fresh(),head=new WatcherHead();state.room=1;
 assert.equal(head.update(.1,{state,roomTime:1,observed:false}),'watching');
 assert.equal(head.room,1);
 state.room=2;assert.equal(head.update(.1,{state,roomTime:1,observed:false}),'watching');
 assert.equal(head.room,2);
 assert.equal(head.update(.1,{state,roomTime:1,observed:true}),'noticed');
 assert.equal(head.update(.49,{state,roomTime:1,observed:false}),'watching');
 assert.equal(head.update(.01,{state,roomTime:1,observed:false}),'hidden');
 state.haunts.push(WATCHER_HEAD_ID);
 assert.equal(head.update(1,{state,roomTime:1,observed:false}),'inactive');
 assert.equal(shouldStartRearHaunt({...state,relays:[true,true,true]},2),true);
});
test('watching head stays beside the previous room exit, not inside a shaft',()=>{
 const rooms=LEVELS.map(room=>({...room,portals:roomPortals(room.id)}));
 assert.equal(watcherThresholdSite(rooms,0),null);
 for(let currentRoom=1;currentRoom<rooms.length;currentRoom++){
  const site=watcherThresholdSite(rooms,currentRoom);
  const opening=rooms[currentRoom-1].portals.find(p=>p.kind==='floor'&&p.to===currentRoom);
  assert.equal(site.room,currentRoom-1);
  assert.equal(site.x,opening.x-.3);
  assert.ok(Math.abs(site.z-opening.z)>opening.d/2,'the head is on floor beyond a side rim, not in the middle of the hole');
  assert.equal(Math.sign(site.z-opening.z),currentRoom%2?-1:1,'the side follows the gravity turn and stays visible');
  assert.ok(Math.abs(site.z)<rooms[currentRoom-1].d/2,'the head remains inside the previous room');
  assert.ok(site.y>0,'the head does not hang in the shaft');
 }
});
test('watcher retreats across the old room floor, never down toward the player',()=>{
 const rooms=LEVELS.map(room=>({...room,portals:roomPortals(room.id)}));
 for(let currentRoom=1;currentRoom<rooms.length;currentRoom++){
  const site=watcherThresholdSite(rooms,currentRoom);
  const start=watcherRetreatHead(site,0),middle=watcherRetreatHead(site,.5),end=watcherRetreatHead(site,1);
  assert.deepEqual(start,{x:site.x,y:site.y,z:site.z});
  assert.equal(middle.y,site.y,'height stays above the previous floor');
  assert.equal(end.y,site.y,'the monster must not sink into the passage');
  assert.equal(end.z,site.z);
  assert.ok((end.x-site.x)*site.edge<0,'retreat moves away from the previous exit');
  assert.ok(Math.abs(end.x-site.x-WATCHER_RETREAT_METERS*-site.edge)<1e-8);
  assert.ok(Math.abs(end.x)<rooms[site.room].w/2,'it remains inside the previous room');
  assert.ok((middle.x-site.x)*site.edge<0,'the movement is already backwards halfway through');
 }
});
test('watcher keeps the entire animated body at 1.4 scale, clipped below shoulders',async()=>{
 const rig=createCreatureRig(await loadRig()),mesh=rig.getObjectByProperty('isSkinnedMesh',true),source=mesh.geometry,material=mesh.material;
 const plane=new Plane(new Vector3(0,1,0),0);configureWatcher(rig,plane);
 const motion=new CreatureMotion(rig);motion.bipedal=1;
 assert.equal(rig.scale.x,WATCHER_SCALE);
 assert.equal(mesh.geometry,source,'no part of the original model is cut from its geometry');
 assert.equal(mesh.geometry.index.count,6316*3);
 assert.notEqual(mesh.material,material,'the chase creature material is unaffected');
 assert.equal(mesh.material.clippingPlanes[0],plane);
 motion.update(.1,{time:0,bipedal:1});rig.updateWorldMatrix(true,true);
 const y=name=>motion.bones[name].getWorldPosition(new Vector3()).y;
 const headHeight=.55,shoulderHeight=headHeight-(y('Head')-y('LeftArm')),chestHeight=headHeight-(y('Head')-y('Spine2'));
 assert.ok(shoulderHeight>0&&shoulderHeight<.3,'shoulders protrude above the floor');
 assert.ok(chestHeight<0,'chest and lower body remain below the clipping plane');
});
test('watcher reacts to a visible upper silhouette from far away even if the bone center is occluded',()=>{
 const rooms=LEVELS.map(room=>({...room,portals:roomPortals(room.id),colliders:[]})),tree=collisionWorld(rooms,{relays:[true,true,true]});
 const site=watcherThresholdSite(rooms,1),eye=worldPosition(1,new Vector3(3.15,1.68,0));
 const low=worldPosition(site.room,new Vector3(site.x,-.05,site.z));
 const high=worldPosition(site.room,new Vector3(site.x,site.y+.28,site.z));
 const camera=new PerspectiveCamera(68,16/9,.045,90);camera.position.copy(eye);camera.lookAt(high);
 assert.equal(watcherIsObserved(camera,[low],tree),false,'the lip blocks a low single-point test');
 assert.equal(watcherIsObserved(camera,[low,high],tree),true,'the visible upper head is noticed from the next room');
 const distant=new PerspectiveCamera(68,16/9,.045,90);distant.position.copy(high).add(new Vector3(0,0,15));distant.lookAt(high);
 assert.equal(watcherIsObserved(distant,[high],null),true,'detection is not restricted to 12 m');
});
test('the watcher head can be seen from every current room without looking through a wall',()=>{
 const rooms=LEVELS.map(room=>({...room,portals:roomPortals(room.id),colliders:[]}));
 const tree=collisionWorld(rooms,{relays:[true,true,true]});
 for(let currentRoom=1;currentRoom<rooms.length;currentRoom++){
  const site=watcherThresholdSite(rooms,currentRoom),eye=worldPosition(currentRoom,new Vector3(3.15,1.68,0));
  const head=worldPosition(site.room,new Vector3(site.x,site.y,site.z));
  const direction=head.clone().sub(eye),distance=direction.length();
  const obstacle=tree.rayIntersect(new Ray(eye,direction.normalize()));
  assert.ok(!obstacle||obstacle.distance>distance-.14,`room ${currentRoom}: head hidden by structure`);
 }
});
