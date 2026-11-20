// 发布前的检查：版本号一致、离线缓存清单完整、引用的文件都存在、安全检查通过。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION } from '../src/version.js';
import { scanProject } from '../scripts/check-security.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const sw = read('sw.js');

function listFiles(dir) {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(ROOT, rel)).isDirectory() ? listFiles(rel) : [rel];
  });
}

test('sw.js 的 VERSION 和 src/version.js 一样（忘了改版本号，手机会一直用旧版）', () => {
  const m = /const VERSION = '([^']+)'/.exec(sw);
  assert.ok(m, 'sw.js 里找不到 VERSION');
  assert.equal(m[1], APP_VERSION);
});

test('离线缓存清单（ASSETS）包含所有 App 文件，而且没有多余的', () => {
  const block = /const ASSETS = \[([\s\S]*?)\];/.exec(sw)[1];
  const assets = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((a) => a !== './');
  const expected = ['index.html', 'manifest.webmanifest', ...listFiles('src'), ...listFiles('styles'), ...listFiles('assets')];
  assert.deepEqual([...assets].sort(), [...expected].sort());
});

test('index.html 和 manifest 引用的文件都存在', () => {
  const index = read('index.html');
  const refs = [...index.matchAll(/(?:href|src)="([^"#?]+)/g)].map((m) => m[1]);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  refs.push(...manifest.icons.map((i) => i.src));
  assert.ok(refs.length > 5);
  for (const ref of refs) assert.ok(existsSync(path.join(ROOT, ref)), `找不到 ${ref}`);
});

test('sprite.svg 里有程序用到的每一个图标', () => {
  const sprite = read('assets/icons/sprite.svg');
  const used = new Set();
  for (const file of [...listFiles('src'), 'index.html']) {
    for (const m of read(file).matchAll(/icon\('([\w-]+)'\)|sprite\.svg#i-([\w-]+)/g)) used.add(m[1] ?? m[2]);
  }
  for (const name of used) assert.ok(sprite.includes(`id="i-${name}"`), `sprite.svg 缺少 i-${name}`);
});

test('程序用到的每一个图标都在 icons.js 的名单里（不然画面会当掉）', () => {
  const allowed = /const NAMES = new Set\(\[([\s\S]*?)\]\)/.exec(read('src/ui/icons.js'))[1];
  const names = new Set([...allowed.matchAll(/'([\w-]+)'/g)].map((m) => m[1]));
  for (const file of listFiles('src')) {
    for (const m of read(file).matchAll(/icon\('([\w-]+)'\)/g)) {
      assert.ok(names.has(m[1]), `${file} 用到 ${m[1]}，但 icons.js 的名单里没有`);
    }
  }
});

test('安全检查通过', () => {
  assert.deepEqual(scanProject(), []);
});
