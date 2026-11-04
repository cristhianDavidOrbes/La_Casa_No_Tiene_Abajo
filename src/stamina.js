// Recuperar al caminar o descansar, incluso dentro de pasos, sillones y casilleros.
export function advanceStamina(value, exhausted, dt, { wantsRun, moving, resting, panic = 1 }) {
  if (exhausted && value >= 30 && !wantsRun) exhausted = false;
  const running = wantsRun && moving && !resting && !exhausted && value > 0;
  value = Math.max(0, Math.min(100, value + (running ? -22 * panic : 24) * dt));
  if (value === 0) exhausted = true;
  return { value, exhausted, running };
}
