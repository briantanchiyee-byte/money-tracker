import { MAX_AMOUNT_CENTS } from './money.js';
import { isValidISODate } from './dates.js';

export const TRANSACTION_TYPES = Object.freeze(['expense', 'income']);
export const NOTE_MAX_LENGTH = 200;
const EDITABLE_FIELDS = ['type', 'amount', 'categoryId', 'date', 'note', 'business'];

export class ValidationError extends Error {
  constructor(errors) {
    super(errors.join('；'));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export function newId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return [...c.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 检查一笔交易，回传错误列表（空的就是没问题）。 */
export function validateTransaction(tx) {
  if (!tx || typeof tx !== 'object') return ['资料格式不对'];
  const errors = [];
  if (typeof tx.id !== 'string' || !tx.id) errors.push('缺少编号');
  if (!TRANSACTION_TYPES.includes(tx.type)) errors.push('类型不对');
  if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0) errors.push('金额要大于 0');
  else if (tx.amount > MAX_AMOUNT_CENTS) errors.push('金额太大');
  if (typeof tx.categoryId !== 'string' || !tx.categoryId) errors.push('请选择类别');
  if (!isValidISODate(tx.date)) errors.push('日期不对');
  if (typeof tx.note !== 'string') errors.push('备注格式不对');
  else if (tx.note.length > NOTE_MAX_LENGTH) errors.push(`备注最多 ${NOTE_MAX_LENGTH} 个字`);
  if (typeof tx.business !== 'boolean') errors.push('生意标记格式不对');
  if (!Number.isFinite(tx.createdAt) || !Number.isFinite(tx.updatedAt)) errors.push('时间格式不对');
  if (tx.recurringId !== undefined && (typeof tx.recurringId !== 'string' || !tx.recurringId)) {
    errors.push('固定项目编号不对');
  }
  return errors;
}

export function createTransaction(input, { now = Date.now(), id = newId() } = {}) {
  const tx = {
    id,
    type: input.type,
    amount: input.amount,
    categoryId: input.categoryId,
    date: input.date,
    note: String(input.note ?? '').trim(),
    business: Boolean(input.business),
    createdAt: now,
    updatedAt: now,
  };
  if (input.recurringId) tx.recurringId = input.recurringId;
  const errors = validateTransaction(tx);
  if (errors.length) throw new ValidationError(errors);
  return tx;
}

/** 修改一笔交易：只改允许改的字段，回传新的物件（不改原本的）。 */
export function applyTransactionPatch(tx, patch, { now = Date.now() } = {}) {
  const next = { ...tx };
  for (const key of EDITABLE_FIELDS) {
    if (!(key in patch)) continue;
    if (key === 'note') next.note = String(patch.note ?? '').trim();
    else if (key === 'business') next.business = Boolean(patch.business);
    else next[key] = patch[key];
  }
  next.updatedAt = now;
  const errors = validateTransaction(next);
  if (errors.length) throw new ValidationError(errors);
  return next;
}

/** 日期新的在前；同一天按记账时间，新的在前。 */
export function compareNewestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return b.createdAt - a.createdAt;
}

export function transactionsOn(list, date) {
  return list.filter((t) => t.date === date).sort(compareNewestFirst);
}

/** 合计：个人支出、生意支出、收入分开算。 */
export function summarize(list) {
  let personalExpense = 0;
  let businessExpense = 0;
  let income = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else if (t.business) businessExpense += t.amount;
    else personalExpense += t.amount;
  }
  return {
    personalExpense,
    businessExpense,
    expense: personalExpense + businessExpense,
    income,
    count: list.length,
  };
}
