// 今天还能花：
//   本期预算   = 预计收入 − 存款目标（中途才开始的那一期按剩下天数折算）
//   每日额度   = (本期预算 − 之前已花 − 今天的固定支出 − 本期还没扣的固定支出) ÷ 剩下天数
//   今天还能花 = 每日额度 − 今天已花（固定支出不算）
// 生意支出默认不占额度（另外列出），可以在计划里改成占用。

import { daysBetween } from './dates.js';
import { hasPlan, monthlySpendable } from './plan.js';
import { periodLength } from './periods.js';
import { pendingRecurring, recurringTransactionIds } from './recurring.js';

export function countsTowardBudget(tx, plan) {
  return tx.type === 'expense' && (plan.budgetIncludesBusiness || !tx.business);
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function computeBudget({ today, transactions, recurring = [], plan, period }) {
  if (!hasPlan(plan)) return null;

  const length = periodLength(period);
  const monthly = monthlySpendable(plan);
  let from = period.start;
  let budget = monthly;
  let prorated = false;
  if (plan.startDate && plan.startDate > period.start && plan.startDate <= today) {
    from = plan.startDate;
    budget = Math.round((monthly * (daysBetween(from, period.end) + 1)) / length);
    prorated = true;
  }

  const recurringIds = recurringTransactionIds(recurring, transactions);
  let spentBefore = 0;
  let todayRecurring = 0;
  let todaySpent = 0;
  let businessSpent = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.date < from || tx.date > today) continue;
    if (!countsTowardBudget(tx, plan)) {
      businessSpent += tx.amount;
      continue;
    }
    if (tx.date < today) spentBefore += tx.amount;
    else if (recurringIds.has(tx.id)) todayRecurring += tx.amount;
    else todaySpent += tx.amount;
  }

  const pending = pendingRecurring({
    items: recurring,
    transactions,
    from: today,
    to: period.end,
    include: (item) => plan.budgetIncludesBusiness || !item.business,
  });

  const remainingDays = daysBetween(today, period.end) + 1;
  const available = budget - spentBefore - todayRecurring - pending.total;
  const daily = Math.floor(available / remainingDays);
  const spent = spentBefore + todayRecurring + todaySpent;
  const daysUsed = daysBetween(from, today) + 1;
  const daysTotal = daysBetween(from, period.end) + 1;

  return {
    period,
    from,
    budget,
    prorated,
    daily,
    leftToday: daily - todaySpent,
    todaySpent,
    todayRecurring,
    spentBefore,
    spent,
    businessSpent,
    pending: pending.total,
    pendingList: pending.list,
    periodLeft: budget - spent - pending.total,
    remainingDays,
    timeRatio: clamp01(daysUsed / daysTotal),
    spentRatio: budget > 0 ? clamp01((spent + pending.total) / budget) : 1,
  };
}
