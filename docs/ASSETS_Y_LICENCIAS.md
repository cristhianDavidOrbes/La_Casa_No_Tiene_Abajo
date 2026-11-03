# Procedencia y licencias - versión activa

Descargas verificadas 27-28 de septiembre de 2026. No se publica el proyecto. CC0 se aplica a los recursos indicados, no a los PDF de clase ni automáticamente a todo el juego.

## Modelos CC0 descargados

| Recurso / autor | Fuente | Uso |
|---|---|---|
| Furniture Kit 2 / Kenney | https://kenney.nl/assets/furniture-kit | Libros, cajas, alfombra, apliques, altavoces y teclado. Para el susto de las tres estanterías se extrajo un libro individual de `books.glb`, conservando sus triángulos; se instancian 45 libros independientes con distintos colores y tamaños. |
| Space Station Kit / Kenney | https://kenney.nl/assets/space-station-kit | Tuberías y conmutadores. |
| Modular House / Keith, Fertile Soil Productions | https://opengameart.org/content/modular-house-3d-models | Módulos OBJ de suelo, paredes, molduras, puerta, ventana y cortinas. |
| Television 02 / Benny Weimer | https://polyhaven.com/a/television_02 | Televisores; material de emisión adaptado al cristal original. |
| ArmChair 01 / Kirill Sannikov | https://polyhaven.com/a/ArmChair_01 | Sillones. |
| Vintage Cabinet 01 / Rico Cilliers | https://polyhaven.com/a/vintage_cabinet_01 | Armarios antiguos. |
| Side Table 01 / James Ray Cock | https://polyhaven.com/a/side_table_01 | Mesa junto a la entrada. |
| Wooden Bookshelf Worn / Ulan Cabanilla | https://polyhaven.com/a/wooden_bookshelf_worn | Estanterías. |
| Vintage Radio Transceiver / Mateusz Sadek | https://polyhaven.com/a/vintage_radio_transceiver | Radio de mantenimiento. |
| Power Box 01 / Rico Cilliers, Yann Kervran | https://polyhaven.com/a/power_box_01 | Cuadros eléctricos. |
| Paper Debris / Paul Wortmann | https://opengameart.org/content/3d-dungeon-debris-paper | Cartas físicas de papel envejecido. |
| Hanging Industrial Lamp / Kuutti Siitonen | https://polyhaven.com/a/hanging_industrial_lamp | Lámpara central. |
| Wooden Table 02 / Serhii Khromov | https://polyhaven.com/a/wooden_table_02 | Mesas y escritorios. |
| Painted Wooden Chair 01 / Kuutti Siitonen | https://polyhaven.com/a/painted_wooden_chair_01 | Silla de taller. |
| Vintage Video Camera / James Ray Cock, Jenelle van Heerden | https://polyhaven.com/a/vintage_video_camera | Equipo del cuarto de emisión. Es una cámara antigua reutilizada como representación del equipo ficticio, no un modelo exacto de videocasetera VHS. |
| Gothic Statue / Benny Weimer | https://polyhaven.com/a/gothic_statue | Recurso anterior conservado; ya no representa a la criatura activa. |
| VHS Cassette / GGBotNet | https://opengameart.org/content/vhs-cassette-3d | Cinta familiar. |
| Ceramic Fuse / catálogo 3DAssets.dev | https://3dassets.dev/assets/scavengers-loot-library-ceramic-fuse-039023e8 | Fusible. El publicador lo identifica como generado con IA y lo ofrece CC0. Se descargó ya existente; no fue generado por este proyecto. |
| Changing Locker / catálogo 3DAssets.dev | https://3dassets.dev/assets/squash-club-and-racket-workshop-changing-locker-ae30f1aa | Casilleros interactivos. Modelo externo ofrecido CC0; marco, patas y manija conservados. Cuerpo sólido y puerta sustituidos por paneles huecos y una puerta articulada con abertura física para mirar desde dentro. |
| Vintage Flashlight / Omar M. El-Safy, Poly Haven | https://polyhaven.com/a/vintage_flashlight | Linterna CC0 recogible sobre la mesa del archivo, junto a la cinta. Sustituye el modelo anterior; glTF original con mapas 1K y dependencias verificadas mediante MD5 el 30 de septiembre de 2026. Mantiene un solo destello. |
| Dropped Flashlight / catálogo 3DAssets.dev | https://3dassets.dev/assets/halloween-slasher-street-dropped-flashlight-6285f107 | Modelo anterior conservado en disco; ya no se carga en el juego. |

