// 一笔记录的列表行（今天、记录页共用）：点一下修改，左滑删除。

import { html } from '../core/html.js';
import { formatMoney } from '../core/money.js';
import { findCategory } from '../core/categories.js';

export function renderRow(tx, categories, { justAddedId = null, recurringIds = null, dateLabel = '' } = {}) {
  const cat = findCategory(categories, tx.categoryId);
  const isIncome = tx.type === 'income';
  const isRecurring = Boolean(tx.recurringId) || Boolean(recurringIds?.has(tx.id));
  const amount = isIncome ? formatMoney(tx.amount, { sign: true }) : formatMoney(-tx.amount);
  const label = [
    dateLabel || null,
    cat.name,
    tx.business ? '生意' : null,
    isRecurring ? '固定项目' : null,
    `${isIncome ? '收入' : '支出'} ${formatMoney(tx.amount)}`,
    tx.note || null,
    '点一下修改',
  ].filter(Boolean).join('，');
  const sub = [dateLabel, tx.note].filter(Boolean).join(' · ');

  return html`
    <li class="swipe-row ${tx.id === justAddedId ? 'pop-in' : ''}" data-id="${tx.id}">
      <button type="button" class="row-delete" data-action="delete" data-id="${tx.id}" tabindex="-1" aria-hidden="true">删除</button>
      <button type="button" class="row-main" data-action="edit" data-id="${tx.id}" aria-label="${label}">
        <span class="cat-icon" data-color="${cat.color}" aria-hidden="true">${cat.icon}</span>
        <span class="row-text">
          <span class="row-title">${cat.name}${tx.business ? html`<span class="badge">生意</span>` : ''}${isRecurring ? html`<span class="badge plain">固定</span>` : ''}</span>
          ${sub ? html`<span class="row-sub">${sub}</span>` : ''}
        </span>
        <span class="row-amount num ${tx.type}">${amount}</span>
      </button>
    </li>`;
}
