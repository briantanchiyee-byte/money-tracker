// 用吉隆坡时区跑，重现「UTC 会把早上的记录算到前一天」的坑。
process.env.TZ = 'Asia/Kuala_Lumpur';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  daysBetween,
  fullDateLabel,
  isValidISODate,
  monthDayLabel,
  relativeDayLabel,
  toISODate,
  todayISO,
  weekdayLabel,
} from '../src/core/dates.js';

test('用本地日期，不用 UTC：吉隆坡早上 7:30 还是当天', () => {
  // 2026-11-19 07:30 (UTC+8) = 2026-11-18 23:30 UTC
  const morning = new Date('2026-11-18T23:30:00Z');
  assert.equal(todayISO(morning), '2026-11-19');
  assert.notEqual(morning.toISOString().slice(0, 10), '2026-11-19'); // UTC 的写法就会错
});

test('晚上 11:59 还是当天', () => {
  assert.equal(toISODate(new Date('2026-11-19T15:59:00Z')), '2026-11-19');
});

test('isValidISODate', () => {
  assert.ok(isValidISODate('2026-11-19'));
  assert.ok(isValidISODate('2028-02-29'));
  assert.ok(!isValidISODate('2026-02-29'));
  assert.ok(!isValidISODate('2026-13-01'));
  assert.ok(!isValidISODate('2026-1-5'));
  assert.ok(!isValidISODate(''));
  assert.ok(!isValidISODate(null));
  assert.ok(!isValidISODate('0099-01-01'));
});

test('addDays：跨月、跨年、闰年', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-03-01', -1), '2028-02-29');
  assert.equal(addDays('2026-11-19', 0), '2026-11-19');
});

test('daysBetween', () => {
  assert.equal(daysBetween('2026-11-19', '2026-11-19'), 0);
  assert.equal(daysBetween('2026-11-18', '2026-11-19'), 1);
  assert.equal(daysBetween('2026-11-19', '2026-11-18'), -1);
  assert.equal(daysBetween('2026-01-01', '2027-01-01'), 365);
});

test('日期标签', () => {
  const today = '2026-11-19';
  assert.equal(weekdayLabel(today), '周四');
  assert.equal(relativeDayLabel('2026-11-19', today), '今天');
  assert.equal(relativeDayLabel('2026-11-18', today), '昨天');
  assert.equal(relativeDayLabel('2026-11-17', today), '前天');
  assert.equal(relativeDayLabel('2026-11-10', today), '11月10日');
  assert.equal(monthDayLabel('2025-12-31', today), '2025年12月31日');
  assert.equal(fullDateLabel('2026-11-19', today), '11月19日 周四');
});