Los modelos se instancian, escalan y colocan para componer las habitaciones. Se adaptan materiales y coordenadas UV; no se atribuye la distribución del nivel a los autores de los modelos. Colliders, partículas y cámaras son componentes de programación, no assets de mobiliario.

## Texturas y sonido CC0

- Wood Floor / Dimitrios Savva: https://polyhaven.com/a/wood_floor
- Painted Plaster Wall / Amal Kumar: https://polyhaven.com/a/painted_plaster_wall
- Dirty Carpet / Rohit Seervi: https://polyhaven.com/a/dirty_carpet
- Concrete Wall 003 / Dimitrios Savva y Rico Cilliers: https://polyhaven.com/a/concrete_wall_003 (se conserva como recurso previo).
- Impact Sounds / Kenney: https://kenney.nl/assets/impact-sounds
- Abandoned passages / congusbongus: https://opengameart.org/content/abandoned-passages-horror-ambience-loop
- Horror Hit Soundpack 1 / psychhead_: https://opengameart.org/content/horror-hit-soundpack-1
- Horror scream1 / Vinrax: https://opengameart.org/content/horror-scream1
- Ghost Monster Voice Moaning & Growling / qubodup: https://opengameart.org/content/ghost-monster-voice-moaning-growling

Los cuatro recursos de terror anteriores están publicados como CC0 en sus páginas. Descargas originales, hashes, selección de archivos y procesamiento local en `docs/SONIDOS_TERROR_CC0.md`. Se precargan desde el servidor local; no hay descargas de sonidos durante una persecución ni un jumpscare.

Se incluyen mapas 1K de color, normales y rugosidad. Licencia Poly Haven: https://polyhaven.com/license. CC0: https://creativecommons.org/publicdomain/zero/1.0/. Paquetes originales y metadatos de descarga en sources; licencias de Kenney en docs/licencias. Los JSON de Poly Haven incluyen URL, tamaño y MD5. El script download-haven.ps1 valida las dependencias de los modelos.

## Contenido del proyecto

Historia, cartas, interfaz, lógica, distribución, cartelas de vídeo y guiones son contenido realizado para el juego. Las cinco emisiones y el final contienen video H.264/audio AAC; la voz se sintetizó localmente con Microsoft Helena Desktop y se procesó con FFmpeg. No se presentan como vídeos CC0 descargados. El CCTV es otra cámara de la escena. No se utilizan servicios de IA durante la partida.

## Criatura generada: excepción solicitada posteriormente

El usuario proporcionó slender humanoid 3d model.glb, cuyo generador declara Tripo. Archivo activo: public/assets/creature/el-inquilino-tripo-repaired.glb. Se repararon localmente las transformaciones y pesos del esqueleto de 55 huesos, conservando geometría y los tres archivos originales de textura. No se declara CC0 ni se presupone autorización comercial. La referencia T-pose se generó previamente para el usuario; detalles técnicos en docs/CREATURA.md. No hubo nueva generación remota ni consumo de créditos en esta revisión.

Las versiones originales de criatura, fusible y cinta siguen recuperables en sources/unused-ai-prototype; ninguna de esas reconstrucciones anteriores se carga como criatura activa. Las otras reconstrucciones y las descargas exploratorias no usadas no forman parte del entorno.

Three.js, cannon-es (Cannon.js moderno) y Vite: MIT, licencias de sus paquetes. Los PDF suministrados por el usuario se conservan en docs/referencias exclusivamente como referencia local.
