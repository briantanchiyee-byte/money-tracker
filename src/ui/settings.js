import { html } from '../core/html.js';
import { formatMoney } from '../core/money.js';
import { activeCategories, findCategory } from '../core/categories.js';
import { hasPlan, monthlySpendable } from '../core/plan.js';
import { icon } from './icons.js';

const chip = (c) => html`
  <span class="cat-chip">
    <span class="cat-icon small" data-color="${c.color}" aria-hidden="true">${c.icon}</span>${c.name}
  </span>`;

function planSection(plan) {
  if (!hasPlan(plan)) {
    return html`
      <section class="card group">
        <button type="button" class="cell cell-button" data-action="open-plan">设定每月计划</button>
      </section>
      <p class="footnote">设定后，「今天」会显示每天还能花多少。</p>`;
  }
  const w = plan.cycleWindow;
  const period = plan.periodMode === 'cycle' ? `收入周期（${w.from}–${w.to} 号）` : '日历月';
  return html`
    <section class="card group">
      <div class="cell"><span>每月预计收入</span><span class="cell-value num">${formatMoney(plan.expectedIncome)}</span></div>
      <div class="cell"><span>每月存款目标</span><span class="cell-value num">${formatMoney(plan.savingsTarget)}</span></div>
      <div class="cell"><span>每月可以花</span><span class="cell-value num strong">${formatMoney(monthlySpendable(plan))}</span></div>
      <div class="cell"><span>预算周期</span><span class="cell-value">${period}</span></div>
      <div class="cell"><span>生意支出</span><span class="cell-value">${plan.budgetIncludesBusiness ? '占每日额度' : '另外列出'}</span></div>
      <button type="button" class="cell cell-button" data-action="open-plan">修改计划</button>
    </section>`;
}

function recurringRow(item, categories) {
  const cat = findCategory(categories, item.categoryId);
  const name = item.note || cat.name;
  const amount = item.type === 'income' ? formatMoney(item.amount, { sign: true }) : formatMoney(-item.amount);
  return html`
    <li>
      <button type="button" class="row-main ${item.active ? '' : 'paused'}" data-action="edit-recurring" data-id="${item.id}"
        aria-label="${name}，每月 ${item.day} 号，${item.type === 'income' ? '收入' : '支出'} ${formatMoney(item.amount)}${item.active ? '' : '，已暂停'}，点一下修改">
        <span class="cat-icon" data-color="${cat.color}" aria-hidden="true">${cat.icon}</span>
        <span class="row-text">
          <span class="row-title">${name}${item.business ? html`<span class="badge">生意</span>` : ''}${item.active ? '' : html`<span class="badge plain">暂停</span>`}</span>
          <span class="row-sub">每月 ${item.day} 号 · ${cat.name}</span>
        </span>
        <span class="row-amount num ${item.type}">${amount}</span>
      </button>
    </li>`;
}

export function renderSettings({ version, transactions, categories, standalone, persistent, plan, recurring }) {
  const expense = activeCategories(categories, 'expense');
  const income = activeCategories(categories, 'income');
  const items = [...recurring].sort((a, b) => b.active - a.active || a.day - b.day);

  return html`
    <header class="page-head"><h1 class="large-title">设置</h1></header>

    ${standalone ? '' : html`
      <section class="card group install">
        <h2 class="group-title">装到 iPhone 主屏幕</h2>
        <ol class="steps">
          <li>用 <strong>Safari</strong> 打开这个网址</li>
          <li>点底部的<strong>分享</strong>按钮</li>
          <li>往下滑，选<strong>添加到主屏幕</strong></li>
        </ol>
        <p class="group-foot">装好后从主屏幕打开，就像普通 App，没网也能用。</p>
      </section>`}

    <h2 class="section-title"><span>每月计划</span></h2>
    ${planSection(plan)}

    <h2 class="section-title"><span>固定项目</span></h2>
    <section class="card group">
      ${items.length ? html`<ul class="list">${items.map((i) => recurringRow(i, categories))}</ul>` : ''}
      <button type="button" class="cell cell-button with-icon" data-action="add-recurring">${icon('plus')}<span>新增固定项目</span></button>
    </section>
    <p class="footnote">房租、电话费、订阅、薪水……到期那天会自动记一笔，还没到期的会先从额度里预留。</p>

    <h2 class="section-title"><span>资料</span></h2>
    <section class="card group">
      <div class="cell"><span>记录笔数</span><span class="cell-value num">${transactions.length}</span></div>
      <div class="cell"><span>保存在</span><span class="cell-value">${persistent ? '只在这台设备' : '暂存（关掉就没了）'}</span></div>
    </section>
    <p class="footnote">资料不会上传到任何地方。备份功能还在做，在那之前请不要清除 Safari 的网站资料。</p>

    <h2 class="section-title"><span>类别</span></h2>
    <section class="card group">
      <p class="cell-head">支出</p>
      <div class="cat-chips">${expense.map(chip)}</div>
      <p class="cell-head">收入</p>
      <div class="cat-chips">${income.map(chip)}</div>
    </section>
    <p class="footnote">选「进货成本」或「生意营运」会自动算成生意的钱。其他类别在记账时点「生意」也可以。</p>

    <h2 class="section-title"><span>关于</span></h2>
    <section class="card group">
      <div class="cell"><span>版本</span><span class="cell-value num">v${version}</span></div>
      <button type="button" class="cell cell-button" data-action="check-update">检查更新</button>
    </section>
  `;
}
