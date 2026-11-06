// Temas de clase usados en la casa: loadAssets (GLTF y PBR), instance (Group y TRS),
// light/lamp (PointLight y SpotLight), dust/updateWorld (BufferGeometry y animación).
// La distribución de los cuartos y el montaje de los puzles son reglas del juego.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { createCreatureRig } from './creature-rig.js';
import { CreatureMotion } from './creature-motion.js';
import { LEVELS, LINKS, connectorShape, roomPortals, portalOpen } from './level.js';
import { insideHole } from './physics.js';
import { fitCRT } from './asset-fit.js';
import { chairPose } from './orientation-puzzle.js';
import { configureWatcher } from './watcher-head.js';
import { ThreatLightState } from './threat-light.js';
import { bindRoomFill } from './room-lighting.js';
import { BookBurst } from './book-burst.js';
import { createBook } from './books.js';
import { loadWithRetry, loadPool } from './asset-loading.js';
import { createEntryDoor, ENTRY_DOOR } from './entry-door.js';
const loader = new GLTFLoader(),
  models = {},
  textures = {};
const furniture = ['rugRectangle', 'lampWall', 'cardboardBoxClosed', 'speaker', 'computerKeyboard'];
const station = ['pipe', 'wall-switch'];
const haven = [
  'television_02',
  'ArmChair_01',
  'vintage_cabinet_01',
  'side_table_01',
  'wooden_bookshelf_worn',
  'vintage_radio_transceiver',
  'power_box_01',
  'hanging_industrial_lamp',
  'wooden_table_02',
  'painted_wooden_chair_01',
  'vintage_video_camera',
  'vintage_flashlight'
];
const house = [
  'Structure_Floor',
  'Structure_Wall_Straight_Main',
  'Structure_Wall_Straight_Base',
  'Structure_Wall_Straight_Top',
  'Structure_Wall_Door',
  'Structure_Wall_Doorway',
  'Structure_Exterior_Window_Double',
  'Prop_Curtains_Double'
];
let wood, plaster, carpet;
// SEMANA 7, diapositivas 13–16: GLTFLoader lee modelos de public/models.
// Se cargan una vez; al cambiar de cuarto se reutilizan, no se descargan de nuevo.
export async function loadAssets(progress) {
  const list = [
    ...furniture.map((n) => [n, 'furniture/' + n.toLowerCase() + '.glb']),
    ...station.map((n) => ['s-' + n, 'station/' + n + '.glb']),
    ...haven.map((n) => ['h-' + n, 'haven/' + n.toLowerCase() + '/' + n.toLowerCase() + '.gltf']),
    ['fuse', 'props/ceramic-fuse.glb'],
    ['changingLocker', 'props/changing-locker.glb'],
    ['book-stendec', 'books/book-stendec.glb'],
    ['scenario', 'escenario.glb']
  ];
  let done = 0;
  const total = list.length + 8 + house.length;
  await loadPool(list, async ([name, file]) => {
    models[name] = (await loadWithRetry('/models/' + file, (url) => loader.loadAsync(url))).scene;
    progress(++done, total);
  });
  // SEMANA 8, diapositiva 21: GLB exportados con recursos empaquetados,
  // transformaciones aplicadas y eje +Y arriba; el navegador solo carga el resultado.
  await loadPool(house, async (name) => {
    models['house-' + name] = (
      await loadWithRetry('/models/house/' + name.toLowerCase() + '.glb', (url) =>
        loader.loadAsync(url)
      )
    ).scene;
    progress(++done, total);
  });
  const vhsMaterials = await loadWithRetry('/models/props/vhs_cassette.mtl', (url) =>
    new MTLLoader().setResourcePath('/models/props/').loadAsync(url)
  );
  models.vhs = await loadWithRetry('/models/props/vhs_cassette.obj', (url) =>
    new OBJLoader().setMaterials(vhsMaterials).loadAsync(url)
  );
  progress(++done, total);
  models.creature = (
    await loadWithRetry('/models/creature/el-inquilino-tripo-repaired.glb', (url) =>
      loader.loadAsync(url)
    )
  ).scene;
  progress(++done, total);
  models.paper = await loadWithRetry('/models/props/letter-paper.obj', (url) =>
    new OBJLoader().loadAsync(url)
  );
  progress(++done, total);
  const paperMaps = await Promise.all(
    ['diff', 'normal'].map(async (name) => {
      const t = await loadWithRetry('/textures/props/letter-paper-' + name + '.png', (url) =>
        new THREE.TextureLoader().loadAsync(url)
      );
      if (name === 'diff') t.colorSpace = THREE.SRGBColorSpace;
      progress(++done, total);
      return t;
    })
  );
  models.paper.traverse((o) => {
    if (o.isMesh)
      o.material = new THREE.MeshStandardMaterial({
        map: paperMaps[0],
        normalMap: paperMaps[1],
        normalScale: new THREE.Vector2(0.2, 0.2),
        roughness: 1,
        side: THREE.DoubleSide
      });
  });
  // Semana 8/10: las seis texturas estructurales ya vienen empaquetadas en el GLB.
  const surfaceMaterials = {};
  models.scenario.traverse((o) => {
    if (o.isMesh) surfaceMaterials[o.material.name] = o.material;
  });
  const floorMaterial = surfaceMaterials.room_0_wood,
    wallMaterial = surfaceMaterials.room_0_wall;
  Object.assign(textures, {
    'wood-diff': floorMaterial.map,
    'wood-nor_gl': floorMaterial.normalMap,
    'wood-Rough': floorMaterial.roughnessMap,
    'plaster-Diffuse': wallMaterial.map,
    'plaster-nor_gl': wallMaterial.normalMap,
    'plaster-rough': wallMaterial.roughnessMap
  });
  await loadPool(['rug-Diffuse', 'rug-nor_gl', 'rug-Rough'], async (name) => {
    const t = await loadWithRetry('/textures/materials/' + name.toLowerCase() + '.jpg', (url) =>
      new THREE.TextureLoader().loadAsync(url)
    );
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (/diff/i.test(name)) t.colorSpace = THREE.SRGBColorSpace;
    textures[name] = t;
    progress(++done, total);
  });
  // SEMANA 2, diapositivas 13–15: PBR combina textura y respuesta a la luz.
  // map aporta color, normalMap relieve aparente y roughnessMap rugosidad.
  wood = new THREE.MeshStandardMaterial({
    map: textures['wood-diff'],
    normalMap: textures['wood-nor_gl'],
    roughnessMap: textures['wood-Rough'],
    color: '#9b8870',
    roughness: 0.88,
    normalScale: new THREE.Vector2(0.3, 0.3)
  });
  plaster = new THREE.MeshStandardMaterial({
    map: textures['plaster-Diffuse'],
    normalMap: textures['plaster-nor_gl'],
    roughnessMap: textures['plaster-rough'],
    color: '#bdb9a5',
    roughness: 1,
    normalScale: new THREE.Vector2(0.25, 0.25)
  });
  carpet = new THREE.MeshStandardMaterial({
    map: textures['rug-Diffuse'],
    normalMap: textures['rug-nor_gl'],
    roughnessMap: textures['rug-Rough'],
    color: '#928679',
    roughness: 1,
    normalScale: new THREE.Vector2(0.35, 0.35)
  });
  // Los cristales finos no necesitan dos pasadas ni alternar sus programas al dibujarse.
  for (const model of Object.values(models))
    model.traverse((object) => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        if (
          material.transparent &&
          material.side === THREE.DoubleSide &&
          /glass/i.test(material.name)
        )
          material.forceSinglePass = true;
    });
}
function agedMaterial(original) {
  const name = (original.name || '').toLowerCase(),
    m = new THREE.MeshStandardMaterial({
      color: original.color,
      map: original.map,
      roughness: 0.85
    });
  if (name === 'wood') {
    m.color.set('#66513b');
    m.map = wood.map;
    m.normalMap = wood.normalMap;
    m.normalScale = new THREE.Vector2(0.1, 0.1);
  } else if (name.includes('metal')) {
    m.color.set(name.includes('dark') ? '#18211d' : '#566453');
    m.metalness = 0.5;
    m.roughness = 0.4;
  } else if (name.includes('carpet')) m.color.set('#51312c');
  else m.color.multiplyScalar(0.65);
  return m;
}
function instance(name, { height, size, mat, raw = false } = {}) {
  const replacements = {
    televisionVintage: 'h-television_02',
    loungeChair: 'h-ArmChair_01',
    cabinetTelevision: 'h-wooden_table_02',
    cabinetBed: 'h-vintage_cabinet_01',
    sideTable: 'h-side_table_01',
    bookcaseOpen: 'h-wooden_bookshelf_worn',
    bookcaseClosed: 'h-wooden_bookshelf_worn',
    radio: 'h-vintage_radio_transceiver',
    lampSquareCeiling: 'h-hanging_industrial_lamp',
    table: 'h-wooden_table_02',
    desk: 'h-wooden_table_02',
    chair: 'h-painted_wooden_chair_01',
    floorFull: 'house-Structure_Floor',
    wall: 'house-Structure_Wall_Straight_Main',
    doorway: 'house-Structure_Wall_Door'
  };
  name = replacements[name] || name;
  if (name.startsWith('h-')) raw = true;
  // SEMANA 2, diapositivas 16–19: Group agrupa el modelo; position/scale
  // ajustan tamaño y origen. Rotar el grupo también rota sus objetos hijos.
  const root = new THREE.Group(),
    m = models[name].clone(true);
  root.add(m);
  const b = new THREE.Box3().setFromObject(m),
    s = b.getSize(new THREE.Vector3()),
    c = b.getCenter(new THREE.Vector3());
  const scale = size
    ? new THREE.Vector3(size[0] / s.x, size[1] / s.y, size[2] / s.z)
    : new THREE.Vector3().setScalar(height / s.y);
  m.scale.copy(scale);
  m.position.set(-c.x * scale.x, -b.min.y * scale.y, -c.z * scale.z);
  m.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.receiveShadow = true;
      const convert = (original) => (mat ? mat : raw ? original.clone() : agedMaterial(original));
      o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
      o.userData.asset = name;
    }
  });
  root.userData.asset = name;
  return root;
}
function collider(room, obj) {
  obj.updateMatrixWorld(true);
  const inverse = room.group.matrixWorld.clone().invert(),
    b = new THREE.Box3().setFromObject(obj).applyMatrix4(inverse);
  const add = (box) =>
    room.colliders.push({
      minX: box.min.x,
      maxX: box.max.x,
      minY: box.min.y,
      maxY: box.max.y,
      minZ: box.min.z,
      maxZ: box.max.z,
      mesh: obj
    });
  // A chair is not a solid cube up to the top of its back: expose the seat.
  if (
    /chair/i.test(obj.userData.asset || '') &&
    new THREE.Vector3(0, 1, 0).applyQuaternion(obj.quaternion).y > 0.98
  ) {
    const h = b.max.y - b.min.y,
      seat = b.clone();
    seat.max.y = b.min.y + h * 0.49;
    add(seat);
    const back = new THREE.Box3(),
      point = new THREE.Vector3();
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const matrix = inverse.clone().multiply(o.matrixWorld),
        a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        point.fromBufferAttribute(a, i).applyMatrix4(matrix);
        if (point.y > b.min.y + h * 0.76) back.expandByPoint(point);
      }
    });
    if (!back.isEmpty()) {
      back.min.y = seat.max.y;
      add(back);
    }
    return;
  }
  add(b);
}
function prop(room, name, pos, height, rot = 0, solid = true, raw = false) {
  const size = ['desk', 'table'].includes(name)
    ? [2.8, height, 1.05]
    : name === 'cabinetTelevision'
      ? [1.8, height, 0.95]
      : undefined;
  const root = instance(name, { height, size, raw });
  root.position.set(...pos);
  root.rotation.y = rot;
  room.group.add(root);
  if (solid) collider(room, root);
  return root;
}
// Visible architecture uses downloaded GLB modules; sizes and placement assemble the level.
function structure(room, name, size, pos, mat, repeat) {
  if (size.some((n) => n < 0.001)) return null;
  const material = mat.clone();
  const root = instance(name, { size, mat: material });
  root.position.set(pos[0], pos[1] - size[1] / 2, pos[2]);
  room.group.add(root);
  root.updateWorldMatrix(true, true);
  // Kenney's palette UVs are not tiling PBR UVs. Re-map the imported mesh in room metres;
  // this changes only texture coordinates, preserving every downloaded vertex and face.
  const inverse = room.group.matrixWorld.clone().invert(),
    p = new THREE.Vector3(),
    n = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(),
      positions = g.attributes.position,
      normals = g.attributes.normal,
      uv = new Float32Array(positions.count * 2),
      matrix = inverse.clone().multiply(o.matrixWorld),
      normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      n.fromBufferAttribute(normals, i).applyNormalMatrix(normalMatrix);
      const ax = Math.abs(n.x),
        ay = Math.abs(n.y),
        az = Math.abs(n.z),
        horizontal = ay >= ax && ay >= az,
        scale = horizontal ? 2 : 5;
      uv[2 * i] = (horizontal ? p.x : ax > az ? p.z : p.x) / scale;
      uv[2 * i + 1] = (horizontal ? p.z : p.y) / scale;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    o.geometry = g;
  });
  return root;
}
export function textTexture(
  lines,
  { color = '#c6d0ba', background = '#182921', size = 39, width = 1024, height = 512 } = {}
) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = `${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const a = Array.isArray(lines) ? lines : lines.split('\n');
  a.forEach((line, i) =>
    ctx.fillText(line, width / 2, height / 2 + (i - (a.length - 1) / 2) * size * 1.5, width - 36)
  );
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// No world-space instructional signs: guidance belongs to thoughts and actual notebooks.
function sign() {
  return null;
}
function note(room, id) {
  const spots = [
      { welcome: [-3.82, 0.753, 4.45], frequency: [-4.1, 1.45, -3.5] },
      { procedure: [-0.85, 0.903, -2.65], frequency: [-2.15, 0.903, -2.65] },
      { procedure: [1.1, 0.853, -2.88], truth: [0, 0.853, -2.4] },
      { archive: [0.5, 0.803, 1.7], tenant: [-2.6, 0.653, 2.3] },
      { tenant: [-0.85, 0.903, -2.55], truth: [-2.35, 0.903, -2.55] }
    ],
    pos = spots[room.id][id];
  const mesh = instance('paper', { size: [0.28, 0.004, 0.36], raw: true });
  mesh.position.set(...pos);
  mesh.rotation.y = 0.18;
  room.group.add(mesh);
  room.interactions.push({
    id: 'note-' + id,
    type: 'note',
    note: id,
    pos: new THREE.Vector3(pos[0], pos[1] + 0.03, pos[2]),
    radius: 2,
    label: 'Leer la carta de Julián',
    mesh
  });
}
// SEMANA 4, diapositiva 9: PointLight ilumina en todas las direcciones.
function light(room, pos, color, power, range = 10) {
  const l = new THREE.PointLight(color, power, range, 2);
  l.position.set(...pos);
  room.group.add(l);
  room.lights.push({ light: l, power });
  return l;
}
function lamp(room) {
  const p = [0, room.h - 0.65, 0];
  const model = prop(room, 'lampSquareCeiling', p, 0.6, 0, false);
  model.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.emissive.set('#bca97a');
      o.material.emissiveIntensity = 0.4;
    }
  });
  const color = room.id === 0 ? '#ffe0a3' : room.id === 3 ? '#b6c9c4' : '#e0c6a6';
  const bulb = light(room, [0, room.h - 0.58, 0], color, room.id === 0 ? 42 : 30, 15);
  // SpotLight dirige un cono; shadow.mapSize limita el coste de su sombra.
  const shadow = new THREE.SpotLight(color, room.id === 0 ? 95 : 85, 16, 1.25, 0.8, 2);
  shadow.position.set(0, room.h - 0.62, 0);
  shadow.target.position.set(0, 0, 0);
  // Solo sirve de referencia; RoomRendering reutiliza una única luz con sombra.
  shadow.castShadow = false;
  shadow.shadow.mapSize.set(512, 512);
  shadow.shadow.bias = -0.0003;
  shadow.shadow.normalBias = 0.03;
  room.group.add(shadow, shadow.target);
  room.bulb = { lamp: bulb, shadow, model, power: bulb.intensity };
}
function pipe(room, start, end, r = 0.05) {
  const a = new THREE.Vector3(...start),
    b = new THREE.Vector3(...end),
    len = a.distanceTo(b),
    m = instance('s-pipe', { size: [r * 2, len, r * 2] });
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  room.group.add(m);
  return m;
}
function shell(room) {
  for (const portal of room.portals.filter((p) => p.kind === 'floor')) {
    portal.cover = structure(
      room,
      'floorFull',
      [1.975, 0.065, 2.475],
      [portal.x, -0.0325, portal.z],
      room.id === 0 || room.id === 3 ? wood : plaster
    );
    portal.openAmount = 0;
    light(room, [portal.x, -0.2, portal.z], '#acc5b2', 7, 4);
  }
  lamp(room);
  if ([1, 2, 4].includes(room.id))
    for (const z of [-room.d / 2 + 0.2, room.d / 2 - 0.2])
      pipe(room, [-4.8, 3.35, z], [4.8, 3.35, z], 0.034);
}
function buildConnectors(scene) {
  return LINKS.map((link) => {
    const data = LEVELS[link.a],
      group = new THREE.Group();
    group.position.set(...data.pos);
    group.rotation.z = data.angle;
    scene.add(group);
    group.updateMatrixWorld(true);
    const room = { group, lights: [] },
      s = connectorShape(link);
    light(room, [s.a, -0.8, s.z], '#aabbb1', 18, 10);
    light(room, [s.a, -link.gap + 0.5, s.z], '#b5c6b3', 18, 10);
    return { group, link, shape: s, lights: room.lights };
  });
}
// SEMANA 4, diapositivas 12–18: un Points dibuja todo el polvo con un búfer.
// Cada partícula ocupa tres números: X, Y, Z. No se crea un Mesh por punto.
function dust(room) {
  const n = 320,
    a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[3 * i] = (Math.random() - 0.5) * 10;
    a[3 * i + 1] = Math.random() * room.h;
    a[3 * i + 2] = (Math.random() - 0.5) * room.d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  room.dust = new THREE.Points(
    g,
    new THREE.PointsMaterial({
      color: '#c9d6ba',
      size: 0.018,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  room.group.add(room.dust);
}
function relay(room, i, pos, rot = 0) {
  const root = prop(room, 'h-power_box_01', [pos[0], pos[1] - 0.45, pos[2]], 0.85, rot, false);
  root.updateWorldMatrix(true, true);
  let b = new THREE.Box3()
    .setFromObject(root)
    .applyMatrix4(room.group.matrixWorld.clone().invert());
  if (rot === 0) root.position.z += -room.d / 2 + 0.12 - b.min.z;
  else root.position.x += room.w / 2 - 0.12 - b.max.x;
  root.updateWorldMatrix(true, true);
  b = new THREE.Box3().setFromObject(root).applyMatrix4(room.group.matrixWorld.clone().invert());
  const center = b.getCenter(new THREE.Vector3()),
    lever = prop(
      room,
      's-wall-switch',
      [pos[0] + 0.48 * Math.cos(rot), pos[1] - 0.2, pos[2] - 0.48 * Math.sin(rot)],
      0.18,
      rot,
      false
    );
  room.relay = { root, lever, index: i, on: false };
  room.interactions.push({
    id: 'relay' + i,
    type: 'relay',
    pos: center,
    radius: 2.2,
    label:
      i === 0
        ? 'Instalar el fusible en la caja'
        : i === 1
          ? 'Revisar el motor del taller'
          : 'Restablecer el panel del archivo',
    mesh: root
  });
}
function addLocker(room, x, z, rot) {
  const model = instance('changingLocker', { size: [1.05, 2.1, 0.8], raw: true });
  model.position.set(x, 0, z);
  model.rotation.y = rot;
  room.group.add(model);
  const body = model.getObjectByName('changing-locker_0'),
    door = model.getObjectByName('changing-locker_3'),
    handle = model.getObjectByName('changing-locker_4'),
    outer = model.getObjectByName('changing-locker_2');
  // The downloaded body and door are closed solids. Keep its feet/frame/handle,
  // but give it a hollow cabin and a real opening, not a screen-space illusion.
  if (outer) outer.visible = false;
  if (door) door.visible = false;
  const steel = new THREE.MeshStandardMaterial({
    color: '#273b37',
    metalness: 0.65,
    roughness: 0.8
  });
  const panel = (parent, size, pos, mat = steel) => {
    // SEMANAS 1–2: Mesh = geometría (forma) + material (apariencia).
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.set(...pos);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  panel(model, [0.035, 1.99, 0.74], [-0.49, 1.1, -0.045]);
  panel(model, [0.035, 1.99, 0.74], [0.49, 1.1, -0.045]);
  panel(model, [0.98, 1.99, 0.035], [0, 1.1, -0.395]);
  panel(model, [0.98, 0.035, 0.74], [0, 0.12, -0.045]);
  panel(model, [0.98, 0.035, 0.74], [0, 2.08, -0.045]);
  const pivot = new THREE.Group();
  pivot.position.set(-0.46, 0, 0.328);
  model.add(pivot);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.15);
  shape.lineTo(0.92, 0.15);
  shape.lineTo(0.92, 2.06);
  shape.lineTo(0, 2.06);
  shape.closePath();
  const vent = new THREE.Path();
  vent.moveTo(0.13, 1.25);
  vent.lineTo(0.13, 1.7);
  vent.lineTo(0.79, 1.7);
  vent.lineTo(0.79, 1.25);
  vent.closePath();
  shape.holes.push(vent);
  const doorMaterial =
    door?.material.clone() ??
    new THREE.MeshStandardMaterial({ color: '#a9b0a0', metalness: 0.5, roughness: 0.8 });
  const leaf = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false }),
    doorMaterial
  );
  leaf.castShadow = leaf.receiveShadow = true;
  pivot.add(leaf);
  for (const y of [1.395, 1.555])
    panel(pivot, [0.66, 0.016, 0.035], [0.46, y, 0.012], doorMaterial);
  if (handle) {
    model.updateWorldMatrix(true, true);
    pivot.attach(handle);
  }
  const front = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)),
    pos = new THREE.Vector3(x, 0.14, z).addScaledVector(front, -0.1),
    eye = pos.clone();
  eye.y = 1.475;
  room.locker = {
    model,
    body,
    door: pivot,
    pos,
    front,
    eye,
    viewYaw: Math.atan2(front.x, front.z) + Math.PI,
    doorTimer: 0,
    doorTarget: 0,
    active: false
  };
  room.interactions.push({
    id: 'locker-' + room.id,
    type: 'locker',
    pos: new THREE.Vector3(x, 1.15, z).addScaledVector(front, 0.43),
    radius: 1.9,
    label: 'Abrir casillero y esconderte',
    mesh: model
  });
}
export function applyLockerLayout(world, selected) {
  for (const room of world.rooms) {
    if (!room.locker) continue;
    const locker = room.locker;
    room.colliders = room.colliders.filter((c) => c.mesh !== locker.model);
    locker.active = selected.includes(room.id);
    locker.model.visible = locker.active;
    locker.door.rotation.y = 0;
    locker.doorTimer = 0;
    locker.doorTarget = 0;
    if (locker.active) collider(room, locker.model);
  }
}
export function createWorld(scene) {
  const rooms = LEVELS.map((data) => {
    const room = {
      ...data,
      group: new THREE.Group(),
      portals: roomPortals(data.id),
      openPortals: [],
      colliders: [],
      interactions: [],
      lights: []
    };
    room.group.position.set(...data.pos);
    room.group.rotation.z = data.angle;
    scene.add(room.group);
    room.group.updateMatrixWorld(true);
    shell(room);
    dust(room);
    return room;
  });
  const r = rooms[0];
  prop(r, 'cabinetTelevision', [0, 0, -4.6], 0.8);
  const tv = prop(r, 'televisionVintage', [0, 0.8, -4.6], 1.05, 0, false);
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 576;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = fitCRT(tv, texture);
  collider(r, tv);
  r.tv = {
    model: tv,
    screen,
    canvas,
    ctx: canvas.getContext('2d'),
    texture,
    light: light(r, [0, 1.5, -3.7], '#bad2bb', 0, 5)
  };
  r.interactions.push({
    id: 'insert-tape',
    type: 'insert',
    pos: new THREE.Vector3(0.6, 1, -4),
    radius: 1.85,
    label: 'Insertar la cinta en el receptor'
  });
  r.chair = prop(r, 'loungeChair', [0, 0, -0.75], 1.1, Math.PI);
  r.interactions.push({
    id: 'chair',
    pos: new THREE.Vector3(0, 0.7, -0.7),
    radius: 2.5,
    label: 'Sentarte a ver la cinta',
    type: 'chair',
    mesh: r.chair
  });
  structure(r, 'rugRectangle', [2.5, 0.012, 3.2], [0, 0.009, -0.1], carpet);
  prop(r, 'sideTable', [-3.6, 0, 4.45], 0.75);
  prop(r, 'bookcaseOpen', [-4.2, 0, -3.7], 2.4, Math.PI / 2);
  // Esta estantería gira 90°: colocar los libros usando su mismo marco local.
  for (let n = 0; n < 6; n++) {
    const book = createBook(models['book-stendec'], 0.24 + (n % 3) * 0.02, n);
    book.position.set(-4.06, (0.9605 * 2.4) / 2.063442, -3.7 - (n - 2.5) * 0.12);
    book.rotation.y = Math.PI / 2;
    r.group.add(book);
  }
  const entryDoor = createEntryDoor(
    r,
    models['house-Structure_Wall_Door'],
    models['house-Structure_Wall_Doorway']
  );
  note(r, 'welcome', [-3.6, 1.6, 5.76], Math.PI);
  note(r, 'frequency', [-4.83, 1.7, -1.4], Math.PI / 2);
  r.fuse = prop(r, 'fuse', [-3.5, 0.79, 4.35], 0.16, 0, false, true);
  r.interactions.push({
    id: 'fuse',
    type: 'fuse',
    pos: new THREE.Vector3(-3.5, 0.88, 4.35),
    radius: 1.85,
    label: 'Recoger el fusible de repuesto',
    mesh: r.fuse
  });
  relay(r, 0, [4.78, 1.45, -2.2], -Math.PI / 2);
  // Imported complete window object; the wall remains a dark outside boundary.
  const win = instance('house-Structure_Exterior_Window_Double', { size: [2.6, 2, 0.22] });
  win.position.set(-5.025, 1.05, 1.4);
  win.rotation.y = Math.PI / 2;
  r.group.add(win);
  const curtains = instance('house-Prop_Curtains_Double', { size: [2.9, 2.25, 0.32] });
  curtains.position.set(-4.73, 0.98, 1.4);
  curtains.rotation.y = Math.PI / 2;
  r.group.add(curtains);
  light(r, [-4.6, 2.4, 1.4], '#809eaf', 7, 8);
  const r1 = rooms[1];
  prop(r1, 'desk', [-1.5, 0, -2.8], 0.9);
  r1.radio = prop(r1, 'radio', [-1.5, 0.9, -2.8], 0.48, 0, false);
  r1.radioBroken = false;
  r1.interactions.push({
    id: 'radio',
    type: 'radio',
    pos: new THREE.Vector3(-1.5, 1.2, -2.6),
    radius: 2,
    label: 'Sintonizar la radio del motor'
  });
  relay(r1, 1, [-3.4, 1.4, -3.75]);
  note(r1, 'procedure', [0.8, 1.6, -3.75]);
  note(r1, 'frequency', [-0.5, 1.3, -2.7]);
  sign(r1, ['JULIÁN / MANTENIMIENTO', '83.0 MHz'], [2, 1.8, 3.8], 1.75, Math.PI);
  prop(r1, 'cardboardBoxClosed', [0.3, 0, 2.6], 0.8);
  const r2 = rooms[2];
  prop(r2, 'table', [0, 0, -2.7], 0.85);
  prop(r2, 'televisionVintage', [-0.7, 0.86, -2.7], 0.65, 0, false);
  prop(r2, 'computerKeyboard', [0.8, 0.86, -2.5], 0.04, 0, false);
  relay(r2, 2, [-2.7, 1.4, -3.75]);
  note(r2, 'procedure', [1.5, 1.65, -3.76]);
  note(r2, 'truth', [2.2, 1.4, 3.76], Math.PI);
  prop(r2, 'cabinetBed', [-2.7, 0, 2.9], 1);
  prop(r2, 'loungeChair', [1.8, 0, 2.85], 1.1, Math.PI);
  const r3 = rooms[3],
    archiveShelves = [];
  for (const [index, x] of [-2, 0, 2].entries()) {
    const shelf = prop(r3, 'bookcaseClosed', [x, 0, -3.55], 2.1),
      books = [];
    // Shelf board tops measured from the imported Poly Haven mesh, scaled to 2.1m.
    for (const [row, board] of [0.3919, 0.9605, 1.6634].entries())
      for (let n = 0; n < 5; n++) {
        const height = 0.24 + ((n + row + index) % 4) * 0.02,
          root = createBook(models['book-stendec'], height, n + row + index),
          pivot = new THREE.Group();
        root.position.y = -height / 2;
        pivot.add(root);
        pivot.position.set(x + (n - 2) * 0.18, (board * 2.1) / 2.063442 + height / 2, -3.4);
        r3.group.add(pivot);
        books.push({ root: pivot, shelf });
      }
    archiveShelves.push({ index, root: shelf, center: new THREE.Vector3(x, 1, -3.3), books });
  }
  const bookBurst = new BookBurst(r3, archiveShelves);
  prop(r3, 'cabinetTelevision', [0, 0, 1.7], 0.8);
  r3.tape = prop(r3, 'vhs', [0, 0.803, 1.7], 0.032, 0, false, true);
  r3.interactions.push({
    id: 'family-tape',
    type: 'tape',
    pos: new THREE.Vector3(0, 0.84, 1.7),
    radius: 2,
    label: 'Recoger «PARA VOLVER»',
    mesh: r3.tape
  });
  note(r3, 'archive');
  note(r3, 'tenant');
  prop(r3, 'cardboardBoxClosed', [-2.6, 0, 2.3], 0.65);
  r3.flashlight = prop(r3, 'h-vintage_flashlight', [-0.6, 0.803, 1.7], 0.3, 0.36, false, true);
  r3.interactions.push({
    id: 'flashlight',
    type: 'flashlight',
    pos: new THREE.Vector3(-0.6, 0.94, 1.7),
    radius: 1.8,
    label: 'Recoger la linterna de la mesa',
    mesh: r3.flashlight
  });
  light(r3, [-0.6, 1.15, 1.7], '#a8bfc1', 3, 2.5);
  const r4 = rooms[4];
  prop(r4, 'desk', [-1.5, 0, -2.55], 0.9);
  r4.rewinder = prop(r4, 'h-vintage_video_camera', [-1.5, 0.9, -2.65], 0.48, Math.PI / 2, false);
  prop(r4, 'speaker', [-3, 0, -2.8], 1.1);
  prop(r4, 'speaker', [0, 0, -2.8], 1.1);
  prop(r4, 'cabinetBed', [2, 0, 2.8], 1);
  r4.interactions.push({
    id: 'rewinder',
    type: 'rewinder',
    pos: new THREE.Vector3(-1.5, 1.2, -2.5),
    radius: 2,
    label: 'Rebobinar la cinta familiar'
  });
  note(r4, 'tenant', [0.5, 1.6, -3.77]);
  note(r4, 'truth', [-2.8, 1.6, 3.77], Math.PI);
  sign(r4, ['REBOBINADOR DE JULIÁN', 'INSERTAR PARA VOLVER'], [-1.5, 2.2, -3.77], 2);
  for (const room of rooms.slice(1)) {
    for (const x of [-3, 3]) {
      prop(room, 'lampWall', [x, 2.65, -3.8], 0.35, 0, false);
      light(room, [x, 2.6, -3.3], room.id === 4 ? '#b75c43' : '#b7c9af', 12, 6);
    }
  }
  for (const room of rooms.slice(0, 3)) {
    room.clueChair = prop(room, 'chair', [2, 0, 1.3], 0.98, 0, false);
    room.clueSurface = null;
    room.interactions.push({
      id: 'orientation-chair',
      type: 'orientation-clue',
      room: room.id,
      pos: new THREE.Vector3(2, 0.5, 1.3),
      radius: 3.8,
      label: 'Examinar la silla de madera',
      mesh: room.clueChair
    });
  }
  addLocker(r1, 3.8, -3.25, 0);
  addLocker(r2, 4.15, -1.05, -Math.PI / 2);
  addLocker(r3, 3.8, 2.95, Math.PI);
  const creature = createCreatureRig(models.creature),
    creatureMesh = creature.children[0];
  const creatureMotion = new CreatureMotion(creature);
  scene.add(creature);
  creature.visible = false;
  const watcher = createCreatureRig(models.creature),
    watcherClipPlane = new THREE.Plane();
  configureWatcher(watcher, watcherClipPlane);
  const watcherMotion = new CreatureMotion(watcher);
  watcherMotion.bipedal = 1;
  const watcherHeadBone = watcherMotion.bones.Head;
  scene.add(watcher);
  watcher.visible = false;
  const connectors = buildConnectors(scene);
  for (const room of rooms) {
    room.indirectFill = { value: 1 };
    room.threatLights = new ThreatLightState(room.id);
    bindRoomFill(room.group, room.indirectFill);
  }
  // Un único escenario modelado y unido en Blender. Las primitivas conservan
  // materiales por cuarto para oscurecerlos sin separar ni reconstruir la malla.
  const architecture = models.scenario;
  architecture.name = 'escenario_blender';
  const wallColors = ['#c9c0a6', '#9da997', '#afb0a1', '#c4b59a', '#a4b2aa'];
  architecture.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const name = mesh.material.name;
    const [, owner, kind] = /^room_(\d+)_(\w+)$/.exec(name);
    mesh.material = (kind === 'wood' ? wood : plaster).clone();
    mesh.material.name = name;
    if (kind !== 'wood')
      mesh.material.color.set(kind === 'connector' ? '#78867c' : wallColors[owner]);
    mesh.userData.room = Number(owner);
    mesh.userData.connector = kind === 'connector';
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
  });
  bindRoomFill(architecture, (material) => rooms[Number(material.name.split('_')[1])].indirectFill);
  scene.add(architecture);
  creature.userData.indirectFill = { value: 1 };
  bindRoomFill(creature, creature.userData.indirectFill);
  // Mesh transforms are static; movable covers and switches use their parent groups.
  for (const room of rooms)
    room.group.traverse((o) => {
      if (o.isMesh) {
        o.updateMatrix();
        o.matrixAutoUpdate = false;
      }
    });
  for (const c of connectors)
    c.group.traverse((o) => {
      if (o.isMesh) {
        o.updateMatrix();
        o.matrixAutoUpdate = false;
      }
    });
  return {
    scene,
    architecture,
    rooms,
    connectors,
    entryDoor,
    creature,
    creatureMesh,
    creatureMotion,
    watcher,
    watcherMotion,
    watcherHeadBone,
    watcherClipPlane,
    bookBurst,
    worldPoint: (id, p) => rooms[id].group.localToWorld(p.clone())
  };
}
export function applyPuzzle(world, puzzle) {
  for (const room of world.rooms.slice(0, 3)) {
    const surface = puzzle.surfaces[room.id];
    if (room.clueSurface === surface) continue;
    room.clueSurface = surface;
    room.colliders = room.colliders.filter((c) => c.mesh !== room.clueChair);
    const pose = chairPose(room.id, surface);
    room.clueChair.position.set(...pose.position);
    room.clueChair.rotation.set(...pose.rotation);
    room.clueChair.updateMatrixWorld(true);
    collider(room, room.clueChair);
    const b = new THREE.Box3()
      .setFromObject(room.clueChair)
      .applyMatrix4(room.group.matrixWorld.clone().invert());
    room.interactions
      .find((i) => i.id === 'orientation-chair')
      .pos.copy(b.getCenter(new THREE.Vector3()));
  }
}
export function updateWorld(world, state, dt, time, comfort, enemy = null) {
  const radioRoom = world.rooms[1];
  if (radioRoom.radioBroken !== state.relays[1]) {
    radioRoom.radioBroken = state.relays[1];
    radioRoom.radio.rotation.z = radioRoom.radioBroken ? 0.17 : 0;
    const materials = new Set();
    radioRoom.radio.traverse((o) => {
      if (o.isMesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    });
    for (const m of materials) m.color.multiplyScalar(radioRoom.radioBroken ? 0.25 : 4);
  }
  for (const room of world.rooms) {
    room.openPortals = room.portals.filter((p) => portalOpen(p, state));
    for (const p of room.portals) {
      if (!p.cover) continue;
      const open = portalOpen(p, state);
      p.openAmount = THREE.MathUtils.damp(p.openAmount, open ? 1 : 0, 4, dt);
      p.cover.visible = p.openAmount < 0.995;
      p.cover.position.y = -0.065 - Math.min(1, p.openAmount * 5) * 0.2;
      p.cover.position.z = p.z + Math.max(0, (p.openAmount - 0.2) / 0.8) * 2.7;
    }
    // SEMANA 4: modificar el búfer y marcar needsUpdate envía las posiciones a la GPU.
    const arr = room.dust.geometry.attributes.position;
    for (let i = 0; i < arr.count; i++) {
      arr.array[i * 3 + 1] -= (0.06 + (i % 7) * 0.012) * dt;
      if (arr.array[i * 3 + 1] < 0.02) arr.array[i * 3 + 1] = room.h - 0.05;
    }
    arr.needsUpdate = true;
    const monsterRoom =
      enemy && !state.inserted && enemy.delay <= 0 ? (enemy.body?.field ?? enemy.room) : null;
    let distance = Infinity;
    if (monsterRoom !== null)
      for (const source of room.lights) {
        if (source.power > 0)
          distance = Math.min(
            distance,
            source.light.getWorldPosition(new THREE.Vector3()).distanceTo(enemy.position)
          );
      }
    const bulbFactor = room.threatLights.update(dt, { monsterRoom, distance, comfort });
    room.indirectFill.value = bulbFactor;
    for (const source of room.lights) {
      if (source.power <= 0) continue;
      source.light.intensity = source.power * (room.hauntPower ?? 1) * bulbFactor;
    }
    room.bulb.shadow.intensity = (room.id === 0 ? 95 : 85) * (room.hauntPower ?? 1) * bulbFactor;
    room.bulb.model.traverse((o) => {
      if (o.isMesh) o.material.emissiveIntensity = 0.4 * (room.hauntPower ?? 1) * bulbFactor;
    });
    if (room.locker) {
      const locker = room.locker;
      locker.doorTimer = Math.max(0, locker.doorTimer - dt);
      locker.doorTarget = locker.doorTimer > 0 ? 1 : 0;
      locker.door.rotation.y = THREE.MathUtils.damp(
        locker.door.rotation.y,
        locker.doorTarget * -1.55,
        10,
        dt
      );
    }
    if (room.relay && room.relay.on !== state.relays[room.relay.index]) {
      const on = state.relays[room.relay.index];
      room.relay.on = on;
      room.relay.lever.rotation.x = on ? -0.3 : 0;
    }
  }
  world.rooms[0].fuse.visible = !state.fuse && !state.relays[0];
  world.rooms[3].tape.visible = !state.tape;
  world.rooms[3].flashlight.visible = !state.flashlight;
  world.creature.userData.indirectFill.value =
    enemy && !state.inserted && enemy.delay <= 0
      ? world.rooms[enemy.body?.field ?? enemy.room].indirectFill.value
      : 1;
}
