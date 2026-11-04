// Final narrativo: cámara, personaje y puerta cambian con el tiempo; todo está precargado.
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { solveLimb } from './creature-motion.js';
import { setExteriorVisible } from './room-rendering.js';
import { createRoad } from './road.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const phase = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const smooth = (n) => n * n * (3 - 2 * n);
const mix = (a, b, n) => a.clone().lerp(b, n);
const UP = V(0, 1, 0);
const DURATION = 34;

function copyMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = true;
    const copy = (m) => {
      const c = m.clone();
      if ('roughness' in c) c.roughness = Math.max(0.68, c.roughness);
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
  });
  return root;
}
function fitted(source, height) {
  const root = new THREE.Group(),
    model = copyMaterials(source.clone(true));
  root.add(model);
  model.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(model),
    size = bounds.getSize(V()),
    center = bounds.getCenter(V()),
    scale = height / Math.max(0.001, size.y);
  model.scale.multiplyScalar(scale);
  model.position.add(V(-center.x * scale, -bounds.min.y * scale, -center.z * scale));
  return root;
}
function findBone(root, name) {
  let result = null;
  const wanted = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
  root.traverse((o) => {
    if (o.isBone && o.name.replace(/[^a-z0-9]/gi, '').toLowerCase() === wanted) result = o;
  });
  return result;
}
function screenGeometry(tv) {
  const bounds = new THREE.Box3(),
    p = V(),
    normal = V(),
    a = V(),
    b = V(),
    c = V();
  tv.model.updateWorldMatrix(true, true);
  const slots = [];
  tv.model.traverse((mesh) => {
    if (!mesh.isMesh || !Array.isArray(mesh.material)) return;
    const slot = mesh.material.indexOf(tv.screen);
    if (slot < 0) return;
    slots.push({ mesh, slot, material: tv.screen });
    const g = mesh.geometry,
      positions = g.attributes.position,
      index = g.index;
    for (const group of g.groups.filter((group) => group.materialIndex === slot))
      for (let i = group.start; i < group.start + group.count; i += 3) {
        const indices = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
        indices.forEach((k) =>
          bounds.expandByPoint(p.fromBufferAttribute(positions, k).applyMatrix4(mesh.matrixWorld))
        );
        a.fromBufferAttribute(positions, indices[0]).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(positions, indices[1]).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(positions, indices[2]).applyMatrix4(mesh.matrixWorld);
        normal.add(b.sub(a).cross(c.sub(a)));
      }
  });
  if (bounds.isEmpty())
    throw new Error('La secuencia final necesita el cristal real del televisor.');
  const center = bounds.getCenter(V()),
    size = bounds.getSize(V());
  normal.normalize();
  if (normal.dot(V(0, 1.4, 0).sub(center)) < 0) normal.negate();
  return { slots, center, normal, width: size.x, height: size.y };
}

