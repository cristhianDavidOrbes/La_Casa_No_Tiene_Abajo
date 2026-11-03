import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseLockerRooms,validLockerRooms,LockerSearch} from '../src/locker.js';
import {flickerFactor} from '../src/threat-light.js';

test('each run selects exactly two distinct interior rooms',()=>{for(let i=0;i<100;i++){const random=()=>Math.random(),rooms=chooseLockerRooms(random);assert.ok(validLockerRooms(rooms));assert.ok(rooms.every(n=>n>0&&n<4));}});
test('hidden player leaves a last-seen room and enemy searches either adjacent room',()=>{const left=new LockerSearch(()=>0);left.hide(2);assert.equal(left.update(.1,1),2);assert.equal(left.update(.1,2),2);assert.equal(left.update(3.3,2),1);left.emerge();assert.equal(left.update(1,1),null);const right=new LockerSearch(()=>.99);right.hide(2);right.update(.1,2);assert.equal(right.update(3.3,2),3);});
test('each light flickers mildly one room away and strongly up close',()=>{const near=flickerFactor({lightRoom:2,monsterRoom:2,distance:1,time:.35}),adjacent=flickerFactor({lightRoom:2,monsterRoom:1,distance:Infinity,time:.35}),far=flickerFactor({lightRoom:2,monsterRoom:0,distance:Infinity,time:.35});assert.equal(far,1);assert.ok(near<=adjacent);assert.ok(adjacent<=1);});
