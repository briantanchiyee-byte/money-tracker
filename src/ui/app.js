import { addDays, todayISO } from '../core/dates.js';
import { formatMoney } from '../core/money.js';
import { findCategory } from '../core/categories.js';
import { APP_VERSION } from '../version.js';
import { renderToday } from './today.js';
import { renderSettings } from './settings.js';
import { isSheetOpen, openEntrySheet } from './entry-sheet.js';
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

export function startApp({ store, persistent }) {
  const screen = document.getElementById('screen');
  const state = {
    tab: 'today',
    today: todayISO(),
    viewDate: todayISO(),
    justAddedId: null,
  };

  // 过了午夜：如果正在看「今天」，就跟着换到新的一天。
  function syncToday() {
    const now = todayISO();
    if (now === state.today) return;
    if (state.viewDate === state.today) state.viewDate = now;
    state.today = now;
  }

  function render() {
    syncToday();
    if (state.viewDate > state.today) state.viewDate = state.today;
    const common = {
      transactions: store.transactions(),
      categories: store.categories(),
      persistent,
    };
    const view =
      state.tab === 'today'
        ? renderToday({ ...common, viewDate: state.viewDate, today: state.today, justAddedId: state.justAddedId })
        : renderSettings({ ...common, version: APP_VERSION, standalone: isStandalone() });
    screen.innerHTML = String(view);
    state.justAddedId = null;
    for (const tab of document.querySelectorAll('.tab')) {
      if (tab.dataset.tab === state.tab) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
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
          await store.restore(tx);
          state.justAddedId = tx.id;
          render();
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
        state.tab = 'today';
        state.viewDate = tx.date;
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
        state.viewDate = saved.date;
        render();
        showToast('已修改');
      },
      onDelete: (t) => remove(t),
    });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || isSheetOpen()) return;
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
      case 'edit':
        openEdit(el.dataset.id);
        break;
      case 'delete': {
        const tx = store.get(el.dataset.id);
        if (tx) remove(tx);
        break;
      }
      case 'check-update':
        checkForUpdate().then((result) => showToast(UPDATE_MESSAGES[result]));
        break;
      default:
        break;
    }
  });

  enableSwipe(screen);
  store.subscribe(render);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
  });

  render();

  if (store.skipped) showToast(`有 ${store.skipped} 笔资料格式不对，暂时不显示`);

  // 主屏幕快捷方式：./?add=expense 或 ./?add=income
  const add = new URLSearchParams(location.search).get('add');
  if (add === 'expense' || add === 'income') {
    history.replaceState(null, '', location.pathname);
    openAdd(add);
  }
}
