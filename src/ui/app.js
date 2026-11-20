import { addDays, todayISO } from '../core/dates.js';
import { formatMoney } from '../core/money.js';
import { findCategory } from '../core/categories.js';
import { computeBudget } from '../core/budget.js';
import { addMonths, currentPeriod, monthOf } from '../core/periods.js';
import { recurringTransactionIds } from '../core/recurring.js';
import { html } from '../core/html.js';
import { APP_VERSION } from '../version.js';
import { renderToday } from './today.js';
import { renderRecordList, renderRecords } from './records.js';
import { renderSettings } from './settings.js';
import { isSheetOpen, openEntrySheet } from './entry-sheet.js';
import { isFormSheetOpen } from './form-sheet.js';
import { openPlanSheet } from './plan-sheet.js';
import { openRecurringSheet } from './recurring-sheet.js';
import { showToast } from './toast.js';
import { enableSwipe } from './swipe.js';
import { checkForUpdate } from './update.js';

const UPDATE_MESSAGES = {
  unsupported: '要从 HTTPS 网址打开才能检查更新',
  latest: `已经是最新版本 v${APP_VERSION}`,
  found: '找到新版本，下载好后上方会出现「更新」',
  error: '检查失败，请稍后再试',
};

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

/** 进度条宽度：CSP 不允许 style 属性，只能在画好之后用 CSSOM 设。 */
function applyMeters(root) {
  for (const el of root.querySelectorAll('[data-pct]')) {
    el.style.setProperty('--pct', `${Math.min(100, Math.max(0, Number(el.dataset.pct) || 0))}%`);
  }
}

