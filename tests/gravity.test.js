import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Box3} from 'three';
import {LEVELS,LINKS,roomPortals,endpoint,worldPosition,localPosition} from '../src/level.js';
import {collisionWorld,makeGravityBody,stepGravityBody,gravityArrival,bodyCapsule} from '../src/gravity.js';
const rooms=LEVELS.map(r=>({...r,portals:roomPortals(r.id),colliders:[]})),tree=collisionWorld(rooms,{relays:[true,true,true]});
test('all room volumes are separated, never intersecting',()=>{const boxes=LEVELS.map(r=>new Box3().setFromPoints([-5,5].flatMap(x=>[0,4].flatMap(y=>[-r.d/2,r.d/2].map(z=>worldPosition(r.id,new Vector3(x,y,z)))))));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const intersection=boxes[i].clone().intersect(boxes[j]);assert.ok(intersection.isEmpty()||intersection.getSize(new Vector3()).length()===0,`${i}/${j} overlap`);}});
for(const link of LINKS)for(const reverse of [false,true])test(`physical input crosses ${link.id} ${reverse?'back':'forward'} without position tween`,()=>{
 const portal=endpoint(link,reverse?link.b:link.a),feet=reverse?new Vector3(4.64,0,portal.z):new Vector3(portal.x,-.2,portal.z),body=makeGravityBody(portal,feet,reverse?0:-2);
 let yaw=reverse?-Math.PI/2:-link.edgeA*Math.PI/2,arrival,largest=0;
 for(let frame=0;frame<1800&&!arrival;frame++){const previous=body.center.clone();const result=stepGravityBody(body,{yaw,forward:1,side:0,speed:2},1/120,tree);yaw=result.yaw;largest=Math.max(largest,previous.distanceTo(body.center));arrival=gravityArrival(body);}
 assert.ok(arrival,JSON.stringify({link:link.id,reverse,center:localPosition(link.a,body.center).toArray(),field:body.field,velocity:body.velocity.toArray()}));
 assert.equal(arrival.room,portal.to);assert.ok(largest<.18,`continuous position: ${largest}`);assert.ok(!tree.capsuleIntersect(bodyCapsule(body)),'arrival does not intersect walls');
});
test('air controls alter actual position inside the passage',()=>{const p=endpoint(LINKS[0],0),a=makeGravityBody(p,new Vector3(4,-.2,p.z),-2),b=makeGravityBody(p,new Vector3(4,-.2,p.z),-2);for(let i=0;i<45;i++){stepGravityBody(a,{yaw:0,side:0,forward:0,speed:2},1/120,tree);stepGravityBody(b,{yaw:0,side:1,forward:0,speed:2},1/120,tree);}assert.ok(a.center.distanceTo(b.center)>.15);});
