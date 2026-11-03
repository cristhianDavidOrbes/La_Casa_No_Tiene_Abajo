import './style.css';
import './letter.css';
import * as T from 'three';
import { loadEnvironment } from './environment.js';
import { loadBroadcasts, prepareVideo } from './media-loading.js';
import { loadAssets, createWorld, updateWorld, applyPuzzle, applyLockerLayout } from './house.js';
import { EYE_HEIGHT, smoothstep, collisionAt, insideHole } from './physics.js';
import { SAVE_KEY, fresh, parseSave, objective, notes, letter } from './story.js';
import { portalOpen, roomQuaternion, localPosition } from './level.js';
import {
  collisionWorld,
  makeGravityBody,
  stepGravityBody,
  gravityArrival,
  gravityEye
} from './gravity.js';
import { puzzleSolved, puzzleOrder, CLUE_ROOMS } from './orientation-puzzle.js';
import { chooseSpawnRoom, spawnPoint } from './environment-navigation.js';
import {
  HauntDirector,
  UnseenRetirement,
  isCreatureObserved,
  CAPTURE_DURATION,
  captureDistance
} from './horror-director.js';
import { Pursuer } from './pursuer.js';
import { createFlash, triggerFlash, tickFlash, hitFlash } from './flash.js';
import { Soundscape } from './audio.js';
import { RenderBudget } from './render-budget.js';
import { RoomRendering } from './room-rendering.js';
import { EndingSequence } from './ending-sequence.js';
import { loadEndingAssets } from './ending-assets.js';
import {
  RearApparition,
  REAR_HAUNT_ID,
  REAR_REVEAL_SECONDS,
  shouldStartRearHaunt
} from './rear-apparition.js';
import {
  WatcherHead,
  WATCHER_HEAD_ID,
  WATCHER_HIDE_SECONDS,
  watcherThresholdSite,
  watcherRetreatHead,
  watcherIsObserved
} from './watcher-head.js';
import { LockerSearch } from './locker.js';
import { chairIcon, mountInstrumentArt } from './ui-art.js';

// Recorrido para explicar el juego: escena -> recursos -> eventos -> física -> render.
// Semanas 1–2: main/house; 3: audio y TV; 4: luces y polvo; 5–6: Cannon.
// Semanas 7–8: HDR y GLB; 9: distancias, puzles, zonas y accesos entre cuartos.
// Ampliaciones necesarias: persecución, apoyos IK, gravedad por cuarto y final del CRT.
const $ = (id) => document.getElementById(id),
  show = (id, on = true) => $(id).classList.toggle('hidden', !on);
mountInstrumentArt();
// 1. Semanas 1 y 2: escena, cámara, materiales y renderizador (T es Three.js).
const scene = new T.Scene();
scene.background = new T.Color('#070c0b');
scene.fog = new T.FogExp2('#0b1210', 0.022);
const normalFogColor = new T.Color('#0b1210'),
  blackFogColor = new T.Color('#000000');
const camera = new T.PerspectiveCamera(68, innerWidth / innerHeight, 0.045, 90);
let renderer;
try {
  renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('load-status').innerHTML =
    '<span class="error">WebGL 2 no está disponible. Abre el juego en Chrome o Edge con aceleración gráfica.</span>';
  throw e;
}
const renderBudget = new RenderBudget(Math.min(devicePixelRatio, 1.5));
renderer.setPixelRatio(renderBudget.ratio);
renderer.setSize(innerWidth, innerHeight);
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = T.SRGBColorSpace;
$('game').appendChild(renderer.domElement);
// 2. Semanas 4 y 7: relleno HDR y luces locales con una sombra compartida.
const ambient = new T.AmbientLight('#c1d6cd', 0.18);
scene.add(ambient);
// Keep the spot in the light set at zero intensity between pulses. Toggling
// visibility would force every material to compile a new shader during play.
const flashlight = new T.SpotLight('#eaf7db', 0, 28, 0.72, 0.65, 1.2);
scene.add(flashlight, flashlight.target);
const audio = new Soundscape();
let broadcasts = {};
const broadcastVideo = document.createElement('video');
broadcastVideo.playsInline = true;
broadcastVideo.loop = false;
broadcastVideo.preload = 'auto';
broadcastVideo.muted = true;
// Semana 3: Three.js actualiza el vídeo directamente sobre el cristal del TV.
const broadcastTexture = new T.VideoTexture(broadcastVideo);
broadcastTexture.colorSpace = T.SRGBColorSpace;
let mediaRunning = false;
let collisionTree,
  playerActor = null;
let roomRendering = null;
let endingSequence = null;
let world,
  state = fresh(),
  mode = 'title',
  returnMode = 'playing',
  seated = false,
  seatBefore = null,
  ready = false,
  pausedLock = false,
  dragging = false;
let player = new T.Vector3(0, 0, 4.7),
  yaw = 0,
  pitch = 0,
  vy = 0,
  grounded = true,
  lamp = false,
  stepDistance = 0,
  walkPhase = 0,
  roomTime = 0,
  transition = null,
  target = null;
let stamina = 100,
  staminaExhausted = false;
let subtitleTime = 0,
  toastTime = 0,
  tvWatch = 0,
  lastBroadcast = 0,
  lastBroadcastChannel = -1,
  lastCCTV = 0,
  anomalyTime = 0,
  seenGhost = 0,
  ghostDone = false,
  enemy = null,
  danger = 0,
  saveTimer = 0;
const haunts = new HauntDirector();
let retirement = new UnseenRetirement(),
  captureAge = 0,
  rearHaunt = null,
  watcherHead = new WatcherHead(),
  blindness = 0;
let flash = createFlash();
let hiddenLocker = null;
const lockerSearch = new LockerSearch();
let volume = 0.65,
  brightness = 1.1,
  sensitivity = 1,
  comfort = false,
  rewindTimer = 0,
  portalCooldown = 0,
  lastThought = '';
let rewindProgress = 0,
  rewindAngle = 0,
  rewindDragging = false,
  rewindPrevious = 0,
  rewindHeld = false,
  rewindTick = 0;
let settingsReturn = 'title';
const keys = new Set(),
  events = new Set(),
  rayDirection = new T.Vector3(),
  tmp = new T.Vector3(),
  qLook = new T.Quaternion();
const cctv = new T.PerspectiveCamera(62, 4 / 3, 0.05, 40),
  cctvTarget = new T.WebGLRenderTarget(256, 192),
  cctvBuffer = new Uint8Array(256 * 192 * 4),
  cctvCanvas = document.createElement('canvas');
cctvCanvas.width = 256;
cctvCanvas.height = 192;
const cctvCtx = cctvCanvas.getContext('2d'),
  cctvImage = cctvCtx.createImageData(256, 192);
let cctvPending = false;
const frequencyOptions = [61, 73, 83, 97, 107];
let tune = 0,
  circuitInput = [];
const titleNoise = document.createElement('canvas');
titleNoise.width = 128;
titleNoise.height = 96;
const noiseContext = titleNoise.getContext('2d'),
  noiseImage = noiseContext.createImageData(128, 96);
for (let i = 0; i < noiseImage.data.length; i += 4) {
  const value = 35 + Math.random() * 80;
  noiseImage.data[i] = value * 0.76;
  noiseImage.data[i + 1] = value;
  noiseImage.data[i + 2] = value * 0.84;
  noiseImage.data[i + 3] = 255;
}
noiseContext.putImageData(noiseImage, 0, 0);
function titleViewActive() {
  return (
    mode === 'title' ||
    (mode === 'settings' && settingsReturn === 'title') ||
    (mode === 'dialog' &&
      (returnMode === 'title' || (returnMode === 'settings' && settingsReturn === 'title')))
  );
}
function titleSignal(time) {
  if (time - lastBroadcast < 0.12) return;
  lastBroadcast = time;
  lastBroadcastChannel = -2;
  const tv = world.rooms[0].tv,
    ctx = tv.ctx;
  tv.screen.map = tv.texture;
  ctx.fillStyle = '#07130e';
  ctx.fillRect(0, 0, 768, 576);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(
    titleNoise,
    Math.floor(time * 11) % 32,
    Math.floor(time * 7) % 24,
    96,
    72,
    0,
    0,
    768,
    576
  );
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#09130f55';
  ctx.fillRect(0, (time * 26) % 576, 768, 4);
  tv.texture.needsUpdate = true;
  tv.light.intensity = 4;
}

