import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json'
};
if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('Falta dist. Ejecuta npm install y npm run build.');
  process.exit(1);
}
const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname === '/health') {
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end('{"game":"la-casa-no-tiene-abajo"}');
    return;
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404).end('No encontrado');
      return;
    }
    const headers = {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes'
    };
    let start = 0,
      end = stat.size - 1,
      status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), end) : end;
      } else start = Math.max(0, stat.size - Number(match[2]));
      if (start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    stream.pipe(res);
    res.on('close', () => stream.destroy());
  });
});
server.on('error', async (err) => {
  if (err.code === 'EADDRINUSE') {
    const running = await fetch('http://127.0.0.1:5180/health')
      .then((r) => r.json())
      .catch(() => null);
    if (running?.game === 'la-casa-no-tiene-abajo') {
      console.log('El juego ya está abierto.');
      if (process.argv.includes('--open'))
        spawn('cmd.exe', ['/d', '/c', 'start', '', 'http://127.0.0.1:5180'], {
          windowsHide: true,
          stdio: 'ignore'
        });
      process.exit(0);
    }
    console.error('Otro programa ocupa el puerto 5180.');
  } else console.error(err);
  process.exit(1);
});
server.listen(5180, '127.0.0.1', () => {
  console.log(
    'LA CASA NO TIENE ABAJO\nAbre http://127.0.0.1:5180\nEste servidor es solo local. Cierra esta ventana para detenerlo.'
  );
  if (process.argv.includes('--open'))
    spawn('cmd.exe', ['/d', '/c', 'start', '', 'http://127.0.0.1:5180'], {
      windowsHide: true,
      stdio: 'ignore'
    });
});
