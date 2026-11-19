// 所有插进画面的文字都经过这里转义，避免备注或导入的资料被当成 HTML 执行。

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"'`]/g, (c) => ESCAPES[c]);
}

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

/** 标记为「已经安全」的 HTML，只用在程序里写死的字符串。 */
export function raw(value) {
  return new SafeHtml(String(value));
}

function renderValue(value) {
  if (value == null || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return escapeHtml(value);
}

/** 用法：html`<p>${userText}</p>` —— userText 会被转义；嵌套的 html`` 不会被重复转义。 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}
