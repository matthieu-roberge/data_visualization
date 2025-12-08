// === Maquette 3.2 : grille iOS-like + widgets de tailles différentes + resize handle ===
document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.getElementById("dashboard");
  const widgets = Array.from(dashboard.querySelectorAll(".widget"));

  // Paramètres de la "grille virtuelle"
  const cellWidth = 260;
  const cellHeight = 150;
  const gap = 20;
  let cols = 1;

  // Chaque item : élément + index logique + span (1 ou 2 colonnes)
  const items = widgets.map((el, index) => ({
    el,
    index,
    span: Math.max(1, Math.min(2, parseInt(el.dataset.span) || 1))
  }));

  // Nombre de colonnes selon la largeur du dashboard
  function computeCols() {
    const width = dashboard.clientWidth || dashboard.offsetWidth || 1100;
    const maxCols = Math.max(
      1,
      Math.floor((width + gap) / (cellWidth + gap))
    );
    cols = maxCols;
  }

  // Peut-on placer un item de "span" colonnes à (row, col) ?
  function canPlaceAt(row, col, span, occupied) {
    if (col + span > cols) return false;
    for (let c = 0; c < span; c++) {
      const cellIndex = row * cols + (col + c);
      if (occupied[cellIndex]) return false;
    }
    return true;
  }

  // Marquer les cellules occupées
  function occupyCells(row, col, span, occupied) {
    for (let c = 0; c < span; c++) {
      const cellIndex = row * cols + (col + c);
      occupied[cellIndex] = true;
    }
  }

  // Positionner tous les widgets en fonction de leur span
  function layout(skipEl = null) {
    computeCols();

    const occupied = [];
    let maxRow = 0;

    items.forEach((item) => {
      const el = item.el;
      const span = Math.max(1, Math.min(item.span || 1, cols)); // span réel

      // Chercher la première place libre
      let placed = false;
      let row = 0;
      let col = 0;

      while (!placed) {
        for (col = 0; col <= cols - span; col++) {
          if (canPlaceAt(row, col, span, occupied)) {
            placed = true;
            break;
          }
        }
        if (!placed) {
          row++;
        }
      }

      const x = col * (cellWidth + gap);
      const y = row * (cellHeight + gap);
      maxRow = Math.max(maxRow, row);

      const width = span * cellWidth + (span - 1) * gap;
      el.style.width = width + "px";
      el.style.height = cellHeight + "px";

      if (el !== skipEl) {
        el.style.transform = `translate(${x}px, ${y}px)`;
      }

      occupyCells(row, col, span, occupied);
    });

    const totalHeight = (maxRow + 1) * cellHeight + maxRow * gap;
    dashboard.style.height = totalHeight + "px";
  }

  function findItemByElement(el) {
    return items.find((it) => it.el === el) || null;
  }

  function findIndexByElement(el) {
    return items.findIndex((it) => it.el === el);
  }

  let draggingItem = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  let resizingItem = null;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  // Démarrage drag OU resize
  dashboard.addEventListener("mousedown", (e) => {
    const widget = e.target.closest(".widget");
    if (!widget) return;
    if (e.button !== 0) return; // bouton gauche uniquement

    const handle = e.target.closest(".widget-resize-handle");

    // --- Resize si clic sur le handle ---
    if (handle) {
      e.preventDefault();
      const item = findItemByElement(widget);
      if (!item) return;

      resizingItem = item;

      const widgetRect = widget.getBoundingClientRect();
      resizeStartX = e.clientX;
      resizeStartWidth = widgetRect.width;

      widget.classList.add("resizing");
      widget.style.transition = "none";
      document.body.style.userSelect = "none";
      return;
    }

    // --- Sinon : drag normal ---
    e.preventDefault();

    draggingItem = findItemByElement(widget);
    if (!draggingItem) return;

    const widgetRect = widget.getBoundingClientRect();
    dragOffsetX = e.clientX - widgetRect.left;
    dragOffsetY = e.clientY - widgetRect.top;

    widget.classList.add("dragging");
    widget.style.transition = "none";
    document.body.style.userSelect = "none";
  });

  // mousemove : drag OU resize
  document.addEventListener("mousemove", (e) => {
    // --- DRAG ---
    if (draggingItem) {
      const el = draggingItem.el;
      const dashboardRect = dashboard.getBoundingClientRect();

      let x = e.clientX - dashboardRect.left - dragOffsetX;
      let y = e.clientY - dashboardRect.top - dragOffsetY;

      x = Math.max(0, x);
      y = Math.max(0, y);

      el.style.transform = `translate(${x}px, ${y}px)`;

      let col = Math.round(x / (cellWidth + gap));
      let row = Math.round(y / (cellHeight + gap));

      col = Math.max(0, Math.min(cols - 1, col));
      if (row < 0) row = 0;

      let targetIndex = row * cols + col;
      const maxIndex = items.length - 1;
      if (targetIndex > maxIndex) {
        targetIndex = maxIndex;
      }

      const currentIndex = findIndexByElement(el);
      if (currentIndex === -1) return;

      if (targetIndex !== currentIndex) {
        const [moved] = items.splice(currentIndex, 1);
        items.splice(targetIndex, 0, moved);
        layout(el); // relayout les autres
      }

      return;
    }

    // --- RESIZE ---
    if (resizingItem) {
      const el = resizingItem.el;

      const dx = e.clientX - resizeStartX;
      let newWidth = resizeStartWidth + dx;

      const minWidth = cellWidth;
      const maxWidth = cols * (cellWidth + gap) - gap;
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      // feedback visuel continu
      el.style.width = newWidth + "px";

      const spanFloat = newWidth / (cellWidth + gap);
      let newSpan = Math.round(spanFloat);
      newSpan = Math.max(1, Math.min(2, newSpan));

      if (newSpan !== resizingItem.span) {
        resizingItem.span = newSpan;
        layout(el);
      }

      return;
    }
  });

  // mouseup : fin drag / resize
  document.addEventListener("mouseup", () => {
    if (draggingItem) {
      const el = draggingItem.el;
      el.classList.remove("dragging");
      el.style.transition = "";
      document.body.style.userSelect = "";
      draggingItem = null;
      layout();
    }

    if (resizingItem) {
      const el = resizingItem.el;
      el.classList.remove("resizing");
      el.style.transition = "";
      document.body.style.userSelect = "";
      resizingItem = null;
      layout();
    }
  });

  // Double-clic : toggle 1 ↔ 2 colonnes (en plus du resize)
  widgets.forEach((widget) => {
    widget.addEventListener("dblclick", () => {
      const item = findItemByElement(widget);
      if (!item) return;
      item.span = item.span === 1 ? 2 : 1;
      layout();
    });
  });

  // Recalcul du layout au resize fenêtre
  window.addEventListener("resize", () => {
    const el =
      draggingItem?.el || resizingItem?.el || null;
    layout(el);
  });

  // Première mise en page
  layout();
});