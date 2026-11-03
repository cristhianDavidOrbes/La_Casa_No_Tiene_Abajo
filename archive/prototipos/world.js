// Escenario antiguo, archivado para no confundirlo con src/house.js.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const BASE='/assets/';
const loader=new GLTFLoader();
const texLoader=new T.TextureLoader();
const modelNames=['loungeChair','cabinetTelevision','televisionVintage','sideTable','bookcaseOpen','books','rugRectangle','radio','lampSquareCeiling','lampWall','doorway','cardboardBoxClosed','cabinetBed','chair','pillow','speaker','table','televisionAntenna','desk','computerKeyboard'];
const models={};
const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.85,...extra});
let wood,plaster;
const trim=material('#303b33'),iron=material('#293433',{metalness:.65,roughness:.45}),brass=material('#9f8757',{metalness:.6,roughness:.35});

export async function loadAssets(progress){
 let done=0;const total=modelNames.length+7;
 const tick=()=>progress(++done,total);
 await Promise.all(modelNames.map(async name=>{const g=await loader.loadAsync(`${BASE}models/${name}.glb`);models[name]=g.scene;tick();}));
 const texture=async(file,color=false)=>{let t=await texLoader.loadAsync(BASE+'textures/'+file);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=T.SRGBColorSpace;tick();return t;};
 const [wd,wn,wr,cd,cn,cr]=await Promise.all([texture('wood-diff.jpg',true),texture('wood-nor_gl.jpg'),texture('wood-Rough.jpg'),texture('concrete-Diffuse.jpg',true),texture('concrete-nor_gl.jpg'),texture('concrete-Rough.jpg')]);
 wood=new T.MeshStandardMaterial({map:wd,normalMap:wn,roughnessMap:wr,roughness:.82,normalScale:new T.Vector2(.38,.38),color:'#b1a48a'});
 plaster=new T.MeshStandardMaterial({map:cd,normalMap:cn,roughnessMap:cr,roughness:1,normalScale:new T.Vector2(.6,.6),color:'#aaa995'});
 models.creature=(await loader.loadAsync(`${BASE}creature/el-inquilino.glb`)).scene;tick();
}

