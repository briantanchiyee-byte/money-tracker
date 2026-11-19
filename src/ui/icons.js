import { raw } from '../core/html.js';

const SPRITE = 'assets/icons/sprite.svg';
const NAMES = new Set([
  'plus', 'close', 'chevron-left', 'chevron-right', 'trash', 'calendar',
  'sliders', 'backspace', 'briefcase',
]);

/** 图标来自 assets/icons/sprite.svg。name 只能是上面写死的名字。 */
export function icon(name, className = 'icon') {
  if (!NAMES.has(name)) throw new Error(`没有这个图标：${name}`);
  return raw(
    `<svg class="${className}" aria-hidden="true" focusable="false"><use href="${SPRITE}#i-${name}"></use></svg>`,
  );
}
