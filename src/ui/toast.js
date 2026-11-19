// 底部的小提示，可以带一个按钮（例如「撤销」）。同一时间只显示一个。

let active = null;

export function dismissToast(handle = active) {
  if (!handle) return;
  clearTimeout(handle.timer);
  handle.el.classList.remove('show');
  setTimeout(() => handle.el.remove(), 300);
  if (active === handle) active = null;
}

export function showToast(message, { actionLabel, onAction, duration } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return null;
  dismissToast();

  const el = document.createElement('div');
  el.className = 'toast';
  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  el.append(text);

  const handle = { el, timer: null };
  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = actionLabel;
    button.addEventListener('click', () => {
      dismissToast(handle);
      onAction();
    });
    el.append(button);
  }

  root.append(el);
  const ms = duration ?? (onAction ? 5000 : 2600);
  if (ms > 0) handle.timer = setTimeout(() => dismissToast(handle), ms);
  active = handle;
  requestAnimationFrame(() => el.classList.add('show'));
  return handle;
}
