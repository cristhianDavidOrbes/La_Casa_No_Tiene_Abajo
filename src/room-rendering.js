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

// Geometry is resident from startup. Changing rooms changes uniforms and the
// visible geometry window, not the shader's light/shadow counts or GPU targets.
export class RoomRendering {
  constructor(world, scene) {
    this.world = world;
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
    // Ocho focos reutilizables: el shader no calcula las luces de toda la casa.
    this.points = Array.from({ length: Math.min(8, this.sources.length) }, () => {
      const light = this.sources[0].source.light.clone();
      light.visible = true;
      light.intensity = 0;
      scene.add(light);
      return { light };
    });
    this.shadow = world.rooms[0].bulb.shadow.clone();
    this.shadow.visible = true;
    this.shadow.target = new Object3D();
    scene.add(this.shadow, this.shadow.target);
    for (const room of world.rooms) room.bulb.shadow.visible = false;
  }
  update(activeRoom, transition = null, eye = null) {
    setExteriorVisible(this.world, activeRoom === 0);
    const visible = new Set(
      this.world.rooms.filter((room) => Math.abs(room.id - activeRoom) <= 1).map((room) => room.id)
    );
    if (transition) {
      visible.add(transition.link.a);
      visible.add(transition.link.b);
    }
    for (const room of this.world.rooms) room.group.visible = visible.has(room.id);
    const origin = eye ?? this.world.rooms[activeRoom].group.localToWorld(new Vector3(0, 1.68, 0));
    const candidates = this.sources.filter(({ rooms }) => rooms.every((id) => visible.has(id)));
    const score = ({ rooms, source, position }) =>
      position.distanceToSquared(origin) / Math.max(1, source.light.distance ** 2) +
      (rooms.includes(activeRoom) ? 0 : 2);
    candidates.sort((a, b) => score(a) - score(b));
    for (let i = 0; i < this.points.length; i++) {
      const { light } = this.points[i];
      const candidate = candidates[i];
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
    for (const connector of this.world.connectors)
      connector.group.visible = visible.has(connector.link.a) && visible.has(connector.link.b);
  }
}
