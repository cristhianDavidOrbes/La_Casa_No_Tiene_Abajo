// Implementación original CC0: el área de cinta se conserva entre ambos carretes.
const CORE = 0.23,
  OUTER = 0.48,
  TAPE = OUTER ** 2 - CORE ** 2;
export class TapeRewind {
  constructor() {
    this.reset();
  }
  reset() {
    this.progress = this.leftAngle = this.rightAngle = this.speed = this.completedFor = 0;
  }
  get leftRadius() {
    return Math.sqrt(CORE ** 2 + TAPE * this.progress);
  }
  get rightRadius() {
    return Math.sqrt(CORE ** 2 + TAPE * (1 - this.progress));
  }
  turn(turns) {
    if (this.progress >= 1) return;
    const left = this.leftRadius,
      right = this.rightRadius;
    const previous = this.progress;
    this.progress = Math.max(0, Math.min(1, previous + (turns * left) / (0.35 * 8)));
    const actual = ((this.progress - previous) * (0.35 * 8)) / left;
    this.leftAngle -= actual * Math.PI * 2;
    this.rightAngle -= (actual * Math.PI * 2 * left) / right;
  }
  update(dt, held) {
    this.speed += ((held && this.progress < 1 ? 1 : 0) - this.speed) * Math.min(1, dt * 10);
    this.turn(this.speed * dt);
    if (this.progress >= 1) this.completedFor += dt;
  }
}
