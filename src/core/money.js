// 金额一律用整数「分」存，避免 0.1 + 0.2 = 0.30000000000000004 这种误差。

export const CURRENCY_SYMBOL = 'RM';
/** 单笔上限：RM 10,000,000 */
export const MAX_AMOUNT_CENTS = 1_000_000_000;
const MAX_INTEGER_DIGITS = 8;

export function isCents(value) {
  return Number.isSafeInteger(value);
}

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 分 → 显示文字。formatMoney(123450) → "RM 1,234.50"
 * sign: true 时正数前面加「+」。
 */
export function formatMoney(cents, { sign = false, symbol = true } = {}) {
  if (!isCents(cents)) throw new TypeError(`金额必须是整数（分）：${cents}`);
  const abs = Math.abs(cents);
  const body = `${groupThousands(String(Math.floor(abs / 100)))}.${String(abs % 100).padStart(2, '0')}`;
  const prefix = cents < 0 ? '-' : sign && cents > 0 ? '+' : '';
  return `${prefix}${symbol ? `${CURRENCY_SYMBOL} ` : ''}${body}`;
}

/**
 * 文字 → 分。
 * 空白 → null（「没填」，和「填了 0」不一样）；格式不对 → NaN。
 */
export function parseAmount(input) {
  if (input == null) return null;
  const s = String(input).trim().replace(/[,\s]/g, '').replace(/^RM/i, '');
  if (s === '') return null;
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return NaN;
  const [whole, frac = ''] = s.split('.');
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : NaN;
}

/** 分 → 记账键盘里的文字（修改记录时用）。1250 → "12.50"，1200 → "12" */
export function amountToInput(cents) {
  if (!isCents(cents) || cents < 0) return '';
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
}

/**
 * 记账键盘按一下。key 是 '0'–'9'、'.'、'back'。
 * 规则：最多两位小数、只能有一个小数点、开头的 0 会被取代、整数最多 8 位。
 */
export function pressKey(current, key) {
  const s = current ?? '';
  if (key === 'back') return s.slice(0, -1);
  if (key === '.') {
    if (s.includes('.')) return s;
    return s === '' ? '0.' : `${s}.`;
  }
  if (!/^\d$/.test(key)) return s;
  const [whole, frac] = s.split('.');
  if (frac !== undefined) return frac.length >= 2 ? s : s + key;
  if (whole === '0') return key;
  if (whole.length >= MAX_INTEGER_DIGITS) return s;
  return s + key;
}

/** 键盘输入中的金额显示，保留用户打的小数位。"1234.5" → "1,234.5" */
export function formatKeypadDisplay(input) {
  if (!input) return '0';
  const [whole, frac] = input.split('.');
  const grouped = groupThousands(whole || '0');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}
