// 通用的底部弹出表单（每月计划、固定项目）。
// 「取消 · 标题 · 保存」；保存时呼叫 onSubmit(form)，回传 true 才关掉。

import { html } from '../core/html.js';

let current = null;

export function isFormSheetOpen() {
  return current !== null;
}

/**
 * @param {object} o
 * @param {string} o.title
 * @param {SafeHtml} o.body          表单内容
 * @param {(form: HTMLFormElement) => Promise<boolean>|boolean} o.onSubmit
 * @param {(ctx: { layer, form, close }) => void} [o.onMount]
 */
export function openFormSheet({ title, body, submitLabel = '保存', onSubmit, onMount }) {
  if (current) return null;

  const layer = document.createElement('div');
  layer.className = 'sheet-layer';
  layer.innerHTML = String(html`
    <div class="sheet-backdrop" data-sheet="close"></div>
    <div class="sheet form-sheet" role="dialog" aria-modal="true" aria-labelledby="form-sheet-title" tabindex="-1">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-header">
        <button type="button" class="text-btn" data-sheet="close">取消</button>
        <h2 id="form-sheet-title" class="sheet-title">${title}</h2>
        <button type="submit" class="text-btn strong" form="form-sheet-form">${submitLabel}</button>
      </header>
      <form id="form-sheet-form" class="form-body" novalidate autocomplete="off">${body}</form>
    </div>`);

  const sheetEl = layer.querySelector('.sheet');
  const form = layer.querySelector('form');
  let busy = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      if (await onSubmit(form)) close();
    } finally {
      busy = false;
    }
  });
  // 改了某个字段，就把那个字段的错误讯息收起来。
  const clearError = (e) => {
    const name = /^cycle(From|To)$/.test(e.target.name) ? 'cycleWindow' : e.target.name;
    const err = name && form.querySelector(`[data-error-for="${name}"]`);
    if (!err || err.hidden) return;
    err.hidden = true;
    err.textContent = '';
    form.querySelector(`[name="${name}"]`)?.removeAttribute('aria-invalid');
  };
  form.addEventListener('input', clearError);
  form.addEventListener('change', clearError);
  layer.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet="close"]')) close();
  });
  layer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  const previousFocus = document.activeElement;
  const app = document.getElementById('app');
  document.getElementById('sheet-root').append(layer);
  app.inert = true;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
  sheetEl.focus({ preventScroll: true });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    current = null;
    layer.classList.remove('open');
    layer.classList.add('closing');
    app.inert = false;
    document.body.classList.remove('sheet-open');
    const remove = () => layer.remove();
    sheetEl.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 450);
    previousFocus?.focus?.({ preventScroll: true });
  }

  current = { close };
  onMount?.({ layer, form, close });
  return { close };
}

/** 在某个字段下面显示错误讯息（没有就清掉）。 */
export function setFieldErrors(form, errors) {
  for (const el of form.querySelectorAll('[data-error-for]')) {
    const msg = errors[el.dataset.errorFor] ?? '';
    el.textContent = msg;
    el.hidden = !msg;
    const input = form.querySelector(`[name="${el.dataset.errorFor}"]`);
    if (input) input.setAttribute('aria-invalid', String(Boolean(msg)));
  }
  const first = Object.keys(errors)[0];
  if (first) form.querySelector(`[name="${first}"]`)?.focus();
}
