// 离线缓存（Service Worker）和「有新版本」提示。
// 只在 HTTPS（GitHub Pages）启用；本机开发时网址加 ?sw=1 才启用，免得一直看到旧画面。

let userAcceptedUpdate = false;

export function serviceWorkerEnabled(loc = globalThis.location, nav = globalThis.navigator) {
  if (!nav || !('serviceWorker' in nav)) return false;
  return loc.protocol === 'https:' || new URLSearchParams(loc.search).has('sw');
}

function showUpdateBanner(worker) {
  if (document.querySelector('.update-banner')) return;
  const bar = document.createElement('div');
  bar.className = 'update-banner';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = '有新版本';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '更新';
  button.addEventListener('click', () => {
    userAcceptedUpdate = true;
    button.disabled = true;
    button.textContent = '更新中…';
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
  bar.append(text, button);
  document.body.append(bar);
}

export function setupUpdates() {
  if (!serviceWorkerEnabled()) return;
  const sw = navigator.serviceWorker;
  // 只有用户按了「更新」才重新载入（第一次安装时不要无故重载）。
  sw.addEventListener('controllerchange', () => {
    if (userAcceptedUpdate) location.reload();
  });
  sw.register('./sw.js')
    .then((reg) => {
      if (reg.waiting && sw.controller) showUpdateBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && sw.controller) showUpdateBanner(worker);
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}

/** 回传 'unsupported' | 'latest' | 'found' | 'error' */
export async function checkForUpdate() {
  if (!serviceWorkerEnabled()) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'unsupported';
    await reg.update();
    return reg.installing || reg.waiting ? 'found' : 'latest';
  } catch {
    return 'error';
  }
}