function subtitle(text, seconds = 6) {
  $('subtitle').textContent = text;
  subtitleTime = seconds;
}
function toast(text, seconds = 5) {
  $('toast').textContent = text;
  toastTime = seconds;
}
function addNote(id, notify = true) {
  if (!state.notes.includes(id)) {
    state.notes.push(id);
    if (notify) toast('REGISTRO ACTUALIZADO / J\n' + notes[id].title);
  }
}
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, won: false }));
  } catch {
    toast('El navegador no permite guardar. Puedes continuar jugando.');
  }
}
function saved() {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}
function refreshHUD() {
  $('objective').querySelector('p').textContent = objective(state);
  $('objective').querySelector('span').textContent = 'PENSAMIENTO / H PARA RECORDAR';
  $('zone').textContent = world.rooms[state.room].name;
  $('gravity').textContent = [
    'GRAVEDAD / SUELO',
    'GRAVEDAD / PARED +90°',
    'GRAVEDAD / TECHO +180°',
    'GRAVEDAD / PARED +270°',
    'GRAVEDAD / SUELO +360°'
  ][state.room];
  $('relays').textContent = state.released
    ? 'CINTA RECUPERADA'
    : state.rewound
      ? 'VUELVE A LA SALA'
      : state.tape
        ? 'CINTA / SIN REBOBINAR'
        : 'MOTORES ' + state.relays.map((v) => (v ? '●' : '○')).join(' ');
  const lBox = $('lamp-status'),
    lCount = $('lamp-count'),
    lPips = $('lamp-pips');
  if (lCount)
    lCount.textContent = !state.flashlight
      ? 'SIN LINTERNA'
      : flash.remaining > 0
        ? 'ACTIVO'
        : flash.charges
          ? '1 / 1'
          : 'AGOTADO';
  if (lPips) {
    const pips = lPips.children;
    for (let i = 0; i < pips.length; i++)
      pips[i]?.classList.toggle('on', state.flashlight && i < flash.charges);
  }
  if (lBox) {
    lBox.classList.toggle('active', flash.remaining > 0);
    lBox.classList.toggle('empty', !state.flashlight || flash.charges === 0);
  }
  const sFill = $('stamina-fill'),
    sVal = $('stamina-val');
  if (sFill) sFill.style.width = stamina + '%';
  if (sVal) sVal.textContent = Math.round(stamina) + '%';
}
function think(text = objective(state)) {
  lastThought = text;
  subtitle('«' + text + '»', 8);
  refreshHUD();
  $('objective').querySelector('p').textContent = text;
}
function readLetter() {
  mode = 'letter';
  keys.clear();
  unlock();
  audio.pause(true);
  $('envelope-scene').classList.remove('opened');
  $('letter-paper').hidden = true;
  $('open-envelope').hidden = false;
  $('letter-copy').innerHTML = letter
    .split('\n\n')
    .map((p) => '<p>' + p + '</p>')
    .join('');
  show('letter-intro');
  show('hud', false);
  $('open-envelope').focus();
}
$('open-envelope').onclick = () => {
  $('envelope-scene').classList.add('opened');
  $('open-envelope').hidden = true;
  $('letter-paper').hidden = false;
  audio.play('footstep_wood_002', 0.12, 1.3);
  $('keep-letter').focus();
};
$('keep-letter').onclick = () => {
  state.letterRead = true;
  addNote('welcome', false);
  show('letter-intro', false);
  show('hud');
  mode = 'playing';
  audio.pause(false);
  think();
  persist();
  requestLock();
};
function resetEphemeral() {
  haunts.reset();
  retirement = new UnseenRetirement();
  captureAge = 0;
  rearHaunt = null;
  watcherHead = new WatcherHead();
  blindness = 0;
  scene.fog.density = 0.022;
  scene.fog.color.copy(normalFogColor);
  rewindHeld = rewindDragging = false;
  show('rewind-screen', false);
  $('blindness').style.opacity = '0';
  stamina = 100;
  staminaExhausted = false;
  $('capture').classList.add('hidden');
  flash = createFlash(state.flashCharges);
  lamp = false;
  hiddenLocker = null;
  lockerSearch.emerge();
  show('locker-view', false);
  world.creatureMotion.reset();
  world.watcherMotion.reset();
  world.watcherMotion.bipedal = 1;
  vy = 0;
  grounded = true;
  seated = false;
  transition = null;
  target = null;
  roomTime = 0;
  tvWatch = 0;
  ghostDone = false;
  seenGhost = 0;
  enemy = null;
  danger = 0;
  anomalyTime = 0;
  stepDistance = 0;
  subtitleTime = toastTime = 0;
  keys.clear();
  events.clear();
  show('remote', false);
  $('subtitle').textContent = '';
  $('toast').textContent = '';
  world.creature.visible = false;
  world.watcher.visible = false;
}
function placeAtCheckpoint() {
  if (enemy?.physicsActor) collisionTree?.removeCharacter(enemy.physicsActor);
  applyPuzzle(world, state.puzzle);
  applyLockerLayout(world, state.lockers);
  collisionTree = collisionWorld(world.rooms, state, { rebuild: true });
  const room = world.rooms[state.room];
  player.set(...room.spawn);
  yaw = room.yaw;
  pitch = 0;
  resetEphemeral();
  if (!playerActor)
    playerActor = collisionTree.createCharacter(world.worldPoint(state.room, player), state.room);
  collisionTree.teleport(playerActor, world.worldPoint(state.room, player), state.room);
  collisionTree.enable(playerActor, true);
  world.bookBurst.bindPhysics(collisionTree);
  world.bookBurst.reset();
  for (const r of world.rooms) {
    r.threatLights.reset();
    r.indirectFill.value = 1;
  }
  rewindTimer = 0;
  portalCooldown = 0.8;
  if (state.rewound && !state.inserted) spawnEnemy();
  refreshHUD();
  updateWorld(world, state, 0, state.elapsed, comfort);
  updateCamera(0);
}
async function startGame(resume = false) {
  endingSequence?.reset();
  world?.entryDoor.reset();
  if (!ready) return;
  state = resume ? saved() || fresh() : fresh();
  addNote('welcome', false);
  placeAtCheckpoint();
  mode = 'playing';
  show('menu', false);
  show('ending', false);
  show('pause', false);
  show('dialog', false);
  show('hud');
  $('fade').style.opacity = '0';
  await audio.init(camera, scene);
  audio.attachMedia(broadcastVideo);
  broadcastVideo.muted = false;
  if (state.channel) setChannel(state.channel);
  if (!state.letterRead) readLetter();
  else {
    requestLock();
    think();
  }
  persist();
}
function requestLock() {
  if (seated || mode !== 'playing') return;
  try {
    const result = renderer.domElement.requestPointerLock();
    result?.catch(() => toast('Mantén pulsado el ratón para mirar. WASD para caminar.', 7));
  } catch {
    toast('Mantén pulsado el ratón para mirar. WASD para caminar.', 7);
  }
}
function unlock() {
  pausedLock = true;
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => (pausedLock = false), 160);
}
function pauseGame() {
  if (mode !== 'playing') return;
  mode = 'paused';
  keys.clear();
  unlock();
  show('pause');
  show('remote', false);
  audio.pause(true);
  persist();
}
function resumeGame() {
  mode = 'playing';
  show('pause', false);
  audio.pause(false);
  show('remote', seated);
  if (!seated) requestLock();
}
function openDialog(tag, title, content, actions = []) {
  returnMode = mode;
  mode = 'dialog';
  keys.clear();
  unlock();
  audio.pause(true);
  $('dialog').classList.remove('letter-dialog', 'circuit-dialog');
  $('dialog-tag').textContent = tag;
  $('dialog-title').textContent = title;
  $('dialog-content').innerHTML = content;
  $('dialog-actions').replaceChildren();
  for (const action of actions) {
    const b = document.createElement('button');
    b.textContent = action.label;
    if (action.surface) {
      b.innerHTML = chairIcon(action.surface) + '<span>' + action.label + '</span>';
      b.className = 'surface-key';
    } else if (action.undo) b.className = 'undo-key';
    b.addEventListener('click', action.run);
    $('dialog-actions').appendChild(b);
  }
  show('dialog');
  ($('dialog-actions').querySelector('button') || $('close-dialog')).focus();
}
function closeDialog() {
  show('dialog', false);
  mode = returnMode;
  if (!state.letterRead && returnMode === 'playing') {
    state.letterRead = true;
    addNote('welcome', false);
    refreshHUD();
  }
  if (mode === 'playing') {
    audio.pause(false);
    if (!seated) requestLock();
  }
  if (mode === 'settings') $('settings-guide').focus();
  keys.clear();
}
function updateSettingReadouts() {
  for (const id of ['volume', 'brightness', 'sensitivity']) {
    const value = Number($(id).value);
    document.querySelector('output[for="' + id + '"]').textContent =
      id === 'volume' ? Math.round(value * 100) + '%' : value.toFixed(id === 'brightness' ? 2 : 1);
  }
}
function openSettings() {
  settingsReturn = mode;
  mode = 'settings';
  keys.clear();
  unlock();
  audio.pause(true);
  show('pause', false);
  show('settings-screen');
  updateSettingReadouts();
  $('volume').focus();
}
function closeSettings() {
  show('settings-screen', false);
  mode = settingsReturn;
  show('pause', mode === 'paused');
  if (mode === 'title') $('about').focus();
  else $('resume').focus();
}
function instructions() {
  openDialog(
    'GUÍA / CRÉDITOS',
    'Antes de entrar.',
    `
 <p>Has venido a recuperar una cinta de tu tío antes de que vacíen su casa. Explora cinco cuartos: sala, pasillo de servicio, taller, archivo familiar y cuarto de emisión. Los umbrales a ras del suelo permiten ir y volver; al cruzarlos gira la gravedad.</p>
 <p>Abre el sobre al comenzar. Los pensamientos indican el siguiente paso. <b>H</b> recuerda el objetivo y <b>J</b> abre las pistas. Cada motor deja su paso abierto permanentemente.</p>
 <p><b>WASD / flechas</b> caminar · <b>Ratón</b> mirar<br><b>E</b> interactuar, abrir casillero, entrar o salir · <b>Shift</b> correr · <b>Espacio</b> saltar<br><b>F</b> destello tras recoger la linterna (un uso) · <b>J</b> registro · <b>H</b> recordar · <b>Esc</b> pausa</p>
 <p>Encontrarás dos casilleros en habitaciones interiores. Puedes abrir uno con E y meterte; el Inquilino investigará la última habitación donde te vio y buscará en los cuartos vecinos. La linterna está sobre la mesa del archivo: F emite un solo destello breve y un acierto lo aturde tres segundos. Mantener F no repite el destello. En una persecución, a veces se acerca caminando y otras trepa hacia el techo. Puedes reducir el balanceo, el titileo y el efecto VHS desde los ajustes. Las notas pausan el juego.</p>
 <p>Modelos descargados CC0: <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">Poly Haven</a>, <a href="https://kenney.nl/assets/furniture-kit" target="_blank" rel="noreferrer">Kenney</a>, <a href="https://opengameart.org/content/modular-house-3d-models" target="_blank" rel="noreferrer">Modular House / Keith</a>, <a href="https://opengameart.org/content/vhs-cassette-3d" target="_blank" rel="noreferrer">VHS / GGBotNet</a>, <a href="https://3dassets.dev/assets/squash-club-and-racket-workshop-changing-locker-ae30f1aa" target="_blank" rel="noreferrer">Changing Locker / 3DAssets.dev</a> y <a href="https://polyhaven.com/a/vintage_flashlight" target="_blank" rel="noreferrer">Vintage Flashlight / Omar M. El-Safy</a>. Algunos modelos externos declaran generación con IA; fueron descargados ya existentes. El Inquilino utiliza el modelo Tripo proporcionado por el usuario.</p>
 <p>Sonidos de terror CC0 de OpenGameArt: <a href="https://opengameart.org/content/abandoned-passages-horror-ambience-loop" target="_blank" rel="noreferrer">Abandoned passages / congusbongus</a>, <a href="https://opengameart.org/content/horror-hit-soundpack-1" target="_blank" rel="noreferrer">Horror Hit Soundpack 1 / psychhead_</a>, <a href="https://opengameart.org/content/horror-scream1" target="_blank" rel="noreferrer">Horror scream1 / Vinrax</a> y <a href="https://opengameart.org/content/ghost-monster-voice-moaning-growling" target="_blank" rel="noreferrer">Ghost Monster Voice / qubodup</a>. Procedencia completa en docs/ASSETS_Y_LICENCIAS.md y docs/SONIDOS_TERROR_CC0.md.</p>
 <p>Final exterior CC0: protagonista con rig y animaciones de <a href="https://quaternius.com/packs/ultimatemodularcharacters.html" target="_blank" rel="noreferrer">Quaternius</a>, casas y carreteras de <a href="https://kenney.nl/assets/city-kit-suburban" target="_blank" rel="noreferrer">Kenney</a>, casa principal adaptada de Modular House y suelo <a href="https://polyhaven.com/a/forest_floor" target="_blank" rel="noreferrer">Forest Floor / Poly Haven</a>. La cinta y el televisor son los mismos modelos de la partida. Detalles en docs/ASSETS_FINAL_CC0.md.</p>
 <p class="small">Historia, interfaz y emisiones narradas: contenido del proyecto. El juego funciona localmente, sin conexión ni servicios de IA durante la partida. No recopila datos ni publica el proyecto.</p>`
  );
}
function journal() {
  const orderList = state.puzzle.order
    .map(
      (i) =>
        CLUE_ROOMS[i] + ': ' + (state.puzzle.observed.includes(i) ? state.puzzle.surfaces[i] : '¿?')
    )
    .join(' ➔ ');
  openDialog(
    'REGISTRO / ' + state.notes.length + ' ENTRADAS',
    'Lo que sabes.',
    `<div class="notes">${state.notes.map((id) => (notes[id] ? `<h3>${notes[id].title}</h3><p>${notes[id].body}</p>` : '')).join('')}</div><h3>Sillas según el orden del panel</h3><div class="observation-order">${puzzleOrder(state.puzzle)}</div><p><b>Combinación a introducir:</b> ${orderList}</p><p class="small">Examinadas: ${state.puzzle.observed.map((i) => CLUE_ROOMS[i] + ': ' + state.puzzle.surfaces[i]).join(' · ') || 'Aún no has examinado ninguna silla.'}</p><p>OBJETIVO: ${objective(state)}</p>`
  );
}

