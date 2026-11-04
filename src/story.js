import { createPuzzle, validPuzzle } from './orientation-puzzle.js';
import { chooseLockerRooms, validLockerRooms } from './locker.js';
export const SAVE_KEY = 'casa-sin-abajo-v2';
export function captureCheckpoint(state) {
  return {
    ...state,
    room: 4,
    tape: true,
    rewound: true,
    inserted: false,
    released: false,
    flashCharges: 1,
    won: false,
    visited: [...new Set([...state.visited, 4])]
  };
}
export const fresh = () => ({
  version: 2,
  room: 0,
  puzzle: createPuzzle(),
  lockers: chooseLockerRooms(),
  flashlight: false,
  haunts: [],
  flashCharges: 1,
  relays: [false, false, false],
  letterRead: false,
  watched: false,
  fuse: false,
  tape: false,
  rewound: false,
  inserted: false,
  released: false,
  visited: [0],
  notes: [],
  elapsed: 0,
  channel: 0,
  frequency: 0,
  won: false
});
export function parseSave(raw) {
  try {
    const s = JSON.parse(raw);
    if (
      !s ||
      s.version !== 2 ||
      !Number.isInteger(s.room) ||
      s.room < 0 ||
      s.room > 4 ||
      !Array.isArray(s.relays) ||
      s.relays.length !== 3 ||
      !s.relays.every((x) => typeof x === 'boolean') ||
      !Array.isArray(s.notes) ||
      !Array.isArray(s.visited)
    )
      return null;
    if (
      (s.room > 0 && !s.relays[0]) ||
      (s.room > 1 && !s.relays[1]) ||
      (s.room > 2 && !s.relays[2])
    )
      return null;
    const defaults = fresh();
    return {
      ...defaults,
      ...s,
      elapsed: Math.max(0, Number(s.elapsed) || 0),
      puzzle: validPuzzle(s.puzzle)
        ? { ...s.puzzle, observed: (s.puzzle.observed || []).filter((i) => [0, 1, 2].includes(i)) }
        : createPuzzle(),
      lockers: validLockerRooms(s.lockers) ? s.lockers : defaults.lockers,
      flashlight: typeof s.flashlight === 'boolean' ? s.flashlight : false,
      haunts: Array.isArray(s.haunts) ? s.haunts.filter((n) => typeof n === 'string') : [],
      flashCharges: Number.isInteger(s.flashCharges) ? Math.max(0, Math.min(1, s.flashCharges)) : 1,
      notes: s.notes.filter((n) => typeof n === 'string')
    };
  } catch {
    return null;
  }
}
export function objective(s) {
  if (!s.letterRead) return 'Tengo que leer la carta de Julián. ¿Por qué me pidió venir?';
  if (!s.fuse && !s.relays[0])
    return 'El motor no tiene corriente. Julián dejó un fusible en la mesa junto a la puerta.';
  if (!s.relays[0])
    return 'Tengo el fusible. Debo instalarlo en el panel 01, junto al acceso de servicio.';
  if (!s.relays[1])
    return s.room === 0
      ? 'Tengo que llegar al pasillo. El umbral junto al suelo, a la derecha, permite ir y volver.'
      : 'Necesito sincronizar el motor del taller. La radio está sobre el escritorio: 83.0 MHz.';
  if (!s.relays[2])
    return s.room < 2
      ? 'El taller está después del pasillo. Debo cruzar el umbral del extremo opuesto.'
      : 'Tengo que observar las sillas de madera de la sala, el pasillo y el taller: ¿sus patas tocan suelo, pared o techo? El panel indica en qué orden recordar esas habitaciones.';
  if (!s.tape)
    return s.room === 3
      ? 'Aquí está el archivo. Debo recoger la cinta «PARA VOLVER» del mueble central.'
      : 'La cinta está en el archivo familiar, después del taller. Tengo que encontrar «PARA VOLVER».';
  if (!s.rewound)
    return s.room === 4
      ? 'La cinta está al final. Tengo que colocarla en el rebobinador sobre el escritorio.'
      : 'Tengo la cinta, pero está al final. El cuarto de emisión, después del archivo, tiene un rebobinador.';
  if (!s.inserted)
    return s.room === 0
      ? 'He vuelto a la sala. Tengo que insertar «PARA VOLVER» en el receptor del televisor.'
      : 'Debo volver a la sala por los mismos umbrales por los que entré. Si encuentro la linterna, tendré un solo destello para aturdirlo.';
  if (!s.released) return 'La cinta está reproduciéndose. Julián pidió que no la interrumpiera.';
  return 'La señal se ha apagado. Ya puedo salir por la puerta de entrada y llevarme la cinta.';
}
export const letter = `Antes de que vacíen mi casa, salva la cinta PARA VOLVER del archivo del taller. Es la única copia de aquella tarde con ustedes.\n\nEsta casa tiene comportamientos extraños. Los umbrales también te dejan regresar. Dejé una grabación de mantenimiento en el canal 02 por si necesitas ayuda.\n\nAntes de irte, reproduce la cinta en el televisor de la sala.\n\nConfía en mí una vez más.`;
export const notes = {
  welcome: { title: 'Carta de Julián', body: letter },
  tape: {
    title: 'Instrucciones / Canal 02',
    body: 'El motor de servicio necesita un fusible. El repuesto está sobre la mesa junto a la entrada. Una vez abierto, el paso junto al suelo funciona en ambos sentidos. No hay que saltar a una caída sin retorno.'
  },
  frequency: {
    title: 'Motor del taller / 83.0 MHz',
    body: 'La radio del pasillo controla el segundo motor. Ajustar a 83.0 MHz. Si se pierde la señal, el canal 05 conserva la frecuencia. Los pasos que llegan de la pared no son del motor.'
  },
  procedure: {
    title: 'Acceso al archivo',
    body: 'No memorices una combinación: la casa cambia. Hay una silla de madera clara en la sala, otra en el pasillo y otra en el taller. Mira dónde están apoyadas sus patas: suelo, pared o techo. El panel del taller nombra las habitaciones en el orden que necesita. Puedes inspeccionar cada silla con E y anotar lo que ves. La cinta PARA VOLVER está detrás de ese panel.'
  },
  tenant: {
    title: 'Una imagen incompleta',
    body: 'Lo capté en una habitación que no existía. El bucle lo mantiene quieto. Si rebobinas la cinta, intentará seguirte. Hay una linterna sobre la mesa del archivo: solo conserva un destello. Si lo alumbras directamente, lo aturde tres segundos. Los casilleros pueden ocultarte, pero él buscará en los cuartos próximos. También atraviesa los umbrales. Vuelve a la sala; el receptor principal puede encerrarlo de nuevo.'
  },
  archive: {
    title: 'PARA VOLVER',
    body: 'La cinta familiar contiene la última grabación de Julián. Está al final del bucle de retención. Antes de volver al salón, hay que usar el rebobinador del cuarto de emisión.'
  },
  truth: {
    title: 'Último registro de Julián',
    body: 'La casa no inventó al Inquilino: lo traje en una imagen. Separé la señal en tres circuitos. La copia PARA VOLVER conserva el último fotograma vacío. Si lo reproduces en el receptor principal, dejará de haber sitio para él fuera de la pantalla.'
  },
  relay0: {
    title: 'Motor 01 / Acceso de servicio',
    body: 'Fusible instalado. El umbral entre la sala y el pasillo permanece abierto en ambos sentidos.'
  },
  relay1: {
    title: 'Motor 02 / Taller',
    body: 'Radio sincronizada a 83.0 MHz. El acceso al taller está abierto, también de regreso.'
  },
  relay2: {
    title: 'Motor 03 / Archivo',
    body: 'Secuencia correcta. El archivo está abierto. Buscar la cinta PARA VOLVER y llevarla al rebobinador del cuarto de emisión.'
  }
};
