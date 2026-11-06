import { Object3D, Vector3 } from 'three';

// The exterior shares world coordinates with folded rooms, but belongs only
// to the living-room view and the ending. Keep its lights resident even when
// the geometry is hidden so crossing a portal does not recompile shaders.
export function setExteriorVisible(world, visible) {
  const exterior = world.exterior;
  if (!exterior) return;
  exterior.group.visible = visible;
  for (const { light, power } of exterior.lights) light.intensity = visible ? power : 0;
}

// La toma exterior final usa solamente la sala. Durante el juego se ve la casa completa.
export function setEndingArchitecture(world, ending) {
  world.architecture.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.visible = !ending || (mesh.userData.room === 0 && !mesh.userData.connector);
  });
}

// La geometría queda en escena. Al cruzar solo se reasignan las luces cercanas.
export class RoomRendering {
  constructor(world, scene) {
    this.world = world;
    this.exteriorPrepared = true;
    const regions = [
      ...world.rooms.map((room) => ({ ids: [room.id], sources: room.lights })),
      ...world.connectors.map((c) => ({ ids: [c.link.a, c.link.b], sources: c.lights ?? [] }))
    ];
    this.sources = regions.flatMap((region) =>
      region.sources.map((source) => {
        source.light.visible = false;
        return {
          rooms: region.ids,
          source,
          position: source.light.getWorldPosition(new Vector3())
        };
      })
    );
    // Cuatro luces compartidas para el cuarto actual y sus vecinos.
    this.points = Array.from({ length: Math.min(4, this.sources.length) }, () => {
      const light = this.sources[0].source.light.clone();
      light.visible = true;
      light.castShadow = false;
      light.intensity = 0;
      scene.add(light);
      return { light };
    });
    this.shadow = world.rooms[0].bulb.shadow.clone();
    this.shadow.visible = true;
    this.shadow.castShadow = true;
    this.shadow.shadow.mapSize.set(512, 512);
    this.shadow.target = new Object3D();
    scene.add(this.shadow, this.shadow.target);
    for (const room of world.rooms) room.bulb.shadow.visible = false;
    this.casters = world.rooms.flatMap((room) => {
      const meshes = [];
      room.group.traverse((mesh) => {
        if (!mesh.isMesh || !mesh.castShadow || !mesh.geometry) return;
        mesh.geometry.computeBoundingBox();
        const size = mesh.geometry.boundingBox.getSize(new Vector3());
        size.multiply(mesh.getWorldScale(new Vector3()));
        // Libros, papeles, fusibles y adornos pequeños no necesitan proyectar sombra.
        meshes.push({
          mesh,
          room: room.id,
          large: Math.max(Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)) >= 0.75
        });
      });
      return meshes;
    });
    world.architecture.traverse((mesh) => {
      if (mesh.isMesh) this.casters.push({ mesh, room: mesh.userData.room, large: true });
    });
  }
  update(activeRoom, transition = null, eye = null) {
    setExteriorVisible(this.world, activeRoom === 0 && this.exteriorPrepared);
    const nearby = new Set(
      this.world.rooms.filter((room) => Math.abs(room.id - activeRoom) <= 1).map((room) => room.id)
    );
    if (transition) {
      nearby.add(transition.link.a);
      nearby.add(transition.link.b);
    }
    for (const caster of this.casters) {
      caster.mesh.castShadow = caster.large && caster.room === activeRoom;
    }
    const origin = eye ?? this.world.rooms[activeRoom].group.localToWorld(new Vector3(0, 1.68, 0));
    const candidates = this.sources.filter(({ rooms }) => rooms.every((id) => nearby.has(id)));
    const score = ({ rooms, source, position }) =>
      position.distanceToSquared(origin) / Math.max(1, source.light.distance ** 2) +
      (rooms.includes(activeRoom) ? 0 : 2);
    candidates.sort((a, b) => score(a) - score(b));
    // Reservar el foco central de cada cuarto cercano conserva sus parpadeos.
    const selected = [...nearby]
      .map((id) => candidates.find(({ source }) => source.light === this.world.rooms[id].bulb.lamp))
      .filter(Boolean);
    for (const candidate of candidates) {
      if (selected.length >= this.points.length) break;
      if (!selected.includes(candidate)) selected.push(candidate);
    }
    for (let i = 0; i < this.points.length; i++) {
      const { light } = this.points[i];
      const candidate = selected[i];
      light.intensity = candidate?.source.light.intensity ?? 0;
      if (!candidate) continue;
      const source = candidate.source.light;
      light.position.copy(candidate.position);
      light.color.copy(source.color);
      light.distance = source.distance;
      light.decay = source.decay;
    }
    const source = this.world.rooms[activeRoom].bulb.shadow;
    this.shadow.position.copy(source.getWorldPosition(new Vector3()));
    this.shadow.target.position.copy(source.target.getWorldPosition(new Vector3()));
    this.shadow.intensity = source.intensity;
    this.shadow.color.copy(source.color);
  }
}