function sit() {
  if (seated) {
    player.copy(seatBefore);
    seated = false;
    show('remote', false);
    pitch = 0;
    requestLock();
    return;
  }
  seatBefore = player.clone();
  seated = true;
  keys.clear();
  player.set(0, -0.5, -0.75);
  yaw = 0;
  pitch = 0.06;
  unlock();
  show('remote');
  think(
    state.inserted
      ? 'Tengo que seleccionar el canal 03 y escuchar la última grabación de Julián.'
      : 'Tengo que seleccionar el canal 02 para ver las instrucciones de Julián.'
  );
}
function setChannel(n) {
  state.channel = n;
  tvWatch = 0;
  $('remote-channel').textContent = 'CANAL ' + String(n).padStart(2, '0');
  broadcastVideo.loop = n !== 2 && !(state.inserted && n === 3);
  audio.switch();
  const name = state.inserted && n === 3 ? 'para-volver' : 'canal-' + String(n).padStart(2, '0');
  broadcastVideo.src = broadcasts[name];
  broadcastVideo
    .play()
    .catch(() =>
      toast('La emisión no pudo reproducirse. Las pistas siguen disponibles en el registro.')
    );
  mediaRunning = true;
  document
    .querySelectorAll('#channels button')
    .forEach((b, i) => b.classList.toggle('selected', i + 1 === n));
  if (n === 2 && !state.watched)
    think('Tengo que escuchar las instrucciones de Julián antes de tocar el motor.');
  if (n === 5) {
    addNote('frequency');
    subtitle('Portadora de mantenimiento: ochenta y tres punto cero.', 5);
  }
  if (n === 4) {
    addNote('procedure');
    subtitle('Debo observar las sillas de madera. La combinación no está en la grabación.', 6);
  }
  if (state.inserted && n === 3) think('Esta es su última grabación. No debo interrumpirla.');
}
for (let i = 1; i <= 5; i++) {
  const b = document.createElement('button');
  b.textContent = String(i).padStart(2, '0');
  b.setAttribute('aria-label', 'Canal ' + i);
  b.onclick = () => setChannel(i);
  $('channels').appendChild(b);
}

