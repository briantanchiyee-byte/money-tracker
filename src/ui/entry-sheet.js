// 「记一笔 / 修改记录」的底部弹出表单。
// 流程：大键盘输入金额 → 点类别就存好（3 秒内完成）。

import { html } from '../core/html.js';
import {
  MAX_AMOUNT_CENTS,
  amountToInput,
  formatKeypadDisplay,
  parseAmount,
  pressKey,
} from '../core/money.js';
import { isValidISODate, relativeDayLabel, todayISO } from '../core/dates.js';
import { activeCategories, findCategory, isBusinessCategory } from '../core/categories.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];
const KEY_LABELS = { '.': '小数点', back: '删掉一位' };

let current = null;

export function isSheetOpen() {
  return current !== null;
}

export function openEntrySheet({ store, tx = null, type = 'expense', date, onSaved, onDelete }) {
  if (current) return;
  const editing = Boolean(tx);
  const today = todayISO();
  const s = {
    type: tx?.type ?? type,
    amount: tx ? amountToInput(tx.amount) : '',
    categoryId: tx?.categoryId ?? null,
    date: tx?.date ?? (date && date <= today ? date : today),
    note: tx?.note ?? '',
    business: tx?.business ?? false,
    saving: false,
  };

  const layer = document.createElement('div');
  layer.className = 'sheet-layer';
  layer.innerHTML = String(html`
    <div class="sheet-backdrop" data-sheet="close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-header">
        <button type="button" class="text-btn" data-sheet="close">取消</button>
        <div class="segmented" role="radiogroup" aria-label="类型">
          <button type="button" role="radio" data-sheet="type" data-type="expense">支出</button>
          <button type="button" role="radio" data-sheet="type" data-type="income">收入</button>
        </div>
        ${editing ? html`<button type="button" class="text-btn strong" data-sheet="save">保存</button>` : html`<span></span>`}
      </header>
      <h2 id="sheet-title" class="visually-hidden">${editing ? '修改记录' : '记一笔'}</h2>

      <div class="amount-display" data-ref="amount" role="status">
        <span class="currency">RM</span><span class="amount-value num" data-ref="amount-value"></span>
      </div>

      <div class="meta-row">
        <label class="chip date-chip">
          ${icon('calendar')}<span data-ref="date-label"></span>
          <input type="date" class="date-input" data-ref="date" max="${today}" aria-label="日期">
        </label>
        <button type="button" class="chip business-chip" data-sheet="business" data-ref="business" aria-pressed="false">
          ${icon('briefcase')}<span>生意</span>
        </button>
        ${editing ? html`
          <button type="button" class="chip danger-chip" data-sheet="delete" aria-label="删除这笔">${icon('trash')}</button>` : ''}
        <input type="text" class="note-input" data-ref="note" placeholder="备注（可不填）" maxlength="200"
          enterkeyhint="done" autocomplete="off" aria-label="备注">
      </div>

      <p class="cat-hint" data-ref="hint"></p>
      <div class="cat-grid" data-ref="cats" role="group" aria-label="类别"></div>

      <div class="keypad" role="group" aria-label="数字键盘">
        ${KEYS.map((k) => html`
          <button type="button" class="key" data-key="${k}" aria-label="${KEY_LABELS[k] ?? k}">${k === 'back' ? icon('backspace') : k}</button>`)}
      </div>
    </div>`);

  const ref = (name) => layer.querySelector(`[data-ref="${name}"]`);
  const sheetEl = layer.querySelector('.sheet');

  function renderAmount() {
    const box = ref('amount');
    ref('amount-value').textContent = formatKeypadDisplay(s.amount);
    box.classList.toggle('empty', !parseAmount(s.amount));
    box.classList.toggle('income', s.type === 'income');
    box.setAttribute('aria-label', `金额 RM ${formatKeypadDisplay(s.amount)}`);
  }

  function renderCategories() {
    const all = store.categories();
    const list = activeCategories(all, s.type);
    // 修改旧记录时，即使类别已封存也要显示出来。
    if (s.categoryId && !list.some((c) => c.id === s.categoryId)) {
      const cat = findCategory(all, s.categoryId);
      if (cat.type === s.type && cat.id) list.push(cat);
    }
    ref('cats').innerHTML = String(html`${list.map((c) => html`
      <button type="button" class="cat-btn" data-sheet="category" data-id="${c.id}" aria-pressed="${c.id === s.categoryId}">
        <span class="cat-icon" data-color="${c.color}" aria-hidden="true">${c.icon}</span>
        <span class="cat-name">${c.name}</span>
      </button>`)}`);
  }

  function renderType() {
    for (const b of layer.querySelectorAll('[data-sheet="type"]')) {
      b.setAttribute('aria-checked', String(b.dataset.type === s.type));
    }
    ref('hint').textContent = editing ? '改好后点「保存」，或直接点类别' : '输入金额，再点类别就存好';
    renderCategories();
    renderAmount();
  }

  function renderDate() {
    ref('date-label').textContent = relativeDayLabel(s.date, today);
    ref('date').value = s.date;
  }

  function renderBusiness() {
    ref('business').setAttribute('aria-pressed', String(s.business));
  }

  function shake() {
    const box = ref('amount');
    box.classList.remove('shake');
    void box.offsetWidth; // 重新触发动画
    box.classList.add('shake');
  }

  async function save() {
    if (s.saving) return;
    const amount = parseAmount(s.amount);
    if (!amount) {
      shake();
      showToast('先输入金额');
      if (!editing) {
        s.categoryId = null;
        renderCategories();
      }
      return;
    }
    if (amount > MAX_AMOUNT_CENTS) {
      shake();
      showToast('金额太大了');
      return;
    }
    if (!s.categoryId) {
      showToast('点一个类别就存好');
      return;
    }
    const cat = findCategory(store.categories(), s.categoryId);
    const input = {
      type: s.type,
      amount,
      categoryId: s.categoryId,
      date: s.date,
      note: s.note,
      business: s.business || isBusinessCategory(cat),
    };
    s.saving = true;
    try {
      const saved = editing ? await store.update(tx.id, input) : await store.add(input);
      close();
      onSaved?.(saved);
    } catch (err) {
      showToast(`没存到：${err.message}`);
    } finally {
      s.saving = false;
    }
  }

  function press(key) {
    const next = pressKey(s.amount, key);
    if (next === s.amount && key !== 'back') shake();
    s.amount = next;
    renderAmount();
  }

  layer.addEventListener('click', (e) => {
    const keyBtn = e.target.closest('[data-key]');
    if (keyBtn) {
      press(keyBtn.dataset.key);
      return;
    }
    const target = e.target.closest('[data-sheet]');
    if (!target) return;
    switch (target.dataset.sheet) {
      case 'close':
        close();
        break;
      case 'type':
        if (s.type !== target.dataset.type) {
          s.type = target.dataset.type;
          if (findCategory(store.categories(), s.categoryId).type !== s.type) s.categoryId = null;
          renderType();
        }
        break;
      case 'business':
        s.business = !s.business;
        renderBusiness();
        break;
      case 'category': {
        s.categoryId = target.dataset.id;
        if (isBusinessCategory(findCategory(store.categories(), s.categoryId))) {
          s.business = true;
          renderBusiness();
        }
        renderCategories();
        save();
        break;
      }
      case 'save':
        save();
        break;
      case 'delete':
        close();
        onDelete?.(tx);
        break;
      default:
        break;
    }
  });

  ref('date').addEventListener('change', (e) => {
    const v = e.target.value;
    if (isValidISODate(v) && v <= today) s.date = v;
    renderDate();
  });
  ref('note').addEventListener('input', (e) => {
    s.note = e.target.value;
  });
  ref('note').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });

  // 电脑上也能用实体键盘打数字。
  layer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.target.matches('input')) return;
    if (/^[0-9.]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter' && s.categoryId) save();
    else return;
    e.preventDefault();
  });

  // 打开
  const previousFocus = document.activeElement;
  const app = document.getElementById('app');
  document.getElementById('sheet-root').append(layer);
  app.inert = true;
  document.body.classList.add('sheet-open');
  ref('note').value = s.note;
  renderType();
  renderDate();
  renderBusiness();
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
}
