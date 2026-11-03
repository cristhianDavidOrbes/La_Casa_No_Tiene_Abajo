# Verificación — 29 de septiembre de 2026

## Automatización y compilación

- 95 pruebas automáticas superadas en la compilación actual: estados, guardado, física, cruces de ida/vuelta, arquitectura, pistas aleatorias, trepa, apoyos independientes, aparición trasera de 0,5 s después del puzle, vigilante con rig completo a escala 1,4× detrás del borde sólido de los cuatro umbrales, visibilidad de cabeza y hombros desde lejos, retirada paralela al piso del cuarto anterior sin bajar por el conducto, sobresalto, encuentros paranormales, destellos y rig.
- Compilación Vite correcta. Ejecutar `npm test` y `npm run build` desde la carpeta del proyecto.
- GLB activo: 55 articulaciones, 52 con influencia sobre vértices, pesos normalizados y ningún vértice sin asignar. Se repararon los pesos y la orientación del esqueleto de la exportación proporcionada.
- 6.316 triángulos originales. Las tres imágenes embebidas conservan exactamente su SHA-256 original; no se redujeron resolución ni geometría.
- IK contrastada en cinco orientaciones gravitatorias y durante 360 pasos de arrastre acelerado con cambios de dirección. Pruebas de seguimiento de la mirada sin girar todo el cuerpo.
- Tres destellos de 0,45 s, aturdimiento de 3 s, bloqueo de repetición por tecla sostenida, ausencia de aturdimiento al fallar, persistencia de cargas y pausa del temporizador.

## Comprobación dentro del navegador local

- Prueba de amenaza: linterna recogible, un único destello disponible, fin de luz antes del fin del aturdimiento, reanudación posterior, pausa correcta y segundo disparo rechazado.
- Persecución continua: regreso de emisión a sala a través de cuatro pasos con los muebles reales; desplazamiento máximo por paso de simulación 0,137 m, sin recrear la entidad. Agachado durante los pasos.
- Recorrido acelerado: 12 cruces físicos, acertijos, cinta, rebobinado y regreso a la puerta original. Se adelantan el visionado y el rebobinado; no equivale a una partida manual completa.
- TV: emisión sobre los 392 triángulos de cristal originales. Canal 02 comprobado previamente mediante reproducción real: 29,1 s, ended=true y fusible instalable.
- Cruce e IK: 917 fotogramas de vuelta con normales de apoyo distintas a la vez. Trepa sobre la caja descargada: altura 0,80 m y error máximo de IK 0,019 m. Retirada final: la entidad siguió presente mientras estaba a la vista y se ocultó después de mirar hacia otro lado.
- El panel del puzle indica el orden aleatorio de habitaciones, pero no la secuencia de superficies. Las pruebas unitarias comprueban las tres posiciones de sillas y la persistencia de la solución.

## Rendimiento observado

Una versión anterior midió 132,9 FPS medios en un ensayo de 10 segundos dentro del navegador integrado, pero ese valor no corresponde a una medición controlada de la compilación actual a una resolución fijada. No debe tomarse como garantía ni como cifra final de rendimiento.

El resultado final no garantiza un mínimo de 60 FPS en todo equipo, resolución o situación. El supersampling se ajusta sin bajar de la resolución nativa y sin modificar texturas ni la malla de la criatura. Queda pendiente una medición reproducible a resolución y perfil de energía fijos en el equipo de destino.

## Repetición y límites

Los controles de QA en pantalla se retiraron por petición del usuario. Las 95 pruebas automáticas se ejecutan con `npm test`, fuera del juego. La versión compilada se puede iniciar y abrir en el navegador local sin errores de consola; esto no equivale a medir todos los cruces y destellos en hardware diferente.

Los apoyos usan IK aproximada y arrastre sobre la superficie, no simulación muscular ni un ragdoll completo. Durante un salto o tramo sin superficie alcanzable no puede garantizarse contacto físico simultáneo de las cuatro extremidades. No se garantiza ausencia universal de fallos. No se publicaron archivos ni se enviaron modelos a servicios externos en esta revisión.
