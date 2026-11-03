# La casa no tiene abajo

Juego local de terror analógico progresivo, en primera persona. Versión revisada: 28-09-2026.

## Abrir

Doble clic en **INICIAR_JUEGO.cmd**. Abre http://127.0.0.1:5180/ en Chrome, Edge o el navegador de Codex. No abras index.html directamente. Node.js está instalado en este equipo. No requiere Internet durante la partida ni publica datos.

## Jugar

Abre el sobre y lee la carta breve de Julián. WASD/flechas: caminar; ratón: mirar; E: interactuar/sentarse/levantarse; Shift: correr; Espacio: saltar; F: destello (tres por intento); H: recordar objetivo; J: notas; Esc: pausa. Si no se permite capturar el cursor, mantén pulsado el botón izquierdo para mirar. Sentado: 1-5 o mando para cambiar canal.

Hay cinco cuartos y cuatro umbrales de ida y vuelta. Sus entradas se desplazan lateralmente: hay que explorar, no solo caminar en línea recta. La gravedad cambia físicamente al cruzar: puedes seguir moviéndote y mirar; no hay viaje automático de cámara. Al regresar se restaura la gravedad anterior. La amenaza empieza a perseguir solo después de rebobinar la cinta. F emite un destello de 0,45 s. Solo hay tres por intento; un acierto directo, a menos de 12 m y sin paredes de por medio, lo aturde 3 s. Las cargas no se reponen al cambiar de cuarto. Reintentar el punto de control empieza un intento con tres cargas.

## Cambios principales

- Sobre interactivo y carta corta; pensamientos que indican qué hacer.
- TV descargada con vídeo sobre sus 392 triángulos de cristal curvo, sin plano flotante.
- Ventana con abertura real; habitaciones separadas, conductos cerrados y bordes sin caras superpuestas.
- Texturas PBR CC0, alfombra de tejido, mesas ajustadas a sus objetos y lámpara central.
- Canal 02 de 29,1 segundos: al terminar habilita permanentemente el fusible.
- Puzle variable: la posición física de tres sillas indica suelo, pared o techo; el orden de sus habitaciones también cambia en cada partida. Las pistas examinadas se conservan en el registro, sin mostrar la solución.
- Encuentros paranormales graduales: desde el primer cruce, el modelo completo, ampliado a 1,4× para esta aparición, se sitúa detrás del borde sólido del hueco de la habitación anterior. El piso oculta el resto del cuerpo y solo deja ver cabeza y hombros; nunca aparece en el centro del conducto. Si no lo miras pasa al siguiente acceso. Al verlo incluso desde lejos, retrocede por el piso de la habitación anterior durante 0,5 s, sin bajar al conducto ni entrar en tu cuarto, y no vuelve en esa partida. Tras resolver el panel de las sillas en el taller, el monstruo aparece detrás del jugador, lo sigue sin girar con su mirada, alza los brazos y se sacude con movimientos nerviosos. Al verlo, permanece 0,5 s y se desvanece mientras la visión se cierra circularmente. Esta aparición no elimina al monstruo: después hay persecución y sobresalto al ser alcanzado. Al colocar la cinta final, la amenaza solo se retira cuando deja de estar a la vista.
- Entorno con modelos descargados CC0. Monstruo Tripo aportado por el usuario, a escala 1,2× respecto de sus 2,6 m originales, con 55 huesos reparados y cuatro apoyos IK individuales sobre suelo, paredes y mobiliario. Puede trepar a mesas, sillas, cajas, paredes y techo. Aparece en un cuarto distinto al del jugador y persiste entre cuartos. No se declara CC0 la criatura generada.
- Pantalla de carga que prepara texturas y luces antes de jugar. Destello sin cambio de programa de iluminación y lectura asíncrona del CCTV para reducir congelamientos.
- Cruces revisados: habitaciones y colisiones residentes, buffers de mallas preparados al inicio, luces estables y una sombra reutilizada. La cámara conserva el giro físico hasta completar el cambio de gravedad. Los recursos iniciales se cargan por lotes con reintentos ante fallos transitorios del servidor local.

## Puerta y final de la grabación

La entrada tiene una abertura real, marco y hoja con bisagra y colisión Cannon. **E** permite abrirla o cerrarla. El protagonista recuerda su promesa y no abandona la casa antes de reproducir la cinta final.

Tras terminar el canal 03 con la cinta recuperada, **E** en la entrada inicia el final de 34 segundos: la cámara sale primero, el protagonista sale con la cinta, cierra la puerta, la vista se aleja por el exterior y continúa dentro del televisor real de la sala. La cámara revela la sala y el CRT se apaga. No se usan fondos prerenderizados para sustituir la casa ni la sala.

Personaje, casa, carretera y suelo: recursos CC0 con procedencia en `docs/ASSETS_FINAL_CC0.md`. Se preparan durante la carga inicial. La cámara, el esqueleto, la cinta sujeta a la muñeca y el apagado del CRT se restablecen al comenzar otra partida.

## Archivos

- dist: juego compilado listo para iniciar.
- src: código activo; main.js, house.js, asset-fit.js, level.js, architecture.js, physics.js, gravity.js, pursuer.js, creature-motion.js, story.js, audio.js.
- public/assets: modelos, texturas, sonidos y emisiones locales.
- docs: diseño, historia, licencias, verificaciones y PDF de clase.
- sources: paquetes descargados, metadatos, guiones y archivo de prototipos. No se sirve esta carpeta al navegador.
- PROYECTO_LA_CASA_NO_TIENE_ABAJO.pdf: memoria anterior a esta revisión del monstruo. La mecánica actual se describe en docs/CREATURA.md y docs/VERIFICACION.md.

Conserva los 6.316 triángulos y los tres archivos originales de textura del GLB recibido. Las sombras se concentran en la habitación ocupada; el sobresampling se ajusta entre resolución nativa y 1,5× para intentar mantener 60 FPS. No se garantiza un mínimo universal en todo equipo o navegador.

## Desarrollo

Abre la terminal en la carpeta del proyecto, no en otra carpeta de Codex:

```powershell
cd "C:\Users\crist\Desktop\La_Casa_No_Tiene_Abajo"
npm run dev
```

`npx vite` también usa http://127.0.0.1:5180/. Ejecuta solo uno de los dos comandos y deja su terminal abierta. El puerto es fijo: si está ocupado, cierra el servidor anterior con Ctrl+C antes de iniciar otro. `INICIAR_JUEGO.cmd` usa ese mismo puerto para la versión compilada; tampoco debe estar ejecutándose a la vez.

`npm install` instala las dependencias si faltan y `npm run build` actualiza la versión de `dist`. Después de actualizar código, recarga el navegador para descartar una partida que ya hubiera quedado con coordenadas inválidas. No hay botones de QA dentro del juego. Las pruebas automáticas históricas contienen referencias a las físicas anteriores y necesitan migración a Cannon antes de utilizar `npm test`.

El guardado usa el almacenamiento del navegador, por origen y perfil. Continuar restaura el punto de entrada del cuarto, no la posición exacta. La versión anterior del taller permanece separada y no fue reemplazada.
