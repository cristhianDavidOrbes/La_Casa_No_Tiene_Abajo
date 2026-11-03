// La compilación puede quedar pendiente si el controlador gráfico deja de responder.
export async function prepareShaders(renderer, scene, camera) {
  let timeout;
  try {
    await Promise.race([
      renderer.compileAsync(scene, camera),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                'La tarjeta gráfica no terminó de preparar la iluminación. Recarga la página.'
              )
            ),
          20000
        );
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
