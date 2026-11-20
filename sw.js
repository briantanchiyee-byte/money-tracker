// 离线缓存。
// 每次发布都要改 VERSION（并和 src/version.js 一样），手机才会提示「有新版本」。
// 新增或删除文件时，也要更新 ASSETS（tests/release.test.mjs 会检查）。

const VERSION = '0.2.0';
const CACHE = `expenses-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icons/icon-180.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/sprite.svg',
  'src/core/categories.js',
  'src/core/budget.js',
  'src/core/dates.js',
  'src/core/html.js',
  'src/core/money.js',
  'src/core/periods.js',
  'src/core/plan.js',
  'src/core/records.js',
  'src/core/recurring.js',
  'src/core/transactions.js',
  'src/data/db.js',
  'src/data/store.js',
  'src/main.js',
  'src/ui/app.js',
  'src/ui/entry-sheet.js',
  'src/ui/form-sheet.js',
  'src/ui/icons.js',
  'src/ui/plan-sheet.js',
  'src/ui/records.js',
  'src/ui/recurring-sheet.js',
  'src/ui/rows.js',
  'src/ui/settings.js',
  'src/ui/swipe.js',
  'src/ui/toast.js',
  'src/ui/today.js',
  'src/ui/update.js',
  'src/version.js',
  'styles/base.css',
  'styles/components.css',
  'styles/screens.css',
  'styles/tokens.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('expenses-') && k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// 用户在 App 里按「更新」才换新版本。
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 打开 App（包括 ./?add=expense 这种快捷方式）一律用缓存的 index.html。
    event.respondWith((async () => (await caches.match('index.html')) ?? fetch(req))());
    return;
  }
  event.respondWith((async () => (await caches.match(req, { ignoreSearch: true })) ?? fetch(req))());
});
