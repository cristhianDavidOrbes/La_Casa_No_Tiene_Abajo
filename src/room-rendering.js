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
    this.points = regions.flatMap((region) =>
      region.sources.map((source) => {
        source.light.visible = false;
        const light = source.light.clone();
        light.visible = true;
        light.position.copy(source.light.getWorldPosition(new Vector3()));
        scene.add(light);
        return { rooms: region.ids, source, light };
      })
    );
    this.shadow = world.rooms[0].bulb.shadow.clone();
    this.shadow.visible = true;
    this.shadow.target = new Object3D();
    scene.add(this.shadow, this.shadow.target);
    for (const room of world.rooms) room.bulb.shadow.visible = false;
  }
  update(activeRoom, transition = null) {
    setExteriorVisible(this.world, activeRoom === 0);
    const visible = new Set(
      this.world.rooms.filter((room) => Math.abs(room.id - activeRoom) <= 1).map((room) => room.id)
    );
    if (transition) {
      visible.add(transition.link.a);
      visible.add(transition.link.b);
    }
    for (const room of this.world.rooms) room.group.visible = visible.has(room.id);
    for (const { rooms, source, light } of this.points) {
      light.intensity = rooms.every((id) => visible.has(id)) ? source.light.intensity : 0;
      light.color.copy(source.light.color);
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
