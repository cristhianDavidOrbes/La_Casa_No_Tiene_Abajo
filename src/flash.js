export const FLASH_DURATION = 0.45,
  STUN_DURATION = 3,
  FLASH_COOLDOWN = 0.9,
  FLASH_CHARGES = 1;
export function createFlash(charges = FLASH_CHARGES) {
  return {
    charges: Math.max(0, Math.min(FLASH_CHARGES, Math.floor(charges))),
    remaining: 0,
    cooldown: 0,
    hit: false
  };
}
export function triggerFlash(flash) {
  if (flash.charges <= 0 || flash.cooldown > 0) return false;
  flash.charges--;
  flash.remaining = FLASH_DURATION;
  flash.cooldown = FLASH_COOLDOWN;
  flash.hit = false;
  return true;
}
export function tickFlash(flash, dt) {
  flash.remaining = Math.max(0, flash.remaining - dt);
  flash.cooldown = Math.max(0, flash.cooldown - dt);
}
export function hitFlash(flash, enemy, inBeam) {
  if (flash.remaining <= 0 || flash.hit || !inBeam) return false;
  flash.hit = true;
  enemy.stun(STUN_DURATION);
  return true;
}
