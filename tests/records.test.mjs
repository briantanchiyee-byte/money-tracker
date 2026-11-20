import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByDay, searchTransactions, transactionsInMonth } from '../src/core/records.js';
import { BUILTIN_CATEGORIES } from '../src/core/categories.js';
import { createTransaction } from '../src/core/transactions.js';

let n = 0;
const tx = (date, amount, fields = {}) => createTransaction(
  { type: 'expense', amount, categoryId: 'food', date, note: '', business: false, ...fields },
  { now: (n += 1), id: `t${n}` },
);
const list = [
  tx('2026-11-02', 1250, { note: '鸡饭' }),
  tx('2026-11-02', 800, { categoryId: 'drinks' }),
  tx('2026-11-05', 50000, { categoryId: 'biz-stock', business: true, note: 'Supplier A' }),
  tx('2026-10-31', 12000),
];

test('按月份筛选', () => {
  assert.equal(transactionsInMonth(list, '2026-11').length, 3);
  assert.equal(transactionsInMonth(list, '2026-10').length, 1);
});

test('按日期分组，新的在前，每天有小计', () => {
  const days = groupByDay(transactionsInMonth(list, '2026-11'));
  assert.deepEqual(days.map((d) => d.date), ['2026-11-05', '2026-11-02']);
  assert.equal(days[1].summary.personalExpense, 2050);
  assert.equal(days[0].summary.businessExpense, 50000);
  assert.equal(days[1].items[0].categoryId, 'drinks'); // 同一天后记的在前
});

test('搜索备注、类别、金额', () => {
  const cats = BUILTIN_CATEGORIES;
  assert.equal(searchTransactions(list, '鸡饭', cats).length, 1);
  assert.equal(searchTransactions(list, 'supplier a', cats).length, 1);
  assert.equal(searchTransactions(list, '饮料', cats).length, 1);
  assert.equal(searchTransactions(list, '12', cats).length, 2); // 12.50 和 120
  assert.equal(searchTransactions(list, 'RM 12.5', cats).length, 1);
  assert.equal(searchTransactions(list, '生意', cats).length, 1);
  assert.equal(searchTransactions(list, '  ', cats).length, 0);
});
