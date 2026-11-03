// Adjust only supersampling, never geometry, textures or skeletal animation quality.
export class RenderBudget {
  constructor(max = 1.5) {
    this.max = max;
    this.ratio = max;
    this.min = Math.min(1, max);
    this.samples = [];
    this.elapsed = 0;
    this.cooldown = 3;
  }
  sample(ms) {
    if (ms <= 0 || ms > 100) return null;
    this.elapsed += ms / 1000;
    this.samples.push(ms);
    if (this.samples.length > 240) this.samples.shift();
    if (this.elapsed < this.cooldown || this.samples.length < 90) return null;
    const s = [...this.samples].sort((a, b) => a - b),
      p95 = s[Math.floor(s.length * 0.95)];
    this.elapsed = 0;
    this.samples = [];
    const old = this.ratio;
    if (p95 > 17.4) this.ratio = Math.max(this.min, this.ratio - 0.15);
    else if (p95 < 11.5) this.ratio = Math.min(this.max, this.ratio + 0.1);
    this.cooldown = this.ratio > old ? 12 : 4;
    return Math.abs(old - this.ratio) > 0.001 ? this.ratio : null;
  }
}
