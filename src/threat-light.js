const clamp = (n) => Math.max(0, Math.min(1, n));
function pulse(phase, near, comfort) {
  const slow = 0.5 + 0.5 * Math.sin(phase + Math.sin(phase * 0.19) * 1.4);
  const flutter = 0.5 + 0.5 * Math.sin(phase * 2.17 + Math.sin(phase * 0.31));
  const irregular = clamp(slow * 0.72 + flutter * 0.28);
  if (near) return comfort ? 0.65 + 0.2 * slow : 0.54 + 0.4 * irregular;
  return comfort ? 0.14 + 0.36 * slow : 0.02 + 0.48 * irregular;
}
export function flickerFactor({ lightRoom, monsterRoom, distance, time, comfort = false }) {
  if (monsterRoom === null || monsterRoom === undefined) return 1;
  const roomsApart = Math.abs(lightRoom - monsterRoom);
  if (roomsApart > 1) return 1;
  const proximity = Number.isFinite(distance) ? clamp(1 - distance / 14) : 0;
  return pulse(
    time * (comfort ? 1.3 : 4 + proximity * 10 + (roomsApart === 0 ? 3 : 0)) + lightRoom * 1.73,
    roomsApart === 1,
    comfort
  );
}

export class ThreatLightState {
  constructor(room) {
    this.room = room;
    this.reset();
  }
  reset() {
    this.same = 0;
    this.near = 0;
    this.proximity = 0;
    this.phase = this.room * 1.73;
    this.factor = 1;
  }
  update(dt, { monsterRoom, distance = Infinity, comfort = false }) {
    const apart =
      monsterRoom === null || monsterRoom === undefined
        ? Infinity
        : Math.abs(this.room - monsterRoom);
    // Fade occupancy, not the pulse itself: fast flicker remains visible, while
    // room changes blend over roughly a second without snapping light levels.
    const blend = 1 - Math.exp(-3 * Math.max(0, dt));
    this.same += (Number(apart === 0) - this.same) * blend;
    this.near += (Number(apart === 1) - this.near) * blend;
    const proximity = apart <= 1 && Number.isFinite(distance) ? clamp(1 - distance / 14) : 0;
    this.proximity += (proximity - this.proximity) * (1 - Math.exp(-4 * Math.max(0, dt)));
    this.phase += dt * (comfort ? 1.3 : 4 + this.proximity * 10 + this.same * 3);
    this.factor =
      1 +
      this.same * (pulse(this.phase, false, comfort) - 1) +
      this.near * (pulse(this.phase, true, comfort) - 1);
    return this.factor;
  }
}
