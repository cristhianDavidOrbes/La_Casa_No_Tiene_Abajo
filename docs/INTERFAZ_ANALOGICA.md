# Interfaz interactiva — 30 septiembre 2026

## Implementación

El menú utiliza una cámara de la sala 3D real. No utiliza una imagen como fondo del entorno. La cámara queda a un lado del sillón y mira al televisor; la pantalla del CRT muestra estática animada.

Las imágenes de la carpeta output/ui-concepts-2026-09-29 guiaron el diseño. Los botones y textos son HTML, las perillas/agujas/pictogramas/carretes son piezas SVG independientes y las superficies se dibujan con CSS y una textura de metal generada. No hay solicitudes de IA durante el juego.

- Inicio: título marfil, selección ámbar, Comenzar/Continuar/Ajustes, navegación por teclado.
- Ajustes: controles con valor visible, persistidos en navegador, accesibles desde inicio o pausa.
- Radio: dial por arrastre circular, rueda y teclas continuas; escala y medidor analógico ligados a frecuencia.
- Cinta: giro manual/tecla/botón mantenido; ambos carretes giran al rebobinar, la banda se acumula en el izquierdo y se vacía en el derecho.
- Orientación: tres entradas y teclas con sillas; conserva pistas aleatorias y no entrega respuestas.
- Carga: cassette con carretes animados y progreso real de recursos/texturas/shaders.
- HUD: marcas de visor, información de borde, aliento, destello único, texto legible sobre el entorno.

## Activos

- public/assets/ui/aged-metal.png: textura de los aparatos. Generada con imagegen integrado.
- output/ui-concepts-2026-09-29/sala-limpia-solo-referencia.png: variante limpia generada antes de la aclaración del usuario. No se carga en el juego, se conserva únicamente como referencia.
- src/ui-art.js: piezas vectoriales móviles.
- output/ui-concepts-2026-09-29/inicio-implementado.jpg: captura del inicio funcional sobre la sala 3D.

La perilla gira con un único centro SVG (50% / 50% de su viewBox). El aro permanece fijo; no se combinan una rotación con pivote SVG y un segundo transform-origin CSS.

## Prompts finales

### Metal (activo utilizado)

```text
Use case: stylized-concept. Asset type: subtle tileable material texture for functional 2D horror-game radio, cassette rewinder and orientation panels.
Reference image: material/style reference only. Extract the worn dark brown-black metal faceplate material appearance of this analog radio, not its objects or layout. Generate a full-frame flat orthographic close-up texture of this aged almost black oxidized metal, faint amber/copper worn edges of sparse irregular scratches, fine surface grain, slight greasy patina. Uniform diffuse neutral lighting, no dimensional relief shadows, no bevels. Most of the texture must stay quiet near-black so live ivory typography remains readable. Seamless/tileable edges. NO radio, NO panel border, NO dial, NO speaker, NO lettering, NO symbols, NO text, NO furniture, NO lights, NO buttons, NO gradients, NO watermark. One continuous 16:9 texture plate with consistent density.
```

### Fondo limpio (solo referencia)

```text
Use case: precise-object-edit. Asset type: production game main-menu background plate, landscape 16:9.
Input image is the approved main-menu mockup of the actual game room.
Remove ALL overlaid UI and lettering from this image: the large title on the left, archive subtitle, start/continue/settings buttons and their triangle/underline, headphone icon and footer. Inpaint only those areas with the underlying same dark curtain, worn wall, shadows and foreground chair. Keep the entire physical scene unchanged: exact camera perspective and furniture positions, silver CRT television with buttons below screen on the simple wooden table, bookcase, armchair and rug, fuse box on the right wall, ceiling bulb and upside-down chair. Preserve warm amber lighting and cool CRT static. Do not add new furniture, change the geometry or improve the room into a different design. NO text, NO UI, NO symbols, NO watermarks anywhere. The left side must retain the same dark negative space for functional HTML title and controls to be overlaid later. Deliver only the clean background plate.
```

