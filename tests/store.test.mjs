import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryBackend } from '../src/data/db.js';
import { createStore } from '../src/data/store.js';

const input = { type: 'expense', amount: 1250, categoryId: 'food', date: '2026-11-19', note: '', business: false };

test('新增、修改、删除、撤销删除', async () => {
  const backend = memoryBackend();
  const store = await createStore(backend);
  let changes = 0;
  store.subscribe(() => changes++);

  const tx = await store.add(input);
  assert.equal(store.transactions().length, 1);
  assert.equal((await backend.getAll('transactions'))[0].amount, 1250);

  const edited = await store.update(tx.id, { amount: 900, note: '改过' });
  assert.equal(store.get(tx.id).amount, 900);
  assert.equal(edited.note, '改过');

  const removed = await store.remove(tx.id);
  assert.equal(store.transactions().length, 0);
  assert.equal((await backend.getAll('transactions')).length, 0);

  await store.restore(removed);
  assert.equal(store.get(tx.id).amount, 900); // 同一笔，同一个编号放回来
  assert.equal(changes, 4);
});

test('重新打开 App 时，资料还在', async () => {
  const backend = memoryBackend();
  const first = await createStore(backend);
  await first.add(input);
  const second = await createStore(backend);
  assert.equal(second.transactions().length, 1);
});

test('资料库里的坏资料会被略过，不会弄坏 App', async () => {
  const good = { ...input, id: 'good', createdAt: 1, updatedAt: 1 };
  const backend = memoryBackend({
    transactions: [good, { id: 'bad', amount: 'abc' }, { ...good, id: 'float', amount: 12.5 }],
  });
  const store = await createStore(backend);
  assert.deepEqual(store.transactions().map((t) => t.id), ['good']);
  assert.equal(store.skipped, 2);
});

test('写入资料库失败时，内存里的资料不变', async () => {
  const backend = memoryBackend();
  const store = await createStore(backend);
  const tx = await store.add(input);
  backend.put = async () => {
    throw new Error('磁盘满了');
  };
  await assert.rejects(store.add(input), /磁盘满了/);
  await assert.rejects(store.update(tx.id, { amount: 1 }), /磁盘满了/);
  assert.equal(store.transactions().length, 1);
  assert.equal(store.get(tx.id).amount, 1250);
});

test('不合理的输入不会写进资料库', async () => {
  const backend = memoryBackend();
  const store = await createStore(backend);
  await assert.rejects(store.add({ ...input, amount: 0 }));
  await assert.rejects(store.update('missing', { amount: 100 }), /找不到/);
  assert.equal((await backend.getAll('transactions')).length, 0);
});

test('每月计划会存下来，重新打开还在', async () => {
  const backend = memoryBackend();
  const store = await createStore(backend);
  assert.equal(store.plan().expectedIncome, null);
  await store.savePlan({ ...store.plan(), expectedIncome: 400000, periodMode: 'cycle', cycleWindow: { from: 10, to: 15 } });
  const again = await createStore(backend);
  assert.equal(again.plan().expectedIncome, 400000);
  assert.deepEqual(again.plan().cycleWindow, { from: 10, to: 15 });
});

test('固定项目：到期自动记账，重复打开不会重复记', async () => {
  const backend = memoryBackend();
  const store = await createStore(backend);
  await store.addRecurring(
    { type: 'expense', amount: 120000, categoryId: 'rent', note: '房租', day: 1 },
    { today: '2026-10-20', id: 'rent' },
  );
  assert.equal(await store.postDueRecurring('2026-10-31'), 0);
  assert.equal(await store.postDueRecurring('2026-11-01'), 1);
  assert.equal(await store.postDueRecurring('2026-11-01'), 0);
  const again = await createStore(backend);
  assert.equal(await again.postDueRecurring('2026-11-02'), 0);
  assert.equal(again.transactions().length, 1);
  assert.equal(again.transactions()[0].recurringId, 'rent');
  assert.equal(again.getRecurring('rent').lastMonth, '2026-11');
});

test('固定项目：自动记账中途失败，下次不会重复记', async () => {
  const backend = memoryBackend();
  const store = await createStore(backend);
  await store.addRecurring({ type: 'expense', amount: 5000, categoryId: 'phone', day: 1 }, { today: '2026-10-20', id: 'p' });
  const put = backend.put;
  backend.put = async (name, value) => {
    if (name === 'recurring') throw new Error('写不进去');
    return put(name, value);
  };
  await assert.rejects(store.postDueRecurring('2026-11-01'), /写不进去/);
  backend.put = put;
  const again = await createStore(backend);
  assert.equal(await again.postDueRecurring('2026-11-01'), 0); // 11 月已经记过了
  assert.equal(again.transactions().length, 1);
});

test('删除固定项目会保留已经记下的交易，也能撤销', async () => {
  const backend = memoryBackend();
  const store = await createStore(backend);
  await store.addRecurring({ type: 'expense', amount: 5000, categoryId: 'phone', day: 1 }, { today: '2026-10-20', id: 'p' });
  await store.postDueRecurring('2026-11-01');
  const removed = await store.removeRecurring('p');
  assert.equal(store.recurring().length, 0);
  assert.equal(store.transactions().length, 1);
  await store.restoreRecurring(removed);
  assert.equal(store.recurring().length, 1);
});