function activateRelay(index) {
  if (state.relays[index]) return;
  state.relays[index] = true;
  addNote('relay' + index);
  collisionTree = collisionWorld(world.rooms, state);
  audio.switch();
  audio.tone(300 + index * 160, 0.65, 0.1);
  updateWorld(world, state, 0, state.elapsed, comfort);
  refreshHUD();
  persist();
  if (index === 0) addNote('frequency', false);
  if (index === 1) addNote('procedure');
  if (index === 2) {
    addNote('archive');
    subtitle(
      '«Se ha abierto la compuerta en el suelo del taller. Puedo bajar al archivo familiar.»',
      7
    );
  }
  think();
}
function radioDialog() {
  openRadioScreen();
}
function openRadioScreen() {
  tune = state.frequency || 0;
  returnMode = mode;
  mode = 'dialog';
  keys.clear();
  unlock();
  audio.pause(false);
  updateRadioKnob();
  buildRadioScale();
  show('radio-screen');
  $('radio-knob').focus();
}
function closeRadioScreen() {
  show('radio-screen', false);
  mode = returnMode;
  if (mode === 'playing') {
    audio.pause(false);
    if (!seated) requestLock();
  }
  keys.clear();
}
function buildRadioScale() {
  const scale = $('radio-scale');
  scale.innerHTML = '';
  frequencyOptions.forEach((freq, i) => {
    const tick = document.createElement('div');
    tick.className = 'radio-tick';
    tick.style.left = 7 + i * 21.5 + '%';
    tick.innerHTML = `<span>${freq}</span><i></i>`;
    scale.appendChild(tick);
  });
  const pointer = document.createElement('div');
  pointer.id = 'radio-pointer';
  scale.appendChild(pointer);
  updateRadioKnob();
}
function radioFrequency() {
  const low = Math.min(3, Math.floor(tune)),
    fraction = tune - low;
  return T.MathUtils.lerp(frequencyOptions[low], frequencyOptions[low + 1], fraction);
}
function updateRadioKnob() {
  const freq = radioFrequency(),
    synced = Math.abs(freq - 83) < 0.65;
  const fraction = tune / (frequencyOptions.length - 1);
  const angleDeg = -130 + fraction * 260;
  $('knob-rotor').style.transform = `rotate(${angleDeg}deg)`;
  $('radio-freq-val').textContent = freq.toFixed(1);
  $('radio-knob').setAttribute('aria-valuenow', tune.toFixed(2));
  $('radio-knob').setAttribute('aria-valuetext', freq.toFixed(1) + ' megahercios');
  if ($('radio-pointer')) $('radio-pointer').style.left = 7 + fraction * 86 + '%';
  $('radio-freq-val').parentElement.classList.toggle('synced', synced);
  const signalPct = Math.max(4, 100 - Math.abs(freq - 83) * 9);
  $('radio-meter-needle').style.transform = `rotate(${-60 + signalPct * 1.2}deg)`;
  $('radio-signal-fill').style.width = signalPct + '%';
  $('radio-signal-fill').classList.toggle('peak', synced);
  $('radio-status').textContent = synced
    ? 'PORTADORA FIJA · PULSA SINCRONIZAR'
    : 'INTERFERENCIA · GIRA DESPACIO EL DIAL';
  $('radio-status').classList.toggle('locked', synced);
}
function changeTune(n) {
  tune = T.MathUtils.clamp(tune + n, 0, 4);
  updateRadioKnob();
  if (performance.now() - rewindTick > 110) {
    audio.tone(125 + radioFrequency() * 2, 0.045, 0.009);
    rewindTick = performance.now();
  }
}
(() => {
  let kDrag = false,
    kLastAngle = 0;
  function getAngle(e, rect) {
    const cx = rect.left + rect.width / 2,
      cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
  }
  $('radio-knob').addEventListener('pointerdown', (e) => {
    if (mode !== 'dialog') return;
    kDrag = true;
    kLastAngle = getAngle(e, $('radio-knob').getBoundingClientRect());
    $('radio-knob').setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  $('radio-knob').addEventListener('pointermove', (e) => {
    if (!kDrag || mode !== 'dialog') return;
    const ang = getAngle(e, $('radio-knob').getBoundingClientRect());
    let d = ang - kLastAngle;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    changeTune((d * 4) / 260);
    kLastAngle = ang;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    $('radio-knob').addEventListener(name, () => (kDrag = false));
  // Hold a key for a continuous sweep instead of OS key-repeat jumps.
  $('radio-knob').addEventListener('keydown', (e) => {
    if (mode !== 'dialog') return;
    if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].includes(e.code)) {
      keys.add(e.code);
      e.preventDefault();
    }
  });
  $('radio-knob').addEventListener(
    'wheel',
    (e) => {
      if (mode !== 'dialog') return;
      changeTune(-Math.sign(e.deltaY) * 0.04);
      e.preventDefault();
    },
    { passive: false }
  );
  $('radio-sync-btn').addEventListener('click', () => {
    if (Math.abs(radioFrequency() - 83) < 0.65) {
      state.frequency = tune;
      closeRadioScreen();
      activateRelay(1);
    } else {
      audio.tone(180, 0.15, 0.05);
      $('radio-status').textContent = 'Solo se oye estática. Afina la señal.';
    }
  });
  $('radio-close-btn').addEventListener('click', closeRadioScreen);
})();

function circuitDialog() {
  circuitInput = [];
  const order = puzzleOrder(state.puzzle);
  const nextPrompt = () =>
    circuitInput.length < 3
      ? `Paso ${circuitInput.length + 1} de 3: ¿Dónde apoya en ${CLUE_ROOMS[state.puzzle.order[circuitInput.length]]}?`
      : 'SECUENCIA COMPLETA';
  const slots = () =>
    Array.from(
      { length: 3 },
      (_, i) =>
        `<div class="sequence-slot ${i === circuitInput.length ? 'active' : ''}"><small>0${i + 1}</small><strong>${circuitInput[i] || '—'}</strong></div>`
    ).join('');
  const renderSlots = () => {
    $('circuit-input').innerHTML = slots();
  };
  const actions = ['SUELO', 'PARED', 'TECHO'].map((label) => ({
    label,
    surface: label,
    run: () => {
      circuitInput.push(label);
      renderSlots();
      $('circuit-feedback').classList.remove('error');
      audio.switch();
      if (circuitInput.length === 3) {
        if (puzzleSolved(state.puzzle, circuitInput)) {
          $('circuit-feedback').textContent = 'CORRECTO. CONEXIÓN 03 RESTABLECIDA';
          closeDialog();
          activateRelay(2);
        } else {
          circuitInput = [];
          $('circuit-feedback').textContent =
            'NO COINCIDE. Observa las sillas y sigue el orden de habitaciones.';
          $('circuit-feedback').classList.add('error');
          renderSlots();
          audio.knock(world.worldPoint(2, new T.Vector3(-2.7, 1.4, -3.75)));
        }
      } else {
        $('circuit-feedback').textContent = nextPrompt();
      }
    }
  }));
  actions.push({
    label: 'Borrar último',
    undo: true,
    run: () => {
      if (circuitInput.length > 0) {
        circuitInput.pop();
        renderSlots();
        $('circuit-feedback').classList.remove('error');
        $('circuit-feedback').textContent = nextPrompt();
      }
    }
  });
  openDialog(
    'CONEXIÓN 03 / OBSERVACIÓN',
    'Restablecer orientación',
    `<div class="observation-order">${order}</div><div class="sequence-slots" id="circuit-input">${slots()}</div><span class="readout" id="circuit-feedback" role="status">${nextPrompt()}</span><p class="small">OBSERVA LAS SILLAS. RECUERDA SUS APOYOS.<br>E · examinar una silla &nbsp; J · consultar tus observaciones</p>`,
    actions
  );
  $('dialog').classList.add('circuit-dialog');
}
function exitDialog() {
  if (state.released) {
    beginEnding();
    return;
  }
  const door = world.entryDoor;
  door.setOpen(!door.target, player.z > 6);
  audio.play('impactWood_heavy_000', 0.15, 0.62, world.worldPoint(0, new T.Vector3(-3.2, 1.2, 6)));
  if (door.target)
    think(
      state.tape
        ? 'Puedo abrir la puerta, pero Julián pidió que reprodujera la cinta antes de llevármela.'
        : 'La salida está aquí. No voy a irme sin la cinta; se lo prometí a mamá.'
    );
}
function updateRewindUI() {
  const degrees = (rewindAngle * 180) / Math.PI;
  $('reel-left').style.transform = `rotate(${-degrees}deg)`;
  $('reel-right').style.transform = `rotate(${-degrees}deg)`;
  document
    .querySelector('.tape-left')
    .style.setProperty('--roll-size', 62 + 36 * Math.sqrt(rewindProgress) + '%');
  document
    .querySelector('.tape-right')
    .style.setProperty('--roll-size', 62 + 36 * Math.sqrt(1 - rewindProgress) + '%');
  $('rewind-progress').style.width = (rewindProgress * 100).toFixed(1) + '%';
  $('rewind-percent').textContent = Math.floor(rewindProgress * 100) + '%';
  $('rewind-status').textContent =
    rewindProgress >= 1
      ? 'LA CINTA ESTÁ AL PRINCIPIO'
      : rewindProgress > 0.7
        ? 'LA IMAGEN RETROCEDE…'
        : rewindProgress > 0.35
          ? 'LA BANDA SE MUEVE…'
          : 'GIRA EL CARRETE IZQUIERDO HACIA ATRÁS';
}
function closeRewind() {
  show('rewind-screen', false);
  rewindDragging = rewindHeld = false;
  document.querySelector('.rewind-machine').classList.remove('winding');
  mode = 'playing';
  audio.pause(false);
  requestLock();
  keys.clear();
}
function addRewind(rotation) {
  if (mode !== 'rewind' || rotation <= 0) return;
  rewindAngle += rotation * 2 * Math.PI;
  rewindProgress = Math.min(1, rewindProgress + rotation / 4);
  updateRewindUI();
  if (performance.now() - rewindTick > 100) {
    audio.play('footstep_concrete_001', 0.045, 0.68);
    rewindTick = performance.now();
  }
  if (rewindProgress >= 1) {
    closeRewind();
    state.rewound = true;
    addNote('tenant');
    spawnEnemy();
    think('La cinta está al principio. Algo despertó en otra habitación. Debo volver a la sala.');
    persist();
  }
}
function openRewind() {
  mode = 'rewind';
  keys.clear();
  unlock();
  rewindProgress = 0;
  rewindAngle = 0;
  rewindHeld = rewindDragging = false;
  show('rewind-screen');
  updateRewindUI();
  $('rewind-reel-control').focus();
  audio.switch();
}
(() => {
  const reel = $('rewind-reel-control');
  const angle = (e) => {
    const r = reel.getBoundingClientRect();
    return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2);
  };
  reel.addEventListener('pointerdown', (e) => {
    if (mode !== 'rewind') return;
    rewindDragging = true;
    rewindPrevious = angle(e);
    reel.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  reel.addEventListener('pointermove', (e) => {
    if (!rewindDragging || mode !== 'rewind') return;
    let delta = angle(e) - rewindPrevious;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    rewindPrevious = angle(e);
    if (delta < 0) addRewind(-delta / (Math.PI * 2));
  });
  reel.addEventListener('pointerup', () => (rewindDragging = false));
  reel.addEventListener('pointercancel', () => (rewindDragging = false));
  $('rewind-hold').addEventListener('pointerdown', (e) => {
    if (mode !== 'rewind') return;
    rewindHeld = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    $('rewind-hold').addEventListener(name, () => (rewindHeld = false));
  $('rewind-close').addEventListener('click', closeRewind);
})();
function finishTape() {
  state.released = true;
  danger = 0;
  audio.tone(220, 1.3, 0.04);
  addNote('truth');
  think('La señal se apagó. Ya puedo llevarme la cinta y salir por la puerta de entrada.');
  persist();
}
function finishInstructions() {
  if (state.watched) return;
  state.watched = true;
  addNote('tape');
  think(
    state.fuse
      ? 'Ya puedo instalar el fusible. Me levantaré con E e iré al cuadro eléctrico junto al umbral.'
      : 'Ya puedo reparar el motor. Me levantaré con E y recogeré el fusible de la mesa junto a la entrada.'
  );
  persist();
}
broadcastVideo.addEventListener('ended', () => {
  if (state.channel === 2 && state.room === 0) finishInstructions();
  if (state.channel === 3 && state.inserted && !state.released) finishTape();
});

function enterLocker(locker) {
  if (!locker?.active) return;
  hiddenLocker = locker;
  locker.doorTimer = 0.75;
  player.copy(locker.pos);
  collisionTree.teleport(playerActor, world.worldPoint(state.room, player), state.room);
  collisionTree.enable(playerActor, false);
  yaw = locker.viewYaw;
  pitch = 0;
  vy = 0;
  grounded = true;
  keys.clear();
  lockerSearch.hide(state.room);
  show('locker-view');
  show('interact', true);
  $('interact').querySelector('span').textContent = 'Salir del casillero';
  audio.play('impactWood_heavy_000', 0.17, 0.7);
  subtitle('«Está cerca. Debo esperar hasta que se aleje.»', 4);
  updateCamera(0);
}
function leaveLocker() {
  if (!hiddenLocker) return;
  const locker = hiddenLocker;
  hiddenLocker = null;
  locker.doorTimer = 0.8;
  player.copy(locker.pos).addScaledVector(locker.front, 1.25);
  player.y = 0;
  pitch = 0;
  vy = 0;
  lockerSearch.emerge();
  show('locker-view', false);
  keys.clear();
  audio.play('impactWood_heavy_000', 0.12, 0.85);
  updateCamera(0);
}

function interact(item = target) {
  if (mode !== 'playing' || transition || rewindTimer > 0) return;
  if (hiddenLocker) {
    leaveLocker();
    return;
  }
  if (seated) {
    sit();
    return;
  }
  if (!item) return;
  switch (item.type) {
    case 'chair':
      sit();
      break;
    case 'orientation-clue': {
      const i = item.room ?? state.room;
      if (!state.puzzle.observed.includes(i)) state.puzzle.observed.push(i);
      const surface = state.puzzle.surfaces[i].toLowerCase();
      subtitle(
        '«En ' +
          CLUE_ROOMS[i].toLowerCase() +
          ', las patas de esta silla están sujetas ' +
          (surface === 'pared' ? 'a la pared' : surface === 'techo' ? 'al techo' : 'al suelo') +
          '. Lo anotaré.»',
        6
      );
      persist();
      break;
    }
    case 'note':
      addNote(item.note);
      openDialog(
        'DEL ARCHIVO PERSONAL / OCTUBRE DE 1998',
        notes[item.note].title,
        `<div class="paper-message">${notes[item.note].body
          .split('\n\n')
          .map((p) => '<p>' + p + '</p>')
          .join('')}</div><div class="letter-signature">Julián</div>`
      );
      $('dialog').classList.add('letter-dialog');
      break;
    case 'fuse':
      if (!state.fuse) {
        state.fuse = true;
        audio.switch();
        think('Este es el repuesto. Tengo que instalarlo en el panel junto al paso de servicio.');
        persist();
      }
      break;
    case 'flashlight':
      if (!state.flashlight) {
        state.flashlight = true;
        flash = createFlash(1);
        state.flashCharges = 1;
        audio.switch();
        think('Solo queda una descarga. Debo reservar el destello para cuando lo tenga delante.');
        persist();
      }
      break;
    case 'locker':
      enterLocker(world.rooms[item.room ?? state.room].locker);
      break;
    case 'tape':
      if (!state.tape) {
        state.tape = true;
        audio.switch();
        addNote('archive');
        think(
          'PARA VOLVER… Es la cinta. Está al final; necesito el rebobinador del cuarto de emisión.'
        );
        persist();
      }
      break;
    case 'rewinder':
      if (!state.tape)
        think('Es el rebobinador de Julián. Primero necesito encontrar la cinta en el archivo.');
      else if (state.rewound) think();
      else openRewind();
      break;
    case 'insert':
      if (state.released) think();
      else if (state.inserted) {
        think('La cinta está dentro. Me sentaré y seleccionaré el canal 03.');
      } else if (state.rewound) {
        state.inserted = true;
        retirement = new UnseenRetirement();
        danger = 0;
        audio.switch();
        think('He colocado la cinta. Tengo que sentarme y verla en el canal 03.');
        persist();
      } else think('Aquí reproduciré la cinta cuando la haya recuperado y rebobinado.');
      break;
    case 'locked':
      subtitle(
        'No cede. Una etiqueta dice: «La salida se habilita al restablecer las tres conexiones».',
        6
      );
      break;
    case 'relay':
      if (state.relays[state.room]) {
        subtitle(notes['relay' + state.room].body, 6);
      } else if (state.room === 0) {
        if (!state.watched)
          subtitle('El procedimiento está en el canal 02. Primero consulta la cinta.', 5);
        else if (!state.fuse)
          subtitle('Falta un fusible. Hay uno sobre la mesa junto a la puerta de entrada.', 5);
        else activateRelay(0);
      } else if (state.room === 1)
        subtitle('La radio de la mesa controla esta conexión. Encuentra la portadora.', 5);
      else circuitDialog();
      break;
    case 'radio':
      if (state.relays[1]) subtitle('83.0 MHz. La portadora está sincronizada.', 4);
      else radioDialog();
      break;
    case 'exit':
      exitDialog();
      break;
  }
}
function targetInteraction() {
  target = null;
  if (seated) {
    show('interact', false);
    return;
  }
  if (hiddenLocker) {
    show('interact', true);
    $('interact').querySelector('span').textContent = 'Salir del casillero';
    return;
  }
  const room = world.rooms[state.room];
  const localEye = player.clone().add(new T.Vector3(0, EYE_HEIGHT, 0));
  const forward = new T.Vector3(0, 0, -1).applyEuler(new T.Euler(pitch, yaw, 0, 'YXZ'));
  let score = Infinity;
  for (const item of room.interactions) {
    if (
      (item.type === 'fuse' && (state.fuse || state.relays[0])) ||
      (item.type === 'tape' && state.tape) ||
      (item.type === 'flashlight' && state.flashlight) ||
      (item.type === 'locker' && !room.locker?.active)
    )
      continue;
    const diff = item.pos.clone().sub(localEye),
      dist = diff.length(),
      dot = diff.normalize().dot(forward);
    if (dist < item.radius && dot > 0.78) {
      const candidate = dist - 0.7 * dot;
      if (candidate < score) {
        score = candidate;
        target = item;
      }
    }
  }
  show('interact', !!target);
  $('crosshair').classList.toggle('active', !!target);
  if (target)
    $('interact').querySelector('span').textContent =
      target.type === 'exit' && state.released ? 'Salir con la cinta' : target.label;
}

function beginFall(
  portal = world.rooms[state.room].openPortals.find((p) => insideHole(player.x, player.z, p))
) {
  if (!portal || transition) return;
  transition = makeGravityBody(portal, player, vy, EYE_HEIGHT, playerActor);
  transition.lastYaw = yaw;
  show('interact', false);
  subtitle('«Puedo moverme dentro del paso. La pared se convierte en suelo.»', 5);
}
function updateFall(dt) {
  const body = transition,
    input = movementInput();
  input.yaw = yaw;
  const result = stepGravityBody(body, input, dt, collisionTree);
  yaw = result.yaw;
  grounded = body.grounded;
  $('gravity').textContent = 'GRAVEDAD / ' + world.rooms[body.field].name;
  camera.position.copy(gravityEye(body));
  qLook.setFromEuler(new T.Euler(pitch, yaw, 0, 'YXZ'));
  camera.quaternion.copy(body.frame).multiply(qLook);
  const arrival = gravityArrival(body);
  if (arrival) {
    const oldRoom = state.room;
    state.room = arrival.room;
    playerActor.room = arrival.room;
    playerActor.transition = null;
    player.copy(localPosition(arrival.room, collisionTree.feet(playerActor)));
    vy = body.velocity.dot(new T.Vector3(0, 1, 0).applyQuaternion(roomQuaternion(state.room)));
    transition = null;
    roomTime = 0;
    if (!state.visited.includes(state.room)) state.visited.push(state.room);
    portalCooldown = 0.1;
    if (state.room !== oldRoom) {
      if (state.room === 1) addNote('frequency', false);
      if (state.room === 3) addNote('tenant', false);
      persist();
      think();
    }
    updateCamera(0);
  }
}
function movementInput() {
  let side =
      Number(keys.has('KeyD') || keys.has('ArrowRight')) -
      Number(keys.has('KeyA') || keys.has('ArrowLeft')),
    forward =
      Number(keys.has('KeyW') || keys.has('ArrowUp')) -
      Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const n = Math.hypot(side, forward);
  if (n) {
    side /= n;
    forward /= n;
  }
  const canRun =
    (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !staminaExhausted && stamina > 0;
  return { side, forward, speed: canRun ? 3.55 : 2, yaw, jump: keys.has('Space') };
}
function updateCamera(dt) {
  const fov = hiddenLocker ? 80 : seated ? 35 : 68;
  camera.fov = dt > 0 ? T.MathUtils.damp(camera.fov, fov, 5, dt) : fov;
  camera.updateProjectionMatrix();
  $('crosshair').style.display = seated || hiddenLocker ? 'none' : '';
  const room = world.rooms[state.room];
  const bob =
    comfort || seated || hiddenLocker || !grounded
      ? 0
      : Math.sin(walkPhase) * 0.022 * Math.min(stepDistance + 1, 1);
  const eye = hiddenLocker
    ? hiddenLocker.eye.clone()
    : player.clone().add(new T.Vector3(0, EYE_HEIGHT + bob, 0));
  camera.position.copy(room.group.localToWorld(eye));
  qLook.setFromEuler(
    new T.Euler(pitch, yaw, comfort || hiddenLocker ? 0 : Math.sin(walkPhase * 0.5) * 0.0015, 'YXZ')
  );
  camera.quaternion.copy(room.group.quaternion).multiply(qLook);
}
function updatePlayer(dt) {
  if (rewindTimer > 0) {
    updateCamera(dt);
    return;
  }
  portalCooldown = Math.max(0, portalCooldown - dt);
  if (hiddenLocker) {
    updateCamera(dt);
    return;
  }
  if (seated) {
    updateCamera(dt);
    return;
  }
  const previous = player.clone();
  player.copy(localPosition(state.room, collisionTree.feet(playerActor)));
  grounded = playerActor.grounded;
  vy = new T.Vector3(
    playerActor.body.velocity.x,
    playerActor.body.velocity.y,
    playerActor.body.velocity.z
  ).dot(playerActor.up);
  let side =
      Number(keys.has('KeyD') || keys.has('ArrowRight')) -
      Number(keys.has('KeyA') || keys.has('ArrowLeft')),
    forward =
      Number(keys.has('KeyW') || keys.has('ArrowUp')) -
      Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const length = Math.hypot(side, forward);
  if (length) {
    side /= length;
    forward /= length;
  }
  const enemyDist = enemy
    ? enemy.position.distanceTo(world.worldPoint(state.room, player))
    : Infinity;
  const isNearEnemy =
    enemy &&
    enemy.delay <= 0 &&
    enemy.stunRemaining <= 0 &&
    (state.room === enemy.room || enemyDist < 8.5);
  const panicT = isNearEnemy ? T.MathUtils.clamp((8.5 - enemyDist) / 6, 0, 1) : 0;
  const panicMultiplier = 1 + 2.2 * panicT;
  const wantsRun = keys.has('ShiftLeft') || keys.has('ShiftRight'),
    canRun = wantsRun && length > 0.01 && !staminaExhausted && stamina > 0,
    run = canRun,
    speed = (run ? 3.55 : 2.0) * dt;
  if (run) {
    stamina = Math.max(0, stamina - 22 * panicMultiplier * dt);
    if (stamina <= 0) staminaExhausted = true;
  } else {
    stamina = Math.min(100, stamina + 20 * dt);
    if (stamina >= 100) staminaExhausted = false;
  }
  const sFill = $('stamina-fill'),
    sBox = $('stamina-container'),
    sLabel = $('stamina-label'),
    sVal = $('stamina-val');
  if (sFill) sFill.style.width = stamina + '%';
  if (sVal) sVal.textContent = Math.round(stamina) + '%';
  if (sBox) {
    sBox.classList.toggle('exhausted', staminaExhausted);
    sBox.classList.toggle('panic', isNearEnemy && run);
  }
  if (sLabel)
    sLabel.textContent = staminaExhausted ? 'AGOTADO' : isNearEnemy && run ? 'PÁNICO' : 'ALIENTO';
  const dx = (side * Math.cos(yaw) - forward * Math.sin(yaw)) * speed;
  let dz = (-side * Math.sin(yaw) - forward * Math.cos(yaw)) * speed;
  // The leaf can be opened to see outside, but the protagonist keeps the
  // promise in the letter. Do not turn the yard into a chase-free shortcut.
  if (
    state.room === 0 &&
    !state.released &&
    player.z + dz > 5.55 &&
    Math.abs(player.x + 3.2) < 1.0 &&
    dz > 0
  ) {
    dz = Math.max(0, 5.55 - player.z);
    if (!events.has('exit-promise')) {
      events.add('exit-promise');
      think(
        state.tape
          ? 'Primero tengo que reproducir la cinta de Julián. Después podré salir.'
          : 'No voy a irme sin la cinta. Se lo prometí a mamá.'
      );
    }
  }
  const incoming = world.rooms[state.room].portals.find(
    (p) => p.kind === 'wall' && portalOpen(p, state)
  );
  if (
    incoming &&
    player.x + dx > 4.62 &&
    Math.abs(player.z - incoming.z) < 0.94 &&
    player.y < 0.18
  ) {
    beginFall(incoming);
    updateFall(dt);
    return;
  }
  collisionTree.configure(playerActor, {
    frame: roomQuaternion(state.room),
    desired: new T.Vector3(dx / Math.max(dt, 0.0001), 0, dz / Math.max(dt, 0.0001)).applyQuaternion(
      roomQuaternion(state.room)
    )
  });
  const moved = Math.hypot(player.x - previous.x, player.z - previous.z);
  if (grounded && moved > 0.0001) {
    stepDistance += moved;
    walkPhase += moved * 8;
    if (stepDistance > (run ? 1.35 : 0.99)) {
      audio.footstep(state.room, run);
      stepDistance = 0;
    }
  }
  const room = world.rooms[state.room];
  room.openPortals = room.portals.filter((p) => portalOpen(p, state));
  if (
    room.openPortals.some((p) => insideHole(player.x, player.z, p, 0.08)) &&
    player.y < -0.18 &&
    portalCooldown <= 0
  ) {
    beginFall();
    return;
  }
  if (player.y < -8) {
    placeAtCheckpoint();
    toast('Se ha restaurado el punto de control.');
  }
  updateCamera(dt);
}
function updateFlashlight() {
  const active = lamp && mode !== 'title' && mode !== 'ending';
  flashlight.intensity = active ? 78 : 0;
  if (active) {
    flashlight.position.copy(camera.position);
    camera.getWorldDirection(rayDirection);
    flashlight.target.position.copy(camera.position).addScaledVector(rayDirection, 12);
  }
}

function fireFlash() {
  if (mode !== 'playing' || hiddenLocker) return false;
  if (!state.flashlight) {
    toast('Primero debo encontrar la linterna.', 3);
    return false;
  }
  if (!triggerFlash(flash)) {
    if (!flash.charges) toast('La linterna se agotó. Busca otra salida.', 3);
    return false;
  }
  state.flashCharges = flash.charges;
  lamp = true;
  audio.switch();
  refreshHUD();
  persist();
  return true;
}
function spawnEnemy(forcedRoom = null) {
  if (enemy?.physicsActor) collisionTree?.removeCharacter(enemy.physicsActor);
  const room =
    forcedRoom ??
    chooseSpawnRoom(
      state.room,
      world.rooms,
      state,
      Math.random,
      transition ? [transition.from, transition.portal.to] : []
    );
  if (room === null) return;
  enemy = new Pursuer(room, spawnPoint(world.rooms[room]));
  collisionTree = collisionWorld(world.rooms, state);
  haunts.reset();
  retirement = new UnseenRetirement();
  world.creatureMotion.reset();
  world.creature.visible = true;
  world.creature.position.copy(enemy.position);
  world.creature.quaternion.copy(enemy.rotation);
  refreshHUD();
}
function updateEncounters(dt) {
  const event = haunts.update(dt, { state, roomTime, observed: false });
  for (const room of world.rooms) room.hauntPower = 1;
  if (!event) return;
  const room = world.rooms[event.room],
    t = event.age;
  if (event.started) {
    audio.haunt(
      ['knock', 'drag', 'whisper', 'whisper'][event.room],
      world.worldPoint(event.room, new T.Vector3(-3.6, 2, 2.7))
    );
    subtitle(
      [
        'Los golpes vienen de dentro del muro.',
        'Algo está arrastrándose encima de mí.',
        'Una voz repite mis pasos con retraso.',
        'La casa respira detrás de los libros.'
      ][event.room],
      5
    );
  }
  room.hauntPower = comfort ? 0.78 : t < 1.1 ? 0.12 + 0.5 * Math.abs(Math.sin(t * 13)) : 1;
  if (event.kind === 'drag' && Math.floor(t * 4) !== Math.floor((t - dt) * 4))
    audio.play(
      'footstep_wood_002',
      0.13,
      0.48,
      world.worldPoint(event.room, new T.Vector3(2 - t * 0.6, 3.8, 2.8))
    );
  if (event.kind === 'figure' && Math.floor(t * 5) !== Math.floor((t - dt) * 5))
    audio.tone(77 + t * 6, 0.17, 0.018, world.worldPoint(event.room, new T.Vector3(-3.6, 2, 2.7)));
}
function updateWatcherHead(dt) {
  const watcher = world.watcher;
  if (state.room < 1 || state.rewound || state.inserted || state.haunts.includes(WATCHER_HEAD_ID)) {
    watcher.visible = false;
    return;
  }
  const site = watcherThresholdSite(world.rooms, state.room);
  if (!site) {
    watcher.visible = false;
    return;
  }
  const oldUp = new T.Vector3(0, 1, 0).applyQuaternion(roomQuaternion(site.room));
  world.watcherClipPlane.setFromNormalAndCoplanarPoint(
    oldUp,
    world.worldPoint(site.room, new T.Vector3(0, 0, 0))
  );
  const hide = T.MathUtils.clamp(watcherHead.hideAge / WATCHER_HIDE_SECONDS, 0, 1);
  const retreat = watcherRetreatHead(site, hide);
  const point = world.worldPoint(site.room, new T.Vector3(site.x, site.y - 2.1, site.z));
  watcher.position.copy(point);
  // The head belongs to the old room's floor edge, not the shaft between the
  // gravity frames. Keep its vertical axis in that room's orientation.
  const between = roomQuaternion(site.room);
  const toward = camera.position.clone().sub(point).applyQuaternion(between.clone().invert());
  watcher.quaternion
    .copy(between)
    .multiply(
      new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.atan2(toward.x, toward.z))
    );
  watcher.visible = true;
  world.watcherMotion.update(dt, { time: state.elapsed, bipedal: 1, lookTarget: camera.position });
  watcher.updateWorldMatrix(true, true);
  const desiredHead = world.worldPoint(site.room, new T.Vector3(retreat.x, retreat.y, retreat.z));
  let head = world.watcherHeadBone?.getWorldPosition(new T.Vector3()) || point.clone();
  watcher.position.add(desiredHead.clone().sub(head));
  watcher.updateWorldMatrix(true, true);
  head = world.watcherHeadBone?.getWorldPosition(new T.Vector3()) || desiredHead;
  const bones = world.watcherMotion.bones;
  const observed =
    !watcherHead.hiding &&
    watcherIsObserved(
      camera,
      [
        head.clone().addScaledVector(oldUp, 0.28),
        head,
        bones.LeftArm.getWorldPosition(new T.Vector3()),
        bones.RightArm.getWorldPosition(new T.Vector3())
      ],
      collisionTree
    );
  const event = watcherHead.update(dt, { state, roomTime, observed });
  if (event === 'noticed') audio.haunt('whisper', head);
  if (event === 'hidden') {
    state.haunts.push(WATCHER_HEAD_ID);
    persist();
    watcher.visible = false;
  }
  if (event === 'inactive') watcher.visible = false;
}
function updateRearHaunt(dt) {
  if (state.room < 2 || state.room > 4 || state.rewound || state.inserted) {
    rearHaunt = null;
    world.creature.visible = false;
    return;
  }
  if (!rearHaunt && shouldStartRearHaunt(state, roomTime)) {
    const backward = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    rearHaunt = new RearApparition(player, backward, world.rooms[state.room]);
    world.creatureMotion.reset();
    world.creatureMotion.bipedal = 1;
    audio.haunt('whisper', world.worldPoint(state.room, rearHaunt.local));
    subtitle('La luz acaba de parpadear. Hay algo detrás de mí.', 4.5);
  }
  if (!rearHaunt) {
    world.creature.visible = false;
    return;
  }
  const room = world.rooms[state.room];
  if (rearHaunt.room !== state.room)
    rearHaunt.relocate(player, new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), room);
  const local = rearHaunt.position(player, room, dt),
    position = world.worldPoint(state.room, local);
  room.hauntPower = comfort ? 0.7 : 0.32 + 0.68 * Math.abs(Math.sin(rearHaunt.age * 19));
  world.creature.visible = true;
  world.creature.position
    .copy(position)
    .addScaledVector(
      new T.Vector3(1, 0, 0).applyQuaternion(roomQuaternion(state.room)),
      Math.sin(rearHaunt.age * 19) * 0.1 + Math.sin(rearHaunt.age * 41) * 0.045
    );
  const toward = camera.position
    .clone()
    .sub(position)
    .applyQuaternion(roomQuaternion(state.room).invert());
  world.creature.quaternion
    .copy(roomQuaternion(state.room))
    .multiply(
      new T.Quaternion().setFromAxisAngle(
        new T.Vector3(0, 1, 0),
        Math.atan2(toward.x, toward.z) + Math.sin(rearHaunt.age * 16) * 0.11
      )
    );
  world.creatureMotion.update(dt, {
    time: rearHaunt.age,
    speed: 0.08,
    crouch: 0,
    tree: collisionTree,
    lookTarget: camera.position,
    bipedal: 1,
    menace: 1
  });
  // Look at the visible face/torso, not at the floor-level root of the rig.
  const event = rearHaunt.update(
    dt,
    isCreatureObserved(camera, world.creature, collisionTree, { verticalPadding: 1.45 })
  );
  if (event === 'spotted') {
    audio.reveal(world.creatureMotion.bones.Head.getWorldPosition(new T.Vector3()));
    subtitle('«Estaba justo detrás de mí.»', 5);
  }
  if (rearHaunt.spotted) {
    danger = 0.95;
    blindness = Math.max(
      blindness,
      Math.min(0.95, (rearHaunt.seenFor / REAR_REVEAL_SECONDS) * 0.95)
    );
  }
  if (event === 'vanished') {
    if (!state.haunts.includes(REAR_HAUNT_ID)) state.haunts.push(REAR_HAUNT_ID);
    persist();
    blindness = 1;
    rearHaunt = null;
    world.creature.visible = false;
    danger = 0;
    audio.haunt('whisper', position);
  }
}
function updateHorror(dt) {
  if (mode !== 'playing') return;
  if (!collisionTree) collisionTree = collisionWorld(world.rooms, state);
  if (!enemy) {
    danger = 0;
    updateEncounters(dt);
    updateWatcherHead(dt);
    updateRearHaunt(dt);
    return;
  }
  world.watcher.visible = false;
  for (const room of world.rooms) room.hauntPower = 1;
  if (state.inserted) {
    // A watched creature must never be deleted in front of the player.
    if (enemy.physicsActor) {
      enemy.physicsActor.desired.set(0, 0, 0);
      enemy.physicsActor.verticalMotor = null;
      enemy.position.copy(collisionTree.feet(enemy.physicsActor));
      world.creature.position.copy(enemy.position);
    }
    world.creature.visible = true;
    world.creatureMotion.update(dt, {
      time: state.elapsed,
      tree: collisionTree,
      lookTarget: camera.position,
      contactUps: enemy.contactUps
    });
    if (retirement.update(dt, isCreatureObserved(camera, world.creature, collisionTree))) {
      world.creature.visible = false;
      collisionTree.removeCharacter(enemy.physicsActor);
      enemy = null;
      danger = 0;
      audio.play('impactWood_heavy_000', 0.15, 0.4);
    }
    return;
  }
  const center = enemy.position
      .clone()
      .addScaledVector(new T.Vector3(0, 1, 0).applyQuaternion(enemy.rotation), 0.65),
    direction = center.clone().sub(camera.position),
    dist = direction.length();
  camera.getWorldDirection(rayDirection);
  const needsSight = flash.remaining > 0 || dist < 1.3;
  const hit = needsSight
    ? collisionTree?.rayIntersect(new T.Ray(camera.position.clone(), direction.clone().normalize()))
    : null;
  const clear = !hit || hit.distance > dist - 0.25,
    illuminated =
      flash.remaining > 0 && direction.normalize().dot(rayDirection) > 0.82 && dist < 16 && clear;
  if (hitFlash(flash, enemy, illuminated))
    subtitle('«Solo tres segundos. Tengo que moverme.»', 2.8);
  const searchRoom = hiddenLocker ? lockerSearch.update(dt, enemy.room) : null;
  const targetRoom =
    searchRoom ??
    (transition
      ? transition.field === transition.from
        ? transition.portal.to
        : transition.field
      : state.room);
  const huntTarget = hiddenLocker
    ? world.worldPoint(targetRoom, new T.Vector3(0, 0, 0))
    : camera.position;
  enemy.update(dt, {
    rooms: world.rooms,
    targetRoom,
    target: huntTarget,
    tree: collisionTree,
    attack: !hiddenLocker
  });
  world.creature.visible = true;
  world.creature.position.copy(enemy.position);
  world.creature.quaternion.copy(enemy.rotation);
  world.creatureMotion.update(dt, {
    time: enemy.awake,
    speed: enemy.speed,
    crouch: enemy.crouch,
    tree: collisionTree,
    lookTarget: huntTarget,
    stunned: enemy.stunRemaining > 0,
    contactUps: enemy.contactUps,
    supportUp: enemy.supportUp,
    travelDirection: enemy.travelDirection,
    climbing: enemy.climbing,
    bipedal: enemy.bipedal
  });
  danger = Math.max(0, 1 - dist / 7) * (hiddenLocker ? 0.65 : 1);
  if (enemy.delay <= 0 && !events.has('awake')) {
    events.add('awake');
    think(
      'Está en la casa. Si encontré la linterna, solo tengo un destello; también puedo esconderme en un casillero.'
    );
    audio.knock(center);
  }
  anomalyTime += dt;
  if (anomalyTime > 1.4 && enemy.speed > 0.1) {
    anomalyTime = 0;
    audio.play('footstep_concrete_001', 0.24, 0.58, center);
    audio.monster(center);
  }
  if (!hiddenLocker && dist < 1.3 && clear && enemy.delay <= 0 && enemy.stunRemaining <= 0)
    caught();
}
function caught() {
  if (mode !== 'playing') return;
  mode = 'caught';
  captureAge = 0;
  show('hud', false);
  unlock();
  keys.clear();
  show('remote', false);
  show('interact', false);
  show('capture');
  audio.jumpscare(world.creatureMotion.bones.Head.getWorldPosition(new T.Vector3()));
  world.creatureMotion.reset();
}
function updateCapture(dt) {
  captureAge += dt;
  const up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
    forward = camera.getWorldDirection(new T.Vector3());
  if (!comfort) {
    const shake = Math.max(0, 1 - captureAge / CAPTURE_DURATION) * 0.032;
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    camera.position.z += (Math.random() - 0.5) * shake;
    camera.rotation.z += (Math.random() - 0.5) * shake * 1.8;
  }
  world.creature.visible = true;
  world.creature.quaternion.copy(camera.quaternion);
  world.creature.position.copy(camera.position).addScaledVector(forward, 1);
  world.creatureMotion.update(dt, {
    time: captureAge * 2.5,
    crouch: 0,
    lookTarget: camera.position,
    jumpscare: captureAge + 0.1,
    bipedal: 1
  });
  const head = world.creatureMotion.bones.Head.getWorldPosition(new T.Vector3()),
    desired = camera.position
      .clone()
      .addScaledVector(forward, captureDistance(captureAge))
      .addScaledVector(up, -0.04);
  world.creature.position.add(desired.sub(head));
  world.creature.updateWorldMatrix(true, true);
  $('capture').style.opacity = String(comfort ? 0.22 : 0.4 + 0.1 * Math.sin(captureAge * 17));
  $('fade').style.opacity = String(Math.max(0, (captureAge - (CAPTURE_DURATION - 0.4)) / 0.4));
  if (captureAge >= CAPTURE_DURATION) {
    const checkpoint = saved();
    if (checkpoint) state = checkpoint;
    state.flashCharges = 1;
    placeAtCheckpoint();
    mode = 'paused';
    show('hud');
    show('pause');
    $('fade').style.opacity = '0';
    audio.pause(true);
    subtitle(
      'Nuevo intento: observa las superficies, busca la linterna y usa su único destello.',
      8
    );
  }
}
function beginEnding() {
  if (mode === 'cinematic' || !endingSequence) return;
  mode = 'cinematic';
  keys.clear();
  unlock();
  show('hud', false);
  show('remote', false);
  show('pause', false);
  show('interact', false);
  show('locker-view', false);
  broadcastVideo.pause();
  mediaRunning = false;
  lamp = false;
  flashlight.intensity = 0;
  blindness = danger = 0;
  $('blindness').style.opacity = '0';
  $('fade').style.opacity = '0';
  $('subtitle').textContent = '';
  $('toast').textContent = '';
  collisionTree.enable(playerActor, false);
  if (enemy?.physicsActor) collisionTree.enable(enemy.physicsActor, false);
  world.creature.visible = world.watcher.visible = false;
  audio.pause(false);
  audio.update(camera, 0, 0);
  endingSequence.start();
}
function win() {
  mode = 'ending';
  state.won = true;
  keys.clear();
  audio.pause(true);
  show('ending');
  $('end-stats').textContent =
    `${state.visited.length} cuartos recorridos · ${Math.floor(state.elapsed / 60)} min ${Math.floor(state.elapsed % 60)} s · ${state.notes.length} registros recuperados`;
}

function securityFrame(time) {
  if (cctvPending || time - lastCCTV < 0.2) return;
  lastCCTV = time;
  const room = world.rooms[0],
    tv = room.tv;
  const oldVisible = world.creature.visible,
    oldPos = world.creature.position.clone(),
    oldQ = world.creature.quaternion.clone();
  if (state.watched && Math.floor(time / 4) % 3 === 1) {
    world.creature.visible = true;
    world.creature.position.set(-1.8, 0, 2.8);
    world.creature.quaternion.identity();
  }
  cctv.position.set(4.6, 3.5, 4.7);
  cctv.up.set(0, 1, 0);
  cctv.lookAt(0, 1, 0);
  tv.screen.visible = false;
  const old = renderer.getRenderTarget();
  renderer.setRenderTarget(cctvTarget);
  renderer.render(scene, cctv);
  renderer.setRenderTarget(old);
  tv.screen.visible = true;
  world.creature.visible = oldVisible;
  world.creature.position.copy(oldPos);
  world.creature.quaternion.copy(oldQ);
  // A synchronous readback blocks the entire browser until the GPU finishes.
  cctvPending = true;
  renderer
    .readRenderTargetPixelsAsync(cctvTarget, 0, 0, 256, 192, cctvBuffer)
    .then(() => {
      for (let y = 0; y < 192; y++)
        cctvImage.data.set(cctvBuffer.subarray((191 - y) * 1024, (192 - y) * 1024), y * 1024);
      cctvCtx.putImageData(cctvImage, 0, 0);
    })
    .catch((e) => console.warn('CCTV no disponible', e))
    .finally(() => {
      cctvPending = false;
    });
}
function broadcast(time) {
  const ch = state.channel;
  if (ch === 0 && lastBroadcastChannel === 0) return;
  if (ch !== 0 && time - lastBroadcast < 0.08) return;
  lastBroadcast = time;
  lastBroadcastChannel = ch;
  const tv = world.rooms[0].tv,
    ctx = tv.ctx,
    w = 768,
    h = 576;
  const liveVideo = ch > 0 && broadcastVideo.readyState >= 2 && !(ch === 3 && !state.inserted);
  tv.screen.map = liveVideo ? broadcastTexture : tv.texture;
  tv.light.intensity = ch ? 7 : 0;
  if (liveVideo) return;
  ctx.fillStyle = ch ? '#14201b' : '#030606';
  ctx.fillRect(0, 0, w, h);
  tv.light.intensity = ch ? 7 : 0;
  if (ch) {
    ctx.fillStyle = '#aebfa7';
    ctx.textAlign = 'left';
    ctx.font = '23px monospace';
    ctx.fillText('CASA / CANAL 0' + ch, 36, 42);
    ctx.textAlign = 'right';
    ctx.fillText('03:17:00', w - 36, 42);
    ctx.textAlign = 'center';
    if (broadcastVideo.readyState < 2) {
      if (ch === 1) {
        const colors = [
          '#a7aaa0',
          '#c0bc76',
          '#73958a',
          '#6f9181',
          '#826d78',
          '#a18371',
          '#6a7389'
        ];
        colors.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect((i * w) / 7, 85, w / 7 + 1, 280);
        });
        ctx.fillStyle = '#d0d4bc';
        ctx.font = '32px monospace';
        ctx.fillText('SEÑAL DOMÉSTICA', w / 2, 430);
        ctx.font = '20px monospace';
        ctx.fillText('NO AJUSTE LA ORIENTACIÓN DEL RECEPTOR', w / 2, 481);
      }
      if (ch === 2) {
        const cycle = Math.floor(tvWatch / 4) % 4;
        const pages = [
          ['MANTENIMIENTO', 'TRES CONEXIONES / UNA SALIDA'],
          ['REEMPLACE EL FUSIBLE', 'MESA JUNTO A LA ENTRADA'],
          ['SI EL SUELO DESAPARECE', 'NO INTENTE DETENER LA CAÍDA'],
          ['SIGA EL POLVO', 'NO TODAS LAS COSAS CAEN CON USTED']
        ];
        ctx.font = '38px monospace';
        ctx.fillText(pages[cycle][0], w / 2, 240, w - 60);
        ctx.font = '23px monospace';
        ctx.fillText(pages[cycle][1], w / 2, 310, w - 50);
        ctx.font = '22px monospace';
        ctx.fillText('CONEXIONES   01 — 02 — 03', w / 2, 460);
      }
      if (ch === 4) {
        ctx.font = '35px monospace';
        ctx.fillText('PROTOCOLO DE ORIENTACIÓN', w / 2, 210, w - 60);
        ctx.font = '33px monospace';
        ctx.fillText('OBSERVE LAS TRES SILLAS', w / 2, 310);
        ctx.font = '21px monospace';
        ctx.fillText('EL PANEL INDICA EL ORDEN DE HABITACIONES', w / 2, 440, w - 50);
      }
      if (ch === 5) {
        ctx.font = '95px monospace';
        ctx.fillText('83.0', w / 2, 280);
        ctx.font = '24px monospace';
        ctx.fillText('MHz / PORTADORA DE MANTENIMIENTO', w / 2, 345);
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const y = 445 + Math.sin(x * 0.04 + time * 4) * 15 + Math.sin(x * 0.1) * 4;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = '#9fb995';
        ctx.stroke();
      }
    }
    if (ch === 3 && !state.inserted) {
      securityFrame(time);
      ctx.drawImage(cctvCanvas, 20, 70, w - 40, h - 140);
      ctx.fillStyle = '#dae4cf';
      ctx.font = '20px monospace';
      ctx.fillText('CIRCUITO CERRADO / RETARDO DESCONOCIDO', w / 2, h - 30);
    }
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.19;
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#bdcdb9';
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 100; i++)
      ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 12, 1);
    ctx.globalAlpha = 1;
  }
  tv.texture.needsUpdate = true;
}

