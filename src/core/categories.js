// 内建类别。内建的只能封存，不能删除（旧记录还要显示得出来）。

export const GROUPS = Object.freeze({
  need: '必要',
  want: '想要',
  growth: '成长',
  business: '生意',
  other: '其他',
});

/** 每个颜色在 styles/tokens.css 里都有一个 --c-<颜色> 变量。 */
export const CATEGORY_COLORS = Object.freeze([
  'orange', 'brown', 'green', 'blue', 'teal', 'yellow', 'cyan', 'pink', 'purple',
  'red', 'gray', 'indigo', 'mint', 'navy', 'gold', 'rose', 'slate',
]);

const cat = (order, id, type, name, icon, color, group, hint = '') =>
  Object.freeze({ id, type, name, hint, icon, color, group, order, archived: false, builtin: true });

export const BUILTIN_CATEGORIES = Object.freeze([
  // 支出
  cat(10, 'food', 'expense', '吃饭', '🍜', 'orange', 'need', '早午晚餐、外卖、mamak'),
  cat(20, 'drinks', 'expense', '饮料', '🧋', 'brown', 'want', '咖啡、奶茶、kopi'),
  cat(30, 'groceries', 'expense', '买菜日用', '🛒', 'green', 'need', '超市、菜市场、日用品'),
  cat(40, 'transport', 'expense', '交通', '🚇', 'blue', 'need', 'Grab、LRT/MRT、油钱、停车、过路费'),
  cat(50, 'rent', 'expense', '房租', '🏠', 'teal', 'need', '房租、管理费'),
  cat(60, 'utilities', 'expense', '水电网络', '💡', 'yellow', 'need', '电费、水费、Wi‑Fi'),
  cat(70, 'phone', 'expense', '手机', '📱', 'cyan', 'need', '手机配套、话费'),
  cat(80, 'shopping', 'expense', '购物', '🛍️', 'pink', 'want', '衣服、网购、电子产品'),
  cat(90, 'fun', 'expense', '娱乐', '🎬', 'purple', 'want', '电影、旅行、聚会、游戏'),
  cat(100, 'health', 'expense', '医疗', '💊', 'red', 'need', '看医生、药、牙医'),
  cat(110, 'insurance', 'expense', '保险', '🛡️', 'gray', 'need', '人寿、医药保险'),
  cat(120, 'learning', 'expense', '学习成长', '📚', 'indigo', 'growth', '书、课程、工具'),
  cat(130, 'family', 'expense', '给家人', '👪', 'rose', 'need', '给父母、家用'),
  cat(140, 'subscriptions', 'expense', '订阅', '🔁', 'mint', 'want', 'Netflix、Spotify、iCloud'),
  cat(150, 'gifts', 'expense', '人情', '🎁', 'gold', 'other', '红包、礼物、请客'),
  cat(160, 'biz-stock', 'expense', '进货成本', '📦', 'navy', 'business', '货品、原料'),
  cat(170, 'biz-ops', 'expense', '生意营运', '💼', 'slate', 'business', '广告、软件、运费、场地'),
  cat(900, 'other', 'expense', '其他', '✳️', 'gray', 'other'),
  // 收入
  cat(10, 'biz-income', 'income', '生意收入', '💰', 'green', 'business', '客户付款、销售'),
  cat(20, 'salary', 'income', '薪水兼职', '💵', 'teal', 'other'),
  cat(30, 'invest-income', 'income', '投资收入', '📈', 'indigo', 'growth', '股息、利息'),
  cat(40, 'gift-income', 'income', '红包礼金', '🧧', 'red', 'other'),
  cat(900, 'other-income', 'income', '其他收入', '➕', 'gray', 'other'),
]);

export const UNKNOWN_CATEGORY = Object.freeze({
  id: '', type: 'expense', name: '未分类', hint: '', icon: '❔', color: 'gray', group: 'other',
  order: 9999, archived: false, builtin: false,
});

function isValidCustom(c) {
  return (
    (c.type === 'expense' || c.type === 'income') &&
    typeof c.name === 'string' && c.name.trim() !== '' && c.name.length <= 20 &&
    typeof c.icon === 'string' && c.icon.length <= 8 &&
    CATEGORY_COLORS.includes(c.color) &&
    Object.hasOwn(GROUPS, c.group)
  );
}

/** 内建类别 + 存起来的设定（封存、排序、自己加的类别）。 */
export function mergeCategories(stored = []) {
  const byId = new Map(BUILTIN_CATEGORIES.map((c) => [c.id, { ...c }]));
  for (const s of stored) {
    if (!s || typeof s.id !== 'string' || !s.id) continue;
    const base = byId.get(s.id);
    if (base?.builtin) {
      byId.set(s.id, {
        ...base,
        archived: Boolean(s.archived),
        order: Number.isFinite(s.order) ? s.order : base.order,
      });
    } else if (!base && isValidCustom(s)) {
      byId.set(s.id, {
        id: s.id, type: s.type, name: s.name.trim(), hint: typeof s.hint === 'string' ? s.hint : '',
        icon: s.icon, color: s.color, group: s.group,
        order: Number.isFinite(s.order) ? s.order : 500,
        archived: Boolean(s.archived), builtin: false,
      });
    }
  }
  return [...byId.values()];
}

export function activeCategories(list, type) {
  return list.filter((c) => c.type === type && !c.archived).sort((a, b) => a.order - b.order);
}

export function findCategory(list, id) {
  return list.find((c) => c.id === id) ?? UNKNOWN_CATEGORY;
}

/** 生意类的支出类别：选了就自动算成生意的钱。 */
export function isBusinessCategory(category) {
  return category?.type === 'expense' && category.group === 'business';
}
