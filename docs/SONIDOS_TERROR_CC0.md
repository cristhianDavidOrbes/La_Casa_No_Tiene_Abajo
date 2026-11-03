# Sonidos de terror CC0

Integrados el 30 de septiembre de 2026. Se verificó la etiqueta CC0 en cada página de origen. No se presentan estos sonidos como creaciones originales del proyecto.

| Recurso y autor | Página de procedencia | Uso activo |
|---|---|---|
| Abandoned passages / congusbongus | https://opengameart.org/content/abandoned-passages-horror-ambience-loop | `freezer_0.ogg` → `horror_ambience.ogg`: ambiente continuo, 31,4 s, con mezcla progresiva según tensión. |
| Horror Hit Soundpack 1 / psychhead_ | https://opengameart.org/content/horror-hit-soundpack-1 | `Bassy 3.wav`, `High 12.wav`, `Mid 11.wav` → tres golpes para apariciones, arrastres y jumpscare. |
| Horror scream1 / Vinrax | https://opengameart.org/content/horror-scream1 | `scream_horror1_0.mp3` → `horror_scream.ogg`: grito al ser atrapado. |
| Ghost Monster Voice Moaning & Growling / qubodup | https://opengameart.org/content/ghost-monster-voice-moaning-growling | `qubodup-GhostMoan01.wav` y `qubodup-GhostMoan05.wav` → voces posicionales durante encuentros y persecución, sin repetición continua. |

Los créditos y enlaces también figuran en la guía del juego. Licencia de referencia: https://creativecommons.org/publicdomain/zero/1.0/.

## Archivos y procesamiento

- Originales conservados en `sources/cc0-horror/`; el paquete de golpes y su README siguen disponibles.
- Descarga reproducible: `sources/download-cc0-horror.ps1`.
- Extracción de entradas concretas y conversión: `sources/prepare-cc0-horror.ps1`.
- Versiones activas: siete archivos `public/assets/audio/horror_*.ogg`, unos 501 KB en total.
- Conversión local con FFmpeg a Vorbis, 44,1 kHz, estéreo, calidad 4. Normalización de sonoridad, filtrado suave y fundidos en los efectos. El ambiente conserva el bucle original sin cortar su duración.
- Golpes y grito recortados a 1,28 s para que no continúen al reanudar después de la captura. Mezcla en capas con ambiente reducido durante el jumpscare y compresor de protección en la salida.
- Los archivos se solicitan durante la carga inicial y se decodifican una vez al activar audio. Durante la partida se reutilizan buffers y se liberan los nodos de efectos al terminar.
- Las síntesis anteriores se conservan como respaldo si un archivo no está disponible, y como refuerzo grave discreto; no sustituyen a las nuevas grabaciones cuando cargan correctamente.

## SHA-256 de las descargas originales

| Archivo | SHA-256 |
|---|---|
| freezer.ogg | B6AC629AAFAEE43415840153BF3AAAF276735BD5281FF29E09E6FD41E5989CD9 |
| horror_hit_soundpack_1.zip | 4BBDBA64225D2AD2F5D23A04D71CCB18E6567C42F972A7F2DCB66D8ACC5ED4F3 |
| scream_horror1.mp3 | 68A0AD4A8F147F3A895ED17549132B31294A8185822D3D4D5C240053BEF9CF14 |
| qubodup-GhostMoans.zip | 25962D146F4634A93EFA7FBFE9CDE63F4182189CED6105B4F92F23C65D8C2A43 |
