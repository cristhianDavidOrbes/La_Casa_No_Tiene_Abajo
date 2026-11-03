const FILES = [
  ...Array.from({ length: 5 }, (_, i) => `footstep_wood_00${i}`),
  ...Array.from({ length: 5 }, (_, i) => `footstep_concrete_00${i}`),
  'impactWood_heavy_000',
  'impactMetal_medium_000',
  'impactGlass_light_000',
  'horror_ambience',
  'horror_hit_low',
  'horror_hit_high',
  'horror_hit_mid',
  'horror_scream',
  'horror_ghost_01',
  'horror_ghost_05',
  'jumpscare_chosen_17',
  'rear_chosen_09'
];
export class Soundscape {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffers = {};
    this.volume = 0.65;
    this.stepIndex = 0;
    this.ready = false;
    this.preloading = null;
    this.nextVoice = 0;
    this.duckUntil = 0;
  }
  preload() {
    if (!this.preloading)
      this.preloading = Promise.all(
        FILES.map(async (name) => {
          try {
            const response = await fetch('/assets/audio/' + name + '.ogg');
            if (!response.ok) throw new Error(response.status);
            return [name, await response.arrayBuffer()];
          } catch (error) {
            console.warn('Audio no disponible', name, error);
            return null;
          }
        })
      );
    return this.preloading;
  }
  async init() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -5;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    this.master.connect(limiter).connect(this.ctx.destination);
    const files = await this.preload();
    await Promise.all(
      files.filter(Boolean).map(async ([name, data]) => {
        try {
          this.buffers[name] = await this.ctx.decodeAudioData(data);
        } catch (error) {
          console.warn('Audio no decodificable', name, error);
        }
      })
    );
    this.preloading = null;
    const noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate),
      data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = noise;
    this.drone = this.ctx.createOscillator();
    this.drone.type = 'sine';
    this.drone.frequency.value = 48;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.024;
    this.drone.connect(this.droneGain).connect(this.master);
    this.drone.start();
    this.undertone = this.ctx.createOscillator();
    this.undertone.type = 'triangle';
    this.undertone.frequency.value = 49.7;
    this.undertoneGain = this.ctx.createGain();
    this.undertoneGain.gain.value = 0.008;
    this.undertone.connect(this.undertoneGain).connect(this.master);
    this.undertone.start();
    const hiss = this.ctx.createBufferSource();
    hiss.buffer = noise;
    hiss.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350;
    this.hissGain = this.ctx.createGain();
    this.hissGain.gain.value = 0.008;
    hiss.connect(filter).connect(this.hissGain).connect(this.master);
    hiss.start();
    if (this.buffers.horror_ambience) {
      const ambience = this.ctx.createBufferSource();
      ambience.buffer = this.buffers.horror_ambience;
      ambience.loop = true;
      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0;
      ambience.connect(this.ambienceGain).connect(this.master);
      ambience.start();
    }
    this.ready = true;
  }
  volumeTo(n) {
    this.volume = n;
    if (this.master) this.master.gain.setTargetAtTime(n, this.ctx.currentTime, 0.03);
  }
  attachMedia(element) {
    if (!this.ctx || this.media) return;
    this.media = this.ctx.createMediaElementSource(element);
    this.mediaPan = this.ctx.createPanner();
    this.mediaPan.panningModel = 'HRTF';
    this.mediaPan.distanceModel = 'inverse';
    this.mediaPan.refDistance = 4;
    this.mediaPan.rolloffFactor = 1.2;
    this.mediaPan.positionX.value = 0;
    this.mediaPan.positionY.value = 1.4;
    this.mediaPan.positionZ.value = -4.05;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.8;
    this.media.connect(this.mediaPan).connect(gain).connect(this.master);
  }
  pause(paused) {
    if (!this.ctx) return;
    paused ? this.ctx.suspend() : this.ctx.resume();
  }
  play(name, volume = 0.3, rate = 1, position = null) {
    if (!this.buffers[name] || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    let pan;
    if (position) {
      pan = this.ctx.createPanner();
      pan.panningModel = 'HRTF';
      pan.distanceModel = 'inverse';
      pan.refDistance = 2;
      pan.maxDistance = 25;
      pan.rolloffFactor = 0.6;
      pan.positionX.value = position.x;
      pan.positionY.value = position.y;
      pan.positionZ.value = position.z;
      gain.connect(pan).connect(this.master);
    } else gain.connect(this.master);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
      pan?.disconnect();
    };
    src.start();
    return src;
  }
  footstep(room, run = false) {
    const type = room === 0 ? 'wood' : 'concrete';
    this.play(
      `footstep_${type}_00${this.stepIndex++ % 5}`,
      run ? 0.18 : 0.13,
      0.83 + Math.random() * 0.16
    );
  }
  knock(pos) {
    this.play('impactWood_heavy_000', 0.6, 0.55, pos);
  }
  switch() {
    this.play('impactMetal_medium_000', 0.18, 1.5);
  }
  swoosh() {
    if (!this.ctx || !this.noiseBuffer) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(90, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1500, this.ctx.currentTime + 1);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22, this.ctx.currentTime + 1);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 3);
    s.connect(filter).connect(g).connect(this.master);
    s.start();
    s.stop(this.ctx.currentTime + 3.1);
  }
  spatialOutput(node, position) {
    if (!position) {
      node.connect(this.master);
      return null;
    }
    const pan = this.ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 2;
    pan.maxDistance = 25;
    pan.rolloffFactor = 0.6;
    pan.positionX.value = position.x;
    pan.positionY.value = position.y;
    pan.positionZ.value = position.z;
    node.connect(pan).connect(this.master);
    return pan;
  }
  tone(freq = 700, length = 0.2, volume = 0.08, position = null) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain(),
      now = this.ctx.currentTime;
    o.frequency.value = freq;
    o.type = 'sine';
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + length);
    o.connect(g);
    const pan = this.spatialOutput(g, position);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      pan?.disconnect();
    };
    o.start();
    o.stop(now + length);
  }
  haunt(kind = 'knock', position = null) {
    if (!this.ctx) return;
    if (kind === 'whisper' && this.buffers.horror_ghost_01) {
      this.play(
        Math.random() < 0.5 ? 'horror_ghost_01' : 'horror_ghost_05',
        0.3,
        0.88 + Math.random() * 0.12,
        position
      );
      return;
    }
    if (kind === 'drag' && this.buffers.horror_hit_low)
      this.play('horror_hit_low', 0.14, 0.8, position);
    if (kind === 'knock') this.knock(position);
    if (kind === 'drag')
      for (let i = 0; i < 3; i++)
        setTimeout(() => this.play('footstep_wood_002', 0.2, 0.46, position), i * 230);
    const now = this.ctx.currentTime,
      osc = this.ctx.createOscillator(),
      filter = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain();
    osc.type = kind === 'whisper' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(kind === 'whisper' ? 136 : 61, now);
    osc.frequency.exponentialRampToValueAtTime(kind === 'whisper' ? 79 : 42, now + 1.8);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 1.8);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc.connect(filter).connect(gain);
    const pan = this.spatialOutput(gain, position);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      pan?.disconnect();
    };
    osc.start(now);
    osc.stop(now + 1.85);
  }
  reveal(position) {
    if (this.buffers.rear_chosen_09) {
      this.play('rear_chosen_09', 0.55, 1, position);
      return;
    }
    this.play('horror_hit_mid', 0.34, 1, position);
  }
  throwBooks(position) {
    this.play('impactWood_heavy_000', 0.5, 0.58, position);
    this.play('horror_hit_low', 0.3, 0.85, position);
    this.play('impactMetal_medium_000', 0.15, 0.55, position);
  }
  bookLanding(position) {
    if (!this.ctx || this.ctx.currentTime < (this.nextBookImpact ?? 0)) return;
    this.nextBookImpact = this.ctx.currentTime + 0.09;
    this.play('impactWood_heavy_000', 0.12, 0.85 + Math.random() * 0.25, position);
  }
  scream(length = 1.05, level = 0.6) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [base, mult] of [
      [610, 1],
      [840, 0.43],
      [1180, 0.26]
    ]) {
      const oscillator = this.ctx.createOscillator(),
        band = this.ctx.createBiquadFilter(),
        gain = this.ctx.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(base, now);
      oscillator.frequency.exponentialRampToValueAtTime(base * 0.37, now + length);
      band.type = 'bandpass';
      band.frequency.setValueAtTime(base * 1.3, now);
      band.frequency.exponentialRampToValueAtTime(base * 0.54, now + length);
      band.Q.value = 4;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(level * mult * 0.14, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + length);
      oscillator.connect(band).connect(gain).connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + length + 0.02);
    }
  }
  jumpscare(position) {
    if (this.buffers.jumpscare_chosen_17) {
      this.duckUntil = this.ctx.currentTime + 3;
      this.ambienceGain?.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.025);
      this.play('jumpscare_chosen_17', 0.72, 1, position);
      return;
    }
    if (this.buffers.horror_scream && this.buffers.horror_hit_low) {
      this.duckUntil = this.ctx.currentTime + 1.35;
      this.ambienceGain?.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.025);
      this.play('horror_hit_low', 0.48, 1);
      this.play(Math.random() < 0.5 ? 'horror_hit_high' : 'horror_hit_mid', 0.28, 1);
      this.play('horror_scream', 0.48, 1);
      this.tone(52, 1.28, 0.055);
      return;
    }
    this.play('impactWood_heavy_000', 0.72, 0.48);
    this.play('impactMetal_medium_000', 0.42, 0.29);
    this.scream(1.15, 0.95);
    for (const [hz, vol] of [
      [55, 0.13],
      [58.2, 0.085],
      [77.8, 0.075],
      [116.5, 0.05]
    ])
      this.tone(hz, 1.32, vol);
    this.tone(880, 0.35, 0.12);
    this.tone(1320, 0.22, 0.09);
    if (this.ctx && this.noiseBuffer) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2200;
      filter.Q.value = 3;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.25, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
      s.connect(filter).connect(g).connect(this.master);
      s.start();
      s.stop(this.ctx.currentTime + 0.65);
    }
  }
  update(camera, room, tension) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const f = { x: 0, y: 0, z: -1 };
    const q = camera.quaternion; // Quaternion-vector rotation without a library dependency.
    const rotate = (v) => {
      const tx = 2 * (q.y * v.z - q.z * v.y),
        ty = 2 * (q.z * v.x - q.x * v.z),
        tz = 2 * (q.x * v.y - q.y * v.x);
      return {
        x: v.x + q.w * tx + q.y * tz - q.z * ty,
        y: v.y + q.w * ty + q.z * tx - q.x * tz,
        z: v.z + q.w * tz + q.x * ty - q.y * tx
      };
    };
    const forward = rotate(f),
      up = rotate({ x: 0, y: 1, z: 0 }),
      pose = {
        positionX: camera.position.x,
        positionY: camera.position.y,
        positionZ: camera.position.z,
        forwardX: forward.x,
        forwardY: forward.y,
        forwardZ: forward.z,
        upX: up.x,
        upY: up.y,
        upZ: up.z
      };
    // Keep a bad camera sample from throwing every frame before rendering.
    if (!Object.values(pose).every(Number.isFinite)) return;
    for (const [key, v] of Object.entries(pose)) if (l[key]) l[key].value = v;
    if (this.ready) {
      this.drone.frequency.setTargetAtTime(48 - room * 4, this.ctx.currentTime, 0.8);
      this.droneGain.gain.setTargetAtTime(
        0.01 + room * 0.003 + tension * 0.015,
        this.ctx.currentTime,
        0.4
      );
      this.undertone.frequency.setTargetAtTime(49.7 - room * 3.7, this.ctx.currentTime, 0.8);
      this.undertoneGain.gain.setTargetAtTime(
        0.003 + room * 0.002 + tension * 0.01,
        this.ctx.currentTime,
        0.5
      );
      this.ambienceGain?.gain.setTargetAtTime(
        this.ctx.currentTime < this.duckUntil ? 0.001 : 0.065 + room * 0.007 + tension * 0.045,
        this.ctx.currentTime,
        0.5
      );
    }
  }
  monster(position, moving = true) {
    if (!this.ctx || !moving || this.ctx.currentTime < this.nextVoice) return;
    this.nextVoice = this.ctx.currentTime + 7 + Math.random() * 7;
    this.play(
      Math.random() < 0.5 ? 'horror_ghost_01' : 'horror_ghost_05',
      0.22,
      0.82 + Math.random() * 0.12,
      position
    );
  }
}