function box(parent,w,h,d,pos,mat,collide=false){
 const geo=new T.BoxGeometry(w,h,d);const uv=geo.attributes.uv;
 const dimensions=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
 for(let f=0;f<6;f++)for(let j=0;j<4;j++){let i=f*4+j;uv.setXY(i,uv.getX(i)*dimensions[f][0]/2,uv.getY(i)*dimensions[f][1]/2);}
 const m=new T.Mesh(geo,mat);m.position.set(...pos);m.castShadow=m.receiveShadow=true;(parent.group||parent).add(m);
 if(collide&&parent.colliders)parent.colliders.push({minX:pos[0]-w/2,maxX:pos[0]+w/2,minY:pos[1]-h/2,maxY:pos[1]+h/2,minZ:pos[2]-d/2,maxZ:pos[2]+d/2,mesh:m});
 return m;
}
function prop(room,name,pos,height,rotation=0,solid=true){
 const root=new T.Group(),m=models[name].clone(true);root.add(m);
 const bounds=new T.Box3().setFromObject(m),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 const scale=height/size.y;m.scale.setScalar(scale);m.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 m.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;const original=o.material;const n=(original.name||'').toLowerCase();o.material=new T.MeshStandardMaterial({color:original.color,map:original.map,roughness:.87,metalness:0});if(n.includes('wood')){o.material.color.set('#5b4533');o.material.map=wood.map;o.material.normalMap=wood.normalMap;o.material.normalScale=new T.Vector2(.12,.12);}else if(n.includes('carpet'))o.material.color.set('#593331');else if(n.includes('metal')){o.material.color.set(n.includes('dark')?'#182220':n.includes('medium')?'#354239':'#647163');o.material.metalness=.55;o.material.roughness=.4;}else if(o.material.color)o.material.color.multiplyScalar(.55);}});
 root.position.set(...pos);root.rotation.y=rotation;room.group.add(root);root.updateMatrixWorld(true);
 if(solid){const b=new T.Box3().setFromObject(root);const inv=new T.Matrix4().copy(room.group.matrixWorld).invert();b.applyMatrix4(inv);room.colliders.push({minX:b.min.x,maxX:b.max.x,minY:b.min.y,maxY:b.max.y,minZ:b.min.z,maxZ:b.max.z,mesh:root});}
 return root;
}
export function textTexture(lines,{color='#c4cbb6',background='#14211e',size=40,width=1024,height=512}={}){
 const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);ctx.strokeStyle=color;ctx.globalAlpha=.35;ctx.strokeRect(18,18,width-36,height-36);ctx.globalAlpha=1;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${size}px monospace`;const list=Array.isArray(lines)?lines:lines.split('\n');list.forEach((t,i)=>ctx.fillText(t,width/2,height/2+(i-(list.length-1)/2)*(size*1.5),width-65));
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture;
}
function sign(room,lines,pos,w=1.3,rot=0,options={}){const map=textTexture(lines,options),m=new T.Mesh(new T.PlaneGeometry(w,w*.5),new T.MeshStandardMaterial({map,roughness:.9,emissive:'#829474',emissiveIntensity:.08}));m.position.set(...pos);m.rotation.y=rot;room.group.add(m);return m;}
function note(room,id,pos,rotation=0){const m=sign(room,['REGISTRO / '+id.toUpperCase(),'[ E ]  LEER'],pos,.56,rotation,{background:'#a8a187',color:'#202821',size:40});room.interactions.push({id:'note-'+id,pos:new T.Vector3(...pos),radius:2.0,label:'Leer registro',type:'note',note:id,mesh:m});return m;}
function light(room,pos,color,power,range=11){const l=new T.PointLight(color,power,range,2);l.position.set(...pos);room.group.add(l);room.lights.push({light:l,power});return l;}
function cable(room,points,color='#282d28',radius=.025){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const mesh=new T.Mesh(new T.TubeGeometry(curve,30,radius,6,false),material(color));room.group.add(mesh);return mesh;}
function bulb(room,pos,color='#ffe4a5',power=70){
 const group=new T.Group();group.position.set(...pos);room.group.add(group);
 const sphere=new T.Mesh(new T.SphereGeometry(.105,16,12),new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:3}));group.add(sphere);
 box(group,.14,.15,.14,[0,.15,0],iron);cable(room,[[pos[0],room.h,pos[2]],[pos[0],pos[1]+.23,pos[2]]]);
 const lamp=light(room,pos,color,power,16);
 const shadow=new T.SpotLight(color,power*1.8,22,1.22,.9,2);shadow.position.set(...pos);shadow.target.position.set(pos[0],0,pos[2]);shadow.castShadow=true;shadow.shadow.mapSize.set(1024,1024);shadow.shadow.bias=-.0003;shadow.shadow.normalBias=.03;room.group.add(shadow,shadow.target);room.lights.push({light:shadow,power:power*1.8});return {group,lamp,shadow,sphere};
}
function floorWithHole(room){
 const {w,d,hole}=room,mat=room.id===0?wood:plaster;
 const {x,z,size}=hole,xa=x-size/2,xb=x+size/2,za=z-size/2,zb=z+size/2;
 box(room,xa+w/2,.24,d,[(xa-w/2)/2,-.12,0],mat);
 box(room,w/2-xb,.24,d,[(w/2+xb)/2,-.12,0],mat);
 box(room,size,.24,za+d/2,[x,-.12,(za-d/2)/2],mat);
 box(room,size,.24,d/2-zb,[x,-.12,(d/2+zb)/2],mat);
 const hatch=new T.Group();hatch.position.set(x-size/2,.02,z);room.group.add(hatch);
 box(hatch,size,.10,size,[size/2,0,0],room.id===0?wood:iron);
 box(hatch,.32,.03,.08,[size*.74,.07,0],brass);
 room.hatch=hatch;room.hatchAngle=0;
 for(let s of [-1,1]){box(room,.09,.06,size+.2,[x+s*(size/2+.04),.03,z],brass);box(room,size,.06,.09,[x,.03,z+s*(size/2+.04)],brass);}
 light(room,[x,-.8,z],room.id===0?'#6a9d9c':'#be7455',15,5);
}
function shell(room){
 floorWithHole(room);
 const mat=plaster.clone();mat.color.set(room.id===0?'#b4ad91':room.id===1?'#89968d':'#9d9690');
 box(room,room.w,.24,room.d,[0,room.h+.12,0],mat);
 box(room,room.w,room.h,.22,[0,room.h/2,-room.d/2-.11],mat);
 box(room,room.w,room.h,.22,[0,room.h/2,room.d/2+.11],mat);
 box(room,.22,room.h,room.d,[-room.w/2-.11,room.h/2,0],mat);
 // Real openings shared with the previous room's floor aperture.
 if(room.id===0)box(room,.22,room.h,room.d,[room.w/2+.11,room.h/2,0],mat);
 else {let low=room.id===1?5:3,high=low+2;box(room,.22,low,room.d,[room.w/2-.11,low/2,0],mat);box(room,.22,room.h-high,room.d,[room.w/2-.11,(room.h+high)/2,0],mat);for(let s of [-1,1])box(room,.22,2,(room.d-2.2)/2,[room.w/2-.11,(low+high)/2,s*(room.d/4+.55)],mat);}
 for(const z of [-room.d/2+.04,room.d/2-.04]){box(room,room.w,.13,.09,[0,.1,z],trim);box(room,room.w,.11,.10,[0,room.h-.2,z],trim);}
 for(const x of [-room.w/2+.04,room.w/2-.04])box(room,.09,.13,room.d,[x,.1,0],trim);
 if(room.id===0){const green=material('#354941');for(const z of [-5.88,5.88]){box(room,10,1.05,.045,[0,.65,z],green);box(room,10,.05,.07,[0,1.19,z],brass);for(let x=-4.6;x<5;x+=.65)box(room,.025,1,.02,[x,.66,z+(z<0?.03:-.03)],trim);}for(let x of [-4.9,4.9]){box(room,.045,1.05,12,[x,.65,0],green);box(room,.07,.05,12,[x,1.19,0],brass);}}
}
function relay(room,index,pos,rot=0){
 const p=new T.Group();p.position.set(...pos);p.rotation.y=rot;room.group.add(p);
 const caseMat=material('#4c5a4b',{metalness:.7,roughness:.4});box(p,.58,.85,.22,[0,0,0],caseMat);box(p,.49,.66,.015,[0,0,.12],iron);
 const led=new T.Mesh(new T.SphereGeometry(.045,10,8),new T.MeshStandardMaterial({color:'#b55031',emissive:'#b55031',emissiveIntensity:2}));led.position.set(-.15,.21,.16);p.add(led);
 for(let y of [-.13,-.19,-.25])box(p,.32,.018,.025,[0,y,.14],brass);
 const readout=new T.Mesh(new T.PlaneGeometry(.36,.15),new T.MeshBasicMaterial({map:textTexture(['0'+(index+1)+'  /  —'],{size:70,width:512,height:180})}));readout.position.set(.01,.075,.145);p.add(readout);
 room.relay={root:p,led,readout};room.interactions.push({id:'relay'+index,pos:new T.Vector3(...pos),radius:2.1,label:index===0?'Instalar fusible':index===1?'Inspeccionar conexión 02':'Restablecer circuito',type:'relay',mesh:p});
}

function particles(room){const n=room.id===1?650:450,arr=new Float32Array(n*3),speeds=new Float32Array(n);for(let i=0;i<n;i++){arr[i*3]=(Math.random()-.5)*room.w;arr[i*3+1]=Math.random()*room.h;arr[i*3+2]=(Math.random()-.5)*room.d;speeds[i]=.06+Math.random()*.09;}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(arr,3));const mat=new T.PointsMaterial({color:room.id===2?'#c8a886':'#c4d3b8',size:.018,transparent:true,opacity:.38,blending:T.AdditiveBlending,depthWrite:false});const pts=new T.Points(geo,mat);room.group.add(pts);room.dust={pts,speeds};}

export function createWorld(scene){
 const rooms=[
 {id:0,name:'01 / LA SALA',w:10,d:12,h:4,pos:[0,0,0],angle:0,hole:{x:3,z:-3,size:2.2},spawn:[0,0,4.7],yaw:0},
 {id:1,name:'02 / EL PASILLO LATERAL',w:12,d:6,h:8,pos:[9,-6,-3],angle:Math.PI/2,hole:{x:-4,z:0,size:2.2},spawn:[4,0,0],yaw:Math.PI/2},
 {id:2,name:'03 / LA CASA INVERTIDA',w:12,d:8,h:6,pos:[15,-6,-3],angle:Math.PI,hole:{x:-4,z:2.8,size:1.5},spawn:[3.5,0,0],yaw:Math.PI/2}
 ].map(data=>{let room={...data,group:new T.Group(),colliders:[],interactions:[],lights:[]};room.group.position.set(...data.pos);room.group.rotation.z=data.angle;scene.add(room.group);room.group.updateMatrixWorld(true);shell(room);particles(room);return room;});
 const r=rooms[0];
 prop(r,'cabinetTelevision',[0,0,-4.6],.8);const tv=prop(r,'televisionVintage',[0,.8,-4.6],1.05,0,false);prop(r,'televisionAntenna',[0,1.85,-4.68],.65,0,false);
 // The screen is a dynamic broadcast, not a substitute model for the downloaded TV.
 const tvCanvas=document.createElement('canvas');tvCanvas.width=768;tvCanvas.height=576;const tvTexture=new T.CanvasTexture(tvCanvas);tvTexture.colorSpace=T.SRGBColorSpace;
 const screen=new T.Mesh(new T.PlaneGeometry(1.03,.72),new T.MeshBasicMaterial({map:tvTexture,toneMapped:false}));screen.position.set(-.17,1.39,-4.059);r.group.add(screen);
 r.tv={model:tv,screen,canvas:tvCanvas,ctx:tvCanvas.getContext('2d'),texture:tvTexture,light:light(r,[0,1.5,-3.7],'#bed3bd',0,5)};
 r.chair=prop(r,'loungeChair',[0,0,-.75],1.1,Math.PI);r.interactions.push({id:'chair',pos:new T.Vector3(0,.7,-.7),radius:2.5,label:'Sentarte frente al televisor',type:'chair',mesh:r.chair});
 prop(r,'rugRectangle',[0,.015,-.1],.024,0,false).scale.set(1.5,1,1.5);
 prop(r,'sideTable',[-3.6,0,4.45],.75);prop(r,'bookcaseOpen',[-4.15,0,-3.55],2.5,Math.PI/2);prop(r,'books',[-4.2,1.46,-3.5],.2,Math.PI/2,false);
 prop(r,'doorway',[-3.2,0,5.83],2.55,Math.PI,false);sign(r,['SALIDA','SIN SEÑAL'],[-3.2,2.88,5.78],1.1,Math.PI);
 r.interactions.push({id:'entry-door',pos:new T.Vector3(-3.2,1.2,5.6),radius:2,label:'Comprobar puerta',type:'locked'});
 note(r,'welcome',[-3.63,1.65,5.75],Math.PI);note(r,'frequency',[-4.72,1.65,-1.5],Math.PI/2);
 const fuse=new T.Group();fuse.position.set(-3.5,.85,4.3);r.group.add(fuse);box(fuse,.28,.06,.07,[0,0,0],material('#d0c6a3'));for(let x of [-.11,.11])box(fuse,.07,.08,.09,[x,0,0],brass);r.fuse=fuse;r.interactions.push({id:'fuse',pos:fuse.position.clone(),radius:1.6,label:'Recoger fusible',type:'fuse',mesh:fuse});
 relay(r,0,[4.76,1.45,-4.45],-Math.PI/2);sign(r,['CONEXIÓN 01','SERVICIO DOMÉSTICO'],[4.74,2.3,-4.45],1.05,-Math.PI/2);
 cable(r,[[4.7,1.2,-4.5],[4.7,.15,-4.5],[4.7,.15,-3.1],[4.2,.05,-3.1]]);
 r.bulb=bulb(r,[0,3.35,-.7],'#ffe0a3',45);
 // A dark outside window, mouldings and cold fill provide readable silhouette contrast.
 box(r,.06,2.1,2.8,[4.85,2.35,1.3],iron);box(r,.07,1.83,2.54,[4.79,2.35,1.3],material('#121f23',{metalness:.5,roughness:.15}));box(r,.12,1.9,.065,[4.72,2.35,1.3],trim);box(r,.12,.065,2.6,[4.72,2.35,1.3],trim);light(r,[4,2.1,1.3],'#90b4ce',15,9);
 const r1=rooms[1];
 for(let x of [-4,0,4]){box(r1,.14,7.8,.18,[x,3.9,-2.83],iron);box(r1,.14,7.8,.18,[x,3.9,2.83],iron);box(r1,.16,.16,5.7,[x,7.75,0],iron);prop(r1,'lampWall',[x,2.3,-2.81],.38,0,false);light(r1,[x,2.8,-2.25],x===-4?'#9da995':'#b0c7b5',28,8);}
 for(let z of [-2.8,-2.55])cable(r1,[[-5.8,5.4,z],[0,5.4,z],[5.7,5.4,z]],'#374740',.075);
 r1.bulb=bulb(r1,[0,5.7,0],'#b7cbb5',42);
 prop(r1,'desk',[-2.4,0,-2],.9);prop(r1,'radio',[-2.4,.9,-2],.48,0,false);r1.interactions.push({id:'radio',pos:new T.Vector3(-2.4,1.2,-2),radius:1.9,label:'Sintonizar portadora',type:'radio'});
 relay(r1,1,[-4.55,1.5,-2.8]);sign(r1,['CONEXIÓN 02','PORTADORA'],[-4.55,2.3,-2.78],1.1);
 note(r1,'procedure',[1.4,1.55,-2.82]);note(r1,'frequency',[-1.4,1.1,-2]);
 sign(r1,['83.0 MHz','MANTENIMIENTO'],[3.4,1.8,2.84],1.3,Math.PI,{background:'#b1ad8b',color:'#283832'});
 sign(r1,['USTED ESTÁ CAMINANDO','SOBRE LA PARED'],[5.84,3.35,0],2.2,-Math.PI/2);
 prop(r1,'cardboardBoxClosed',[1.8,0,1.8],.7);prop(r1,'cardboardBoxClosed',[2.4,0,2.3],1.05);
 const oldChair=prop(r1,'chair',[3.8,5,-1.6],1.1,0,false);oldChair.rotation.z=-Math.PI/2;
 const r2=rooms[2];r2.bulb=bulb(r2,[0,4.9,0],'#d7bca0',48);
 prop(r2,'table',[1.6,0,-2.7],.85);prop(r2,'computerKeyboard',[1.6,.86,-2.6],.04,0,false);prop(r2,'radio',[2.8,.85,-2.7],.44,0,false);
 prop(r2,'cabinetBed',[-2.2,0,-3.3],1.05);prop(r2,'cardboardBoxClosed',[3.6,0,2.85],.9);
 relay(r2,2,[.2,1.5,-3.75]);sign(r2,['CONEXIÓN 03','ORIENTACIÓN'],[.2,2.35,-3.73],1.2);
 note(r2,'tenant',[3.1,1.25,-2.65]);note(r2,'procedure',[1.1,1.85,-3.76]);
 const upside=prop(r2,'loungeChair',[-.5,5.8,1.7],1.3,0,false);upside.rotation.z=Math.PI;
 const upsideTV=prop(r2,'televisionVintage',[2,5.8,2.3],.8,Math.PI,false);upsideTV.rotation.z=Math.PI;
 prop(r2,'doorway',[-5.78,0,0],2.65,Math.PI/2,false);sign(r2,['SALIDA'],[-5.7,3,0],1.3,Math.PI/2,{background:'#395246',color:'#dce8d1'});r2.exitLight=light(r2,[-5.2,2,0],'#a3e0b1',8,7);
 r2.interactions.push({id:'exit',pos:new T.Vector3(-5.7,1.4,0),radius:2,label:'Abrir salida',type:'exit'});
 for(let x of [-4.5,0,4.5]){prop(r2,'lampWall',[x,2.8,3.81],.35,Math.PI,false);light(r2,[x,3.1,3.3],'#b74732',12,6);}
 sign(r2,['NO CONFÍE EN SU SOMBRA'],[-2.8,2.25,-3.79],2.2);
 // Physical aperture two leads to this opening at x=+6. A sealed service hatch elsewhere is not a portal.
 r2.hatch.visible=true;
 const creatureRoot=new T.Group(),creature=models.creature.clone(true),bounds=new T.Box3().setFromObject(creature),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 const sc=2.8/size.y;creature.scale.setScalar(sc);creature.position.set(-center.x*sc,-bounds.min.y*sc,-center.z*sc);creature.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.material=o.material.clone();o.material.roughness=.97;}});creatureRoot.add(creature);scene.add(creatureRoot);creatureRoot.visible=false;
 return {rooms,creature:creatureRoot,creatureMesh:creature,scene,worldPoint:(room,p)=>rooms[room].group.localToWorld(p.clone())};
}

export function updateWorld(world,state,dt,time,comfort){
 for(const room of world.rooms){
  const target=state.relays[room.id]&&room.id<2?-Math.PI*.93:0;room.hatchAngle=T.MathUtils.damp(room.hatchAngle,target,2.4,dt);room.hatch.rotation.z=room.hatchAngle;
  const {pts,speeds}=room.dust,p=pts.geometry.attributes.position;for(let i=0;i<p.count;i++){p.array[i*3+1]-=speeds[i]*dt;if(p.array[i*3+1]<.03)p.array[i*3+1]=room.h-.05;p.array[i*3]+=.008*Math.sin(time+i)*dt;}p.needsUpdate=true;
  const rel=room.relay,on=state.relays[room.id];rel.led.material.color.set(on?'#b5d99a':'#b55031');rel.led.material.emissive.copy(rel.led.material.color);
  if(rel.lastOn!==on){rel.readout.material.map.dispose();rel.readout.material.map=textTexture([on?['01 / 3','02 / 8','03 / 1'][room.id]:'0'+(room.id+1)+' / —'],{size:70,width:512,height:180});rel.lastOn=on;}
  const flicker=comfort?1:1-.025*Math.sin(time*3.1+room.id)-.018*Math.sin(time*7.3);
  room.bulb.lamp.intensity=(room.id===0?45:room.id===1?42:48)*flicker;
 }
 world.rooms[0].fuse.visible=!state.fuse&&!state.relays[0];world.rooms[2].exitLight.intensity=state.relays[2]?32:8;
}
