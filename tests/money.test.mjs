import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_AMOUNT_CENTS,
  amountToInput,
  formatKeypadDisplay,
  formatMoney,
  parseAmount,
  pressKey,
} from '../src/core/money.js';

test('formatMoney：分 → RM 文字', () => {
  assert.equal(formatMoney(0), 'RM 0.00');
  assert.equal(formatMoney(5), 'RM 0.05');
  assert.equal(formatMoney(1250), 'RM 12.50');
  assert.equal(formatMoney(123456789), 'RM 1,234,567.89');
  assert.equal(formatMoney(-1250), '-RM 12.50');
  assert.equal(formatMoney(1250, { sign: true }), '+RM 12.50');
  assert.equal(formatMoney(0, { sign: true }), 'RM 0.00');
  assert.equal(formatMoney(1250, { symbol: false }), '12.50');
});

test('formatMoney：不接受小数（金额一律是整数分）', () => {
  assert.throws(() => formatMoney(12.5));
  assert.throws(() => formatMoney(NaN));
});

test('用整数分加总，不会出现 0.30000000000000004', () => {
  const total = parseAmount('0.1') + parseAmount('0.2');
  assert.equal(total, 30);
  assert.equal(formatMoney(total), 'RM 0.30');
});

test('parseAmount：空白是「没填」(null)，0 是「填了 0」', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('   '), null);
  assert.equal(parseAmount(undefined), null);
  assert.equal(parseAmount('0'), 0);
});

test('parseAmount：各种写法', () => {
  assert.equal(parseAmount('12'), 1200);
  assert.equal(parseAmount('12.5'), 1250);
  assert.equal(parseAmount('12.50'), 1250);
  assert.equal(parseAmount('12.'), 1200);
  assert.equal(parseAmount('.5'), 50);
  assert.equal(parseAmount('1,234.56'), 123456);
  assert.equal(parseAmount('RM 8.90'), 890);
});

test('parseAmount：格式不对回传 NaN', () => {
  for (const bad of ['12.345', 'abc', '1.2.3', '-5', '1e3']) {
    assert.ok(Number.isNaN(parseAmount(bad)), bad);
  }
});

test('amountToInput：修改记录时放回键盘', () => {
  assert.equal(amountToInput(1250), '12.50');
  assert.equal(amountToInput(1200), '12');
  assert.equal(amountToInput(5), '0.05');
  assert.equal(parseAmount(amountToInput(98765)), 98765);
});

const type = (keys) => keys.reduce((s, k) => pressKey(s, k), '');

test('pressKey：一般输入', () => {
  assert.equal(type(['1', '2', '.', '5']), '12.5');
  assert.equal(type(['1', '2', 'back']), '1');
  assert.equal(type(['back']), '');
});

test('pressKey：最多两位小数、只有一个小数点', () => {
  assert.equal(type(['1', '.', '2', '3', '4']), '1.23');
  assert.equal(type(['1', '.', '.', '5']), '1.5');
  assert.equal(type(['.', '5']), '0.5');
});

test('pressKey：开头的 0 会被取代，整数最多 8 位', () => {
  assert.equal(type(['0', '0', '7']), '7');
  assert.equal(type(['0', '.', '5']), '0.5');
  assert.equal(type('1234567890'.split('')), '12345678');
});

test('键盘最多能打的金额会被上限挡住', () => {
  assert.ok(parseAmount('99999999.99') > MAX_AMOUNT_CENTS);
  assert.ok(parseAmount('10000000') <= MAX_AMOUNT_CENTS);
});

test('formatKeypadDisplay：保留用户打的小数位', () => {
  assert.equal(formatKeypadDisplay(''), '0');
  assert.equal(formatKeypadDisplay('1234'), '1,234');
  assert.equal(formatKeypadDisplay('1234.'), '1,234.');
  assert.equal(formatKeypadDisplay('1234.5'), '1,234.5');
  assert.equal(formatKeypadDisplay('0.'), '0.');
});
