import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, html, raw } from '../src/core/html.js';

test('备注里的 HTML 会被转义，不会被执行', () => {
  const note = '<img src=x onerror="alert(1)">';
  const out = String(html`<span>${note}</span>`);
  assert.equal(out, '<span>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</span>');
});

test('属性里的引号也会被转义', () => {
  assert.equal(String(html`<b title="${`a" onclick="x`}">`), '<b title="a&quot; onclick=&quot;x">');
  assert.equal(escapeHtml(`'&\``), '&#39;&amp;&#96;');
});

test('嵌套的 html`` 不会被重复转义，阵列会接起来', () => {
  const items = ['<a>', 'b'].map((x) => html`<li>${x}</li>`);
  assert.equal(String(html`<ul>${items}</ul>`), '<ul><li>&lt;a&gt;</li><li>b</li></ul>');
});

test('null / undefined / false 显示成空白，0 照常显示', () => {
  assert.equal(String(html`${null}${undefined}${false}${0}`), '0');
});

test('raw() 不转义（只给程序写死的字符串用）', () => {
  assert.equal(String(html`${raw('<br>')}`), '<br>');
});
