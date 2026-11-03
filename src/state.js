export const SAVE_KEY = 'casa-sin-abajo-v1';
export const fresh = () => ({
  version: 1,
  room: 0,
  relays: [false, false, false],
  watched: false,
  fuse: false,
  notes: [],
  elapsed: 0,
  channel: 0,
  frequency: 0,
  code: [],
  won: false
});
export function parseSave(raw) {
  try {
    const s = JSON.parse(raw);
    if (
      !s ||
      s.version !== 1 ||
      !Number.isInteger(s.room) ||
      s.room < 0 ||
      s.room > 2 ||
      !Array.isArray(s.relays) ||
      s.relays.length !== 3 ||
      !s.relays.every((x) => typeof x === 'boolean') ||
      !Array.isArray(s.notes)
    )
      return null;
    if ((s.room > 0 && !s.relays[0]) || (s.room > 1 && !s.relays[1])) return null;
    return {
      ...fresh(),
      ...s,
      elapsed: Math.max(0, Number(s.elapsed) || 0),
      notes: s.notes.filter((n) => typeof n === 'string')
    };
  } catch {
    return null;
  }
}
export function objective(s) {
  if (!s.watched) return 'Siéntate en el sillón y sintoniza el canal 02.';
  if (!s.fuse && !s.relays[0]) return 'Recoge el fusible de la mesa junto a la puerta.';
  if (!s.relays[0]) return 'Coloca el fusible en la conexión 01, junto a la trampilla.';
  if (s.room === 0) return 'La trampilla está abierta. Camina hacia el hueco y déjate caer.';
  if (s.room === 1 && !s.relays[1])
    return 'Encuentra la frecuencia de mantenimiento. Sintoniza la radio del pasillo.';
  if (s.room === 1) return 'Sigue el polvo. Déjate caer por el segundo hueco.';
  if (!s.relays[2]) return 'Restablece el circuito: PARED → TECHO → SUELO. Busca el tablero.';
  return 'El Inquilino se detiene bajo la linterna. Alcanza la salida e introduce los tres dígitos de las conexiones.';
}
export const notes = {
  welcome: {
    title: '01 / Servicio doméstico',
    body: 'No hay nadie más en la vivienda. En caso de interferencia, siéntese frente al receptor y consulte el CANAL 02. La puerta permanece sellada mientras existan conexiones pendientes.'
  },
  tape: {
    title: '02 / Cinta de mantenimiento',
    body: 'Tres conexiones mantienen estable la vivienda. La primera necesita un fusible. Se dejó uno sobre la mesa, junto a la entrada. Si el suelo deja de ser suelo, no intente detener la caída. Siga el polvo.'
  },
  frequency: {
    title: '03 / Parte de radio',
    body: 'La portadora de mantenimiento permanece en 83.0 MHz. El canal 05 conserva esta frecuencia. No use las voces como referencia: algunas aprenden a imitar la señal.'
  },
  procedure: {
    title: '04 / Restablecimiento',
    body: 'El último circuito debe activarse en este orden: PARED, TECHO, SUELO. El protocolo no cambia aunque la habitación sí lo haga. Cada conexión revela un dígito de la salida.'
  },
  tenant: {
    title: '05 / El Inquilino',
    body: 'Conserva la gravedad de la habitación anterior. Puede estar en una pared aunque sus pasos suenen encima. La luz directa lo detiene. Mantenga el haz sobre él y retroceda hacia la salida. La linterna no se agota.'
  },
  relay0: {
    title: 'CONEXIÓN 01 / 3',
    body: 'Señal doméstica restablecida. Primer dígito de salida: 3.'
  },
  relay1: {
    title: 'CONEXIÓN 02 / 8',
    body: 'Portadora restablecida en 83.0 MHz. Segundo dígito de salida: 8.'
  },
  relay2: {
    title: 'CONEXIÓN 03 / 1',
    body: 'La casa ha aceptado la nueva orientación. Tercer dígito de salida: 1. Ya no necesita que usted permanezca dentro.'
  }
};
