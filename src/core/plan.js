// 每月计划（存在 settings 里，key = 'plan'）。
// 读出来的资料一律清洗：坏掉的字段换回默认值，不让 App 坏掉。

import { MAX_AMOUNT_CENTS } from './money.js';
import { isValidISODate } from './dates.js';
import { PERIOD_MODES, normalizeWindow } from './periods.js';

export const PLAN_KEY = 'plan';

export const DEFAULT_PLAN = Object.freeze({
  expectedIncome: null, // 每月预计收入（给自己用的部分），分；null = 还没设定
  savingsTarget: 0, // 每月存款目标，分
  periodMode: 'month', // 'month' 日历月 / 'cycle' 收入周期
  cycleWindow: Object.freeze({ from: 14, to: 20 }),
  budgetIncludesBusiness: false, // 生意支出占不占「今天还能花」
  startDate: null, // 开始用计划的日期；那一期的预算按剩下天数折算
});

const isMoney = (v) => Number.isSafeInteger(v) && v >= 0 && v <= MAX_AMOUNT_CENTS;

export function normalizePlan(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    expectedIncome: isMoney(p.expectedIncome) && p.expectedIncome > 0 ? p.expectedIncome : null,
    savingsTarget: isMoney(p.savingsTarget) ? p.savingsTarget : 0,
    periodMode: PERIOD_MODES.includes(p.periodMode) ? p.periodMode : DEFAULT_PLAN.periodMode,
    cycleWindow: normalizeWindow(p.cycleWindow) ?? { ...DEFAULT_PLAN.cycleWindow },
    budgetIncludesBusiness: p.budgetIncludesBusiness === true,
    startDate: isValidISODate(p.startDate) ? p.startDate : null,
  };
}

export function hasPlan(plan) {
  return Boolean(plan) && Number.isSafeInteger(plan.expectedIncome) && plan.expectedIncome > 0;
}

/** 每月可以花的钱 = 预计收入 − 存款目标 */
export function monthlySpendable(plan) {
  return hasPlan(plan) ? plan.expectedIncome - plan.savingsTarget : 0;
}

/**
 * 检查计划表单。输入的金额已经是「分」：null = 没填，NaN = 格式不对。
 * 回传 { errors: { 字段: 讯息 }, plan }
 */
export function validatePlanInput(input) {
  const errors = {};
  const { expectedIncome, savingsTarget } = input;
  if (expectedIncome === null) errors.expectedIncome = '请填每月预计收入';
  else if (!Number.isSafeInteger(expectedIncome)) errors.expectedIncome = '金额格式不对';
  else if (expectedIncome <= 0) errors.expectedIncome = '要大于 0';
  else if (expectedIncome > MAX_AMOUNT_CENTS) errors.expectedIncome = '金额太大了';

  // 存款目标可以不填（= 0），但不能乱填。
  const savings = savingsTarget === null ? 0 : savingsTarget;
  if (!Number.isSafeInteger(savings)) errors.savingsTarget = '金额格式不对';
  else if (savings < 0) errors.savingsTarget = '不能是负数';
  else if (!errors.expectedIncome && savings > expectedIncome) errors.savingsTarget = '存款目标比收入还多';

  const mode = PERIOD_MODES.includes(input.periodMode) ? input.periodMode : 'month';
  const window = normalizeWindow(input.cycleWindow);
  if (mode === 'cycle' && !window) errors.cycleWindow = '开始的日子不能比结束晚';

  const plan = normalizePlan({
    expectedIncome,
    savingsTarget: savings,
    periodMode: mode,
    cycleWindow: window ?? undefined,
    budgetIncludesBusiness: input.budgetIncludesBusiness === true,
    startDate: input.startDate,
  });
  return { errors, plan };
}
