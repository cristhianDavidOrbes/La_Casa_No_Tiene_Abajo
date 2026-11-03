import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {fitCRT} from '../src/asset-fit.js';
import {LEVELS,roomPortals,worldPosition} from '../src/level.js';
const dir=new URL('../public/assets/haven/television_02/',import.meta.url);
function televisionGeometry(){const doc=JSON.parse(fs.readFileSync(new URL('television_02.gltf',dir))),buffer=fs.readFileSync(new URL(doc.buffers[0].uri,dir)),geo=new T.BufferGeometry();
 for(const [name,key] of [['position','POSITION'],['uv','TEXCOORD_0']]){const a=doc.accessors[doc.meshes[0].primitives[0].attributes[key]],v=doc.bufferViews[a.bufferView],n=name==='uv'?2:3,arr=new Float32Array(a.count*n);for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)arr[i*n+j]=buffer.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*4)+j*4);geo.setAttribute(name,new T.BufferAttribute(arr,n));}
 const a=doc.accessors[doc.meshes[0].primitives[0].indices],v=doc.bufferViews[a.bufferView],arr=[];for(let i=0;i<a.count;i++){const o=(v.byteOffset||0)+(a.byteOffset||0)+i*(a.componentType===5123?2:4);arr.push(a.componentType===5123?buffer.readUInt16LE(o):buffer.readUInt32LE(o));}geo.setIndex(arr);return geo;
}
test('video uses the existing curved glass triangles, never a floating plane',()=>{const geo=televisionGeometry(),original=geo.toNonIndexed().attributes.position.array.slice(),root=new T.Group(),mesh=new T.Mesh(geo,new T.MeshStandardMaterial());root.add(mesh);fitCRT(root,new T.Texture());assert.ok(root.userData.screenTriangles>50);assert.equal(root.children.length,1);assert.deepEqual(mesh.geometry.attributes.position.array,original);assert.equal(mesh.geometry.groups.length,2);assert.equal(mesh.geometry.index.count,original.length/3);console.log('CRT glass triangles:',root.userData.screenTriangles);});
