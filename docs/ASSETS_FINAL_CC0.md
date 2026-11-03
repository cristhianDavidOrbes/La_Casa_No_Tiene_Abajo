# Recursos CC0 para el final

Licencias verificadas en las páginas del autor/distribuidor el 4 de octubre de 2026. Los archivos de ejecución están en `public/assets/ending/`; no necesitan descargas externas durante la partida.

| Archivo | Autor y recurso | Fuente y licencia | Adaptación |
| --- | --- | --- | --- |
| `protagonist.glb` | Quaternius, Casual Character / Ultimate Modular Men Pack | [Modelo publicado por Quaternius](https://poly.pizza/m/kZ3DmIoGip), [paquete oficial](https://quaternius.com/packs/ultimatemodularcharacters.html). Ambos identifican CC0. | GLB original conservado; ropa de manga larga, pantalón, pelo y calzado; rig y animaciones originales. Escala y cinta se ajustan en la escena. |
| `house.glb` | Keith at Fertile Soil Productions, Modular House | [Publicación del autor en OpenGameArt, CC0](https://opengameart.org/content/modular-house-3d-models) | Ensamblado de módulos OBJ originales de pared exterior, tejado, ventanas, contraventanas y chimenea. Añadidos remates y pórtico, color envejecido, medidas de la sala real. No contiene suelo interior ni hoja de puerta: se usa la puerta animada del juego. |
| `neighbor-house.glb` | Kenney, City Kit (Suburban), `building-type-a.glb` | [Kenney, CC0](https://kenney.nl/assets/city-kit-suburban) | Modelo original, usado para casas del entorno. |
| `road.glb` | Kenney, City Kit (Roads), `road-straight.glb` | [Kenney, CC0](https://kenney.nl/assets/city-kit-roads) | Pieza original de carretera, repetida y escalada en el exterior. |
| `ground_diffuse.jpg`, `ground_normal.jpg`, `ground_roughness.jpg` | eye-candy.xyz / Poly Haven, Forest Floor | [Recurso](https://polyhaven.com/a/forest_floor), [licencia CC0 de Poly Haven](https://polyhaven.com/license) | Mapas de color, normal OpenGL y rugosidad en 1K. Se emplean como material del terreno; no se usa desplazamiento pesado. |

CC0 permite copiar, modificar y redistribuir estos recursos, incluido uso comercial, sin atribución obligatoria. Se conserva la procedencia por trazabilidad. Esto no declara CC0 el código, otros modelos, sonidos ni todo el juego.

## Fuentes conservadas

- `sources/ending/protagonist-original.glb`: copia del GLB descargado de `https://static.poly.pizza/90a9e2d4-053f-42f1-99a2-8f5e1180ea7f.glb`.
- `sources/ending/casual-character-page.html` y `quaternius-source-page.html`: páginas de procedencia.
- `sources/ending/city-kit-roads.zip` y `city-kit-suburban.zip`: paquetes originales, con sus `License.txt` dentro de las carpetas extraídas `roads/` y `suburban/`.
- `sources/ending/embed-kenney.mjs`: empaqueta la paleta correspondiente dentro de cada GLB; carretera y casa vecina no comparten una ruta de textura externa ni requieren archivos adicionales.
- `sources/modular_house_collection.zip` y `sources/modular-house/`: paquete modular original ya usado en el juego.
- `sources/ending/forest_floor.json`: manifiesto público de Poly Haven, con URL y MD5 de cada resolución.
- `sources/ending/build-house.mjs`: ensamblado reproducible de la casa. Ejecutar `node sources/ending/build-house.mjs` desde el proyecto regenera exclusivamente `public/assets/ending/house.glb`.

## Contrato técnico

### Casa principal

- Ejes Three.js: Y arriba; fachada de entrada hacia +Z.
- Se coloca en el origen, escala 1. El cuerpo rodea la sala de 10 × 12 × 4 m; no normalizar con su caja delimitadora total.
- Abertura: X entre −3.9 y −2.5; Y entre 0 y 2.55; plano de la puerta Z = 6.
- Pórtico: superficie superior Y = 0, X entre −5.05 y −1.05, Z entre 6.05 y 8.65. Los postes quedan fuera del acceso.
- Envolvente total con tejado, chimenea y pórtico: X [−5.7, 5.7], Y [−0.16, 6.725], Z [−6.7, 8.725].
- 3634 triángulos; GLB autónomo sin texturas/buffers externos. Fachada y módulos CC0 más piezas de remate generadas para encajar con el nivel.

### Protagonista

- 4 mallas skinned (cuerpo, cabeza, piernas y pies); 62 articulaciones compartidas por sus skins; 24 clips.
- Clips relevantes: `CharacterArmature|Walk`, `CharacterArmature|Idle`, `CharacterArmature|Idle_Neutral`, `CharacterArmature|Interact`.
- El archivo conserva transformaciones de importación: armature y mallas con escala 100, coordenadas de hueso pequeñas. No aplicar escalas destructivas al esqueleto. Usar un grupo padre para ajustar altura y compensar la escala mundial al adjuntar la cinta a la muñeca.
- Tras GLTFLoader los nombres útiles son `WristL`, `WristR`, `Head`, `FootL`, `FootR`.
- Altura en pose neutral aproximadamente 1.85 m, frente +Z. La caja varía con la animación.

### Entorno

- Carretera original: X/Z [−0.5, 0.5], Y [0, 0.02].
- Casa vecina original: X [−0.65, 0.65], Z [−0.514069, 0.514069], altura 0.833541.
- Suelo: normal OpenGL; mapa de color en sRGB y mapas de datos sin corrección de color.

## Rendimiento

Los modelos y mapas se precargan junto al resto del juego. La casa utiliza pocos triángulos y materiales sin descargas nuevas. La carretera y casas vecinas reutilizan geometría. Se evita añadir texturas de 4K/8K, vídeos externos o personajes sin rig para el plano final. El coste real del render depende del dispositivo y la resolución; estos tamaños no son una garantía universal de 60 FPS.
