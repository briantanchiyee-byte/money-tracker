// 「每月计划」表单：预计收入、存款目标、预算周期、生意支出占不占额度。

import { html } from '../core/html.js';
import { amountToInput, formatMoney, parseAmount } from '../core/money.js';
import { lateDays, normalizeWindow } from '../core/periods.js';
import { validatePlanInput } from '../core/plan.js';
import { openFormSheet, setFieldErrors } from './form-sheet.js';
import { showToast } from './toast.js';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const dayOptions = (selected) =>
  DAYS.map((d) => html`<option value="${d}" ${d === selected ? 'selected' : ''}>${d} 号</option>`);

function readForm(form) {
  const f = new FormData(form);
  return {
    expectedIncome: parseAmount(f.get('expectedIncome')),
    savingsTarget: parseAmount(f.get('savingsTarget')),
    periodMode: f.get('periodMode'),
    cycleWindow: { from: Number(f.get('cycleFrom')), to: Number(f.get('cycleTo')) },
    budgetIncludesBusiness: f.get('budgetIncludesBusiness') === 'on',
  };
}

export function openPlanSheet({ store, defaultStartDate, onSaved }) {
  const plan = store.plan();
  const isNew = !plan.expectedIncome;

  const body = html`
    <p class="form-intro">按这个计划算「今天还能花」。数字随时可以改。</p>

    <div class="field-group card-inset">
      <label class="field">
        <span class="field-label">每月预计收入</span>
        <span class="money-input"><span>RM</span>
          <input name="expectedIncome" inputmode="decimal" placeholder="例如 4000" value="${plan.expectedIncome ? amountToInput(plan.expectedIncome) : ''}" aria-describedby="err-income">
        </span>
      </label>
      <p class="field-error" id="err-income" data-error-for="expectedIncome" hidden></p>
      <p class="field-hint">生意的钱进来后，打算给自己生活用的部分。收入不固定的话，填保守一点的数字。</p>

      <label class="field">
        <span class="field-label">每月存款目标</span>
        <span class="money-input"><span>RM</span>
          <input name="savingsTarget" inputmode="decimal" placeholder="0" value="${plan.savingsTarget ? amountToInput(plan.savingsTarget) : ''}" aria-describedby="err-savings">
        </span>
      </label>
      <p class="field-error" id="err-savings" data-error-for="savingsTarget" hidden></p>

      <p class="spendable" data-ref="spendable" aria-live="polite"></p>
    </div>

    <fieldset class="field-group card-inset">
      <legend class="field-label">预算周期</legend>
      <div class="seg-radio">
        <label><input type="radio" name="periodMode" value="month" ${plan.periodMode === 'month' ? 'checked' : ''}><span>日历月</span></label>
        <label><input type="radio" name="periodMode" value="cycle" ${plan.periodMode === 'cycle' ? 'checked' : ''}><span>收入周期</span></label>
      </div>
      <p class="field-hint" data-ref="mode-hint"></p>
      <div class="window-row" data-ref="window">
        <span>收入通常在每月</span>
        <select name="cycleFrom" aria-label="最早几号">${dayOptions(plan.cycleWindow.from)}</select>
        <span>到</span>
        <select name="cycleTo" aria-label="最晚几号">${dayOptions(plan.cycleWindow.to)}</select>
        <span>进来</span>
      </div>
      <p class="field-error" data-error-for="cycleWindow" hidden></p>
      <p class="field-hint" data-ref="window-hint"></p>
    </fieldset>

    <div class="field-group card-inset">
      <label class="switch-row">
        <span>
          <span class="field-label">生意支出也占每日额度</span>
          <span class="field-hint">关掉时，进货、营运的钱另外列出，不影响「今天还能花」。</span>
        </span>
        <input type="checkbox" role="switch" class="switch" name="budgetIncludesBusiness" ${plan.budgetIncludesBusiness ? 'checked' : ''}>
      </label>
    </div>`;

  return openFormSheet({
    title: '每月计划',
    body,
    onMount({ form }) {
      const ref = (name) => form.querySelector(`[data-ref="${name}"]`);
      const update = () => {
        const v = readForm(form);
        const ok = Number.isSafeInteger(v.expectedIncome) && v.expectedIncome > 0;
        const savings = Number.isSafeInteger(v.savingsTarget) ? v.savingsTarget : 0;
        ref('spendable').textContent = ok ? `每月可以花 ${formatMoney(v.expectedIncome - savings)}` : '';
        const cycle = v.periodMode === 'cycle';
        ref('window').hidden = !cycle;
        ref('window-hint').hidden = !cycle;
        ref('mode-hint').textContent = cycle
          ? '从「生意收入」或「薪水兼职」进来那天开始，到下次收入前一天。钱要撑到下次收入，每日额度会算到那天。'
          : '每月 1 号到月底。收入日子很乱、一个月进来好几次的话，用这个比较简单。';
        const win = normalizeWindow(v.cycleWindow);
        ref('window-hint').textContent = win
          ? `窗口内第一笔收入开始新的一期，晚到 ${lateDays(win)} 天内也算。还没进来时，先假设 ${win.to} 号才到。`
          : '';
      };
      form.addEventListener('input', update);
      form.addEventListener('change', update);
      update();
      if (isNew) form.querySelector('[name="expectedIncome"]').focus({ preventScroll: true });
    },
    async onSubmit(form) {
      const { errors, plan: next } = validatePlanInput({
        ...readForm(form),
        startDate: plan.startDate ?? defaultStartDate,
      });
      setFieldErrors(form, errors);
      if (Object.keys(errors).length) return false;
      try {
        await store.savePlan(next);
      } catch (err) {
        showToast(`没存到：${err.message}`);
        return false;
      }
      onSaved?.(next);
      return true;
    },
  });
}
