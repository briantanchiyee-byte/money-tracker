import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBudget } from '../src/core/budget.js';
import { calendarMonthPeriod, incomeCyclePeriod } from '../src/core/periods.js';
import { createRecurring } from '../src/core/recurring.js';
import { createTransaction } from '../src/core/transactions.js';
import { normalizePlan, validatePlanInput } from '../src/core/plan.js';

// 全部是编出来的数字。
let n = 0;
const tx = (date, amount, fields = {}) => createTransaction(
  { type: 'expense', amount, categoryId: 'food', date, note: '', business: false, ...fields },
  { now: (n += 1), id: `t${n}` },
);
const plan = (fields = {}) => normalizePlan({ expectedIncome: 400000, savingsTarget: 100000, ...fields });
const nov = (today) => calendarMonthPeriod(today);

test('没有计划就不算', () => {
  assert.equal(computeBudget({ today: '2026-11-19', transactions: [], plan: normalizePlan({}), period: nov('2026-11-19') }), null);
});

test('每日额度 = (本期预算 − 之前已花) ÷ 剩下天数；今天还能花 = 每日额度 − 今天已花', () => {
  const today = '2026-11-21'; // 11 月剩 10 天（21–30）
  const list = [tx('2026-11-03', 100000), tx('2026-11-21', 2500), tx('2026-10-30', 99999)];
  const b = computeBudget({ today, transactions: list, plan: plan(), period: nov(today) });
  assert.equal(b.budget, 300000);
  assert.equal(b.spentBefore, 100000);
  assert.equal(b.remainingDays, 10);
  assert.equal(b.daily, 20000); // (3000 − 1000) ÷ 10 = RM 200
  assert.equal(b.todaySpent, 2500);
  assert.equal(b.leftToday, 17500);
  assert.equal(b.periodLeft, 300000 - 102500);
});

test('生意支出默认不占额度，打开开关才占', () => {
  const today = '2026-11-21';
  const list = [tx('2026-11-21', 50000, { business: true, categoryId: 'biz-stock' }), tx('2026-11-21', 1000)];
  const off = computeBudget({ today, transactions: list, plan: plan(), period: nov(today) });
  assert.equal(off.todaySpent, 1000);
  assert.equal(off.businessSpent, 50000);
  const on = computeBudget({ today, transactions: list, plan: plan({ budgetIncludesBusiness: true }), period: nov(today) });
  assert.equal(on.todaySpent, 51000);
  assert.equal(on.businessSpent, 0);
});

test('收入不会减少花费', () => {
  const today = '2026-11-21';
  const list = [tx('2026-11-20', 500000, { type: 'income', categoryId: 'biz-income' })];
  const b = computeBudget({ today, transactions: list, plan: plan(), period: nov(today) });
  assert.equal(b.spent, 0);
});

test('还没扣的固定支出先预留；今天自动记的固定支出不算「今天已花」', () => {
  const today = '2026-11-21';
  const rent = createRecurring({ type: 'expense', amount: 120000, categoryId: 'rent', day: 25 }, { today: '2026-11-01', id: 'rent' });
  const phone = createRecurring({ type: 'expense', amount: 5000, categoryId: 'phone', day: 21 }, { today: '2026-11-01', id: 'phone' });
  const list = [tx(today, 5000, { categoryId: 'phone', recurringId: 'phone' }), tx(today, 1500)];
  const b = computeBudget({ today, transactions: list, recurring: [rent, phone], plan: plan(), period: nov(today) });
  assert.equal(b.pending, 120000);
  assert.equal(b.todayRecurring, 5000);
  assert.equal(b.todaySpent, 1500);
  assert.equal(b.daily, Math.floor((300000 - 5000 - 120000) / 10));
});

test('手动先付的固定支出也不算「今天已花」，也不再预留', () => {
  const today = '2026-11-21';
  const rent = createRecurring({ type: 'expense', amount: 120000, categoryId: 'rent', day: 25 }, { today: '2026-11-01', id: 'rent' });
  const list = [tx(today, 120000, { categoryId: 'rent' })];
  const b = computeBudget({ today, transactions: list, recurring: [rent], plan: plan(), period: nov(today) });
  assert.equal(b.pending, 0);
  assert.equal(b.todayRecurring, 120000);
  assert.equal(b.todaySpent, 0);
});

test('中途才开始用计划：预算按剩下天数折算，之前的花费不算', () => {
  const today = '2026-11-21';
  const list = [tx('2026-11-05', 80000), tx('2026-11-21', 1000)];
  const b = computeBudget({ today, transactions: list, plan: plan({ startDate: '2026-11-21' }), period: nov(today) });
  assert.equal(b.prorated, true);
  assert.equal(b.budget, 100000); // 3000 × 10/30
  assert.equal(b.spentBefore, 0);
  assert.equal(b.daily, 10000);
});

test('花超了：今天还能花变成负数', () => {
  const today = '2026-11-30';
  const b = computeBudget({ today, transactions: [tx('2026-11-01', 290000), tx(today, 20000)], plan: plan(), period: nov(today) });
  assert.equal(b.daily, 10000);
  assert.equal(b.leftToday, -10000);
  assert.equal(b.spentRatio, 1);
});

test('收入周期：额度算到下次收入前一天，不是月底', () => {
  const today = '2026-11-21';
  const income = tx('2026-11-16', 400000, { type: 'income', categoryId: 'biz-income' });
  const period = incomeCyclePeriod({ today, transactions: [income], window: { from: 14, to: 20 } });
  const b = computeBudget({ today, transactions: [income], plan: plan(), period });
  assert.equal(b.remainingDays, 29); // 11/21 – 12/19
  assert.equal(b.daily, Math.floor(300000 / 29));
});

test('每日额度不会因为除不尽多给一分钱', () => {
  const today = '2026-11-28'; // 剩 3 天
  const b = computeBudget({ today, transactions: [], plan: plan({ expectedIncome: 100100, savingsTarget: 0 }), period: nov(today) });
  assert.equal(b.daily, 33366);
  assert.ok(b.daily * 3 <= 100100);
});

test('计划表单：空白和 0 不一样', () => {
  assert.equal(validatePlanInput({ expectedIncome: null, savingsTarget: null }).errors.expectedIncome, '请填每月预计收入');
  assert.equal(validatePlanInput({ expectedIncome: 0, savingsTarget: null }).errors.expectedIncome, '要大于 0');
  assert.equal(validatePlanInput({ expectedIncome: NaN, savingsTarget: null }).errors.expectedIncome, '金额格式不对');
  const ok = validatePlanInput({ expectedIncome: 400000, savingsTarget: null });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.plan.savingsTarget, 0);
  assert.equal(validatePlanInput({ expectedIncome: 1000, savingsTarget: 2000 }).errors.savingsTarget, '存款目标比收入还多');
  assert.ok(validatePlanInput({ expectedIncome: 1000, periodMode: 'cycle', cycleWindow: { from: 20, to: 10 } }).errors.cycleWindow);
});

test('读出来的计划坏掉时用默认值', () => {
  const p = normalizePlan({ expectedIncome: '4000', savingsTarget: -1, periodMode: 'week', cycleWindow: { from: 40 }, startDate: '2026-13-01' });
  assert.equal(p.expectedIncome, null);
  assert.equal(p.savingsTarget, 0);
  assert.equal(p.periodMode, 'month');
  assert.deepEqual(p.cycleWindow, { from: 14, to: 20 });
  assert.equal(p.startDate, null);
  assert.equal(p.budgetIncludesBusiness, false);
});
