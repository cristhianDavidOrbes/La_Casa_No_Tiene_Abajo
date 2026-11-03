// Bound concurrent model loads: a glTF can itself request several buffers/maps.
// Retry transient local-server/network failures without restarting the level.
export async function loadWithRetry(url, load, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await load(url);
    } catch (error) {
      if (attempt === attempts - 1)
        throw new Error(`Recurso: ${url}. ${error.message ?? error}`, { cause: error });
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}
export async function loadPool(items, load, concurrency = 3) {
  let next = 0,
    failed = false;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (!failed && next < items.length) {
        const item = items[next++];
        try {
          await load(item);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    })
  );
}
