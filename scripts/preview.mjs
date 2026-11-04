// Serves dist/ under /preview/ so broken relative asset paths show up, as on a gateway subpath.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT) || 4173;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/') {
    response.writeHead(302, { location: '/preview/' }).end();
    return;
  }
  if (!pathname.startsWith('/preview/')) {
    response.writeHead(404).end();
    return;
  }
  const inner = decodeURIComponent(pathname.slice('/preview/'.length)) || 'index.html';
  const file = resolve(join(root, inner));
  if (!file.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`SqueekPulse preview: http://127.0.0.1:${port}/preview/`);
  console.log(`OBS overlay preview: http://127.0.0.1:${port}/preview/?overlay=1`);
});
