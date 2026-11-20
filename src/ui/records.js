// 记录页：按月浏览、搜索、每天小计。

import { html } from '../core/html.js';
import { formatMoney } from '../core/money.js';
import { relativeDayLabel, weekdayLabel } from '../core/dates.js';
import { summarize } from '../core/transactions.js';
import { groupByDay, searchTransactions, transactionsInMonth } from '../core/records.js';
import { monthLabel, monthOf } from '../core/periods.js';
import { icon } from './icons.js';
import { renderRow } from './rows.js';
import { dotted } from './today.js';

const SEARCH_LIMIT = 200;

function dayHeader(day, today) {
  const s = day.summary;
  const parts = [
    s.personalExpense ? `花了 ${formatMoney(s.personalExpense)}` : null,
    s.businessExpense ? `生意 ${formatMoney(s.businessExpense)}` : null,
    s.income ? `收入 ${formatMoney(s.income)}` : null,
  ];
  return html`
    <h3 class="day-head">
      <span>${relativeDayLabel(day.date, today)} <span class="muted">${weekdayLabel(day.date)}</span></span>
      <span class="day-total num">${dotted(parts)}</span>
    </h3>`;
}

/** 列表部分（搜索时只更新这一块，输入框才不会失去焦点）。 */
export function renderRecordList({ transactions, categories, month, query, today, recurringIds, justAddedId }) {
  const q = query.trim();
  if (q) {
    const found = searchTransactions(transactions, q, categories);
    if (!found.length) {
      return html`<div class="card empty"><p>找不到「${q}」</p><p class="empty-sub">可以搜备注、类别或金额</p></div>`;
    }
    const sum = summarize(found);
    const shown = groupByDay(found.slice(0, SEARCH_LIMIT));
    return html`
      <p class="result-count">${dotted([`找到 ${found.length} 笔`, sum.personalExpense ? `支出 ${formatMoney(sum.personalExpense)}` : null, sum.income ? `收入 ${formatMoney(sum.income)}` : null])}</p>
      ${shown.map((day) => html`
        ${dayHeader(day, today)}
        <ul class="card list">${day.items.map((t) => renderRow(t, categories, { recurringIds, justAddedId }))}</ul>`)}
      ${found.length > SEARCH_LIMIT ? html`<p class="footnote">只显示前 ${SEARCH_LIMIT} 笔，打多几个字缩小范围。</p>` : ''}`;
  }

  const inMonth = transactionsInMonth(transactions, month);
  if (!inMonth.length) {
    return html`<div class="card empty"><p class="empty-emoji" aria-hidden="true">🗓️</p><p>${monthLabel(month, today)}没有记录</p></div>`;
  }
  return html`${groupByDay(inMonth).map((day) => html`
    ${dayHeader(day, today)}
    <ul class="card list">${day.items.map((t) => renderRow(t, categories, { recurringIds, justAddedId }))}</ul>`)}`;
}

export function renderRecords(props) {
  const { transactions, month, query, today } = props;
  const isThisMonth = month >= monthOf(today);
  const sum = summarize(transactionsInMonth(transactions, month));

  return html`
    <header class="page-head"><h1 class="large-title">记录</h1></header>

    <label class="search">
      ${icon('search')}
      <input type="search" data-ref="search" placeholder="搜备注、类别、金额" value="${query}" enterkeyhint="search" aria-label="搜索记录">
    </label>

    <div data-ref="month-block" ${query.trim() ? 'hidden' : ''}>
      <div class="month-nav">
        <button type="button" class="icon-btn" data-action="month-prev" aria-label="上个月">${icon('chevron-left')}</button>
        <h2 class="month-title">${monthLabel(month, today)}</h2>
        <button type="button" class="icon-btn" data-action="month-next" aria-label="下个月" ${isThisMonth ? 'disabled' : ''}>${icon('chevron-right')}</button>
      </div>
      <section class="card summary compact" aria-label="${monthLabel(month, today)}的合计">
        <div class="summary-grid">
          <div>
            <p class="stat-label">个人支出</p>
            <p class="stat-value num">${formatMoney(sum.personalExpense)}</p>
          </div>
          <div>
            <p class="stat-label">生意支出</p>
            <p class="stat-value num">${formatMoney(sum.businessExpense)}</p>
          </div>
          <div>
            <p class="stat-label">收入</p>
            <p class="stat-value num ${sum.income ? 'income' : ''}">${formatMoney(sum.income)}</p>
          </div>
        </div>
      </section>
    </div>

    <div data-ref="record-list" class="record-list">${renderRecordList(props)}</div>
  `;
}
