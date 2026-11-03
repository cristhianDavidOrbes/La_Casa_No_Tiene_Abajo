# Relación del juego con las nueve clases

Se revisaron las 191 diapositivas/páginas del ZIP suministrado, incluidas las dos páginas cuyo contenido es una imagen. Los PDF se conservan como referencia local; no se suben al repositorio.

| Clase y fecha | Páginas revisadas | Lo enseñado que aplica al juego |
|---|---:|---|
| 1 · 02/09/2026 | 1–26 | Escena, cámara, renderer, mallas, geometrías, CPU/GPU y bucle `requestAnimationFrame`. La página 2 es la ruta general del curso, no evidencia de que ya se dictaron las semanas 10–12. |
| 2 · Semana 2 | 1–27 | Vite, materiales PBR, texturas, normales, rugosidad, position/rotation/scale, cuaterniones, grupos y eventos resize. |
| 3 · 16/09/2026 | 1–4 | Televisor temático, vídeo, audio espacial, animación y activación multimedia mediante interacción del usuario. |
| 4 · 23/09/2026 | 1–21 | Luces de relleno y focales, sombras, partículas con `Points` y `BufferGeometry`, parpadeos con seno. |
| 5 · 30/09/2026 | 1–21 | Three.js + Cannon-es, cuerpos estáticos/dinámicos/cinemáticos, colisiones, fricción y paso fijo de simulación. |
| 6 · 07/10/2026 | 1–21 | Teclado, saltos por impulso, eventos de impacto, SAP, reposo de cuerpos, seguimiento de cámara y sincronización mesh/body. |
| 7 · 14/10/2026 | 1–23 | `GLTFLoader`, HDRI, IBL, MatCap opcional, rutas públicas y recursos ligeros de resolución 1K. |
| 8 · 21/10/2026 | 1–29 | Modelado en Blender, Python, orígenes y escalas, UV, exportación GLB y presupuesto de recursos web. |
| 9 · 28/10/2026 | 1–19 | Triggers por distancia y `Box3`, zonas sonoras, portales, tiempo de espera, HUD, niebla y partículas. |

## Qué se conserva y por qué

La base es JavaScript, HTML/CSS, Three.js, Cannon-es y Vite, como en las clases. No se añaden frameworks de interfaz ni otro motor físico. Los módulos separan tareas; no son sistemas adicionales.

El HDR aporta reflejos y luz de relleno. Los focos se conservan para sombras, linterna y parpadeos; un mapa global no describe por sí solo una bombilla que falla en una habitación concreta. El fondo sigue siendo la cámara real del juego.

Los recursos se cargan una vez y se reutilizan. No se crean habitaciones o motores al cruzar puertas. Los vídeos se preparan durante la carga inicial y se reproducen después de un gesto del usuario, respetando las restricciones del navegador.

## Ampliaciones necesarias del juego

Estas partes NO aparecen desarrolladas en las diapositivas y se identifican como ampliaciones, no como contenido impartido:

- Gravedad distinta por habitación: aplica vectores, grupos, cuaterniones y fuerzas de Cannon a la mecánica propia de la casa.
- Animación procedural y apoyos IK: permiten adaptar manos/pies al suelo, paredes y muebles. Quitarlos rompe el monstruo.
- Persecución, escondites, puzles, guardado y encuentros: reglas propias construidas con variables, funciones, eventos y distancias.
- Oscuridad por habitación y vídeo del final en el CRT: se conservan los ajustes de materiales y la segunda cámara para que el terror y el desenlace funcionen.
- Preparación de GPU y lectura asíncrona de CCTV: evitan trabajo costoso durante el recorrido. Son medidas de rendimiento, no requisitos demostrados por las clases.

No se añaden controles de órbita, un panel lil-gui ni disparos de proyectiles al juego solo por aparecer en un ejemplo: alterarían el diseño solicitado. Se aplican sus conceptos de cámaras, propiedades, eventos e instanciación donde corresponden.

## Historia del repositorio

El primer commit registra la versión existente. Los siguientes registran cambios reales de esta revisión, por temas y con mensajes en español. No se reconstruyen supuestas clases pasadas ni se cambian fechas para simular trabajo previo.
