// 内存中的 store：打开 App 时把资料读进来，之后每次修改「先写进资料库，成功了才改内存」。
// 这样写入失败时，画面上的数字不会和资料库对不上。

import {
  applyTransactionPatch,
  createTransaction,
  validateTransaction,
} from '../core/transactions.js';
import { mergeCategories } from '../core/categories.js';
import { PLAN_KEY, normalizePlan } from '../core/plan.js';
import {
  applyRecurringPatch,
  createRecurring,
  planRecurringPosts,
  validateRecurring,
} from '../core/recurring.js';

export async function createStore(backend) {
  const [rawTransactions, rawCategories, rawRecurring, rawSettings] = await Promise.all([
    backend.getAll('transactions'),
    backend.getAll('categories'),
    backend.getAll('recurring'),
    backend.getAll('settings'),
  ]);

  const transactions = new Map();
  let skipped = 0;
  for (const tx of rawTransactions) {
    if (validateTransaction(tx).length === 0) transactions.set(tx.id, tx);
    else skipped += 1;
  }
  const recurring = new Map();
  for (const item of rawRecurring) {
    if (validateRecurring(item).length === 0) recurring.set(item.id, item);
    else skipped += 1;
  }
  const categories = mergeCategories(rawCategories);
  let plan = normalizePlan(rawSettings.find((s) => s?.key === PLAN_KEY)?.value);

  const listeners = new Set();
  const emit = () => {
    for (const fn of listeners) fn();
  };

  async function putTransaction(tx) {
    await backend.put('transactions', tx);
    transactions.set(tx.id, tx);
  }

  async function putRecurring(item) {
    await backend.put('recurring', item);
    recurring.set(item.id, item);
  }

  return {
    /** 读取时发现的坏资料笔数（没有删掉，只是不显示）。 */
    skipped,

    transactions: () => [...transactions.values()],
    categories: () => categories,
    get: (id) => transactions.get(id) ?? null,

    async add(input, options) {
      const tx = createTransaction(input, options);
      await putTransaction(tx);
      emit();
      return tx;
    },

    async update(id, patch, options) {
      const current = transactions.get(id);
      if (!current) throw new Error('找不到这笔记录');
      const next = applyTransactionPatch(current, patch, options);
      await putTransaction(next);
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
      await putTransaction(tx);
      emit();
      return tx;
    },

    // ---------- 每月计划 ----------

    plan: () => plan,

    async savePlan(next) {
      const clean = normalizePlan(next);
      await backend.put('settings', { key: PLAN_KEY, value: clean });
      plan = clean;
      emit();
      return clean;
    },

    // ---------- 固定项目 ----------

    recurring: () => [...recurring.values()],
    getRecurring: (id) => recurring.get(id) ?? null,

    async addRecurring(input, { today, id } = {}) {
      const item = createRecurring(input, { today, id });
      await putRecurring(item);
      emit();
      return item;
    },

    async updateRecurring(id, patch, { today }) {
      const current = recurring.get(id);
      if (!current) throw new Error('找不到这个固定项目');
      const next = applyRecurringPatch(current, patch, { today });
      await putRecurring(next);
      emit();
      return next;
    },

    /** 删除固定项目。已经自动记下的交易会保留。 */
    async removeRecurring(id) {
      const item = recurring.get(id);
      if (!item) return null;
      await backend.delete('recurring', id);
      recurring.delete(id);
      emit();
      return item;
    },

    async restoreRecurring(item) {
      if (validateRecurring(item).length) throw new Error('资料不完整，无法复原');
      await putRecurring(item);
      emit();
      return item;
    },

    /**
     * 补记到期的固定项目，回传记了几笔。
     * 先记交易、再更新 lastMonth；中途失败的话，下次打开会接着补，不会重复记
     * （同一个月已经有自动记的交易就会跳过）。
     */
    async postDueRecurring(today) {
      const { posts, marks } = planRecurringPosts({
        items: [...recurring.values()],
        transactions: [...transactions.values()],
        today,
      });
      let added = 0;
      try {
        for (const input of posts) {
          await putTransaction(createTransaction(input));
          added += 1;
        }
        for (const { id, lastMonth } of marks) {
          await putRecurring({ ...recurring.get(id), lastMonth });
        }
      } finally {
        if (added || marks.length) emit();
      }
      return added;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