export function startApp({ store, persistent }) {
  const screen = document.getElementById('screen');
  const state = {
    tab: 'today',
    today: todayISO(),
    viewDate: todayISO(),
    month: monthOf(todayISO()),
    query: '',
    justAddedId: null,
  };

  // 过了午夜：如果正在看「今天」，就跟着换到新的一天。
  function syncToday() {
    const now = todayISO();
    if (now === state.today) return false;
    if (state.viewDate === state.today) state.viewDate = now;
    if (state.month === monthOf(state.today)) state.month = monthOf(now);
    state.today = now;
    return true;
  }

  function commonProps() {
    const transactions = store.transactions();
    const recurring = store.recurring();
    return {
      transactions,
      categories: store.categories(),
      recurringIds: recurringTransactionIds(recurring, transactions),
      today: state.today,
      persistent,
    };
  }

  function render() {
    if (syncToday()) syncRecurring();
    if (state.viewDate > state.today) state.viewDate = state.today;
    const common = commonProps();
    let view;
    if (state.tab === 'today') {
      const plan = store.plan();
      const period = currentPeriod({ today: state.today, transactions: common.transactions, plan });
      const budget = computeBudget({
        today: state.today,
        transactions: common.transactions,
        recurring: store.recurring(),
        plan,
        period,
      });
      view = renderToday({ ...common, viewDate: state.viewDate, justAddedId: state.justAddedId, budget });
    } else if (state.tab === 'records') {
      view = renderRecords({ ...common, month: state.month, query: state.query, justAddedId: state.justAddedId });
    } else {
      view = renderSettings({
        ...common,
        version: APP_VERSION,
        standalone: isStandalone(),
        plan: store.plan(),
        recurring: store.recurring(),
      });
    }
    screen.innerHTML = String(view);
    applyMeters(screen);
    state.justAddedId = null;
    for (const tab of document.querySelectorAll('.tab')) {
      if (tab.dataset.tab === state.tab) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
  }

  function renderSearchResults() {
    const list = screen.querySelector('[data-ref="record-list"]');
    const monthBlock = screen.querySelector('[data-ref="month-block"]');
    if (!list) return;
    list.innerHTML = String(html`${renderRecordList({ ...commonProps(), month: state.month, query: state.query })}`);
    if (monthBlock) monthBlock.hidden = Boolean(state.query.trim());
  }

  // ---------- 固定项目自动记账 ----------

  let syncing = false;
  async function syncRecurring() {
    if (syncing) return;
    syncing = true;
    try {
      const added = await store.postDueRecurring(todayISO());
      if (added) showToast(`自动记了 ${added} 笔固定项目`);
    } catch (err) {
      showToast(`固定项目自动记账失败：${err.message}`);
    } finally {
      syncing = false;
    }
  }

  const describe = (tx) => `${findCategory(store.categories(), tx.categoryId).name} ${formatMoney(tx.amount)}`;

  async function remove(tx, { fromUndo = false } = {}) {
    try {
      await store.remove(tx.id);
    } catch (err) {
      showToast(`删除失败：${err.message}`);
      return;
    }
    if (fromUndo) {
      showToast('已撤销');
      return;
    }
    showToast(`已删除 ${describe(tx)}`, {
      actionLabel: '撤销',
      onAction: async () => {
        try {
          state.justAddedId = tx.id;
          await store.restore(tx);
        } catch (err) {
          showToast(`复原失败：${err.message}`);
        }
      },
    });
  }

  function openAdd(type = 'expense') {
    openEntrySheet({
      store,
      type,
      date: state.tab === 'today' ? state.viewDate : state.today,
      onSaved: (tx) => {
        if (state.tab !== 'records' || state.query) {
          state.tab = 'today';
          state.viewDate = tx.date;
        } else {
          state.month = monthOf(tx.date);
        }
        state.justAddedId = tx.id;
        render();
        showToast(`已记下 ${describe(tx)}`, {
          actionLabel: '撤销',
          onAction: () => remove(tx, { fromUndo: true }),
        });
      },
    });
  }

  function openEdit(id) {
    const tx = store.get(id);
    if (!tx) return;
    openEntrySheet({
      store,
      tx,
      onSaved: (saved) => {
        if (state.tab === 'today') state.viewDate = saved.date;
        render();
        showToast('已修改');
      },
      onDelete: (t) => remove(t),
    });
  }

  function openPlan() {
    const dates = store.transactions().map((t) => t.date).sort();
    const defaultStartDate = dates[0] && dates[0] < state.today ? dates[0] : state.today;
    openPlanSheet({
      store,
      defaultStartDate,
      onSaved: () => showToast('计划已保存'),
    });
  }

  function openRecurring(id = null) {
    const item = id ? store.getRecurring(id) : null;
    if (id && !item) return;
    openRecurringSheet({
      store,
      item,
      today: state.today,
      onSaved: (saved, { editing }) => {
        showToast(editing ? '已修改固定项目' : `已新增：每月 ${saved.day} 号`);
        syncRecurring();
      },
      onDelete: async (it) => {
        try {
          await store.removeRecurring(it.id);
        } catch (err) {
          showToast(`删除失败：${err.message}`);
          return;
        }
        showToast('已删除固定项目', {
          actionLabel: '撤销',
          onAction: () => store.restoreRecurring(it).catch((err) => showToast(`复原失败：${err.message}`)),
        });
      },
    });
  }

  const sheetOpen = () => isSheetOpen() || isFormSheetOpen();

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || sheetOpen()) return;
    switch (el.dataset.action) {
      case 'tab':
        if (state.tab !== el.dataset.tab) {
          state.tab = el.dataset.tab;
          render();
          window.scrollTo(0, 0);
        }
        break;
      case 'add':
        openAdd();
        break;
      case 'day-prev':
        state.viewDate = addDays(state.viewDate, -1);
        render();
        break;
      case 'day-next':
        if (state.viewDate < state.today) {
          state.viewDate = addDays(state.viewDate, 1);
          render();
        }
        break;
      case 'day-today':
        state.viewDate = state.today;
        render();
        break;
      case 'month-prev':
        state.month = addMonths(state.month, -1);
        render();
        break;
      case 'month-next':
        if (state.month < monthOf(state.today)) {
          state.month = addMonths(state.month, 1);
          render();
        }
        break;
      case 'edit':
        openEdit(el.dataset.id);
        break;
      case 'delete': {
        const tx = store.get(el.dataset.id);
        if (tx) remove(tx);
        break;
      }
      case 'open-plan':
        openPlan();
        break;
      case 'add-recurring':
        openRecurring();
        break;
      case 'edit-recurring':
        openRecurring(el.dataset.id);
        break;
      case 'check-update':
        checkForUpdate().then((result) => showToast(UPDATE_MESSAGES[result]));
        break;
      default:
        break;
    }
  });

  screen.addEventListener('input', (e) => {
    if (e.target.matches('[data-ref="search"]')) {
      state.query = e.target.value;
      renderSearchResults();
    }
  });
  screen.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-ref="search"]')) e.target.blur();
  });

  enableSwipe(screen);
  store.subscribe(() => {
    // 搜索中有资料变动：保留输入框，只更新列表。
    if (state.tab === 'records' && state.query.trim() && screen.querySelector('[data-ref="search"]')) renderSearchResults();
    else render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      render();
      syncRecurring();
    }
  });

  render();
  syncRecurring();

  if (store.skipped) showToast(`有 ${store.skipped} 笔资料格式不对，暂时不显示`);

  // 主屏幕快捷方式：./?add=expense 或 ./?add=income
  const add = new URLSearchParams(location.search).get('add');
  if (add === 'expense' || add === 'income') {
    history.replaceState(null, '', location.pathname);
    openAdd(add);
  }
}
