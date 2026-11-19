import { html } from '../core/html.js';
import { activeCategories } from '../core/categories.js';

const chip = (c) => html`
  <span class="cat-chip">
    <span class="cat-icon small" data-color="${c.color}" aria-hidden="true">${c.icon}</span>${c.name}
  </span>`;

export function renderSettings({ version, transactions, categories, standalone, persistent }) {
  const expense = activeCategories(categories, 'expense');
  const income = activeCategories(categories, 'income');

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
