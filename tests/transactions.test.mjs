import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  applyTransactionPatch,
  compareNewestFirst,
  createTransaction,
  summarize,
  transactionsOn,
  validateTransaction,
} from '../src/core/transactions.js';

const base = { type: 'expense', amount: 1250, categoryId: 'food', date: '2026-11-19', note: '', business: false };
const make = (over = {}, opts = {}) => createTransaction({ ...base, ...over }, { now: 1000, id: 'x', ...opts });

test('createTransaction：正常的一笔', () => {
  const tx = make({ note: '  午餐  ' });
  assert.deepEqual(tx, {
    id: 'x', type: 'expense', amount: 1250, categoryId: 'food', date: '2026-11-19',
    note: '午餐', business: false, createdAt: 1000, updatedAt: 1000,
  });
});

test('createTransaction：没指定编号时自动产生', () => {
  const a = createTransaction(base);
  const b = createTransaction(base);
  assert.equal(typeof a.id, 'string');
  assert.notEqual(a.id, b.id);
});

test('createTransaction：挡掉不合理的资料', () => {
  assert.throws(() => make({ amount: 0 }), ValidationError);
  assert.throws(() => make({ amount: -100 }), ValidationError);
  assert.throws(() => make({ amount: 12.5 }), ValidationError);
  assert.throws(() => make({ amount: 1_000_000_001 }), ValidationError);
  assert.throws(() => make({ type: 'transfer' }), ValidationError);
  assert.throws(() => make({ categoryId: '' }), ValidationError);
  assert.throws(() => make({ date: '2026-02-30' }), ValidationError);
  assert.throws(() => make({ note: 'a'.repeat(201) }), ValidationError);
});

test('validateTransaction：坏资料不会让程序出错', () => {
  assert.deepEqual(validateTransaction(null), ['资料格式不对']);
  assert.ok(validateTransaction({}).length > 0);
  assert.ok(validateTransaction({ ...make(), business: 'yes' }).length > 0);
  assert.deepEqual(validateTransaction(make()), []);
});

test('applyTransactionPatch：只改允许改的，不改原本的物件', () => {
  const tx = make();
  const next = applyTransactionPatch(tx, { amount: 900, id: 'hacked', createdAt: 0 }, { now: 2000 });
  assert.equal(next.amount, 900);
  assert.equal(next.id, 'x');
  assert.equal(next.createdAt, 1000);
  assert.equal(next.updatedAt, 2000);
  assert.equal(tx.amount, 1250);
  assert.throws(() => applyTransactionPatch(tx, { amount: 0 }), ValidationError);
});

test('排序：日期新的在前，同一天后记的在前', () => {
  const a = make({ date: '2026-11-18' }, { id: 'a', now: 5 });
  const b = make({}, { id: 'b', now: 1 });
  const c = make({}, { id: 'c', now: 9 });
  assert.deepEqual([a, b, c].sort(compareNewestFirst).map((t) => t.id), ['c', 'b', 'a']);
  assert.deepEqual(transactionsOn([a, b, c], '2026-11-19').map((t) => t.id), ['c', 'b']);
});

test('summarize：个人支出、生意支出、收入分开算', () => {
  const list = [
    make({ amount: 1250 }, { id: '1' }),
    make({ amount: 350, categoryId: 'drinks' }, { id: '2' }),
    make({ amount: 50000, categoryId: 'biz-stock', business: true }, { id: '3' }),
    make({ type: 'income', amount: 300000, categoryId: 'biz-income' }, { id: '4' }),
  ];
  assert.deepEqual(summarize(list), {
    personalExpense: 1600,
    businessExpense: 50000,
    expense: 51600,
    income: 300000,
    count: 4,
  });
  assert.deepEqual(summarize([]), { personalExpense: 0, businessExpense: 0, expense: 0, income: 0, count: 0 });
});
