# Aparición y libros — 30 de septiembre de 2026

## Sonidos elegidos por el usuario

- Jumpscare: opción **17**, Horror scream1 / Vinrax, CC0. Fuente: https://opengameart.org/content/horror-scream1. Archivo activo `public/assets/audio/jumpscare_chosen_17.ogg`.
- Aparición detrás del jugador al verla: opción **09**, Mid 2 del Horror Hit Soundpack 1 / psychhead_, CC0. Fuente: https://opengameart.org/content/horror-hit-soundpack-1. Archivo activo `public/assets/audio/rear_chosen_09.ogg`.
- Son las muestras de la selección, convertidas de MP3 a Vorbis mono 44.1 kHz, hasta 3 segundos, sin cambiar velocidad ni añadir otras capas al sonido seleccionado. La captura dura 3.1 segundos para no cortar el grito al pausar el audio; la aparición continúa desapareciendo tras 0.5 segundos de detectarse la mirada.
- Se precargan con los demás sonidos. Ambos usan el panner HRTF con posición mundial de la cabeza de la criatura. Los golpes de libros y sus aterrizajes también usan posiciones mundiales. Las capas de ambiente y los avisos de interfaz no son fuentes de un monstruo situado en una pared.

## Detección y pose

Se eliminó el filtro adicional que comprobaba la dirección hacia el origen del modelo (sus pies). La detección usa rayos hacia cabeza, cuello, torso, caderas y manos, con tolerancia vertical ampliada para la aparición y comprobación de oclusión. Mirar la cara ya cuenta sin mirar las piernas. Clave de encuentro revisada a `rear-workshop-close-v6` para las partidas guardadas existentes.

La pose de amenaza usa altura de cadera de reposo del propio rig, torso erguido, piernas casi completamente extendidas y manos levantadas por encima de los hombros. La cabeza tiene sacudidas independientes en sus tres ejes. Esta pose no modifica la locomoción del perseguidor ni su escala de 1.2.

## Libros individuales CC0

Fuente comprobada: https://kenney.nl/assets/furniture-kit. Licencia original conservada en `sources/furniture/License.txt`. Modelo original `public/assets/models/books.glb`.

`sources/separate-cc0-books.mjs` extrae el libro frontal que tiene una frontera geométrica completa. No se separan los otros lomos porque comparten caras traseras; eso produciría fragmentos abiertos. `public/assets/models/book-single-1.glb` conserva 28 vértices, 14 triángulos, normales, UV y asignaciones de material originales. Se reutiliza en 45 cuerpos independientes, con variantes de tamaño y color, repartidos entre tres estanterías.

Al pasar cerca de cada estantería los libros salen despedidos con velocidad inicial, giro y gravedad local. Desde la integración del 1 de octubre, cada libro tiene un cuerpo rígido de `cannon-es`: las colisiones, rebotes, fricción y reposo los calcula Cannon, no una animación de caída. Interactúan con muebles, paredes, suelo, personajes y otros libros. El evento se registra una vez por estantería en `state.haunts`; los cuerpos se preparan al iniciar la partida, sin descargar modelos ni reconstruir colisiones durante el susto. Three.js sincroniza posición y orientación con cada cuerpo físico.

El golpe de lanzamiento mezcla el impacto de madera y metal de Kenney (https://kenney.nl/assets/impact-sounds, CC0) con el impacto grave del Horror Hit Soundpack 1. Los aterrizajes usan madera, variando ligeramente el tono y limitando la frecuencia de reproducción. Todas estas fuentes se posicionan en el lugar físico del golpe.

No se ejecutaron pruebas de partida; se comprobó sintaxis y compilación.