document.addEventListener('keydown', (event) => {
  if (event.code === 'Tab') {
    const active =
      mode === 'settings'
        ? $('settings-screen')
        : mode === 'paused'
          ? $('pause')
          : mode === 'dialog'
            ? !$('radio-screen').classList.contains('hidden')
              ? $('radio-screen')
              : $('dialog')
            : mode === 'rewind'
              ? $('rewind-screen')
              : mode === 'letter'
                ? $('letter-intro')
                : mode === 'title'
                  ? $('menu')
                  : mode === 'ending'
                    ? $('ending')
                    : null;
    if (active) {
      const controls = [
        ...active.querySelectorAll('button:not(:disabled),input,[tabindex="0"]')
      ].filter((el) => el.getClientRects().length);
      const index = controls.indexOf(document.activeElement);
      if (
        controls.length &&
        (event.shiftKey ? index <= 0 : index === controls.length - 1 || index < 0)
      ) {
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
        event.preventDefault();
      }
    }
    return;
  }
  if (mode === 'settings') {
    if (event.code === 'Escape') closeSettings();
    return;
  }
  if (mode === 'letter') return;
  if (mode === 'rewind') {
    if (event.code === 'Escape') {
      closeRewind();
      return;
    }
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      keys.add(event.code);
      event.preventDefault();
    }
    return;
  }
  if (mode === 'dialog' && event.code === 'KeyE') {
    if (!$('radio-screen').classList.contains('hidden')) closeRadioScreen();
    else closeDialog();
    return;
  }
  if (event.code === 'Escape') {
    if (mode === 'dialog') {
      const rs = $('radio-screen');
      if (rs && !rs.classList.contains('hidden')) closeRadioScreen();
      else closeDialog();
    } else if (mode === 'playing') pauseGame();
    return;
  }
  if (mode !== 'playing') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code))
    event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyE') interact();
  if (event.code === 'KeyF') fireFlash();
  if (event.code === 'KeyJ') journal();
  if (event.code === 'KeyH') think();
  if (event.code === 'Space' && grounded && !seated && !hiddenLocker && !transition) {
    if (collisionTree.jump(playerActor)) {
      vy = 4.5;
      grounded = false;
    }
  }
  if (seated && /^Digit[1-5]$/.test(event.code)) setChannel(Number(event.code.slice(-1)));
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
document.addEventListener('mousemove', (e) => {
  if (mode !== 'playing' || seated) return;
  if (document.pointerLockElement === renderer.domElement || dragging) {
    yaw -= e.movementX * 0.0021 * sensitivity;
    pitch = T.MathUtils.clamp(
      pitch - e.movementY * 0.0021 * sensitivity,
      hiddenLocker ? -0.42 : -1.42,
      hiddenLocker ? 0.42 : 1.42
    );
    if (hiddenLocker)
      yaw =
        hiddenLocker.viewYaw +
        T.MathUtils.clamp(
          T.MathUtils.euclideanModulo(yaw - hiddenLocker.viewYaw + Math.PI, Math.PI * 2) - Math.PI,
          -0.6,
          0.6
        );
  }
});
renderer.domElement.addEventListener('mousedown', () => {
  if (mode === 'playing' && !seated) {
    dragging = true;
    requestLock();
  }
});
document.addEventListener('mouseup', () => (dragging = false));
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer.domElement) {
    $('load-status').textContent = '';
  } else if (mode === 'playing' && !seated && !pausedLock) pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') pauseGame();
});
window.addEventListener('blur', () => {
  keys.clear();
  dragging = false;
  if (mode === 'playing') pauseGame();
});
$('start').onclick = () => startGame(false);
$('continue').onclick = () => startGame(true);
$('resume').onclick = resumeGame;
$('checkpoint').onclick = () => {
  state = saved() || state;
  state.flashCharges = 1;
  placeAtCheckpoint();
  resumeGame();
};
$('quit').onclick = () => {
  persist();
  mode = 'title';
  seated = false;
  hiddenLocker = null;
  show('locker-view', false);
  show('pause', false);
  show('hud', false);
  show('remote', false);
  show('menu');
  $('continue').hidden = false;
  $('continue').disabled = false;
  world.creature.visible = world.watcher.visible = false;
  world.creatureMotion.reset();
  collisionTree?.removeCharacter(enemy?.physicsActor);
  enemy = null;
  danger = 0;
  blindness = 0;
  audio.pause(true);
  $('start').focus();
};
$('about').onclick = openSettings;
$('pause-settings').onclick = openSettings;
$('settings-back').onclick = closeSettings;
$('settings-guide').onclick = instructions;
$('close-dialog').onclick = closeDialog;
$('replay').onclick = () => startGame(false);
$('end-credits').onclick = instructions;
for (const [id, apply] of Object.entries({
  volume: (v) => {
    volume = v;
    audio.volumeTo(v);
  },
  brightness: (v) => {
    brightness = v;
    renderer.toneMappingExposure = v;
  },
  sensitivity: (v) => (sensitivity = v)
}))
  $(id).addEventListener('input', (e) => {
    apply(Number(e.target.value));
    updateSettingReadouts();
    saveSettings();
  });
