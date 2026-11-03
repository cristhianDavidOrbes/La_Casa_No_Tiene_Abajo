// Archivo histórico, no se importa ni se ejecuta en el juego actual.
import {puzzleAnswer} from '../../src/orientation-puzzle.js';
import {createPuzzle} from './orientation-puzzle.js';
import {tickFlash} from './flash.js';
import {fresh} from './story.js';
import {EYE_HEIGHT,collisionAt,insideHole} from './physics.js';
import {roomPortals,portalOpen} from './level.js';
export function setupQA(api){
 const {T,world,player,renderer}=api,$=id=>document.getElementById(id);
 const panel=document.createElement('div');panel.id='qa';panel.style.cssText='position:fixed;right:12px;top:12px;z-index:50;background:#14231ff5;padding:12px;border:1px solid #99b090;max-width:440px;max-height:80vh;overflow:auto;font:12px monospace';
 panel.innerHTML='<b>VERIFICACIÓN LOCAL · V2</b><div id="qa-actions"></div><pre id="qa-result" style="white-space:pre-wrap"></pre>';document.body.appendChild(panel);
 const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.style.padding='7px';b.onclick=fn;$('qa-actions').appendChild(b);};
 function view(i,progress=true){const state=fresh();state.letterRead=true;state.watched=state.fuse=progress;state.relays=progress?[true,true,true]:[false,false,false];state.room=i;
  api.set({state,mode:'paused'});api.placeAtCheckpoint();for(const id of ['menu','pause','ending','dialog','remote'])api.show(id,false);api.show('hud');api.updateWorld(world,state,3,10,true);api.updateCamera(0);api.refreshHUD();$('qa-result').textContent='Vista '+world.rooms[i].name;
 }
 ['Sala','Pasillo','Taller','Archivo','Emisión'].forEach((label,i)=>button(label,()=>view(i)));
 button('Rig e IK',()=>{view(4);api.spawnEnemy(4);const m=world.creatureMotion,tree=api.get().collisionTree;world.creature.position.copy(world.worldPoint(4,new T.Vector3(0,0,0)));world.creature.quaternion.copy(world.rooms[4].group.quaternion);m.reset();m.update(2,{crouch:1,tree,lookTarget:api.camera.position});world.creature.updateMatrixWorld(true);world.creature.traverse(o=>o.skeleton?.update());const b=new T.Box3().setFromObject(world.creature,true);$('qa-result').textContent=(m.rest.length===55?'OK':'ERROR')+' 55 huesos Tripo reparados\n'+(m.contacts===4?'OK':'ERROR')+' Cuatro apoyos: '+m.contacts+'/4\n'+(Math.max(...m.errors)<.01?'OK':'ERROR')+' Error IK: '+Math.max(...m.errors).toFixed(4)+' m\nAltura agachada: '+b.getSize(new T.Vector3()).y.toFixed(2)+' m';});
 button('Persecución continua',async()=>{view(4);api.spawnEnemy(4);const enemy=api.get().enemy,tree=api.get().collisionTree,target=world.worldPoint(0,new T.Vector3(0,1.68,3));enemy.delay=0;let max=0,crouched=false;for(let i=0;i<24000&&enemy.room!==0;i++){const previous=enemy.position.clone();enemy.update(1/60,{rooms:world.rooms,targetRoom:0,target,tree});max=Math.max(max,previous.distanceTo(enemy.position));crouched ||= enemy.crouch>.5;if(i%1200===0){$('qa-result').textContent='Simulando persecución con muebles. Cuarto '+enemy.room;await new Promise(resolve=>setTimeout(resolve,0));}}$('qa-result').textContent=(enemy.room===0?'OK':'ERROR')+' Regresa de emisión a sala\n'+(enemy.crossings===4?'OK':'ERROR')+' Cuatro pasos: '+enemy.crossings+'\n'+(max<.25?'OK':'ERROR')+' Mayor desplazamiento por paso: '+max.toFixed(3)+' m\n'+(crouched?'OK':'ERROR')+' Se agacha en pasos estrechos';});
 button('Criatura',()=>{view(4);world.creature.visible=true;world.creature.position.copy(world.worldPoint(4,new T.Vector3(0,0,0)));world.creature.quaternion.copy(world.rooms[4].group.quaternion);player.set(1.8,0,3.0);api.set({yaw:.56,pitch:-.30});api.updateCamera(0);world.creatureMotion.reset();world.creatureMotion.update(1,{time:1,lookTarget:api.camera.position});});
 button('Criatura agachada',()=>{view(4);world.creature.visible=true;world.creature.position.copy(world.worldPoint(4,new T.Vector3(0,0,0)));world.creature.quaternion.copy(world.rooms[4].group.quaternion);player.set(1.8,0,2.7);api.set({yaw:.58,pitch:-.37});api.updateCamera(0);world.creatureMotion.reset();world.creatureMotion.update(1,{time:2,crouch:1,lookTarget:api.camera.position});});
 button('Criatura en pared',()=>{view(4);world.creature.visible=true;world.creature.position.copy(world.worldPoint(4,new T.Vector3(-4.85,2.2,0)));const b=new T.Matrix4().makeBasis(new T.Vector3(0,0,-1),new T.Vector3(1,0,0),new T.Vector3(0,1,0));world.creature.quaternion.copy(world.rooms[4].group.quaternion).multiply(new T.Quaternion().setFromRotationMatrix(b));player.set(1.5,0,0);api.set({yaw:-Math.PI/2,pitch:.22});api.updateCamera(0);world.creatureMotion.reset();world.creatureMotion.update(1,{time:1,tree:api.get().collisionTree,climbing:true,lookTarget:api.camera.position});});
 button('Criatura en techo',()=>{view(4);world.creature.visible=true;world.creature.position.copy(world.worldPoint(4,new T.Vector3(0,3.8,0)));const b=new T.Matrix4().makeBasis(new T.Vector3(1,0,0),new T.Vector3(0,-1,0),new T.Vector3(0,0,1));world.creature.quaternion.copy(world.rooms[4].group.quaternion).multiply(new T.Quaternion().setFromRotationMatrix(b));player.set(0,0,2.5);api.set({yaw:0,pitch:.72});api.updateCamera(0);world.creatureMotion.reset();world.creatureMotion.update(1,{time:1,tree:api.get().collisionTree,climbing:true,lookTarget:api.camera.position});});
 button('Criatura bípeda',()=>{view(4);world.creature.visible=true;world.creature.position.copy(world.worldPoint(4,new T.Vector3(0,0,0)));world.creature.quaternion.copy(world.rooms[4].group.quaternion);player.set(0,0,2.8);api.set({yaw:0,pitch:-.15});api.updateCamera(0);world.creatureMotion.reset();world.creatureMotion.update(1,{time:1,bipedal:1,tree:api.get().collisionTree,lookTarget:api.camera.position});$('qa-result').textContent='Criatura erguida bípeda en dos patas con brazos libres extendidos.';});
 button('Jumpscare mejorado',()=>{view(4);api.set({mode:'playing'});api.caught();$('qa-result').textContent='Sobresalto: garras acechando pantalla, espasmos de cabeza y distorsión.';});
 button('Prueba estamina',()=>{view(0);api.set({mode:'playing',stamina:100,staminaExhausted:false});api.keys.add('ShiftLeft');api.keys.add('KeyW');api.updatePlayer(1.0);api.keys.clear();const s1=api.get().stamina;api.spawnEnemy(0);const e=api.get().enemy;e.delay=0;e.position.copy(player).add(new T.Vector3(0,0,3));api.keys.add('ShiftLeft');api.keys.add('KeyW');api.updatePlayer(1.0);api.keys.clear();const s2=api.get().stamina;const baseDrain=100-s1,panicDrain=s1-s2;$('qa-result').textContent='Estamina normal (1s corrida): gasto '+baseDrain.toFixed(1)+'\nEstamina con pánico cerca: gasto '+panicDrain.toFixed(1)+' (multiplicador x'+(panicDrain/Math.max(1,baseDrain)).toFixed(2)+')\n'+(panicDrain>baseDrain*1.8?'OK: Pánico drena estamina aceleradamente':'ERROR');});
 button('Ver umbral',()=>{view(0);player.set(1.8,0,.8);api.set({yaw:-Math.PI/2,pitch:-.45});api.updateCamera(0);});
 button('Ver caja',()=>{view(0,false);player.set(2.4,0,-2.2);api.set({yaw:-Math.PI/2,pitch:-.1});api.updateCamera(0);});
 button('Ver carta',()=>{view(0,false);player.set(-2.6,0,3.8);api.set({yaw:.9,pitch:-.65});api.updateCamera(0);});
 button('Leer carta',()=>{view(0,false);api.set({mode:'playing'});api.interact({type:'note',note:'welcome'});});
 button('Ver ventana',()=>{view(0,false);player.set(-2.1,0,1.4);api.set({yaw:Math.PI/2,pitch:.12});api.updateCamera(0);});
 button('Ver piso',()=>{view(0,false);player.set(.1,0,3.2);api.set({yaw:-.72,pitch:-.5});api.updateCamera(0);});
 button('TV de lado',()=>{view(0,false);player.set(1.8,0,-3.6);api.set({yaw:1.06,pitch:-.13});api.updateCamera(0);});
 button('Cruzar umbral',()=>{view(0);api.set({mode:'playing',portalCooldown:0});player.set(3.85,0,world.rooms[0].portals[0].z);api.updateCamera(0);api.updatePlayer(.05);});
 button('Navegación',()=>{
  const results=[];for(const room of world.rooms){const step=.2,queue=[[...room.spawn]],visited=new Set(),reachable=[];let head=0;while(head<queue.length){const [x,y,z]=queue[head++],key=Math.round(x/step)+','+Math.round(z/step);
   if(visited.has(key)||Math.abs(x)>room.w/2-.25||Math.abs(z)>room.d/2-.25||collisionAt(x,z,0,room.colliders)||room.portals.some(p=>insideHole(x,z,p,.1)))continue;visited.add(key);reachable.push(new T.Vector3(x,EYE_HEIGHT,z));for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]])queue.push([x+dx,0,z+dz]);}
   for(const item of room.interactions){const ok=reachable.some(p=>p.distanceTo(item.pos)<item.radius-.15);results.push((ok?'OK ':'ERROR ')+room.id+'/'+item.id+' accesible');}
  }$('qa-result').textContent=results.join('\n');
 });
 button('TV / canal 02',async()=>{view(0,false);api.set({mode:'playing'});await api.audio.init();api.audio.attachMedia(api.media);api.media.muted=false;player.set(0,0,.8);api.set({yaw:0,pitch:-.35});api.updateCamera(0);api.targetInteraction();api.interact();api.setChannel(2);});
 button('Comprobar fin canal 02',()=>{const s=api.get().state,log=[];log.push((s.watched?'OK':'ERROR')+' Instrucciones completadas por reproducción real');log.push('Video: '+api.media.currentTime.toFixed(1)+' / '+api.media.duration.toFixed(1)+' s; ended='+api.media.ended);if(api.get().seated)api.sit();api.set({mode:'playing'});api.interact({type:'fuse'});api.interact({type:'relay'});log.push((s.relays[0]?'OK':'ERROR')+' Fusible instalable después del canal 02');api.set({mode:'paused'});$('qa-result').textContent=log.join('\n');});
 button('Prueba amenaza',()=>{view(4);const state=api.get().state;state.tape=state.rewound=true;api.set({mode:'playing'});api.spawnEnemy(4);const e=api.get().enemy;e.delay=0;e.x=0;e.z=0;e.position.copy(world.worldPoint(4,new T.Vector3(0,0,0)));player.set(3,0,0);api.set({yaw:Math.PI/2,pitch:-.25});api.updateCamera(0);const result=[],check=(label,ok)=>result.push((ok?'OK':'ERROR')+' '+label),f=api.get().flash;api.fireFlash();api.updateHorror(.1);check('Acierto aturde 3 s',e.stunRemaining>2.8);const p=e.position.clone();tickFlash(f,.5);api.updateHorror(.5);check('Permanece aturdido sin luz',e.position.distanceTo(p)<.001);api.set({mode:'paused'});const remaining=e.stunRemaining;api.updateHorror(.5);check('Pausa conserva aturdimiento',e.stunRemaining===remaining);api.set({mode:'playing'});for(let i=0;i<180;i++)api.updateHorror(1/60);check('Reanuda acecho tras aturdimiento',e.stunRemaining===0);tickFlash(f,1);api.fireFlash();tickFlash(f,1);api.fireFlash();tickFlash(f,1);check('Cuarto destello bloqueado',!api.fireFlash()&&f.charges===0);api.set({mode:'paused'});$('qa-result').textContent=result.join('\n');});
 button('Ensayo 10 s / FPS',async()=>{
  view(4);api.spawnEnemy(4);const e=api.get().enemy;e.delay=0;e.x=-3;e.z=1.8;e.position.copy(world.worldPoint(4,new T.Vector3(e.x,0,e.z)));player.set(2.5,0,2.4);api.set({yaw:1.35,pitch:-.24});api.updateCamera(0);
  const tree=api.get().collisionTree,samples=[];let previous=null,elapsed=0,worstIK=0;
  while(elapsed<10){const now=await new Promise(requestAnimationFrame),ms=previous===null?0:Math.max(0,now-previous);previous=now;const dt=Math.min(ms/1000,.05);elapsed+=dt;
   const target=world.worldPoint(4,new T.Vector3(2.5,1.68,2.4));e.update(dt,{rooms:world.rooms,targetRoom:4,target,tree,frozen:e.position.distanceTo(target)<2.2});
   world.creature.position.copy(e.position);world.creature.quaternion.copy(e.rotation);world.creatureMotion.update(dt,{time:elapsed,speed:e.speed,tree,lookTarget:api.camera.position,contactUps:e.contactUps,climbing:e.climbing||e.y>.05});worstIK=Math.max(worstIK,...world.creatureMotion.errors);
   if(elapsed>1&&ms<250)samples.push(ms);$('qa-result').textContent='Ensayo vivo '+elapsed.toFixed(1)+' / 10 s';
  }
  const sorted=[...samples].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length;
  $('qa-result').textContent='FPS medios: '+(1000/mean).toFixed(1)+'\nFrame p95: '+sorted[Math.floor(sorted.length*.95)].toFixed(1)+' ms\nMuestras: '+samples.length+'\nError IK máximo: '+worstIK.toFixed(3)+' m\nApoyos finales: '+world.creatureMotion.contacts+'/4\nDibujos: '+renderer.info.render.calls+' / Triángulos: '+renderer.info.render.triangles;
 });
 button('Prueba de recorrido',async()=>{
  const log=[],check=(name,ok)=>{log.push((ok?'OK  ':'ERROR  ')+name);$('qa-result').textContent=log.join('\n');if(!ok)throw Error(name);};
  function cross(to){const {state}=api.get(),from=state.room,p=world.rooms[from].portals.find(p=>p.to===to);
   check('Umbral '+from+' → '+to+' desbloqueado',!!p&&portalOpen(p,state));api.set({mode:'playing',portalCooldown:0,yaw:p.kind==='wall'?-Math.PI/2:-p.edge*Math.PI/2});player.set(p.kind==='wall'?4.64:p.x,p.kind==='wall'?0:-.2,p.z);api.updateCamera(0);api.beginFall(p);
   check('Cápsula física '+from+' → '+to,!!api.get().transition);api.keys.add('KeyW');
   for(let i=0;i<1800&&api.get().transition;i++)api.updateFall(1/120);
   api.keys.clear();
   check('Llegada transitable '+to,api.get().state.room===to&&!api.get().transition&&!collisionAt(player.x,player.z,player.y,world.rooms[to].colliders));
  }
  try{
   view(0,false);api.set({mode:'playing'});let state=api.get().state;api.interact({type:'relay'});check('Motor exige instrucciones',!state.relays[0]);state.watched=true;api.interact({type:'relay'});check('Motor exige fusible',!state.relays[0]);api.interact({type:'fuse'});api.interact({type:'relay'});check('Fusible abre motor 01',state.relays[0]);cross(1);cross(0);cross(1);
   api.radioDialog();api.changeTune(2);$('dialog-actions').children[1].click();check('83.0 MHz abre motor 02',state.relays[1]);cross(2);cross(1);cross(2);
   api.circuitDialog();for(const label of puzzleAnswer(state.puzzle))$('dialog-actions').children[['SUELO','PARED','TECHO'].indexOf(label)].click();check('Observaciones de sillas abren archivo',state.relays[2]);cross(3);api.interact({type:'tape'});check('Cinta recogida',state.tape);cross(4);
   api.interact({type:'rewinder'});$('dialog-actions').children[0].click();check('Rebobinador inicia cuenta',api.get().rewindTimer>0);api.set({rewindTimer:0});state.rewound=true;api.spawnEnemy(4);
   cross(3);cross(2);cross(1);cross(0);api.interact({type:'insert'});check('Cinta insertada en sala',state.inserted);api.interact({type:'chair'});api.setChannel(3);check('Receptor carga grabación final',api.media.src.endsWith('/para-volver.mp4'));
   api.finishTape();api.sit();api.exitDialog();check('Final alcanzable por puerta original',api.get().mode==='ending');check('Cinco habitaciones visitadas',state.visited.length===5);check('Figura descargada cargada',world.creatureMesh.children.length>0);
   log.push('Recorrido acelerado: 12 cruces físicos y regreso completo. El visionado y rebobinado se adelantan en esta prueba.');$('qa-result').textContent=log.join('\n');
  }catch(e){log.push(e.stack);$('qa-result').textContent=log.join('\n');api.set({mode:'paused'});}
 });

 button('Puzle sin respuesta',()=>{view(2);api.circuitDialog();});
 for(const [name,surfaces,index] of [['Silla suelo',['SUELO','PARED','TECHO'],0],['Silla pared',['SUELO','PARED','TECHO'],1],['Silla techo',['SUELO','PARED','TECHO'],2]]){
  button(name,()=>{view(index);api.get().state.puzzle={surfaces,order:[2,0,1],observed:[]};api.placeAtCheckpoint();player.set(index===0?2:1.5,0,index===0?4.8:1.8);api.set({yaw:index===1?Math.PI:0,pitch:index===2?1.05:index===1?.22:-.45});api.updateCamera(0);$('qa-result').textContent='Pista física de prueba: '+name;});
 }
 button('Retirada fuera de vista',()=>{
  view(0);const state=api.get().state;state.tape=state.rewound=true;api.spawnEnemy(0);const e=api.get().enemy;e.x=0;e.z=1.2;e.y=0;e.position.copy(world.worldPoint(0,new T.Vector3(0,0,1.2)));e.rotation.copy(world.rooms[0].group.quaternion);world.creature.position.copy(e.position);world.creature.quaternion.copy(e.rotation);player.set(0,0,3.8);api.set({mode:'playing',yaw:0,pitch:-.32});api.updateCamera(0);world.creatureMotion.update(1,{lookTarget:api.camera.position});api.interact({type:'insert'});api.updateHorror(.8);
  const watched=!!api.get().enemy;api.set({yaw:Math.PI});api.updateCamera(0);api.updateHorror(.6);const hidden=!api.get().enemy;api.set({mode:'paused'});$('qa-result').textContent=(watched?'OK':'ERROR')+' Sigue visible al insertar mientras lo miras\n'+(hidden?'OK':'ERROR')+' Se retira después de mirar fuera';
 });
 button('Encuentro paranormal',()=>{view(2);api.set({roomTime:6,mode:'playing'});api.updateHorror(.05);api.updateHorror(1.5);api.set({mode:'paused'});api.updateWorld(world,api.get().state,0,10,true);player.set(0,0,2.5);api.set({yaw:Math.PI/2,pitch:-.3});api.updateCamera(0);$('qa-result').textContent='Aparición antes de recuperar y rebobinar la cinta.';});
 button('Vista sobresalto',()=>{view(4);api.set({mode:'playing'});api.caught();api.updateCapture(.28);api.set({mode:'paused'});$('qa-result').textContent='Fotograma de captura: acercamiento del modelo, no imagen plana.';});
 button('Prueba captura',async()=>{view(4);api.set({mode:'playing'});api.caught();await new Promise(resolve=>setTimeout(resolve,1800));$('qa-result').textContent=(api.get().mode==='paused'?'OK':'ERROR')+' Captura termina en punto de control\n'+(api.get().flash.charges===1?'OK':'ERROR')+' Nuevo intento con un destello';});
 button('Ensayo trepa',async()=>{
  view(1);api.spawnEnemy(1);const e=api.get().enemy,tree=api.get().collisionTree;e.delay=0;e.x=.3;e.y=0;e.z=1.0;e.position.copy(world.worldPoint(1,new T.Vector3(e.x,0,e.z)));
  player.set(2,0,1.2);api.set({yaw:.9,pitch:-.35});api.updateCamera(0);let highest=0,elapsed=0,previous=null,worst=0;
  while(elapsed<5){const now=await new Promise(requestAnimationFrame),dt=previous===null?0:Math.min(.04,(now-previous)/1000);previous=now;elapsed+=dt;
   e.update(dt,{rooms:world.rooms,tree,targetRoom:1,target:world.worldPoint(1,new T.Vector3(.3,1.6,2.6))});
   world.creature.position.copy(e.position);world.creature.quaternion.copy(e.rotation);world.creatureMotion.update(dt,{time:elapsed,speed:e.speed,crouch:e.crouch,tree,lookTarget:api.camera.position,climbing:e.climbing||e.y>.05});highest=Math.max(highest,e.y);worst=Math.max(worst,...world.creatureMotion.errors);
   $('qa-result').textContent='Trepa sobre caja: '+e.y.toFixed(2)+' m';
  }
  $('qa-result').textContent=(highest>.7?'OK':'ERROR')+' Se sube al modelo de caja: '+highest.toFixed(2)+' m\nError IK máximo: '+worst.toFixed(3)+' m';
 });
 button('Ensayo cruce e IK',async()=>{
  view(0);api.spawnEnemy(1);const e=api.get().enemy,tree=api.get().collisionTree,p=world.rooms[1].portals.find(p=>p.to===0);e.delay=0;e.x=4.12;e.y=0;e.z=p.z;e.position.copy(world.worldPoint(1,new T.Vector3(e.x,0,e.z)));
  player.set(1.8,0,1.6);api.set({yaw:-Math.PI/2,pitch:-.44});api.updateCamera(0);let elapsed=0,previous=null,mixed=0,worst=0;
  while(elapsed<9){const now=await new Promise(requestAnimationFrame),dt=previous===null?0:Math.min(.04,(now-previous)/1000);previous=now;elapsed+=dt;
   e.update(dt,{rooms:world.rooms,tree,targetRoom:0,target:world.worldPoint(0,new T.Vector3(1.5,1.68,1.6)),frozen:e.room===0});
   world.creature.position.copy(e.position);world.creature.quaternion.copy(e.rotation);world.creatureMotion.update(dt,{time:elapsed,speed:e.speed,crouch:e.crouch,tree,lookTarget:api.camera.position,contactUps:e.contactUps,climbing:e.climbing});
   const m=world.creatureMotion;if(m.contactNormals.some(n=>n.dot(m.contactNormals[0])<.8))mixed++;worst=Math.max(worst,...m.errors);$('qa-result').textContent='Cruce vivo: cuarto '+e.room+' / apoyos '+m.contacts;
  }
  $('qa-result').textContent=(e.room===0?'OK':'ERROR')+' Cruce de regreso\n'+(mixed>0?'OK':'ERROR')+' Apoyos sobre superficies diferentes: '+mixed+' fotogramas\nError IK máximo: '+worst.toFixed(3)+' m';
 });
 button('Ocultar QA',()=>panel.style.display='none');
}
