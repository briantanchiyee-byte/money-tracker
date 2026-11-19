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
