import * as T from 'three';

// Shared by the visible opening, the hinged leaf and Cannon's collider.
export const ENTRY_DOOR = Object.freeze({
  x: -3.2,
  z: 6,
  width: 1.4,
  height: 2.55,
  hingeX: -3.9,
  thickness: 0.085
});

export function createEntryDoor(room, doorModel, frameModel) {
  const d = ENTRY_DOOR,
    root = new T.Group(),
    pivot = new T.Group();
  root.name = 'entrada-con-marco';
  room.group.add(root);
  const paint = new T.MeshStandardMaterial({ color: '#797364', roughness: 0.88 });
  const prepare = (model) => {
    const copy = model.clone(true);
    copy.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      const convert = (m) =>
        /brass/i.test(m.name)
          ? new T.MeshStandardMaterial({ color: '#76613b', metalness: 0.72, roughness: 0.4 })
          : paint;
      o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
    });
    return copy;
  };
  // This CC0 module is centred on z=-.5, with an .8 x 1.9 m opening.
  // Fit the aperture, not the outside bounds of the frame.
  const frame = prepare(frameModel);
  frame.scale.set(d.width / 0.8, d.height / 1.9, 1.15);
  frame.position.set(d.x, 0, d.z + 0.5 * 1.15);
  root.add(frame);
  pivot.name = 'bisagra-puerta-entrada';
  pivot.position.set(d.hingeX, 0, d.z);
  root.add(pivot);
  const leaf = prepare(doorModel),
    sx = (d.width - 0.04) / 0.8,
    sy = (d.height - 0.045) / 1.9;
  leaf.scale.set(sx, sy, 0.85);
  leaf.position.set(d.width / 2, 0.02, 0.425);
  pivot.add(leaf);
  const item = {
    id: 'entry-door',
    type: 'exit',
    pos: new T.Vector3(d.x, 1.2, d.z - 0.12),
    radius: 2.25,
    label: 'Abrir la puerta de entrada',
    mesh: root
  };
  room.interactions.push(item);
  const door = {
    root,
    pivot,
    leaf,
    frame,
    openAmount: 0,
    target: 0,
    swingSign: 1,
    setOpen(open, inward = false) {
      if (open && !this.target && this.openAmount < 0.1) this.swingSign = inward ? -1 : 1;
      this.target = open ? 1 : 0;
      item.label = open ? 'Cerrar la puerta de entrada' : 'Abrir la puerta de entrada';
    },
    update(dt) {
      this.openAmount = T.MathUtils.damp(this.openAmount, this.target, 4.6, dt);
      if (Math.abs(this.openAmount - this.target) < 0.0001) this.openAmount = this.target;
      pivot.rotation.y = -1.68 * this.openAmount * this.swingSign;
      root.updateWorldMatrix(true, true);
    },
    reset() {
      this.setOpen(false);
      this.openAmount = 0;
      this.swingSign = 1;
      pivot.rotation.y = 0;
      root.updateWorldMatrix(true, true);
    }
  };
  room.entryDoor = door;
  return door;
}
