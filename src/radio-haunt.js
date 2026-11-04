export class RadioHaunt {
  constructor() {
    this.reset();
  }
  reset() {
    this.lockFor = 0;
    this.exploded = false;
  }
  update(frequency, dt) {
    const distance = Math.abs(frequency - 83);
    const strength = Math.max(0, 1 - distance / 4.5) ** 2;
    this.lockFor = distance <= 0.05 ? this.lockFor + dt : 0;
    const burst = !this.exploded && this.lockFor >= 0.8;
    if (burst) this.exploded = true;
    return { strength, burst };
  }
}
