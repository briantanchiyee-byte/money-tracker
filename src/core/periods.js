// 预算周期：日历月 / 收入周期。
//
// 收入周期：从「生意收入 / 薪水」进来那天开始，到下次收入前一天结束。
// - 设一个收入窗口（例如每月 14–20 号）。窗口内第一笔收入开新周期，晚到几天也算。
// - 下次收入还没到时，假设它在窗口最后一天才到（保守：钱要撑到那天）。

import { addDays, daysBetween } from './dates.js';

export const PERIOD_MODES = Object.freeze(['month', 'cycle']);
/** 这些类别的收入会开始新的收入周期。 */
export const CYCLE_STARTER_CATEGORIES = Object.freeze(['biz-income', 'salary']);
/** 收入晚到最多几天，仍然算这一期的收入。 */
export const MAX_LATE_DAYS = 13;
const LOOK_BACK_MONTHS = 3;

const pad2 = (n) => String(n).padStart(2, '0');

/** '2026-11-19' → '2026-11' */
export function monthOf(iso) {
  return iso.slice(0, 7);
}

/** addMonths('2026-11', 2) → '2027-01' */
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** 某个月的第 day 天；那个月没有这一天（例如 2 月 30 号）就用月底。 */
export function dayInMonth(ym, day) {
  return `${ym}-${pad2(Math.min(day, daysInMonth(ym)))}`;
}

/** "2026年11月"；今年的话只写 "11月" */
export function monthLabel(ym, today) {
  const [y, m] = ym.split('-').map(Number);
  return today && today.slice(0, 4) === ym.slice(0, 4) ? `${m}月` : `${y}年${m}月`;
}

export function periodLength(period) {
  return daysBetween(period.start, period.end) + 1;
}

export function calendarMonthPeriod(today) {
  const ym = monthOf(today);
  return { mode: 'month', start: `${ym}-01`, end: dayInMonth(ym, 31), estimated: false, late: false };
}

/** 收入窗口：{ from, to } 都是 1–31 的整数，from ≤ to。不合理就回传 null。 */
export function normalizeWindow(window) {
  const from = Number(window?.from);
  const to = Number(window?.to);
  const ok = (d) => Number.isInteger(d) && d >= 1 && d <= 31;
  if (!ok(from) || !ok(to) || from > to) return null;
  return { from, to };
}

/** 晚到的宽限天数。窗口越宽，宽限越短，免得和下个月的窗口重叠。 */
export function lateDays(window) {
  return Math.max(0, Math.min(MAX_LATE_DAYS, 27 - (window.to - window.from)));
}

function windowIn(ym, window) {
  const from = dayInMonth(ym, window.from);
  const to = dayInMonth(ym, window.to);
  return { from, to, lateEnd: addDays(to, lateDays(window)) };
}

export function isCycleStarter(tx, starters = CYCLE_STARTER_CATEGORIES) {
  return tx.type === 'income' && starters.includes(tx.categoryId);
}

/**
 * 今天所在的收入周期。
 * 回传 { mode, start, end, estimated, late, nextWindow }
 * - estimated：还没记到这一期的收入，开始日是按窗口第一天估的。
 * - late：下次收入已经过了窗口最后一天还没到，结束日暂时算到今天。
 */
export function incomeCyclePeriod({ today, transactions, window, starters = CYCLE_STARTER_CATEGORIES }) {
  const win = normalizeWindow(window);
  if (!win) return calendarMonthPeriod(today);

  const incomeDates = [...new Set(
    transactions.filter((t) => t.date <= today && isCycleStarter(t, starters)).map((t) => t.date),
  )].sort();

  const thisMonth = monthOf(today);
  let instance = null;
  let start = null;
  for (let k = 0; k <= LOOK_BACK_MONTHS; k += 1) {
    const ym = addMonths(thisMonth, -k);
    const w = windowIn(ym, win);
    if (w.from > today) continue;
    const first = incomeDates.find((d) => d >= w.from && d <= w.lateEnd);
    if (first) {
      instance = ym;
      start = first;
      break;
    }
  }

  let estimated = false;
  if (!instance) {
    // 还没记到收入：从最近一个已经开始的窗口第一天算起。
    instance = windowIn(thisMonth, win).from <= today ? thisMonth : addMonths(thisMonth, -1);
    start = windowIn(instance, win).from;
    estimated = true;
  }

  const next = windowIn(addMonths(instance, 1), win);
  const assumedEnd = addDays(next.to, -1);
  const late = today > assumedEnd;
  return {
    mode: 'cycle',
    start,
    end: late ? today : assumedEnd,
    estimated,
    late,
    nextWindow: { from: next.from, to: next.to },
  };
}

export function currentPeriod({ today, transactions, plan }) {
  if (plan?.periodMode === 'cycle') {
    return incomeCyclePeriod({ today, transactions, window: plan.cycleWindow });
  }
  return calendarMonthPeriod(today);
}
