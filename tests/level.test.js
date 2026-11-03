import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {LEVELS,LINKS,endpoint,roomPortals,portalOpen,worldPosition,arrivalFor,connectorShape} from '../src/level.js';
import {insideHole,stepVertical} from '../src/physics.js';
test('five named rooms form a connected chain with four two-way links',()=>{assert.equal(LEVELS.length,5);assert.equal(LINKS.length,4);for(let i=0;i<4;i++){assert.ok(roomPortals(i).some(p=>p.to===i+1));assert.ok(roomPortals(i+1).some(p=>p.to===i));}});
for(const link of LINKS){
 test('closed passage meets next floor at an exact edge '+link.id,()=>{const s=connectorShape(link);for(const z of [-1.25,0,1.25]){const a=worldPosition(link.a,new Vector3(s.right,-link.gap,s.z+z)),b=worldPosition(link.b,new Vector3(5,0,link.zB+z));assert.ok(a.distanceTo(b)<1e-8);}});
 for(const id of [link.a,link.b]){
  test('bidirectional fall and safe arrival '+id+' on link '+link.id,()=>{const p=endpoint(link,id),a=arrivalFor(p),r={...LEVELS[id],colliders:[],openPortals:[p]},position={x:p.x,y:0,z:p.z};const result=stepVertical(position,0,.2,r,true);if(p.kind==='floor')assert.ok(result.gap&&position.y<-.18);else assert.equal(result.gap,false);assert.ok(!roomPortals(p.to).some(p=>insideHole(a.position[0],a.position[2],p,-.24)));assert.ok(Math.abs(a.position[0])<5-.24);});
 }
 test('both directions use the same permanent gate '+link.id,()=>{const s={relays:[false,false,false]},a=endpoint(link,link.a),b=endpoint(link,link.b);assert.equal(portalOpen(a,s),portalOpen(b,s));if(link.gate!==null){assert.equal(portalOpen(a,s),false);s.relays[link.gate]=true;}assert.equal(portalOpen(a,s),true);assert.equal(portalOpen(b,s),true);});
}
