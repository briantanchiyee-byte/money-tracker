// 本机预览服务器（不需要安装任何东西）。
//   node scripts/serve.mjs         只有这台电脑能打开：http://localhost:8080
//   node scripts/serve.mjs --lan   同一个 Wi‑Fi 的手机也能打开（会印出网址）

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const LAN = process.argv.includes('--lan');
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';

// 只开放 App 本身的文件，不开放 scripts/、tests/ 等。
const ALLOWED_TOP = new Set(['index.html', 'manifest.webmanifest', 'sw.js', 'src', 'styles', 'assets']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const rel = path.normalize(pathname).replace(/^[\\/]+/, '');
    const top = rel.split(/[\\/]/)[0];
    const file = path.resolve(ROOT, rel);
    if (!ALLOWED_TOP.has(top) || !file.startsWith(ROOT + path.sep)) throw Object.assign(new Error(), { code: 'ENOENT' });
    if (!(await stat(file)).isFile()) throw Object.assign(new Error(), { code: 'ENOENT' });
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(err.code === 'ENOENT' ? '找不到' : '出错了');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`电脑上打开：http://localhost:${PORT}`);
  if (LAN) {
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (a.family === 'IPv4' && !a.internal) console.log(`手机（同一个 Wi‑Fi）打开：http://${a.address}:${PORT}`);
      }
    }
    console.log('（Windows 问要不要允许网络存取时，选「私人网络」就好。）');
  }
});
