import { Vector3 } from 'three';
const Y = new Vector3(0, 1, 0);
export class BookBurst {
  constructor(room, shelves) {
    this.room = room;
    this.shelves = shelves;
    this.books = shelves.flatMap((shelf) => shelf.books);
    this.physics = null;
    this.onLanding = () => {};
    for (const book of this.books) {
      book.home = book.root.position.clone();
      book.rest = book.root.quaternion.clone();
      book.velocity = new Vector3();
      book.spin = new Vector3();
      book.active = false;
      book.wait = 0;
    }
  }
  bindPhysics(physics) {
    if (this.physics === physics) return;
    this.physics = physics;
    for (const book of this.books)
      book.prop = physics.createProp(book.root, this.room.id, {
        onImpact: (position) => this.onLanding(position)
      });
  }
  reset() {
    for (const book of this.books) {
      book.root.visible = true;
      book.root.position.copy(book.home);
      book.root.quaternion.copy(book.rest);
      book.active = false;
      if (book.prop) {
        book.prop.room = this.room.id;
        this.physics.resetProp(book.prop);
      }
    }
  }
  update(dt, { state, player, hidden = false, onThrow = () => {}, onLanding = () => {} }) {
    if (!this.physics) return;
    this.onLanding = onLanding;
    if (state.room === this.room.id && !hidden && !state.inserted) {
      for (const shelf of this.shelves) {
        const id = 'archive-book-burst-' + shelf.index;
        if (state.haunts.includes(id) || player.distanceTo(shelf.center) > 3.2) continue;
        state.haunts.push(id);
        onThrow(this.room.group.localToWorld(shelf.center.clone()));
        const toward = player.clone().sub(shelf.center).setY(0).normalize();
        if (toward.lengthSq() < 0.1) toward.set(0, 0, 1);
        toward.z = Math.max(0.55, toward.z);
        toward.normalize();
        shelf.books.forEach((book, i) => {
          book.active = true;
          book.wait = i * 0.035;
          book.velocity
            .copy(toward)
            .applyAxisAngle(Y, (Math.random() - 0.5) * 0.5)
            .multiplyScalar(4.5 + Math.random() * 2.3)
            .setY(2.1 + Math.random() * 2.4);
          book.spin.set(
            (Math.random() - 0.5) * 13,
            (Math.random() - 0.5) * 11,
            (Math.random() - 0.5) * 15
          );
        });
      }
    }
    const roomFrame = this.room.group.getWorldQuaternion(this.room.group.quaternion.clone());
    for (const book of this.books) {
      if (!book.active) continue;
      if (!book.prop.active) {
        book.wait -= dt;
        if (book.wait > 0) continue;
        // The shelf's coarse collider fills its interior; start beyond its front.
        book.root.position.z = Math.max(book.root.position.z, -3.04);
        this.physics.resetProp(book.prop);
        this.physics.launchProp(
          book.prop,
          book.velocity.clone().applyQuaternion(roomFrame),
          book.spin.clone().applyQuaternion(roomFrame)
        );
      }
      this.physics.syncProp(book.prop);
    }
  }
}