$('comfort').addEventListener('change', (e) => {
  comfort = e.target.checked;
  $('vhs').style.opacity = comfort ? '.04' : '.12';
  saveSettings();
});
function saveSettings() {
  try {
    localStorage.setItem(
      'casa-settings',
      JSON.stringify({ volume, brightness, sensitivity, comfort })
    );
  } catch {}
}
try {
  const pref = JSON.parse(localStorage.getItem('casa-settings'));
  if (pref) {
    volume = Number(pref.volume) ?? 0.65;
    brightness = Number(pref.brightness) || 1.1;
    sensitivity = Number(pref.sensitivity) || 1;
    comfort = !!pref.comfort;
    for (let id of ['volume', 'brightness', 'sensitivity'])
      $(id).value = { volume, brightness, sensitivity }[id];
    $('comfort').checked = comfort;
    renderer.toneMappingExposure = brightness;
    audio.volume = volume;
    $('vhs').style.opacity = comfort ? '.04' : '.16';
  }
} catch {}
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let warming = false;
async function prewarmRendering() {
  // Upload every reused texture and compile each room's light arrangement before
  // gameplay. The flash uses the same shader because its light stays present.
  warming = true;
  const smallTarget = new T.WebGLRenderTarget(96, 64),
    oldTarget = renderer.getRenderTarget(),
    oldCreature = world.creature.visible,
    oldWatcher = world.watcher.visible,
    frustumFlags = [];
  try {
    // Compile alone does not upload vertex buffers for meshes outside the view.
    // Draw all resident meshes once while loading, then restore normal culling.
    scene.traverse((object) => {
      if (object.isMesh) {
        frustumFlags.push([object, object.frustumCulled]);
        object.frustumCulled = false;
      }
    });
    const textureSlots = [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'emissiveMap',
      'alphaMap',
      'bumpMap',
      'displacementMap',
      'lightMap'
    ];
    const textures = new Set();
    scene.traverse((o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        for (const slot of textureSlots)
          if (m[slot]?.isTexture && m[slot].image) textures.add(m[slot]);
    });
    let uploaded = 0;
    for (const texture of textures) {
      renderer.initTexture(texture);
      uploaded++;
      const percent = 65 + Math.round((uploaded / Math.max(1, textures.size)) * 20);
      $('loading-detail').textContent = `PREPARANDO TEXTURAS / ${uploaded} DE ${textures.size}`;
      $('loading-percent').textContent = percent + '%';
      $('loading-bar').style.width = percent + '%';
      if (uploaded % 2 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    for (let roomId = 0; roomId < world.rooms.length; roomId++) {
      roomRendering.update(roomId);
      world.creature.visible = true;
      world.creature.position.copy(world.worldPoint(roomId, new T.Vector3(0, 0, 0)));
      world.creature.quaternion.copy(roomQuaternion(roomId));
      world.watcher.visible = true;
      world.watcher.position.copy(world.worldPoint(roomId, new T.Vector3(3, -1.1, 0)));
      world.watcher.quaternion.copy(roomQuaternion(roomId));
      const eye = world.worldPoint(roomId, new T.Vector3(0, 1.68, 1.5));
      camera.position.copy(eye);
      camera.quaternion.copy(roomQuaternion(roomId));
      camera.updateMatrixWorld(true);
      flashlight.intensity = 78;
      flashlight.position.copy(eye);
      flashlight.target.position.copy(world.worldPoint(roomId, new T.Vector3(0, 1.5, -2)));
      await renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(smallTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(oldTarget);
      const stage = roomId + 1,
        percent = 85 + Math.round((stage / world.rooms.length) * 10);
      $('loading-detail').textContent =
        `PREPARANDO LUZ Y HABITACIÓN / ${stage} DE ${world.rooms.length}`;
      $('loading-percent').textContent = percent + '%';
      $('loading-bar').style.width = percent + '%';
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    // Preparar también la variante de vídeo evita compilarla al sentarse en el TV.
    const screen = world.rooms[0].tv.screen;
    const originalMap = screen.map;
    try {
      screen.map = broadcastTexture;
      roomRendering.update(0);
      camera.position.set(0, 1.68, 1.5);
      camera.quaternion.identity();
      await renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(smallTarget);
      renderer.render(scene, camera);
    } finally {
      screen.map = originalMap;
    }
  } finally {
    renderer.setRenderTarget(oldTarget);
    smallTarget.dispose();
    for (const [object, flag] of frustumFlags) object.frustumCulled = flag;
    world.creature.visible = oldCreature;
    world.watcher.visible = oldWatcher;
    flashlight.intensity = 0;
    roomRendering.update(0);
    warming = false;
  }
}

let last = performance.now(),
  frameTime = 0;
// 5. Cada fotograma: entrada, física Cannon, sincronización, efectos y render.
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000,
    dt = Math.min(rawDt, 0.05);
  last = now;
  frameTime += dt;
  if (!ready || warming) return;
  if (mode === 'cinematic' || mode === 'ending') {
    if (mode === 'cinematic') {
      endingSequence.update(dt);
      audio.update(camera, 0, 0);
    }
    if (!endingSequence.render()) renderer.render(scene, camera);
    return;
  }
  const ratio = renderBudget.sample(rawDt * 1000);
  if (ratio !== null) renderer.setPixelRatio(ratio);
  if (mode === 'playing') {
    world.entryDoor.update(dt);
    if (playerActor) {
      const physical = !hiddenLocker && !seated && rewindTimer <= 0;
      if (physical && !playerActor.enabled)
        collisionTree.teleport(playerActor, world.worldPoint(state.room, player), state.room);
      collisionTree.enable(playerActor, physical);
    }
    collisionTree?.step(dt);
    const hadFlash = flash.remaining > 0;
    tickFlash(flash, dt);
    lamp = flash.remaining > 0;
    if (hadFlash !== lamp) refreshHUD();
    state.elapsed += dt;
    roomTime += dt;
    saveTimer += dt;
    if (saveTimer > 15) {
      saveTimer = 0;
      persist();
    }
    if (transition) updateFall(dt);
    else {
      updatePlayer(dt);
      if (!transition) targetInteraction();
    }
    updateHorror(dt);
    world.bookBurst.update(dt, {
      state,
      player,
      hidden: !!hiddenLocker || !!transition,
      onThrow: (position) => {
        audio.throwBooks(position);
        subtitle('Los libros salen despedidos. Algo golpea desde dentro de la pared.', 4);
        persist();
      },
      onLanding: (position) => audio.bookLanding(position)
    });
    if (seated) {
      tvWatch += dt;
      if (
        state.channel === 2 &&
        !state.watched &&
        Number.isFinite(broadcastVideo.duration) &&
        broadcastVideo.currentTime >= broadcastVideo.duration - 0.3
      )
        finishInstructions();
      if (
        state.channel === 5 &&
        Math.floor(tvWatch * 2) % 12 === 0 &&
        !events.has('tone' + Math.floor(tvWatch))
      ) {
        events.add('tone' + Math.floor(tvWatch));
        audio.tone(83 * 4, 0.3, 0.035);
      }
    }
    if (
      seated &&
      state.inserted &&
      state.channel === 3 &&
      !state.released &&
      Number.isFinite(broadcastVideo.duration) &&
      broadcastVideo.currentTime >= broadcastVideo.duration - 0.3
    )
      finishTape();
    if (subtitleTime > 0) {
      subtitleTime -= dt;
      if (subtitleTime <= 0) $('subtitle').textContent = '';
    }
    if (toastTime > 0) {
      toastTime -= dt;
      if (toastTime <= 0) $('toast').textContent = '';
    }
    const s = Math.floor(state.elapsed);
    $('clock').textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
    updateWorld(world, state, dt, state.elapsed, comfort, enemy);
    audio.update(camera, state.room, danger);
  } else if (mode === 'caught') {
    updateCapture(dt);
  } else if (mode === 'rewind') {
    const winding = rewindHeld || rewindDragging || keys.has('ArrowLeft') || keys.has('KeyA');
    document.querySelector('.rewind-machine').classList.toggle('winding', winding);
    if (rewindHeld || keys.has('ArrowLeft') || keys.has('KeyA')) addRewind(dt / 5);
  } else if (mode === 'dialog' && !$('radio-screen').classList.contains('hidden')) {
    const input =
      Number(keys.has('ArrowRight') || keys.has('ArrowUp')) -
      Number(keys.has('ArrowLeft') || keys.has('ArrowDown'));
    if (input) changeTune(input * dt * 0.8);
  }
  if (titleViewActive()) {
    camera.fov = 60;
    camera.updateProjectionMatrix();
    camera.position.set(-3.35 + (comfort ? 0 : 0.025 * Math.sin(frameTime * 0.15)), 1.65, 4.4);
    camera.up.set(0, 1, 0);
    camera.lookAt(-2.25, 1.5, -3.2);
    updateWorld(world, state, dt, frameTime, comfort);
    for (const source of world.rooms[0].lights)
      if (source.power > 0) source.light.intensity *= 0.65;
    world.rooms[0].bulb.shadow.intensity *= 0.6;
  }
  renderer.toneMappingExposure = brightness * (titleViewActive() ? 0.85 : 1);
  updateFlashlight();
  if (titleViewActive()) titleSignal(frameTime);
  else if (mode === 'playing' && state.room === 0) broadcast(frameTime);
  // Stable light set + one preallocated shadow map throughout all crossings.
  const activeRoom = titleViewActive() ? 0 : (transition?.field ?? state.room);
  roomRendering.update(activeRoom, transition);
  // Room-local shader uniforms handle darkness; never dim the whole scene just
  // because the occupied room or camera has changed.
  ambient.intensity = 0.18;
  scene.environmentIntensity = 0.08;
  const shouldPlay = mode === 'playing' && state.channel > 0 && state.room === 0;
  if (shouldPlay !== mediaRunning) {
    mediaRunning = shouldPlay;
    if (shouldPlay) broadcastVideo.play().catch(() => {});
    else broadcastVideo.pause();
  }
  $('vignette').style.background =
    `radial-gradient(ellipse,transparent 40%,rgba(${danger > 0.6 ? '25,4,3' : '0,0,0'},${0.54 + danger * 0.24}) 100%)`;
  if (blindness > 0) blindness = Math.max(0, blindness - dt * 0.16);
  $('blindness').style.opacity = String(Math.min(1, blindness));
  scene.fog.density = 0.022 + blindness * (comfort ? 0.06 : 0.18);
  scene.fog.color.copy(normalFogColor).lerp(blackFogColor, blindness);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
try {
  // 6. Una sola carga inicial; los cuartos reutilizan lo que ya está en memoria.
  $('loading-detail').textContent = 'PREPARANDO LA LUZ DEL ENTORNO';
  await loadEnvironment(scene, renderer);
  await loadAssets((loaded, total) => {
    const percent = Math.round((loaded / Math.max(1, total)) * 50);
    $('load-status').textContent = `RECURSOS LOCALES / ${loaded} DE ${total}`;
    $('loading-detail').textContent = `RECURSOS / ${loaded} DE ${total}`;
    $('loading-percent').textContent = percent + '%';
    $('loading-bar').style.width = percent + '%';
  });
  const endingAssets = await loadEndingAssets((loaded, total) => {
    const percent = 50 + Math.round((loaded / total) * 15);
    $('loading-detail').textContent = `EXTERIOR Y PROTAGONISTA / ${loaded} DE ${total}`;
    $('loading-percent').textContent = percent + '%';
    $('loading-bar').style.width = percent + '%';
  });
  // Audio does not compete with glTF buffers during model loading.
  const mediaReady = Promise.all([audio.prepare(), loadBroadcasts()]);
  // Evita un rechazo sin manejar mientras se preparan los modelos en la GPU.
  mediaReady.catch(() => {});
  world = createWorld(scene);
  applyPuzzle(world, state.puzzle);
  roomRendering = new RoomRendering(world, scene);
  endingAssets.tape = world.rooms[3].tape;
  endingSequence = new EndingSequence({
    scene,
    world,
    renderer,
    camera,
    audio,
    assets: endingAssets,
    onComplete: win
  });
  $('loading-detail').textContent = 'PREPARANDO SONIDO Y EMISIONES';
  [, broadcasts] = await mediaReady;
  await prepareVideo(broadcastVideo, broadcasts['canal-01']);
  await prewarmRendering();
  warming = true;
  $('loading-detail').textContent = 'PREPARANDO LA ÚLTIMA SEÑAL';
  await endingSequence.prewarm();
  warming = false;
  roomRendering.update(0);
  ready = true;
  $('start').disabled = false;
  $('start').textContent = 'Comenzar';
  $('load-status').textContent = '';
  $('loading-detail').textContent = 'SEÑAL PREPARADA';
  $('loading-percent').textContent = '100%';
  $('loading-bar').style.width = '100%';
  $('loading-screen').classList.add('loaded');
  setTimeout(() => show('loading-screen', false), 850);
  $('continue').hidden = false;
  $('continue').disabled = !saved();
  refreshHUD();
} catch (error) {
  console.error(error);
  const message =
    'No se pudo cargar el recurso indicado. Mantén el servidor local abierto (npm run dev o INICIAR_JUEGO.cmd) y recarga con Ctrl+F5. ' +
    String(error.message).replace(/[<>]/g, '');
  $('load-status').textContent = message;
  $('load-status').classList.add('error');
  $('loading-detail').textContent = 'ERROR DE RECURSO';
  $('loading-screen').querySelector('p').textContent = message;
}
