# Three.js + Cannon — 1 de octubre de 2026

Three.js conserva la escena, cámaras, iluminación, modelos y animación del esqueleto. `cannon-es` 0.20.0, implementación moderna de Cannon.js con licencia MIT, es el único motor de simulación física. No se añadió el paquete antiguo `cannon` ni se reutilizó el ejemplo pegado por el usuario.

## Simulación compartida

`src/cannon-physics.js` mantiene un único `World` y un reloj fijo de 120 Hz. El acumulador limita el trabajo a 50 ms por fotograma para evitar recuperar una pausa larga con cientos de pasos. La simulación solo avanza durante la partida activa, no en los menús, pausa, minijuegos o captura.

La gravedad global es cero. Cada personaje o libro activo recibe una fuerza según la orientación de su habitación; los conectores cambian el campo espacial tanto al avanzar como al regresar. El personaje conserva su velocidad física y rota su cuerpo durante el cruce. No existe una trayectoria prefijada ni un teletransporte de llegada.

El cruce permanece activo hasta que la orientación física coincide con la habitación de llegada, para evitar un salto de cámara/cápsula en el siguiente fotograma. Las colisiones de toda la casa permanecen residentes; activar un motor o aparecer el monstruo solo actualiza el estado. La reconstrucción se solicita explícitamente al colocar un punto de control, después de modificar sillas y casilleros.

`room-rendering.js` conserva un conjunto fijo de luces y reutiliza una única sombra de 1024×1024 en la habitación activa. Las dos habitaciones del conector permanecen visibles durante el cruce. No se descargan modelos ni se cambian los recuentos de luces/sombras al pasar por un umbral. La carga inicial prepara texturas, programas y buffers de las mallas fuera de cámara; `asset-loading.js` limita las cargas concurrentes y reintenta fallos transitorios de recursos locales.

## Qué utiliza Cannon

- Jugador: cuerpo dinámico compuesto por cilindro y esferas, colisiones, contacto con el suelo, salto y motor de movimiento. La cámara sigue su posición física.
- Perseguidor: cuerpo dinámico con tamaño adaptado a postura y orientación de suelo, pared o techo. La navegación proporciona objetivos de velocidad; Cannon resuelve desplazamiento y contactos. La elevación al trepar muebles es un motor vertical, no una caída integrada por separado.
- Entorno: cuerpos estáticos de paredes, techos, suelos, conectores, muebles y objetos recogibles. Los muebles usan proxies simplificados y las sillas exponen su asiento.
- Casilleros: paneles huecos independientes y puerta cinemática articulada con abertura real. La acción de entrar coloca al jugador dentro y desactiva su locomoción hasta salir.
- Tapas de umbrales: cuerpos cinemáticos que siguen su posición visible mientras se abren.
- Libros: cuerpos dinámicos independientes, masa, velocidad inicial, giro, fricción, rebote, contactos y reposo automático. Los sonidos de impacto nacen de sus contactos y permanecen espaciales.
- Apoyos de manos y pies y oclusión: rayos sobre el mismo mundo de Cannon. La animación procedural del esqueleto sigue siendo responsabilidad de Three.js; no es un segundo simulador físico.

Los filtros geométricos en `physics.js` y el mapa de alturas de navegación solo sirven para decidir rutas y ubicaciones. Se retiraron los integradores anteriores de movimiento/gravedad y las colisiones mediante Octree. Los cuerpos visuales se sincronizan con Cannon, no se simulan en paralelo con otra física.

## Comprobación y límites

Se comprobó la compilación, la carga inicial en navegador y diagnósticos físicos dirigidos de los cuatro conectores en ambos sentidos (ocho cruces), sin añadir paneles de prueba ni ejecutar una partida completa. El buffer local `television_02.bin` responde con HTTP 200 y 81.668 bytes. Las pruebas unitarias históricas que importan los integradores retirados necesitan migración antes de poder utilizarse de nuevo; no se presentan como comprobadas.

Los proxies simplificados, la búsqueda espacial SAP y el reposo de libros reducen coste, pero no garantizan 60 FPS en cualquier navegador o equipo. La calidad visual de los modelos no se redujo por esta integración. No se convierten en objetos dinámicos todos los muebles: los elementos fijados al escenario siguen siendo cuerpos estáticos.
