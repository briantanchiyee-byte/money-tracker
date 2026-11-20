// 固定项目（房租、电话费、订阅、薪水……）：每月几号自动记一笔。
//
// - 每次打开 App，补记到期的固定项目（最多往回补 3 个月）。
// - 认出手动先付的：同类型、同类别、金额差不到 5%（或 RM 1），而且那个月还没自动记过，
//   就当作那个月已经付了：不再自动记，也不再预留。

import { MAX_AMOUNT_CENTS } from './money.js';
import { NOTE_MAX_LENGTH, TRANSACTION_TYPES, ValidationError, newId } from './transactions.js';
import { addMonths, dayInMonth, monthOf } from './periods.js';

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const EDITABLE_FIELDS = ['type', 'amount', 'categoryId', 'note', 'day', 'business', 'active'];
export const MAX_BACKFILL_MONTHS = 3;

export function validateRecurring(item) {
  if (!item || typeof item !== 'object') return ['资料格式不对'];
  const errors = [];
  if (typeof item.id !== 'string' || !item.id) errors.push('缺少编号');
  if (!TRANSACTION_TYPES.includes(item.type)) errors.push('类型不对');
  if (!Number.isSafeInteger(item.amount) || item.amount <= 0) errors.push('金额要大于 0');
  else if (item.amount > MAX_AMOUNT_CENTS) errors.push('金额太大');
  if (typeof item.categoryId !== 'string' || !item.categoryId) errors.push('请选择类别');
  if (typeof item.note !== 'string') errors.push('备注格式不对');
  else if (item.note.length > NOTE_MAX_LENGTH) errors.push(`备注最多 ${NOTE_MAX_LENGTH} 个字`);
  if (!Number.isInteger(item.day) || item.day < 1 || item.day > 31) errors.push('日子要在 1–31 号之间');
  if (typeof item.business !== 'boolean') errors.push('生意标记格式不对');
  if (typeof item.active !== 'boolean') errors.push('启用标记格式不对');
  if (typeof item.startMonth !== 'string' || !YM_RE.test(item.startMonth)) errors.push('开始月份不对');
  if (typeof item.lastMonth !== 'string' || !YM_RE.test(item.lastMonth)) errors.push('最后记账月份不对');
  return errors;
}

export function dueDate(item, ym) {
  return dayInMonth(ym, item.day);
}

/** 从今天起，第一个还没过的到期月份（今天到期也算）。 */
function firstMonthFrom(today, day) {
  const ym = monthOf(today);
  return dayInMonth(ym, day) >= today ? ym : addMonths(ym, 1);
}

export function createRecurring(input, { today, id = newId() }) {
  const day = Number(input.day);
  const startMonth = firstMonthFrom(today, day);
  const item = {
    id,
    type: input.type,
    amount: input.amount,
    categoryId: input.categoryId,
    note: String(input.note ?? '').trim(),
    day,
    business: Boolean(input.business),
    active: input.active !== false,
    startMonth,
    lastMonth: addMonths(startMonth, -1),
  };
  const errors = validateRecurring(item);
  if (errors.length) throw new ValidationError(errors);
  return item;
}

export function applyRecurringPatch(item, patch, { today }) {
  const next = { ...item };
  for (const key of EDITABLE_FIELDS) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }
  if (typeof next.note === 'string') next.note = next.note.trim();
  next.day = Number(next.day);
  // 暂停后重新启用：只从今天之后开始记，不补记暂停期间的。
  if (!item.active && next.active) {
    const resumeFrom = addMonths(firstMonthFrom(today, next.day), -1);
    if (resumeFrom > next.lastMonth) next.lastMonth = resumeFrom;
  }
  const errors = validateRecurring(next);
  if (errors.length) throw new ValidationError(errors);
  return next;
}

/** 手动记的这笔，是不是在付这个固定项目？ */
export function matchesRecurring(item, tx) {
  if (tx.recurringId || tx.type !== item.type || tx.categoryId !== item.categoryId) return false;
  const tolerance = Math.max(100, Math.round(item.amount * 0.05));
  return Math.abs(tx.amount - item.amount) <= tolerance;
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byDateThenCreated = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt);

/**
 * 每个固定项目、每个月的付款状况。
 * 回传 Map：`${itemId}|${ym}` → { kind: 'auto' | 'manual', txId }
 * 一笔手动记录只会配对一个固定项目。
 */
export function recurringPayments(items, transactions) {
  const payments = new Map();
  const used = new Set();
  for (const tx of transactions) {
    if (tx.recurringId) payments.set(`${tx.recurringId}|${monthOf(tx.date)}`, { kind: 'auto', txId: tx.id });
  }
  const manual = transactions.filter((t) => !t.recurringId).sort(byDateThenCreated);
  for (const item of [...items].sort(byId)) {
    for (const tx of manual) {
      const ym = monthOf(tx.date);
      if (ym < item.startMonth || used.has(tx.id)) continue;
      const key = `${item.id}|${ym}`;
      if (payments.has(key) || !matchesRecurring(item, tx)) continue;
      payments.set(key, { kind: 'manual', txId: tx.id });
      used.add(tx.id);
    }
  }
  return payments;
}

/** 算是「固定支出 / 固定收入」的交易编号（自动记的 + 认出来的手动付款）。 */
export function recurringTransactionIds(items, transactions) {
  const ids = new Set(transactions.filter((t) => t.recurringId).map((t) => t.id));
  for (const p of recurringPayments(items, transactions).values()) ids.add(p.txId);
  return ids;
}

/**
 * 算出今天要补记哪些固定项目。
 * 回传 { posts: [交易输入], marks: [{ id, lastMonth }] }
 */
export function planRecurringPosts({ items, transactions, today, maxBackMonths = MAX_BACKFILL_MONTHS }) {
  const thisMonth = monthOf(today);
  const floor = addMonths(thisMonth, -(maxBackMonths - 1));
  const payments = recurringPayments(items, transactions);
  const posts = [];
  const marks = [];

  for (const item of [...items].sort(byId)) {
    if (!item.active) continue;
    let ym = addMonths(item.lastMonth, 1);
    if (ym < item.startMonth) ym = item.startMonth;
    if (ym < floor) ym = floor;
    let last = item.lastMonth;
    while (ym <= thisMonth) {
      const date = dueDate(item, ym);
      if (date > today) break;
      if (!payments.has(`${item.id}|${ym}`)) {
        posts.push({
          type: item.type,
          amount: item.amount,
          categoryId: item.categoryId,
          date,
          note: item.note,
          business: item.business,
          recurringId: item.id,
        });
      }
      last = ym;
      ym = addMonths(ym, 1);
    }
    if (last !== item.lastMonth) marks.push({ id: item.id, lastMonth: last });
  }
  return { posts, marks };
}

/**
 * 这一期还没扣的固定项目（到期日在 [from, period.end] 之间，而且那个月还没付）。
 * include(item) 决定要不要算进来（例如生意的要不要算）。
 */
export function pendingRecurring({ items, transactions, from, to, type = 'expense', include = () => true }) {
  const payments = recurringPayments(items, transactions);
  const list = [];
  for (const item of items) {
    if (!item.active || item.type !== type || !include(item)) continue;
    for (let ym = monthOf(from); ym <= monthOf(to); ym = addMonths(ym, 1)) {
      const date = dueDate(item, ym);
      if (date < from || date > to || ym < item.startMonth) continue;
      if (payments.has(`${item.id}|${ym}`)) continue;
      list.push({ item, date });
    }
  }
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { total: list.reduce((s, p) => s + p.item.amount, 0), list };
}
