process.env.TZ = 'Asia/Kuala_Lumpur';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  calendarMonthPeriod,
  currentPeriod,
  dayInMonth,
  incomeCyclePeriod,
  lateDays,
  monthLabel,
  normalizeWindow,
  periodLength,
} from '../src/core/periods.js';

let n = 0;
const income = (date, categoryId = 'biz-income', amount = 300000) => ({
  id: `i${(n += 1)}`, type: 'income', amount, categoryId, date, note: '', business: false, createdAt: n, updatedAt: n,
});
const window = { from: 14, to: 20 };

test('月份加减会跨年', () => {
  assert.equal(addMonths('2026-11', 2), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-03', -14), '2025-01');
});

test('没有 31 号的月份用月底', () => {
  assert.equal(dayInMonth('2026-02', 31), '2026-02-28');
  assert.equal(dayInMonth('2028-02', 30), '2028-02-29');
  assert.equal(dayInMonth('2026-04', 31), '2026-04-30');
});

test('日历月：1 号到月底', () => {
  const p = calendarMonthPeriod('2026-02-10');
  assert.equal(p.start, '2026-02-01');
  assert.equal(p.end, '2026-02-28');
  assert.equal(periodLength(p), 28);
  assert.equal(monthLabel('2026-11', '2026-11-19'), '11月');
  assert.equal(monthLabel('2025-12', '2026-11-19'), '2025年12月');
});

test('收入窗口要合理', () => {
  assert.deepEqual(normalizeWindow({ from: '14', to: 20 }), { from: 14, to: 20 });
  assert.equal(normalizeWindow({ from: 20, to: 14 }), null);
  assert.equal(normalizeWindow({ from: 0, to: 14 }), null);
  assert.equal(normalizeWindow(null), null);
  assert.equal(lateDays({ from: 14, to: 20 }), 13);
  assert.equal(lateDays({ from: 1, to: 28 }), 0); // 窗口太宽就不给宽限，免得和下个月重叠
});

test('收入周期：从窗口内的收入那天开始，到下次窗口最后一天的前一天', () => {
  const p = incomeCyclePeriod({ today: '2026-11-25', transactions: [income('2026-11-16')], window });
  assert.equal(p.start, '2026-11-16');
  assert.equal(p.end, '2026-12-19'); // 假设下次收入 12/20 才到
  assert.equal(p.estimated, false);
  assert.equal(p.late, false);
});

test('收入周期：下个月初还在同一期', () => {
  const p = incomeCyclePeriod({ today: '2026-12-05', transactions: [income('2026-11-16')], window });
  assert.equal(p.start, '2026-11-16');
});

test('收入周期：下次收入一到就开新的一期', () => {
  const tx = [income('2026-11-16'), income('2026-12-15')];
  const p = incomeCyclePeriod({ today: '2026-12-15', transactions: tx, window });
  assert.equal(p.start, '2026-12-15');
  assert.equal(p.end, '2027-01-19');
});

test('收入周期：窗口里还没收到钱，还是上一期', () => {
  const p = incomeCyclePeriod({ today: '2026-12-17', transactions: [income('2026-11-16')], window });
  assert.equal(p.start, '2026-11-16');
  assert.equal(p.end, '2026-12-19');
});

test('收入周期：收入比窗口晚到（13 天内）也算新的一期', () => {
  const tx = [income('2026-10-15'), income('2026-11-28')];
  const p = incomeCyclePeriod({ today: '2026-11-30', transactions: tx, window });
  assert.equal(p.start, '2026-11-28');
});

test('收入周期：过了窗口还没收到钱，结束日暂时算到今天', () => {
  const p = incomeCyclePeriod({ today: '2026-12-22', transactions: [income('2026-11-16')], window });
  assert.equal(p.start, '2026-11-16');
  assert.equal(p.end, '2026-12-22');
  assert.equal(p.late, true);
});

test('收入周期：窗口外的小收入（例如其他收入）不会切断周期', () => {
  const tx = [income('2026-11-16'), income('2026-12-03', 'other-income', 5000), income('2026-12-03', 'biz-income', 5000)];
  const p = incomeCyclePeriod({ today: '2026-12-05', transactions: tx, window });
  assert.equal(p.start, '2026-11-16'); // 12/3 不在 12 月的窗口里，也不在 11 月的宽限里
});

test('收入周期：一笔收入都还没记，从窗口第一天估算', () => {
  const a = incomeCyclePeriod({ today: '2026-11-19', transactions: [], window });
  assert.equal(a.start, '2026-11-14');
  assert.equal(a.estimated, true);
  const b = incomeCyclePeriod({ today: '2026-11-05', transactions: [], window });
  assert.equal(b.start, '2026-10-14');
  assert.equal(b.end, '2026-11-19');
});

test('收入周期：只算到今天为止的收入', () => {
  const p = incomeCyclePeriod({ today: '2026-11-15', transactions: [income('2026-11-16')], window });
  assert.equal(p.estimated, true);
});

test('currentPeriod 按计划选周期', () => {
  assert.equal(currentPeriod({ today: '2026-11-19', transactions: [], plan: { periodMode: 'month' } }).start, '2026-11-01');
  assert.equal(
    currentPeriod({ today: '2026-11-19', transactions: [income('2026-11-15')], plan: { periodMode: 'cycle', cycleWindow: window } }).start,
    '2026-11-15',
  );
  // 窗口坏掉就退回日历月
  assert.equal(currentPeriod({ today: '2026-11-19', transactions: [], plan: { periodMode: 'cycle', cycleWindow: {} } }).mode, 'month');
});
