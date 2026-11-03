# Puerta de entrada y final

## Uso

- La puerta se abre y cierra con E. Su hoja gira sobre una bisagra; el marco coincide con la abertura de la pared. El collider cinemático Cannon sigue la hoja.
- Antes de completar la última grabación se puede mirar fuera, pero el personaje no abandona la casa y recuerda su promesa. Esto conserva la persecución y evita utilizar el exterior como atajo seguro.
- Después de reproducir la cinta recuperada en el canal 03, el aviso de la puerta cambia a «Salir con la cinta». E inicia el final.

## Secuencia

1. La cámara se alinea con la abertura, la puerta abre y la cámara sale primero.
2. El protagonista animado sale llevando la cinta en la mano izquierda.
3. Se vuelve hacia la puerta y la cierra; la mano derecha se adapta al tirador con IK.
4. La cámara se aleja mostrando la casa, el terreno, la carretera y las casas vecinas.
5. Esa misma vista continúa en una textura de render del cristal real del televisor. La cámara retrocede desde el cristal y revela la sala del juego.
6. La imagen se contrae y el CRT se apaga. Después aparece el cierre de la historia.

Duración aproximada: 34 segundos. La escena y los modelos se preparan durante la carga inicial; no hay descarga al pulsar la puerta. La TV usa un render target de 1024×768 preasignado, sin renderizarse a sí misma dentro de su propia textura. Reiniciar restaura cámara, luces, niebla, material original del CRT y puerta.

## Integración

- `src/entry-door.js`: dimensiones comunes, modelo CC0, bisagra e interacción.
- `src/architecture.js` y `src/cannon-physics.js`: abertura y colisión de la hoja.
- `src/ending-assets.js`: carga acotada con reintentos; conserva clips del protagonista.
- `src/ending-sequence.js`: actor, cinta, cámaras, exterior y apagado.
- `src/main.js`: disparador después de la cinta final y modo cinemático sin controles, persecución ni vídeo anterior.
- `src/room-lighting.js`: la luz lunar exterior no ilumina artificialmente las habitaciones cerradas ni elimina la oscuridad de la persecución.

Se mantienen Three.js para gráficos y Cannon para la física interactiva. La cinemática conduce cámaras y animaciones por tiempo, no mediante una segunda simulación física.

## Comprobaciones

- Hoja cerrada bloquea al personaje desde dentro y desde fuera. Hoja abierta permite salida y regreso; abrir desde fuera invierte el giro para no empujar al jugador contra el marco.
- Los cuatro GLB del final son autónomos, sin buffers o imágenes externos faltantes.
- La altura animada del protagonista es de 1,82 m. Se actualizan las matrices de enlace del esqueleto antes de medirlo; la cinta compensa la escala importada de la muñeca.
- El terreno tiene un recorte bajo la casa para no tapar los umbrales de gravedad.
- Licencias y fuentes: `ASSETS_FINAL_CC0.md`. Correcciones y comprobaciones del monstruo: `CREATURA.md`.
- Compilación Vite completada. Arranque normal hasta el menú y reproducción completa de los 34 segundos comprobados en navegador, sin errores de consola. Capturas en `output/final-protagonista-puerta.png` y `output/final-televisor-apagado.png`. La página temporal de revisión se retiró; no se añadieron controles de prueba al juego.

No se promete una tasa de FPS universal. La comprobación visual de la cinemática no sustituye una partida completa en todos los equipos.
