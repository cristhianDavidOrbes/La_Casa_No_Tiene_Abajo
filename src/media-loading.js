import { loadPool, loadWithRetry } from './asset-loading.js';

export function prepareVideo(video, url) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timeout);
      video.onloadeddata = video.onerror = null;
      error ? reject(error) : resolve();
    };
    const timeout = setTimeout(() => finish(new Error('El vídeo inicial no responde')), 12000);
    video.onloadeddata = () => finish();
    video.onerror = () => finish(new Error('No se pudo preparar la emisión inicial'));
    video.src = url;
    video.load();
  });
}

// Los canales sin señal y la cámara no descargan vídeos ni voces.
export async function loadBroadcasts() {
  const videos = {};
  const names = ['canal-01', 'canal-02', 'canal-05', 'para-volver'];
  try {
    await loadPool(names, async (name) => {
      const data = await loadWithRetry('/videos/' + name + '.mp4', async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.blob();
      });
      videos[name] = URL.createObjectURL(data);
    });
    return videos;
  } catch (error) {
    for (const url of Object.values(videos)) URL.revokeObjectURL(url);
    throw error;
  }
}
