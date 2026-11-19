import { html } from '../core/html.js';
import { formatMoney } from '../core/money.js';
import { fullDateLabel, relativeDayLabel, weekdayLabel } from '../core/dates.js';
import { summarize, transactionsOn } from '../core/transactions.js';
import { findCategory } from '../core/categories.js';
import { icon } from './icons.js';

function renderRow(tx, categories, justAddedId) {
  const cat = findCategory(categories, tx.categoryId);
  const isIncome = tx.type === 'income';
  const amount = isIncome ? formatMoney(tx.amount, { sign: true }) : formatMoney(-tx.amount);
  const label = [
    cat.name,
    tx.business ? '生意' : null,
    `${isIncome ? '收入' : '支出'} ${formatMoney(tx.amount)}`,
    tx.note || null,
    '点一下修改',
  ].filter(Boolean).join('，');

  return html`
    <li class="swipe-row ${tx.id === justAddedId ? 'pop-in' : ''}" data-id="${tx.id}">
      <button type="button" class="row-delete" data-action="delete" data-id="${tx.id}" tabindex="-1" aria-hidden="true">删除</button>
      <button type="button" class="row-main" data-action="edit" data-id="${tx.id}" aria-label="${label}">
        <span class="cat-icon" data-color="${cat.color}" aria-hidden="true">${cat.icon}</span>
        <span class="row-text">
          <span class="row-title">${cat.name}${tx.business ? html`<span class="badge">生意</span>` : ''}</span>
          ${tx.note ? html`<span class="row-sub">${tx.note}</span>` : ''}
        </span>
        <span class="row-amount num ${tx.type}">${amount}</span>
      </button>
    </li>`;
}

export function renderToday({ transactions, categories, viewDate, today, justAddedId, persistent }) {
  const isToday = viewDate === today;
  const rows = transactionsOn(transactions, viewDate);
  const sum = summarize(rows);
  const title = relativeDayLabel(viewDate, today);
  const isRelative = ['今天', '昨天', '前天'].includes(title);
  const eyebrow = isRelative ? fullDateLabel(viewDate, today) : weekdayLabel(viewDate);

  return html`
    ${persistent ? '' : html`
      <p class="notice" role="alert">这个浏览器现在不能保存资料（可能开了无痕浏览）。现在记的账，关掉页面就会不见。</p>`}

    <header class="today-head">
      <div class="today-title">
        <p class="eyebrow">${eyebrow}</p>
        <h1 class="large-title">${title}</h1>
      </div>
      <div class="day-nav">
        <button type="button" class="icon-btn" data-action="day-prev" aria-label="前一天">${icon('chevron-left')}</button>
        <button type="button" class="icon-btn" data-action="day-next" aria-label="后一天" ${isToday ? 'disabled' : ''}>${icon('chevron-right')}</button>
      </div>
    </header>

    <section class="card summary" aria-label="${title}的合计">
      <p class="summary-label">${isToday ? '今天花了' : '这天花了'}</p>
      <p class="summary-amount num">${formatMoney(sum.personalExpense)}</p>
      <div class="summary-grid">
        <div>
          <p class="stat-label">生意支出</p>
          <p class="stat-value num">${formatMoney(sum.businessExpense)}</p>
        </div>
        <div>
          <p class="stat-label">收入</p>
          <p class="stat-value num ${sum.income ? 'income' : ''}">${formatMoney(sum.income)}</p>
        </div>
        <div>
          <p class="stat-label">笔数</p>
          <p class="stat-value num">${sum.count}</p>
        </div>
      </div>
    </section>

    <h2 class="section-title">
      <span>记录</span>
      ${rows.length ? html`<span class="section-aside">左滑删除 · 点一下修改</span>` : ''}
    </h2>
    ${rows.length
      ? html`<ul class="card list">${rows.map((t) => renderRow(t, categories, justAddedId))}</ul>`
      : html`
        <div class="card empty">
          <p class="empty-emoji" aria-hidden="true">🪙</p>
          <p>${isToday ? '今天还没有记录' : '这天没有记录'}</p>
          <p class="empty-sub">点右下角的 ＋ 记一笔</p>
        </div>`}

    ${isToday ? '' : html`<button type="button" class="pill-btn" data-action="day-today">回到今天</button>`}
  `;
}
