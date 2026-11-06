// Resolución adaptativa: conservar geometría y texturas, ajustar píxeles al coste de GPU.
export class RenderBudget {
  constructor(max = 1, pixels = 1280 * 720) {
    this.max = Math.min(max, Math.sqrt((1600 * 900) / Math.max(1, pixels)));
    this.ratio = Math.min(this.max, Math.sqrt((1280 * 720) / Math.max(1, pixels)));
    this.min = Math.min(0.55, this.ratio);
    this.samples = new Float32Array(120);
    this.count = this.index = this.elapsed = 0;
    this.cooldown = 1.5;
  }
  sample(ms) {
    if (ms <= 0 || ms > 250) return null;
    this.elapsed += ms / 1000;
    this.samples[this.index] = ms;
    this.index = (this.index + 1) % this.samples.length;
    this.count = Math.min(this.count + 1, this.samples.length);
    if (this.elapsed < this.cooldown || this.count < 45) return null;
    const sorted = this.samples.slice(0, this.count).sort(),
      p90 = sorted[Math.floor(this.count * 0.9)];
    this.elapsed = this.count = this.index = 0;
    const old = this.ratio;
    if (p90 > 17.8) this.ratio = Math.max(this.min, this.ratio * 0.82);
    else if (p90 < 11.5) this.ratio = Math.min(this.max, this.ratio + 0.05);
    this.cooldown = this.ratio > old ? 12 : 2;
    return Math.abs(this.ratio - old) > 0.001 ? this.ratio : null;
  }
}
