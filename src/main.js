import { idbBackend, memoryBackend, openDatabase } from './data/db.js';
import { createStore } from './data/store.js';
import { startApp } from './ui/app.js';
import { setupUpdates } from './ui/update.js';

async function boot() {
  setupUpdates();

  let backend;
  let persistent = true;
  try {
    backend = idbBackend(await openDatabase());
  } catch {
    backend = memoryBackend();
    persistent = false;
  }

  // 请浏览器不要在空间不够时自动清掉资料。
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  const store = await createStore(backend);
  startApp({ store, persistent });
}

boot().catch((err) => {
  const screen = document.getElementById('screen');
  if (screen) screen.textContent = `打开失败：${err?.message ?? err}`;
  console.error(err);
});
