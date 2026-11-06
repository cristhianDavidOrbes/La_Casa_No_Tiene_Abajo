import { Audio, AudioContext as ThreeAudioContext, AudioListener, PositionalAudio } from 'three';

// SEMANAS 3 y 9: el oyente viaja con la cámara y los efectos tienen posición 3D.
// Para exponer: init() conecta AudioListener; play() crea Audio/PositionalAudio.
// La mezcla, la precarga y los efectos específicos conservan las reglas del juego.
const FILES = [
  ...Array.from({ length: 5 }, (_, i) => `footstep_wood_00${i}`),
  ...Array.from({ length: 5 }, (_, i) => `footstep_concrete_00${i}`),
  'impactwood_heavy_000',
  'impactmetal_medium_000',
  'impactglass_light_000',
  'horror_ambience',
  'horror_hit_low',
  'horror_hit_high',
  'horror_hit_mid',
  'horror_scream',
  'jumpscare_chosen_17',
  'rear_chosen_09',
  'radio_whispers',
  'tape_rewind'
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
    this.preparing = null;
    this.duckUntil = 0;
  }
  preload() {
    if (!this.preloading)
      this.preloading = Promise.all(
        FILES.map(async (name) => {
          try {
            const response = await fetch('/sounds/' + name + '.ogg');
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
  // Semana 3: decodificar durante la carga, activar el sonido con el primer clic.
  prepare() {
    if (this.preparing) return this.preparing;
    this.preparing = (async () => {
      const decoder = new OfflineAudioContext(1, 1, 48000);
      const files = await this.preload();
      await Promise.all(
        files.filter(Boolean).map(async ([name, data]) => {
          try {
            this.buffers[name] = await decoder.decodeAudioData(data);
          } catch (error) {
            console.warn('Audio no decodificable', name, error);
          }
        })
      );
      this.preloading = null;
    })();
    return this.preparing;
  }
  async init(camera, scene) {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    ThreeAudioContext.setContext(this.ctx);
    // SEMANA 3: la cámara representa los oídos del jugador.
    this.listener = new AudioListener();
    camera.add(this.listener);
    this.scene = scene;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -5;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    this.master.connect(limiter).connect(this.ctx.destination);
    this.listener.gain.disconnect();
    this.listener.gain.connect(this.master);
    await this.prepare();
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
  play(name, volume = 0.3, rate = 1, position = null, anchor = null) {
    if (!this.buffers[name] || !this.ctx) return;
    // SEMANA 9, diapositivas 9–11: el emisor espacial permite localizar un sonido.
    const sound = position ? new PositionalAudio(this.listener) : new Audio(this.listener);
    sound.setBuffer(this.buffers[name]).setVolume(volume).setPlaybackRate(rate);
    if (position) {
      // Al alejarnos del emisor se reduce su volumen; la posición es mundial.
      sound.setRefDistance(2).setMaxDistance(25).setRolloffFactor(0.6);
      sound.position.copy(position);
      if (anchor) {
        anchor.add(sound);
        sound.position.set(0, 0, 0);
      } else this.scene.add(sound);
    }
    sound.onEnded = () => {
      sound.isPlaying = false;
      sound.disconnect();
      sound.gain.disconnect();
      sound.removeFromParent();
    };
    sound.play();
    sound.updateMatrixWorld(true);
    return sound;
  }
  radioWhispers(strength, position, anchor) {
    if (!this.ctx || !this.buffers.radio_whispers) return;
    if (!this.radioVoice && strength > 0.001) {
      this.radioVoice = this.play('radio_whispers', 0, 0.85, position, anchor);
      this.radioVoice.setLoop(true);
    }
    if (this.radioVoice) {
      this.radioVoice.gain.gain.setTargetAtTime(strength * 0.8, this.ctx.currentTime, 0.08);
      this.radioVoice.setPlaybackRate(0.8 + strength * 0.14);
    }
  }
  stopRadioWhispers() {
    if (this.radioVoice?.isPlaying) this.radioVoice.stop();
    this.radioVoice = null;
  }
  radioBurst(position) {
    this.stopRadioWhispers();
    this.play('impactmetal_medium_000', 0.65, 0.55, position);
    this.play('impactglass_light_000', 0.55, 0.8, position);
    this.play('horror_hit_high', 0.4, 0.9, position);
    this.tone(48, 0.7, 0.06, position);
  }
  tapeRewind(active, position) {
    if (active && !this.tapeMotor) {
      this.tapeMotor = this.play('tape_rewind', 0.15, 1, position);
      this.tapeMotor?.setLoop(true);
    } else if (!active) this.stopTapeRewind();
  }
  stopTapeRewind() {
    if (this.tapeMotor?.isPlaying) this.tapeMotor.stop();
    this.tapeMotor = null;
  }
  footstep(room, run = false) {
    const type = room === 0 ? 'wood' : 'concrete';
    this.play(
      `footstep_${type}_00${this.stepIndex++ % 5}`,
      run ? 0.18 : 0.13,
      0.83 + Math.random() * 0.16
    );
  }
  switch() {
    this.play('impactmetal_medium_000', 0.18, 1.5);
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
  reveal(position) {
    if (this.buffers.rear_chosen_09) {
      this.play('rear_chosen_09', 0.55, 1, position);
      return;
    }
    this.play('horror_hit_mid', 0.34, 1, position);
  }
  throwBooks(position) {
    this.play('impactwood_heavy_000', 0.5, 0.58, position);
    this.play('horror_hit_low', 0.3, 0.85, position);
    this.play('impactmetal_medium_000', 0.15, 0.55, position);
  }
  bookLanding(position) {
    if (!this.ctx || this.ctx.currentTime < (this.nextBookImpact ?? 0)) return;
    this.nextBookImpact = this.ctx.currentTime + 0.09;
    this.play('impactwood_heavy_000', 0.12, 0.85 + Math.random() * 0.25, position);
  }
  jumpscare(position) {
    if (!this.ctx) return;
    this.duckUntil = this.ctx.currentTime + 3;
    this.ambienceGain?.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.025);
    this.play(
      this.buffers.jumpscare_chosen_17 ? 'jumpscare_chosen_17' : 'horror_scream',
      0.72,
      1,
      position
    );
  }
  update(camera, room, tension) {
    if (!this.ctx) return;
    if (![...camera.position.toArray(), ...camera.quaternion.toArray()].every(Number.isFinite))
      return;
    // AudioListener transforma posición y orientación junto a la cámara.
    camera.updateMatrixWorld(true);
    if (this.ctx.currentTime < (this.nextMix ?? 0)) return;
    this.nextMix = this.ctx.currentTime + 0.1;
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
}
