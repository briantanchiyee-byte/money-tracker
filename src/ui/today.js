import { html } from '../core/html.js';
import { formatMoney } from '../core/money.js';
import { fullDateLabel, monthDayLabel, relativeDayLabel, weekdayLabel } from '../core/dates.js';
import { summarize, transactionsOn } from '../core/transactions.js';
import { icon } from './icons.js';
import { renderRow } from './rows.js';

const pct = (ratio) => Math.round(ratio * 100);

/** 「a · b · c」：每段不拆行，只在段与段之间换行。 */
const dotted = (parts) => html`${parts.filter(Boolean).map((p, i) => html`${i ? html`<span class="dot" aria-hidden="true"> · </span>` : ''}<span class="nowrap">${p}</span>`)}`;

function renderBudgetCard(b, today) {
  const p = b.period;
  const over = b.leftToday < 0;
  const range = `${monthDayLabel(b.from, today)} – ${monthDayLabel(p.end, today)}`;
  const notes = [];
  if (p.estimated) notes.push(`还没记到这期的收入，先从 ${monthDayLabel(p.start, today)} 算起。收入进来后记一笔「生意收入」，周期会自动对齐。`);
  if (p.late) notes.push('收入比平时晚到，额度先算到今天。收入进来后会开始新的一期。');
  if (b.prorated) notes.push(`这期从 ${monthDayLabel(b.from, today)} 开始用计划，预算按剩下的天数折算。`);
  if (b.daily < 0) notes.push('这期的预算已经用完了。');

  return html`
    <section class="card hero" aria-label="今天还能花">
      <div class="hero-head">
        <p class="summary-label">${over ? '今天超出了' : '今天还能花'}</p>
        <button type="button" class="period-chip" data-action="open-plan" aria-label="本期 ${range}，还有 ${b.remainingDays} 天。点一下修改计划">
          ${range}<span class="dot" aria-hidden="true"> · </span>还有 ${b.remainingDays} 天
        </button>
      </div>
      <p class="hero-amount num ${over ? 'over' : ''}">${formatMoney(over ? -b.leftToday : b.leftToday)}</p>
      <p class="hero-line">${dotted([`每日额度 ${formatMoney(b.daily)}`, `今天花了 ${formatMoney(b.todaySpent)}`, b.todayRecurring ? `固定支出 ${formatMoney(b.todayRecurring)}` : null])}</p>

      <div class="meter" role="img" aria-label="本期预算用了 ${pct(b.spentRatio)}%，时间过了 ${pct(b.timeRatio)}%">
        <span class="meter-fill ${b.spentRatio > b.timeRatio ? 'ahead' : ''}" data-pct="${pct(b.spentRatio)}"></span>
        <span class="meter-mark" data-pct="${pct(b.timeRatio)}"></span>
      </div>
      <p class="meter-caption" aria-hidden="true"><span>预算用了 ${pct(b.spentRatio)}%</span><span>时间过了 ${pct(b.timeRatio)}%</span></p>

      <div class="summary-grid">
        <div>
          <p class="stat-label">本期还剩</p>
          <p class="stat-value num ${b.periodLeft < 0 ? 'negative' : ''}">${formatMoney(b.periodLeft)}</p>
        </div>
        <div>
          <p class="stat-label">还要付的固定</p>
          <p class="stat-value num">${formatMoney(b.pending)}</p>
        </div>
        <div>
          <p class="stat-label">本期预算</p>
          <p class="stat-value num">${formatMoney(b.budget)}</p>
        </div>
      </div>
      ${notes.length ? html`<div class="hero-notes">${notes.map((n) => html`<p>${n}</p>`)}</div>` : ''}
    </section>`;
}

const planPrompt = html`
  <section class="card hero setup">
    <p class="summary-label">今天还能花</p>
    <p class="setup-text">填好每月预计收入和存款目标，就能看到每天还能花多少。</p>
    <button type="button" class="primary-btn" data-action="open-plan">设定每月计划</button>
  </section>`;

export function renderToday({ transactions, categories, viewDate, today, justAddedId, persistent, budget, recurringIds }) {
  const isToday = viewDate === today;
  const rows = transactionsOn(transactions, viewDate);
  const sum = summarize(rows);
  const title = relativeDayLabel(viewDate, today);
  const isRelative = ['今天', '昨天', '前天'].includes(title);
  const eyebrow = isRelative ? fullDateLabel(viewDate, today) : weekdayLabel(viewDate);

  let top;
  if (isToday && budget) {
    top = html`
      ${renderBudgetCard(budget, today)}
      <p class="today-strip">${dotted([
        `生意支出 ${formatMoney(sum.businessExpense)}`,
        `收入 ${formatMoney(sum.income)}`,
        `${sum.count} 笔`,
      ])}</p>`;
  } else {
    top = html`
      ${isToday ? planPrompt : ''}
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
      </section>`;
  }

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

    ${top}

    <h2 class="section-title">
      <span>记录</span>
      ${rows.length ? html`<span class="section-aside">左滑删除 · 点一下修改</span>` : ''}
    </h2>
    ${rows.length
      ? html`<ul class="card list">${rows.map((t) => renderRow(t, categories, { justAddedId, recurringIds }))}</ul>`
      : html`
        <div class="card empty">
          <p class="empty-emoji" aria-hidden="true">🪙</p>
          <p>${isToday ? '今天还没有记录' : '这天没有记录'}</p>
          <p class="empty-sub">点右下角的 ＋ 记一笔</p>
        </div>`}

    ${isToday ? '' : html`<button type="button" class="pill-btn" data-action="day-today">回到今天</button>`}
  `;
}

export { dotted };
