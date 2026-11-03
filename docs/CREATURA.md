# El Inquilino — Tripo, esqueleto reparado y acecho procedural

Modelo recibido del usuario: Downloads/slender humanoid 3d model.glb. Copia intacta: public/assets/creature/el-inquilino-tripo.glb. Activo: public/assets/creature/el-inquilino-tripo-repaired.glb. No se declara CC0 ni se presupone licencia comercial.

Escala en el juego: 1,2× la altura de referencia de 2,6 m (3,12 m); se redujo desde la versión temporal de 5,2 m sin cambiar la geometría ni las texturas.

## Reparación de la exportación

La inspección profunda encontró 55 joints e inverse bind matrices, pero todos los JOINTS_0 eran 0 y todos los WEIGHTS_0 eran [1,0,0,0]. Los nodos carecían de transformaciones locales. Había huesos, pero no un skin funcional.

sources/repair-tripo-bind.mjs recupera las transformaciones desde las matrices inversas y alinea el esqueleto con el frente +Z de la malla. sources/weight-tripo-rig.py calcula pesos por calor en Blender sobre una copia temporal soldada (las costuras UV desconectadas impedían resolverlos directamente), y transfiere los pesos al original. No se simplifica ni se cambia la topología del modelo entregado. Resultado: 55 huesos, 52 con influencia, 0 vértices sin pesos, 6.316 triángulos. Los tres archivos de textura conservan sus SHA-256 originales, byte por byte.

Fuente editable: sources/el-inquilino-tripo-repaired.blend. No se enviaron tareas a servicios remotos ni se gastaron créditos. El rig anterior de 17 huesos queda conservado, pero ya no se carga.

## Movimiento

Corrección de apoyos con Cannon (2026-10-01): el modelo y la cápsula comparten la misma orientación suavizada; la fuerza de adhesión usa la normal de la superficie detectada. Las entradas a pared/techo se deciden con rayos contra geometría física real, no por posiciones previstas ni saltos de coordenadas. La aproximación evita obstáculos con A*, y una trepada bloqueada o sin apoyo vuelve a la búsqueda por suelo. La altura de la cápsula cambia progresivamente con la postura.

Los rayos de las extremidades tienen alcance limitado e ignoran recogibles y libros sueltos. Conservan sus puntos de apoyo en el mundo, orientan cada contacto con cuaterniones —también al invertir la gravedad— y limitan la rapidez de recuperación para evitar saltos bruscos. El ritmo de pasos sigue la velocidad física real. La elevación sobre muebles no se confunde con estar adherido a una pared. Estos ajustes no cambian la escala ni las texturas del modelo.

Corrección anatómica (2026-10-04): las piernas del rig miden aproximadamente 1,60 m y los brazos 1,04–1,05 m. Los objetivos antiguos plegaban esas piernas demasiado cerca de la cadera y podían conservar una mano al lado opuesto del torso al girar. Ahora cada contacto respeta el lado de su extremidad, un alcance mínimo y máximo y el espesor real de palma/planta. La postura cuadrúpeda extiende los pies hacia atrás; la postura erguida reserva espacio para la cabeza. Al cambiar un apoyo se conserva y recupera gradualmente el objetivo visual, sin un salto instantáneo hasta el nuevo punto.

Comprobación específica sobre el GLB real y el mundo Cannon: recorridos de suelo, subida de pared, techo, descenso y vuelta desde el cuarto contiguo mantienen transformaciones finitas y ningún cruce de manos/pies al otro lado del cuerpo; error máximo de IK inferior a 0,002 m. En un giro con cambio de postura, el salto máximo de una extremidad bajó de 0,78 a 0,20 m por fotograma. El acecho trasero conserva las manos elevadas y las piernas al 99,76 % de su extensión. Son verificaciones numéricas dirigidas, no una garantía de ausencia de intersecciones visuales en todo el mobiliario.

- CreatureMotion usa el esqueleto real. La postura baja y adelanta el torso; nunca aplasta la escala.
- Cuatro cadenas de dos huesos apoyan manos y pies mediante rayos individuales hacia suelo, paredes y superficies del mobiliario. Cada apoyo conserva su propia normal y posición en coordenadas del mundo, incluso cuando el cuerpo cruza entre dos gravedades.
- Las extremidades alternan pasos largos; cada traslado describe un arco de altura sinusoidal y vuelve a plantarse. Si el cuerpo acelera más allá del alcance, se limita el objetivo sin estirar los huesos ni dejar una mano congelada en el cuarto anterior.
- Cabeza y cuello siguen al jugador con límites de giro; dedos y torso presentan tensión y temblor leve.
- El perseguidor conserva una sola entidad entre cuartos y usa sus campos de gravedad. Se encoge más en los conductos; puede trepar a las superficies transitables de cajas, sillas y mesas sin atravesarlas.
- La búsqueda A* penaliza el centro del cuarto y prefiere una franja junto a las paredes. Sale de esa franja para alcanzar al jugador, un umbral o un objeto escalable. Aparece en un cuarto aleatorio accesible distinto al ocupado por el jugador.
- El acecho se vuelve bípedo cerca del jugador y usa una postura cuadrúpeda veloz al estar lejos o bajo un techo. Si alcanza al jugador, se acerca al rostro antes de reiniciar el punto de control. Tras colocar la cinta final, permanece mientras se le mire y se retira únicamente después de permanecer fuera de vista.
- Acecho cercano: 0,85–1,55 m/s con ritmo irregular. Lejos (>8 m) o en otro cuarto: acelera gradualmente hasta 5 m/s. Reduce la velocidad al acercarse. Los conductos mantienen velocidades menores por seguridad.

## Luz limitada

F: pulso de 0,45 s; tres cargas por intento. El destello solo aturde si tiene línea de visión, está orientado hacia la criatura y a menos de 12 m. Aturdimiento: 3 s, independiente de cuánto se mantenga pulsado F. Un pulso no reaplica el aturdimiento cada frame. Espera mínima entre pulsos: 0,9 s. Fallar consume carga.

Las cargas persisten al cambiar de habitación, guardar y continuar. Nueva partida o reintento explícito del punto de control restaura tres. La pausa congela temporizadores y persecución. Reproducir la cinta final conserva el desenlace previo.

## Rendimiento y límites

Malla y texturas originales intactas; no hay generación de modelos durante la partida. La animación es IK cinemática, no simulación muscular ni ragdoll. Las superficies muy complejas y los cambios de apoyo durante una caída requieren revisión visual; no se promete ausencia universal de clipping.

Se evita recalcular transformaciones de mallas estáticas y se limita la sombra dinámica a la habitación ocupada. La carga inicial sube las texturas a la GPU y prepara las variantes de iluminación de los cinco cuartos. El foco permanece en la configuración de luces con intensidad cero fuera del destello, evitando compilar shaders al pulsar F. El CCTV lee sus píxeles de forma asíncrona y la TV apagada no sube una textura negra repetidamente. El presupuesto de render reduce solo el sobresampling hasta resolución nativa si el tiempo de frame aumenta. No baja la resolución de las texturas ni elimina polígonos. Las medidas locales no garantizan 60 FPS mínimos en otros equipos.

