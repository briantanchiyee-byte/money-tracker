import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRecurringPatch,
  createRecurring,
  matchesRecurring,
  pendingRecurring,
  planRecurringPosts,
  recurringTransactionIds,
  validateRecurring,
} from '../src/core/recurring.js';
import { createTransaction } from '../src/core/transactions.js';

let n = 0;
const tx = (fields) => createTransaction(
  { type: 'expense', amount: 120000, categoryId: 'rent', date: '2026-11-01', note: '', business: false, ...fields },
  { now: (n += 1), id: `t${n}` },
);
const rent = (today = '2026-10-20', fields = {}) =>
  createRecurring({ type: 'expense', amount: 120000, categoryId: 'rent', note: '房租', day: 1, business: false, ...fields }, { today, id: 'rent' });

test('新增固定项目：今天之后才到期的，这个月开始记', () => {
  const item = createRecurring({ type: 'expense', amount: 5000, categoryId: 'phone', day: 25 }, { today: '2026-11-19', id: 'p' });
  assert.equal(item.startMonth, '2026-11');
  assert.equal(item.lastMonth, '2026-10');
  assert.deepEqual(validateRecurring(item), []);
});

test('新增固定项目：这个月已经过了到期日，下个月才开始（不会补记）', () => {
  const item = rent('2026-11-19');
  assert.equal(item.startMonth, '2026-12');
});

test('固定项目的输入要合理', () => {
  assert.throws(() => createRecurring({ type: 'expense', amount: 0, categoryId: 'rent', day: 1 }, { today: '2026-11-19' }));
  assert.throws(() => createRecurring({ type: 'expense', amount: 100, categoryId: 'rent', day: 32 }, { today: '2026-11-19' }));
  assert.throws(() => createRecurring({ type: 'gift', amount: 100, categoryId: 'rent', day: 1 }, { today: '2026-11-19' }));
});

test('到期那天自动记一笔，lastMonth 往前推', () => {
  const item = rent();
  const { posts, marks } = planRecurringPosts({ items: [item], transactions: [], today: '2026-11-01' });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].date, '2026-11-01');
  assert.equal(posts[0].recurringId, 'rent');
  assert.equal(posts[0].note, '房租');
  assert.deepEqual(marks, [{ id: 'rent', lastMonth: '2026-11' }]);
});

test('还没到期就不记', () => {
  const item = createRecurring({ type: 'expense', amount: 5000, categoryId: 'phone', day: 25 }, { today: '2026-11-19', id: 'p' });
  const { posts, marks } = planRecurringPosts({ items: [item], transactions: [], today: '2026-11-24' });
  assert.equal(posts.length, 0);
  assert.equal(marks.length, 0);
});

test('很久没打开 App：最多往回补 3 个月', () => {
  const item = rent('2026-05-20'); // 从 6 月开始
  const { posts, marks } = planRecurringPosts({ items: [item], transactions: [], today: '2026-11-19' });
  assert.deepEqual(posts.map((p) => p.date), ['2026-09-01', '2026-10-01', '2026-11-01']);
  assert.equal(marks[0].lastMonth, '2026-11');
});

test('已经自动记过的月份不会再记（中途当掉也不会重复）', () => {
  const item = rent();
  const posted = tx({ recurringId: 'rent', date: '2026-11-01' });
  const { posts, marks } = planRecurringPosts({ items: [item], transactions: [posted], today: '2026-11-19' });
  assert.equal(posts.length, 0);
  assert.equal(marks[0].lastMonth, '2026-11');
});

test('认出手动先付的：同类别、金额差不多，这个月就不自动记', () => {
  const item = rent();
  const manual = tx({ date: '2026-10-30', amount: 119000 }); // 上个月底先付了（10 月），不算 11 月的
  const manualNov = tx({ date: '2026-11-01', amount: 121000 }); // 差 RM 10，在 5% 内
  const { posts } = planRecurringPosts({ items: [item], transactions: [manual, manualNov], today: '2026-11-02' });
  assert.equal(posts.length, 0);
});

test('金额差太多就不算同一笔', () => {
  const item = rent();
  assert.equal(matchesRecurring(item, tx({ amount: 120000 + 6001 })), false);
  assert.equal(matchesRecurring(item, tx({ amount: 120000 + 6000 })), true);
  assert.equal(matchesRecurring(item, tx({ categoryId: 'food' })), false);
  // 小金额：差 RM 1 以内都算
  const small = { ...item, amount: 1000 };
  assert.equal(matchesRecurring(small, tx({ amount: 1100 })), true);
  assert.equal(matchesRecurring(small, tx({ amount: 1101 })), false);
});

test('一笔手动记录只配对一个固定项目', () => {
  const a = { ...rent(), id: 'a' };
  const b = { ...rent(), id: 'b' };
  const manual = tx({ date: '2026-11-01' });
  const ids = recurringTransactionIds([a, b], [manual]);
  assert.deepEqual([...ids], [manual.id]);
  const { posts } = planRecurringPosts({ items: [a, b], transactions: [manual], today: '2026-11-01' });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].recurringId, 'b');
});

test('暂停的不记；重新启用后不补记暂停期间的', () => {
  const paused = { ...rent(), active: false };
  assert.equal(planRecurringPosts({ items: [paused], transactions: [], today: '2026-11-19' }).posts.length, 0);
  const resumed = applyRecurringPatch(paused, { active: true }, { today: '2027-02-10' });
  assert.equal(resumed.lastMonth, '2027-02'); // 2 月 1 号已经过了，从 3 月开始
  assert.equal(planRecurringPosts({ items: [resumed], transactions: [], today: '2027-02-10' }).posts.length, 0);
});

test('修改固定项目不能改坏', () => {
  assert.throws(() => applyRecurringPatch(rent(), { amount: -5 }, { today: '2026-11-19' }));
  const edited = applyRecurringPatch(rent(), { amount: 130000, note: '  新房租 ', id: 'hack' }, { today: '2026-11-19' });
  assert.equal(edited.amount, 130000);
  assert.equal(edited.note, '新房租');
  assert.equal(edited.id, 'rent');
});

test('本期还没扣的固定支出', () => {
  const r = rent();
  const phone = createRecurring({ type: 'expense', amount: 5000, categoryId: 'phone', day: 25, business: true }, { today: '2026-10-20', id: 'phone' });
  const salary = createRecurring({ type: 'income', amount: 300000, categoryId: 'salary', day: 28 }, { today: '2026-10-20', id: 's' });
  const items = [r, phone, salary];
  // 收入周期 11/16 – 12/19：11/25 电话费、12/1 房租
  const all = pendingRecurring({ items, transactions: [], from: '2026-11-19', to: '2026-12-19' });
  assert.deepEqual(all.list.map((p) => p.date), ['2026-11-25', '2026-12-01']);
  assert.equal(all.total, 125000);
  // 生意的不算
  const personal = pendingRecurring({ items, transactions: [], from: '2026-11-19', to: '2026-12-19', include: (i) => !i.business });
  assert.equal(personal.total, 120000);
  // 12 月的房租已经先手动付了
  const paid = pendingRecurring({ items, transactions: [tx({ date: '2026-11-30' }), tx({ date: '2026-12-01' })], from: '2026-11-19', to: '2026-12-19' });
  assert.equal(paid.total, 5000);
});
