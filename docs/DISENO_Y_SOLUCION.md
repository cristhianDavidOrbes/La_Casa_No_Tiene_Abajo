# Diseño e implementación revisada

Cinco cuartos independientes, rotados en incrementos de 90 grados, sin intersección entre sus volúmenes. Cuatro conductos cerrados separan las estancias (2,4 m; 6,4 m; 2,4 m; 2,4 m). Sus entradas y salidas alternan posiciones laterales, así que la ruta exige girar y explorar cada cuarto. Cada paso une un hueco de suelo del cuarto anterior con una abertura lateral a ras de suelo del siguiente. El conducto tiene 2 m de altura útil bajo la gravedad del destino y 2,5 m de anchura.

architecture.js comparte las dimensiones entre arquitectura visible de módulos OBJ descargados y proxies invisibles de colisión. Los bordes del conducto terminan bajo el espesor del suelo, evitando caras coplanares; se recortan también contra las jambas del destino. La caja eléctrica está anclada por sus límites reales, no por el centro de su puerta abierta. El render conserva el cuarto ocupado y sus vecinos y descarta los cuartos lejanos cerrados para ahorrar trabajo de GPU; la física y la entidad perseguidora siguen activas.

## Control y gravedad

Movimiento terrestre con WASD, ratón, carrera y salto. Ojos a 1,68 m y radio corporal de 0,24 m. Desde el 1 de octubre de 2026, `cannon-es` simula los cuerpos del jugador, perseguidor y libros, y sus contactos con el escenario; sustituye el Octree y los integradores manuales. Un reloj compartido usa pasos de 1/120 s. Three.js conserva gráficos y animación. No hay trayectoria Bézier, duración fija, teletransporte de llegada ni bloqueo del ratón/WASD. Detalles en `FISICAS_CANNON.md`.

La gravedad se elige por posición en el campo de la unión, con histéresis para evitar oscilación. Al salir de vuelta se recupera el vector del cuarto anterior. El borde de regreso aplica un impulso de salto al cuerpo de Cannon para superar el labio; después manda la gravedad y el control del jugador. La orientación corporal gira hacia la nueva vertical; no se prescribe la posición de la cámara. El esqueleto sigue animado proceduralmente, sin convertirse en ragdoll.

## Presentación y multimedia

Ventana con abertura real. TV con emisión sobre los 392 triángulos originales de cristal curvo. Texturas PBR CC0; alfombra de tejido; lámpara central; notas como papel envejecido descargado y lectura sobre una carta antigua. Sobre inicial corto e interactivo. Sin letreros de instrucciones en paredes.

Canal 02 no hace bucle: ended y tiempo real de vídeo desbloquean permanentemente el fusible. Cinco emisiones con audio y grabación final en canal 03. Tres sillas de madera clara se colocan al azar sobre suelo, pared o techo, y el orden de las habitaciones también se baraja: la solución se descubre en el espacio, nunca se entrega escrita. Guardado validado por versión y cuarto. La ruta ?test=1 no escribe partidas.

La criatura usa el GLB Tripo aportado por el usuario, con 55 huesos y pesos reparados, sin reducir su malla ni sus texturas originales. Sus manos y pies buscan apoyos independientes en suelo, pared y mobiliario; da zancadas alternas en arcos sinusoidales, trepa a objetos transitables y sigue al jugador con la cabeza. Prefiere rutas junto a paredes, acelera si queda lejos, persiste entre cuartos y se agacha ante conductos y techos bajos. Su cuarto inicial se escoge al azar entre los disponibles, excluyendo el del jugador. Antes de perseguir, la casa presenta encuentros paranormales graduales; al alcanzarte, la criatura se acerca al rostro. Tras la cinta final se retira solo fuera de tu mirada. En un ataque cercano elige acercarse por el suelo (40 %) o por pared y techo (60 %). Dos casilleros se distribuyen entre los tres cuartos interiores; E permite abrir uno, esconderse y volver a salir. El monstruo investiga el último cuarto visto y después busca en los adyacentes. La linterna tirada en el archivo debe recogerse antes de usar F; ofrece un único destello de 0,45 s, que aturde durante 3 s con visión directa. Detalles y límites en CREATURA.md.

## Relación con la clase

MeshStandardMaterial; mapas de color, normales y rugosidad; PointLight y SpotLight; sombras PCF; 1.600 partículas en cinco BufferGeometry; CanvasTexture y CCTV; Web Audio espacial. Controles de escritorio, no táctiles. Colliders aproximados. El aparato de rebobinado está representado por una cámara antigua CC0, no por una videocasetera exacta.
