// 记录列表的「左滑删除」。
// 每一行：.swipe-row > .row-delete（藏在后面的删除按钮）+ .row-main（盖在上面、可以滑动）。
// 画面每次整页重画，所以事件挂在外层容器上。

const REVEAL = 88;

export function enableSwipe(container) {
  let drag = null;
  let openRow = null;
  let suppressClick = false;

  const main = (row) => row.querySelector('.row-main');

  function setOffset(row, x, animate = true) {
    row.classList.toggle('dragging', !animate);
    const el = main(row);
    if (el) el.style.transform = x ? `translateX(${x}px)` : '';
  }

  function closeRow(row) {
    if (!row) return;
    setOffset(row, 0);
    row.classList.remove('open');
    if (openRow === row) openRow = null;
  }

  container.addEventListener('pointerdown', (e) => {
    suppressClick = false;
    if (openRow && !openRow.isConnected) openRow = null;
    if (e.button !== 0 || e.target.closest('.row-delete')) return;
    const row = e.target.closest('.swipe-row');
    // 有一行开着时，点别的地方只是把它关上。
    if (openRow && openRow !== row) {
      closeRow(openRow);
      suppressClick = true;
    }
    if (!row) return;
    drag = {
      row,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      base: row === openRow ? -REVEAL : 0,
      offset: 0,
      active: false,
    };
  });

  container.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.active) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        drag.active = true;
        try {
          drag.row.setPointerCapture(e.pointerId);
        } catch {
          /* 有些浏览器在这时候不给 capture，没关系 */
        }
      } else if (Math.abs(dy) > 10) {
        drag = null; // 是上下滚动，不是左滑
        return;
      } else {
        return;
      }
    }
    drag.offset = Math.max(-REVEAL * 1.6, Math.min(0, drag.base + dx));
    setOffset(drag.row, drag.offset, false);
  });

  container.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { row, active, offset, base } = drag;
    drag = null;
    if (active) {
      suppressClick = true;
      if (offset < -REVEAL / 2) {
        setOffset(row, -REVEAL);
        row.classList.add('open');
        openRow = row;
      } else {
        closeRow(row);
      }
    } else if (base) {
      closeRow(row); // 点一下开着的那行：关上，不进入修改
      suppressClick = true;
    }
  });

  container.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { row } = drag;
    drag = null;
    if (row === openRow) setOffset(row, -REVEAL);
    else closeRow(row);
  });

  // 滑动结束后浏览器还会送一个 click，这里把它吃掉，免得打开修改画面。
  container.addEventListener(
    'click',
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
}
