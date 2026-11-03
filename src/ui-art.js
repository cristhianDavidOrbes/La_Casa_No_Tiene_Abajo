// Small vector parts stay independent of the background and move with the controls.
export function chairIcon(surface = 'SUELO') {
  const rotation = { SUELO: 0, PARED: -90, TECHO: 180 }[surface] ?? 0;
  return `<svg class="chair-icon" viewBox="0 0 120 120" aria-hidden="true"><g transform="rotate(${rotation} 60 60)" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M20 100H100M36 94V59H80V94M38 58V23H77V58M39 28H76M38 59L78 59M43 95V65M74 95V65"/></g></svg>`;
}
export function reelArt() {
  return `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="#bbad8d" stroke="#e2d6b8" stroke-width="2"/><circle cx="60" cy="60" r="47" fill="#645a44" stroke="#dac7a1" stroke-width="3"/>${Array.from({ length: 6 }, (_, i) => `<path d="M52 17H68L73 38L60 44L47 38Z" fill="#d9c7a0" stroke="#aa9878" stroke-width="2" transform="rotate(${i * 60} 60 60)"/>`).join('')}<circle cx="60" cy="60" r="23" fill="#c9b895" stroke="#ece0bf" stroke-width="2"/><path d="M55 49H65L72 55V65L65 72H55L48 65V55Z" fill="#24221b" stroke="#776a50" stroke-width="3"/><circle cx="60" cy="60" r="54" fill="none" stroke="#342b21" stroke-width="1"/></svg>`;
}
export function meterArt() {
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const angle = ((-60 + i * 6) * Math.PI) / 180,
      r1 = i % 5 === 0 ? 60 : 68,
      r2 = 78;
    return `<path d="M${110 + Math.sin(angle) * r1} ${100 - Math.cos(angle) * r1}L${110 + Math.sin(angle) * r2} ${100 - Math.cos(angle) * r2}" stroke="${i > 15 ? '#b35230' : '#dfb76f'}" stroke-width="${i % 5 === 0 ? 3 : 2}"/>`;
  }).join('');
  return `<svg viewBox="0 0 220 124" aria-hidden="true"><path d="M35 55Q110 -8 185 55" fill="none" stroke="#9d7a43" stroke-width="1"/>${ticks}<text x="110" y="83" fill="#c6a165" text-anchor="middle" font-size="9" font-family="Georgia">NIVEL DE SEÑAL</text><g id="radio-meter-needle"><path d="M110 102V30" stroke="#ffc477" stroke-width="2"/><circle cx="110" cy="100" r="8" fill="#3d3020" stroke="#ae8650"/></g></svg>`;
}
export function mountInstrumentArt() {
  for (const id of ['reel-left', 'reel-right']) document.getElementById(id).innerHTML = reelArt();
  for (const spool of document.querySelectorAll('.loading-spool')) spool.innerHTML = reelArt();
  document.getElementById('radio-vu').innerHTML = meterArt();
}
