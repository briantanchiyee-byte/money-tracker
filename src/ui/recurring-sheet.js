// 「固定项目」表单：每月几号自动记一笔（房租、电话费、订阅、薪水……）。

import { html } from '../core/html.js';
import { MAX_AMOUNT_CENTS, amountToInput, parseAmount } from '../core/money.js';
import { activeCategories, findCategory, isBusinessCategory } from '../core/categories.js';
import { openFormSheet, setFieldErrors } from './form-sheet.js';
import { showToast } from './toast.js';
import { icon } from './icons.js';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function categoryOptions(categories, type, selectedId) {
  const list = activeCategories(categories, type);
  if (selectedId && !list.some((c) => c.id === selectedId)) {
    const cat = findCategory(categories, selectedId);
    if (cat.type === type && cat.id) list.push(cat);
  }
  return list.map((c) => html`<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.icon} ${c.name}</option>`);
}

export function openRecurringSheet({ store, item = null, today, onSaved, onDelete }) {
  const editing = Boolean(item);
  const categories = store.categories();
  const initial = item ?? { type: 'expense', amount: null, categoryId: 'rent', note: '', day: 1, business: false, active: true };

  const body = html`
    <div class="seg-radio center">
      <label><input type="radio" name="type" value="expense" ${initial.type === 'expense' ? 'checked' : ''}><span>支出</span></label>
      <label><input type="radio" name="type" value="income" ${initial.type === 'income' ? 'checked' : ''}><span>收入</span></label>
    </div>

    <div class="field-group card-inset">
      <label class="field">
        <span class="field-label">名称</span>
        <input name="note" maxlength="200" placeholder="例如 房租、Unifi、Netflix" value="${initial.note}">
      </label>
      <label class="field">
        <span class="field-label">每月金额</span>
        <span class="money-input"><span>RM</span>
          <input name="amount" inputmode="decimal" placeholder="0.00" value="${initial.amount ? amountToInput(initial.amount) : ''}" aria-describedby="err-amount">
        </span>
      </label>
      <p class="field-error" id="err-amount" data-error-for="amount" hidden></p>
      <label class="field">
        <span class="field-label">类别</span>
        <select name="categoryId" data-ref="category">${categoryOptions(categories, initial.type, initial.categoryId)}</select>
      </label>
      <label class="field">
        <span class="field-label">每月几号</span>
        <select name="day">${DAYS.map((d) => html`<option value="${d}" ${d === initial.day ? 'selected' : ''}>${d} 号</option>`)}</select>
      </label>
      <p class="field-hint">没有这一天的月份（例如 2 月 30 号）会记在月底。</p>
    </div>

    <div class="field-group card-inset">
      <label class="switch-row">
        <span><span class="field-label">生意的钱</span></span>
        <input type="checkbox" role="switch" class="switch" name="business" ${initial.business ? 'checked' : ''}>
      </label>
      ${editing ? html`
        <label class="switch-row">
          <span>
            <span class="field-label">启用</span>
            <span class="field-hint">暂停后不会自动记账，也不会预留。</span>
          </span>
          <input type="checkbox" role="switch" class="switch" name="active" ${initial.active ? 'checked' : ''}>
        </label>` : ''}
    </div>

    <p class="field-hint pad">到期那天会自动记一笔。如果你先手动记了（同类别、金额差不多），那个月就不会重复记。</p>

    ${editing ? html`
      <button type="button" class="danger-btn" data-ref="delete">${icon('trash')}<span>删除这个固定项目</span></button>
      <p class="field-hint pad center">已经记下的记录会保留。</p>` : ''}`;

  return openFormSheet({
    title: editing ? '修改固定项目' : '新增固定项目',
    body,
    onMount({ form, close }) {
      const select = form.querySelector('[data-ref="category"]');
      const business = form.querySelector('[name="business"]');
      form.addEventListener('change', (e) => {
        if (e.target.name === 'type') {
          select.innerHTML = String(html`${categoryOptions(categories, e.target.value, null)}`);
        }
        if (e.target.name === 'type' || e.target.name === 'categoryId') {
          if (isBusinessCategory(findCategory(categories, select.value))) business.checked = true;
        }
      });
      form.querySelector('[data-ref="delete"]')?.addEventListener('click', () => {
        close();
        onDelete?.(item);
      });
      if (!editing) form.querySelector('[name="note"]').focus({ preventScroll: true });
    },
    async onSubmit(form) {
      const f = new FormData(form);
      const amount = parseAmount(f.get('amount'));
      const errors = {};
      if (amount === null) errors.amount = '请填金额';
      else if (!Number.isSafeInteger(amount)) errors.amount = '金额格式不对';
      else if (amount <= 0) errors.amount = '要大于 0';
      else if (amount > MAX_AMOUNT_CENTS) errors.amount = '金额太大了';
      setFieldErrors(form, errors);
      if (Object.keys(errors).length) return false;

      const categoryId = String(f.get('categoryId'));
      const input = {
        type: f.get('type') === 'income' ? 'income' : 'expense',
        amount,
        categoryId,
        note: String(f.get('note') ?? ''),
        day: Number(f.get('day')),
        business: f.get('business') === 'on' || isBusinessCategory(findCategory(categories, categoryId)),
      };
      if (editing) input.active = f.get('active') === 'on';
      try {
        const saved = editing
          ? await store.updateRecurring(item.id, input, { today })
          : await store.addRecurring(input, { today });
        onSaved?.(saved, { editing });
        return true;
      } catch (err) {
        showToast(`没存到：${err.message}`);
        return false;
      }
    },
  });
}
