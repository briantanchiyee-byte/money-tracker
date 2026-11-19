// 内存中的 store：打开 App 时把资料读进来，之后每次修改「先写进资料库，成功了才改内存」。
// 这样写入失败时，画面上的数字不会和资料库对不上。

import {
  applyTransactionPatch,
  createTransaction,
  validateTransaction,
} from '../core/transactions.js';
import { mergeCategories } from '../core/categories.js';

export async function createStore(backend) {
  const [rawTransactions, rawCategories] = await Promise.all([
    backend.getAll('transactions'),
    backend.getAll('categories'),
  ]);

  const transactions = new Map();
  let skipped = 0;
  for (const tx of rawTransactions) {
    if (validateTransaction(tx).length === 0) transactions.set(tx.id, tx);
    else skipped += 1;
  }
  const categories = mergeCategories(rawCategories);

  const listeners = new Set();
  const emit = () => {
    for (const fn of listeners) fn();
  };

  return {
    /** 读取时发现的坏资料笔数（没有删掉，只是不显示）。 */
    skipped,

    transactions: () => [...transactions.values()],
    categories: () => categories,
    get: (id) => transactions.get(id) ?? null,

    async add(input, options) {
      const tx = createTransaction(input, options);
      await backend.put('transactions', tx);
      transactions.set(tx.id, tx);
      emit();
      return tx;
    },

    async update(id, patch, options) {
      const current = transactions.get(id);
      if (!current) throw new Error('找不到这笔记录');
      const next = applyTransactionPatch(current, patch, options);
      await backend.put('transactions', next);
      transactions.set(id, next);
      emit();
      return next;
    },

    async remove(id) {
      const tx = transactions.get(id);
      if (!tx) return null;
      await backend.delete('transactions', id);
      transactions.delete(id);
      emit();
      return tx;
    },

    /** 撤销删除：把原本那笔（同一个编号）放回去。 */
    async restore(tx) {
      if (validateTransaction(tx).length) throw new Error('资料不完整，无法复原');
      await backend.put('transactions', tx);
      transactions.set(tx.id, tx);
      emit();
      return tx;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
