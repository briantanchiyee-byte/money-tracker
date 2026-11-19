// 产生 App 图标（PNG）。不需要安装任何东西：用 Node 自带的 zlib 自己编码 PNG。
// 用法：node scripts/make-icons.mjs
// 图案：绿色渐层背景 + 一张白色收据。内容都在中心 40% 半径内，可当 maskable 图标。

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../assets/icons/', import.meta.url));
const SIZES = [180, 192, 512];
const SUPERSAMPLE = 4;

const TOP = [0x2c, 0xc9, 0x8b];
const BOTTOM = [0x08, 0x7f, 0x54];
const WHITE = [255, 255, 255];

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 图案（座标 0–1） ----
const R = { left: 0.31, right: 0.69, top: 0.21, bottom: 0.73, corner: 0.045, teeth: 5, toothDepth: 0.045 };

function insideReceipt(u, v) {
  if (u < R.left || u > R.right || v < R.top) return false;
  // 底部锯齿
  const t = (((u - R.left) / (R.right - R.left)) * R.teeth) % 1;
  const bottom = R.bottom + R.toothDepth * (1 - Math.abs(2 * t - 1));
  if (v > bottom) return false;
  // 圆角
  const cy = R.top + R.corner;
  if (v < cy) {
    const cx = u < R.left + R.corner ? R.left + R.corner : u > R.right - R.corner ? R.right - R.corner : null;
    if (cx !== null && Math.hypot(u - cx, v - cy) > R.corner) return false;
  }
  return true;
}

function nearSegment(u, v, x1, x2, y, half) {
  const cx = Math.max(x1, Math.min(x2, u));
  return Math.hypot(u - cx, v - y) <= half;
}

const LINES = [
  [0.385, 0.615, 0.33],
  [0.385, 0.615, 0.425],
  [0.385, 0.53, 0.52],
];

function colorAt(u, v) {
  const bg = lerp(TOP, BOTTOM, v);
  if (!insideReceipt(u, v)) return bg;
  if (LINES.some(([x1, x2, y]) => nearSegment(u, v, x1, x2, y, 0.022))) return bg;
  if (nearSegment(u, v, 0.56, 0.615, 0.62, 0.03)) return bg; // 底部的「总数」
  return WHITE;
}

function render(size) {
  const rgb = Buffer.alloc(size * size * 3);
  const n = SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const [cr, cg, cb] = colorAt((x + (sx + 0.5) / n) / size, (y + (sy + 0.5) / n) / size);
          r += cr; g += cg; b += cb;
        }
      }
      const i = (y * size + x) * 3;
      rgb[i] = Math.round(r / (n * n));
      rgb[i + 1] = Math.round(g / (n * n));
      rgb[i + 2] = Math.round(b / (n * n));
    }
  }
  return encodePNG(size, rgb);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), render(size));
  console.log(`assets/icons/icon-${size}.png`);
}
