import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BUILTIN_CATEGORIES,
  CATEGORY_COLORS,
  GROUPS,
  activeCategories,
  findCategory,
  isBusinessCategory,
  mergeCategories,
} from '../src/core/categories.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('内建类别：编号不重复、栏位齐全', () => {
  const ids = BUILTIN_CATEGORIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of BUILTIN_CATEGORIES) {
    assert.ok(['expense', 'income'].includes(c.type), c.id);
    assert.ok(Object.hasOwn(GROUPS, c.group), c.id);
    assert.ok(CATEGORY_COLORS.includes(c.color), c.id);
    assert.ok(c.name && c.icon, c.id);
  }
  assert.ok(activeCategories(BUILTIN_CATEGORIES, 'expense').length > 0);
  assert.ok(activeCategories(BUILTIN_CATEGORIES, 'income').length > 0);
});

test('每个类别颜色在 CSS 里都有定义', () => {
  const tokens = read('styles/tokens.css');
  const components = read('styles/components.css');
  for (const color of CATEGORY_COLORS) {
    assert.ok(tokens.includes(`--c-${color}:`), `tokens.css 缺少 --c-${color}`);
    assert.ok(components.includes(`[data-color="${color}"]`), `components.css 缺少 [data-color="${color}"]`);
  }
});

test('生意类别：只有支出的「进货成本」「生意营运」会自动算生意', () => {
  const list = mergeCategories();
  assert.ok(isBusinessCategory(findCategory(list, 'biz-stock')));
  assert.ok(isBusinessCategory(findCategory(list, 'biz-ops')));
  assert.ok(!isBusinessCategory(findCategory(list, 'food')));
  assert.ok(!isBusinessCategory(findCategory(list, 'biz-income')));
});

test('mergeCategories：内建的可以封存，但不会被删除或改名', () => {
  const list = mergeCategories([{ id: 'drinks', archived: true, name: '被改掉' }]);
  const drinks = findCategory(list, 'drinks');
  assert.equal(drinks.archived, true);
  assert.equal(drinks.name, '饮料');
  assert.ok(!activeCategories(list, 'expense').some((c) => c.id === 'drinks'));
});

test('mergeCategories：自己加的类别要合法才收', () => {
  const ok = { id: 'pet', type: 'expense', name: '宠物', icon: '🐱', color: 'orange', group: 'want' };
  const list = mergeCategories([ok, { id: 'bad', type: 'expense', name: '', icon: 'x', color: 'neon', group: 'want' }, null]);
  assert.equal(findCategory(list, 'pet').name, '宠物');
  assert.equal(findCategory(list, 'bad').name, '未分类');
});

test('找不到的类别显示「未分类」', () => {
  assert.equal(findCategory(mergeCategories(), 'deleted').name, '未分类');
});