// This scene is assembled once during loading. Opening a door or reaching the
// ending never downloads models, creates a second world or allocates a target.
export class EndingSequence {
  constructor({ scene, world, renderer, camera, audio, assets, onComplete }) {
    this.scene = scene;
    this.world = world;
    this.renderer = renderer;
    this.camera = camera;
    this.audio = audio;
    this.assets = assets;
    this.onComplete = onComplete;
    this.active = false;
    this.completed = false;
    this.time = 0;
    this.saved = null;
    this.events = new Set();
    this.exterior = new THREE.Group();
    this.exterior.name = 'exterior-final-cc0';
    scene.add(this.exterior);
    this.makeExterior();
    this.makeProtagonist();
    world.exterior = {
      group: this.exterior,
      lights: [this.moon, this.skyFill, this.porchLight].map((light) => ({
        light,
        power: light.intensity
      }))
    };
    setExteriorVisible(world, false);
    this.tv = world.rooms[0].tv;
    this.screen = screenGeometry(this.tv);
    this.feedCamera = new THREE.PerspectiveCamera(
      55,
      this.screen.width / this.screen.height,
      0.04,
      180
    );
    this.feedTarget = new THREE.WebGLRenderTarget(1024, 768, {
      depthBuffer: true,
      stencilBuffer: false
    });
    this.feedTarget.texture.name = 'final-en-el-televisor';
    this.crt = new THREE.ShaderMaterial({
      name: 'apagado-crt-final',
      toneMapped: true,
      uniforms: {
        image: { value: this.feedTarget.texture },
        power: { value: 1 },
        vertical: { value: 1 },
        horizontal: { value: 1 }
      },
      vertexShader:
        'varying vec2 displayUV; void main(){displayUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform sampler2D image;uniform float power;uniform float vertical;uniform float horizontal;varying vec2 displayUV;
    void main(){vec2 extent=vec2(max(horizontal,.0001),max(vertical,.0001));vec2 p=(displayUV-.5)/extent+.5;
     float mask=step(0.,p.x)*step(p.x,1.)*step(0.,p.y)*step(p.y,1.);
     vec3 color=texture2D(image,clamp(p,0.,1.)).rgb;
     float line=1.-smoothstep(.0008,.004,abs(displayUV.y-.5));
     color=mix(color,vec3(.72,.84,.76),clamp((.08-vertical)*10.,0.,.8)*line);
     gl_FragColor=vec4(color*mask*power,1.);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`
    });
    this.lookMatrix = new THREE.Matrix4();
    this.targetQuaternion = new THREE.Quaternion();
    this.neck = findBone(this.heroModel, 'Head');
  }

  makeExterior() {
    if (!this.assets.house?.scene || !this.assets.protagonist?.scene)
      throw new Error('Faltan los modelos CC0 del final.');
    // house.glb is authored in the room's coordinates, including its real opening.
    this.house = copyMaterials(this.assets.house.scene.clone(true));
    this.house.name = 'casa-con-salida-real';
    this.exterior.add(this.house);
    const ground = this.assets.ground ?? {},
      maps = {};
    for (const key of ['map', 'normalMap', 'roughnessMap'])
      if (ground[key]) {
        maps[key] = ground[key].clone();
        maps[key].wrapS = maps[key].wrapT = THREE.RepeatWrapping;
        maps[key].repeat.set(28, 28);
        maps[key].needsUpdate = true;
      }
    const soil = new THREE.MeshStandardMaterial({
      ...maps,
      color: '#7c8272',
      roughness: 1,
      normalScale: new THREE.Vector2(0.35, 0.35)
    });
    // The yard cannot cover the living-room floor portals from underneath.
    const yard = new THREE.Shape();
    yard.moveTo(-75, -75);
    yard.lineTo(75, -75);
    yard.lineTo(75, 75);
    yard.lineTo(-75, 75);
    yard.closePath();
    const cutout = new THREE.Path();
    cutout.moveTo(-5.3, -6.05);
    cutout.lineTo(-5.3, 6.3);
    cutout.lineTo(5.3, 6.3);
    cutout.lineTo(5.3, -6.05);
    cutout.closePath();
    yard.holes.push(cutout);
    const landGeometry = new THREE.ShapeGeometry(yard),
      uv = landGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (uv.getX(i) + 75) / 150, (uv.getY(i) + 75) / 150);
    const land = new THREE.Mesh(landGeometry, soil);
    land.rotation.x = -Math.PI / 2;
    land.position.y = -0.055;
    land.receiveShadow = true;
    land.name = 'suelo-cc0';
    this.exterior.add(land);
    this.exterior.add(createRoad(this.assets.asphalt));
    const neighbour = this.assets.neighborHouse?.scene;
    if (neighbour)
      for (const [x, z, yaw, height] of [
        [-20, -1, 0.09, 7.1],
        [20, 0, -0.08, 6.4],
        [-24, 29, Math.PI, 7],
        [20, 31, Math.PI, 7.5]
      ]) {
        const model = fitted(neighbour, height);
        model.position.set(x, -0.02, z);
        model.rotation.y = yaw;
        this.exterior.add(model);
      }
    this.exteriorLights = new THREE.Group();
    this.exteriorLights.name = 'luces-exterior-residentes';
    this.scene.add(this.exteriorLights);
    this.moon = new THREE.DirectionalLight('#9bbed1', 0.65);
    this.moon.position.set(-15, 28, 15);
    this.moon.target.position.set(0, 0, 4);
    this.exteriorLights.add(this.moon, this.moon.target);
    this.skyFill = new THREE.HemisphereLight('#7f9eae', '#343a2b', 0.16);
    this.exteriorLights.add(this.skyFill);
    this.porchLight = new THREE.PointLight('#e3b578', 14, 12, 2);
    this.porchLight.position.set(-3.2, 2.9, 7.3);
    this.exteriorLights.add(this.porchLight);
  }

  makeProtagonist() {
    this.hero = new THREE.Group();
    this.hero.name = 'protagonista-con-la-cinta';
    this.hero.visible = false;
    this.heroModel = copyMaterials(cloneSkeleton(this.assets.protagonist.scene));
    this.hero.add(this.heroModel);
    this.exterior.add(this.hero);
    this.mixer = new THREE.AnimationMixer(this.heroModel);
    this.actions = {};
    // Keep the imported 62-joint skeleton and native animation scales intact.
    for (const [key, suffix] of [
      ['walk', 'Walk'],
      ['idle', 'Idle_Neutral'],
      ['interact', 'Interact']
    ]) {
      const clip = this.assets.protagonist.animations?.find(
        (clip) => clip.name.split('|').at(-1) === suffix
      );
      if (clip) this.actions[key] = this.mixer.clipAction(clip);
    }
    if (!this.actions.walk || !this.actions.idle)
      throw new Error('El protagonista necesita sus clips Walk e Idle_Neutral.');
    this.actions.idle.play();
    this.mixer.update(0);
    this.hero.updateMatrixWorld(true);
    this.heroModel.traverse((o) => {
      if (o.isSkinnedMesh) o.skeleton.update();
    });
    const bounds = new THREE.Box3().setFromObject(this.heroModel, true),
      height = bounds.max.y - bounds.min.y,
      scale = 1.82 / height,
      center = bounds.getCenter(V());
    this.heroModel.scale.multiplyScalar(scale);
    this.heroModel.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    this.hero.updateMatrixWorld(true);
    // SkinnedMesh.updateMatrixWorld refreshes bindMatrixInverse; updateWorldMatrix
    // alone does not. The animated skin must not inherit stale imported bounds.
    this.heroModel.traverse((o) => {
      if (o.isSkinnedMesh) o.frustumCulled = false;
    });
    this.hand = findBone(this.heroModel, 'Wrist.L');
    this.rightHand = findBone(this.heroModel, 'Wrist.R');
    this.currentAction = 'idle';
    this.rightUpper = findBone(this.heroModel, 'UpperArm.R');
    this.rightLower = findBone(this.heroModel, 'LowerArm.R');
    if (!this.hand || !this.assets.tape)
      throw new Error('El final necesita la mano del protagonista y la cinta.');
    const tape = copyMaterials(this.assets.tape.clone(true));
    tape.position.set(0, 0, 0);
    tape.quaternion.identity();
    tape.scale.set(1, 1, 1);
    tape.visible = true;
    tape.updateWorldMatrix(true, true);
    const tapeBox = new THREE.Box3().setFromObject(tape),
      tapeSize = tapeBox.getSize(V()),
      tapeCenter = tapeBox.getCenter(V());
    const tapeScale = 0.235 / Math.max(tapeSize.x, tapeSize.y, tapeSize.z);
    tape.scale.setScalar(tapeScale);
    tape.position.copy(tapeCenter).multiplyScalar(-tapeScale);
    this.tapeGrip = new THREE.Group();
    this.tapeGrip.name = 'cinta-en-la-mano';
    this.tapeGrip.add(tape);
    this.hand.add(this.tapeGrip);
    // Wrist's inherited scale is roughly 100 in this GLB; compensate at the prop,
    // never on the bone, or both the hand and the cassette become enormous.
    const inherited = this.hand.getWorldScale(V());
    this.tapeGrip.scale.set(1 / inherited.x, 1 / inherited.y, 1 / inherited.z);
    this.tapeGrip.position.set(0, 0.075 / inherited.y, 0);
    this.tapeGrip.rotation.set(Math.PI / 2, 0, 0.12);
    this.hero.position.set(-3.2, 0, 4.9);
  }

  action(name) {
    if (name === this.currentAction) return;
    const next = this.actions[name] ?? this.actions.idle,
      previous = this.actions[this.currentAction];
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (previous) next.crossFadeFrom(previous, 0.3, true);
    this.currentAction = name;
  }

  swapScreen(enabled) {
    for (const { mesh, slot, material } of this.screen.slots)
      mesh.material[slot] = enabled ? this.crt : material;
    this.tv.screen = enabled ? this.crt : this.screen.slots[0].material;
  }

  async prewarm(preparation) {
    // El final también se prepara en copias: nunca mover la cámara, el actor o el TV reales.
    await preparation.prepare([this.exterior], { background: true });
    const target = this.renderer.getRenderTarget();
    try {
      this.renderer.initRenderTarget(this.feedTarget);
      this.renderer.setRenderTarget(this.feedTarget);
      this.renderer.clear();
    } finally {
      this.renderer.setRenderTarget(target);
    }
    const screens = this.screen.slots.map(({ mesh, slot }) => {
      const copy = mesh.clone(false);
      copy.material = mesh.material.slice();
      copy.material[slot] = this.crt;
      return copy;
    });
    await preparation.prepare(screens, { background: true });
  }

  start() {
    if (this.active) return;
    this.reset();
    const lights = [];
    this.scene.traverse((o) => {
      if (o.isLight)
        lights.push({
          light: o,
          intensity: o.intensity,
          visible: o.visible,
          position: o.position.clone(),
          target: o.target?.position.clone()
        });
    });
    this.saved = {
      cameraPosition: this.camera.position.clone(),
      cameraQuaternion: this.camera.quaternion.clone(),
      up: this.camera.up.clone(),
      fov: this.camera.fov,
      near: this.camera.near,
      far: this.camera.far,
      background: this.scene.background,
      fog: this.scene.fog,
      environmentIntensity: this.scene.environmentIntensity,
      roomVisibility: this.world.rooms.map((room) => room.group.visible),
      connectorVisibility: this.world.connectors.map((c) => c.group.visible),
      exteriorVisible: this.exterior.visible,
      lights
    };
    setExteriorVisible(this.world, true);
    this.startPosition = this.camera.position.clone();
    this.startQuaternion = this.camera.quaternion.clone();
    this.time = 0;
    this.active = true;
    this.completed = false;
    this.events.clear();
    this.approachPosition = V(
      -3.2,
      1.68,
      this.startPosition.z > 6.1
        ? Math.max(6.8, this.startPosition.z)
        : Math.min(5.3, this.startPosition.z)
    );
    this.scene.background = new THREE.Color('#0a1015');
    this.scene.fog = new THREE.FogExp2('#0a1015', 0.018);
    this.scene.environmentIntensity = 0.12;
    this.world.rooms.forEach((room) => {
      room.group.visible = room.id === 0;
    });
    this.world.connectors.forEach((c) => {
      c.group.visible = false;
    });
    this.world.entryDoor.reset();
    this.world.entryDoor.setOpen(true);
    this.hero.visible = false;
    this.hero.position.set(-3.2, 0, 4.9);
    this.hero.rotation.y = 0;
    this.action('idle');
    // The renderer uses a fixed global pool. Recover the living-room lights by
    // matching their resident sources, and mute the folded rooms outside the house.
    const sources = this.world.rooms[0].lights.map((source) => ({
      position: source.light.getWorldPosition(V()),
      power: source.power
    }));
    for (const { light } of lights) {
      if (light.parent === this.scene && light.isPointLight) {
        const source = sources.find((s) => s.position.distanceTo(light.position) < 0.025);
        light.intensity = source ? source.power * 0.72 : 0;
      }
      if (light.isAmbientLight) light.intensity = 0.2;
      if (light.parent === this.scene && light.isSpotLight) {
        if (!light.castShadow) {
          light.intensity = 0;
          continue;
        }
        const source = this.world.rooms[0].bulb.shadow;
        light.position.copy(source.getWorldPosition(V()));
        light.target.position.copy(source.target.getWorldPosition(V()));
        light.intensity = 65;
      }
    }
    this.camera.up.copy(UP);
    this.camera.near = 0.035;
    this.camera.far = 180;
    this.camera.fov = 55;
    this.camera.updateProjectionMatrix();
    this.feedCamera.aspect = this.screen.width / this.screen.height;
    const fovRad = THREE.MathUtils.degToRad(this.camera.fov),
      visibleHeight = Math.min(this.screen.height, this.screen.width / this.camera.aspect);
    this.revealDistance = visibleHeight / (2 * Math.tan(fovRad / 2));
    this.feedCamera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(fovRad / 2) / (visibleHeight / this.screen.height))
    );
    this.feedCamera.updateProjectionMatrix();
    this.crt.uniforms.power.value = 1;
    this.crt.uniforms.vertical.value = 1;
    this.crt.uniforms.horizontal.value = 1;
    this.audio?.play('impactwood_heavy_000', 0.16, 0.58, V(-3.2, 1.1, 6));
    this.update(0);
  }

  once(name, callback) {
    if (!this.events.has(name)) {
      this.events.add(name);
      callback();
    }
  }

  poseDoor(amount) {
    const door = this.world.entryDoor;
    door.openAmount = amount;
    door.target = amount;
    door.swingSign = 1;
    door.update(0);
  }

  aim(position, target, blend = 1) {
    this.camera.position.copy(position);
    this.lookMatrix.lookAt(position, target, UP);
    this.targetQuaternion.setFromRotationMatrix(this.lookMatrix);
    if (blend < 1)
      this.camera.quaternion.copy(this.startQuaternion).slerp(this.targetQuaternion, blend);
    else this.camera.quaternion.copy(this.targetQuaternion);
  }

  update(dt) {
    if (!this.active || this.completed) return;
    this.time = Math.min(DURATION, this.time + Math.max(0, dt));
    const t = this.time;
    const fov = THREE.MathUtils.lerp(this.saved.fov, 55, smooth(phase(t, 0, 1.3)));
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const opening = smooth(phase(t, 0, 1.65)),
      closing = smooth(phase(t, 10.6, 13.1));
    this.poseDoor(opening * (1 - closing));
    this.hero.visible = t >= 5.7;
    this.hero.rotation.y = 0;
    if (t < 5.7) {
      this.action('idle');
      this.hero.position.set(-3.2, 0, 4.9);
    } else if (t < 10.2) {
      this.action('walk');
      const p = phase(t, 5.7, 10.2);
      this.hero.position.copy(mix(V(-3.2, 0, 4.9), V(-3.25, 0, 7.6), p));
      if (Math.floor((t - 5.7) / 0.62) > Math.floor((t - dt - 5.7) / 0.62))
        this.audio?.play('footstep_wood_002', 0.19, 0.9, this.hero.position);
    } else if (t < 13.3) {
      this.action('interact');
      const p = smooth(phase(t, 10.2, 10.65));
      const handle = this.world.entryDoor.pivot.localToWorld(V(1.18, 1.13, 0.04));
      const desired = handle.clone().add(V(0.45, -1.13, 0.43));
      this.hero.position.copy(mix(V(-3.25, 0, 7.6), desired, p));
      const facing = handle.clone().sub(this.hero.position);
      this.hero.rotation.y = Math.atan2(facing.x, facing.z);
    } else {
      this.action('idle');
      this.hero.position.set(-2.25, 0, 6.48);
      this.hero.rotation.y = Math.PI;
      if (t > 14.1) this.hero.rotation.y = Math.PI * (1 - smooth(phase(t, 14.1, 15.5)));
    }
    this.mixer.update(Math.max(0, dt));
    this.hero.updateMatrixWorld(true);
    if (t >= 10.3 && t < 13.3 && this.rightUpper && this.rightLower && this.rightHand) {
      const grip = this.world.entryDoor.pivot.localToWorld(V(1.28, 1.14, 0.07)),
        amount = smooth(phase(t, 10.3, 10.7)) * (1 - smooth(phase(t, 13.05, 13.3)));
      grip.lerp(this.rightHand.getWorldPosition(V()), 1 - amount);
      solveLimb(
        this.rightUpper,
        this.rightLower,
        this.rightHand,
        grip,
        this.hero.position.clone().add(V(0.75, 0.85, 0.2)),
        0.18
      );
      this.hero.updateMatrixWorld(true);
    }
    if (t >= 13.08)
      this.once('door-close', () => {
        this.world.entryDoor.setOpen(false);
        this.audio?.play('impactwood_heavy_000', 0.34, 0.8, V(-3.2, 1.1, 6));
      });
    // The camera reaches the exterior before the protagonist begins moving.
    if (t < 3.8) {
      // Align inside the opening first; a diagonal from an off-centre interaction
      // point would otherwise cut through the solid wall beside the door.
      const position =
        t < 1.3
          ? mix(this.startPosition, this.approachPosition, smooth(phase(t, 0, 1.3)))
          : mix(this.approachPosition, V(-3.2, 1.7, 9.05), smooth(phase(t, 1.3, 3.8)));
      this.aim(position, V(-3.2, 1.5, 17), smooth(phase(t, 0, 0.9)));
    } else if (t < 6) {
      const p = smooth(phase(t, 3.8, 6)),
        position = mix(V(-3.2, 1.7, 9.05), V(-0.35, 2.05, 11.8), p);
      // Turn smoothly back toward the door, without a cut or teleport.
      const outward = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(position, V(-3.2, 1.5, 17), UP)
      );
      this.aim(position, V(-3.2, 1.25, 6.3));
      this.camera.quaternion.copy(outward).slerp(this.targetQuaternion, p);
    } else if (t < 14) {
      this.aim(
        mix(V(-0.35, 2.05, 11.8), V(0.15, 2.15, 12.6), smooth(phase(t, 6, 14))),
        V(-3.0, 1.2, 6.7)
      );
    } else if (t < 23) {
      const p = smooth(phase(t, 14, 23));
      this.aim(
        mix(V(0.15, 2.15, 12.6), V(6, 5.9, 29), p),
        mix(V(-3, 1.2, 6.7), V(-0.7, 2.1, 3), p)
      );
    }
    const outdoor = phase(t, 23, 31);
    this.feedCamera.position.copy(mix(V(6, 5.9, 29), V(12, 8.2, 42), smooth(outdoor)));
    this.feedCamera.up.copy(UP);
    this.feedCamera.lookAt(-0.7, 2.1, 3);
    if (t >= 23) {
      this.swapScreen(true);
      const p = smooth(phase(t, 23, 30.8)),
        normal = this.screen.normal,
        right = V().crossVectors(UP, normal).normalize();
      const from = this.screen.center.clone().addScaledVector(normal, this.revealDistance),
        to = this.screen.center
          .clone()
          .addScaledVector(normal, 5.7)
          .addScaledVector(right, 2)
          .addScaledVector(UP, 0.75);
      this.aim(mix(from, to, p), this.screen.center.clone().addScaledVector(UP, 0.12 * p));
    }
    if (t >= 31) {
      const collapse = smooth(phase(t, 31, 31.4));
      this.crt.uniforms.vertical.value = Math.max(0.004, 1 - collapse);
      this.crt.uniforms.horizontal.value = 1 - smooth(phase(t, 31.45, 31.85));
      this.crt.uniforms.power.value = 1 - smooth(phase(t, 31.65, 32.15));
      this.once('tv-off', () =>
        this.audio?.play('impactmetal_medium_000', 0.16, 1.35, this.screen.center)
      );
      const dim = 1 - 0.78 * smooth(phase(t, 31.2, 33));
      for (const saved of this.saved.lights) {
        const light = saved.light;
        if (light.parent === this.scene && light.isPointLight && light.intensity > 0)
          light.intensity = Math.min(light.intensity, saved.intensity * dim);
        if (light.isAmbientLight) light.intensity = 0.2 * dim;
      }
    }
    if (t >= DURATION) {
      this.completed = true;
      this.onComplete?.();
    }
  }

  render() {
    if (!this.active) return false;
    if (this.time >= 23 && this.time < 32.15) {
      const target = this.renderer.getRenderTarget(),
        visible = this.crt.visible;
      this.crt.visible = false;
      try {
        this.renderer.setRenderTarget(this.feedTarget);
        this.renderer.render(this.scene, this.feedCamera);
      } finally {
        this.renderer.setRenderTarget(target);
        this.crt.visible = visible;
      }
    }
    this.renderer.render(this.scene, this.camera);
    return true;
  }

  reset() {
    this.swapScreen?.(false);
    this.active = false;
    this.completed = false;
    this.time = 0;
    this.events.clear();
    this.hero.visible = false;
    if (this.saved) {
      const saved = this.saved;
      this.scene.background = saved.background;
      this.scene.fog = saved.fog;
      this.scene.environmentIntensity = saved.environmentIntensity;
      setExteriorVisible(this.world, saved.exteriorVisible);
      this.world.rooms.forEach((room, i) => {
        room.group.visible = saved.roomVisibility[i];
      });
      this.world.connectors.forEach((c, i) => {
        c.group.visible = saved.connectorVisibility[i];
      });
      for (const { light, intensity, visible, position, target } of saved.lights) {
        light.intensity = intensity;
        light.visible = visible;
        light.position.copy(position);
        if (target) light.target.position.copy(target);
      }
      this.camera.position.copy(saved.cameraPosition);
      this.camera.quaternion.copy(saved.cameraQuaternion);
      this.camera.up.copy(saved.up);
      this.camera.fov = saved.fov;
      this.camera.near = saved.near;
      this.camera.far = saved.far;
      this.camera.updateProjectionMatrix();
      this.saved = null;
    }
  }
}
