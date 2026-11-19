// 日期一律用「本地日期」字符串 YYYY-MM-DD，不用 UTC。
// 用 UTC 的话，马来西亚（UTC+8）早上 8 点前记的账会跑到前一天。

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const pad2 = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISODate(now);
}

export function isValidISODate(value) {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900) return false;
  const dt = new Date(y, mo - 1, d, 12);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** 取当天中午，避开夏令时等边界问题。 */
export function parseISODate(value) {
  if (!isValidISODate(value)) throw new RangeError(`日期格式不对：${value}`);
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** 从 fromIso 到 toIso 相差几天（toIso 比较晚就是正数）。 */
export function daysBetween(fromIso, toIso) {
  return Math.round((parseISODate(toIso) - parseISODate(fromIso)) / DAY_MS);
}

export function weekdayLabel(iso) {
  return WEEKDAYS[parseISODate(iso).getDay()];
}

/** "11月19日"；不是今年的话加年份。 */
export function monthDayLabel(iso, today) {
  const [y, m, d] = iso.split('-').map(Number);
  const sameYear = !today || today.slice(0, 4) === iso.slice(0, 4);
  return sameYear ? `${m}月${d}日` : `${y}年${m}月${d}日`;
}

/** 今天 / 昨天 / 前天 / 11月16日 */
export function relativeDayLabel(iso, today) {
  const diff = daysBetween(iso, today);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  return monthDayLabel(iso, today);
}

/** "11月19日 周四" */
export function fullDateLabel(iso, today) {
  return `${monthDayLabel(iso, today)} ${weekdayLabel(iso)}`;
}
