// 记录页：按月浏览、搜索、每天小计。

import { amountToInput } from './money.js';
import { findCategory } from './categories.js';
import { compareNewestFirst, summarize } from './transactions.js';
import { monthOf } from './periods.js';

export function transactionsInMonth(list, ym) {
  return list.filter((t) => monthOf(t.date) === ym);
}

/** 按日期分组（新的在前），每天附上小计。 */
export function groupByDay(list) {
  const days = new Map();
  for (const tx of [...list].sort(compareNewestFirst)) {
    if (!days.has(tx.date)) days.set(tx.date, []);
    days.get(tx.date).push(tx);
  }
  return [...days].map(([date, items]) => ({ date, items, summary: summarize(items) }));
}

const normalize = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '');

/**
 * 搜索备注、类别名称、金额。
 * 金额：打 "12" 会找到 12、12.50、120……（金额开头一样的）。
 */
export function searchTransactions(list, query, categories) {
  const q = normalize(query).replace(/^rm/, '');
  if (!q) return [];
  const isNumber = /^\d+(\.\d{0,2})?$/.test(q);
  return list.filter((tx) => {
    if (normalize(tx.note).includes(q)) return true;
    if (normalize(findCategory(categories, tx.categoryId).name).includes(q)) return true;
    if (tx.business && '生意'.includes(q)) return true;
    return isNumber && amountToInput(tx.amount).startsWith(q);
  });
}
