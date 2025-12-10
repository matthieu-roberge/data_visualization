// === Maquette 3.2 : grille iOS-like + widgets de tailles différentes + resize handle ===
document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.getElementById("dashboard");
  // Exclude fixed widgets from the draggable widgets list
  const widgets = Array.from(dashboard.querySelectorAll(".widget")).filter(
    (w) => !w.dataset.fixed
  );

  // Paramètres de la "grille virtuelle"
  // Calculé pour iPad Pro 2021 (1366px landscape): 7 widgets + 6 gaps + padding = 1358px
  // 7w + 6×6 + 8 = 1358 => 7w = 1350 => w = 192.86px (arrondi à 192px pour marge de sécurité)
  // Avec gap = 4px: 7w + 6×4 + 8 = 1358 => 7w = 1326 => w = 189.4px (arrondi à 189px)
  const cellWidth = 189;
  const cellHeight = 155;
  const gap = 4;
  let cols = 1;

  // Chaque item : élément + index logique + span (1 ou 2 colonnes) + group
  // Left area should include 9 single-span and 4 double-span widgets (13 items total)
  const items = widgets.map((el, index) => ({
    el,
    index,
    span: Math.max(1, Math.min(2, parseInt(el.dataset.span) || 1)),
    group: el.dataset.group || (index < 13 ? "left" : "main"),
  }));

  // Aire gauche : 3 widgets simple + 3 gaps
  const leftAreaCols = 3;
  const leftAreaWidth = leftAreaCols * (cellWidth + gap) - gap;

  // Limit canvas to a fixed number of rows
  const maxRows = 5; // user-requested limit: rows 0..4

  // Nombre de colonnes selon la largeur du dashboard
  function computeCols() {
    // Utiliser la largeur disponible du dashboard, en tenant compte du padding du wrapper
    const wrapper = dashboard.parentElement;
    const wrapperWidth = wrapper ? wrapper.clientWidth : window.innerWidth;
    const availableWidth = wrapperWidth - 8; // 4px padding de chaque côté
    const width = Math.min(availableWidth, 1792); // Ne pas dépasser le max-width

    const maxCols = Math.max(1, Math.floor((width + gap) / (cellWidth + gap)));
    cols = maxCols;
  }

  // Peut-on placer un item de "span" colonnes à (row, col) ?
  function canPlaceAt(row, col, span, occupied, group) {
    // Enforce max rows limit
    if (row >= maxRows) return false;
    // Contrainte d'aire : les widgets "left" restent dans l'aire gauche,
    // les autres ne peuvent pas entrer dans l'aire gauche.
    if (group === "left") {
      if (col < 0 || col + span > leftAreaCols) return false;
    } else {
      if (col < leftAreaCols) return false;
    }

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

  // Build an occupancy map from current DOM positions (used to test span expansion)
  function buildOccupiedFromDOM(excludeItem = null) {
    computeCols();
    const occupied = [];
    const dashboardRect = dashboard.getBoundingClientRect();

    // Reserve fixed placeholder column for the first fixedRows (as in layout)
    const fixedCol = 3;
    const fixedRows = 3;
    for (let r = 0; r < fixedRows; r++) {
      const cellIndex = r * cols + fixedCol;
      occupied[cellIndex] = true;
    }

    items.forEach((item) => {
      if (item === excludeItem) return;
      const rect = item.el.getBoundingClientRect();
      const x = rect.left - dashboardRect.left;
      const y = rect.top - dashboardRect.top;
      let col = Math.round(x / (cellWidth + gap));
      let row = Math.round(y / (cellHeight + gap));
      col = Math.max(0, Math.min(cols - 1, col));
      if (row < 0) row = 0;
      if (row >= maxRows) row = maxRows - 1;
      const span = Math.max(1, Math.min(item.span || 1, cols));
      for (let c = 0; c < span; c++) {
        const idx = row * cols + (col + c);
        occupied[idx] = true;
      }
    });

    return occupied;
  }
  // Check if an item can expand to `targetSpan` somewhere in the grid
  function canExpandSomewhere(item, targetSpan) {
    const occupied = buildOccupiedFromDOM(item);
    for (let r = 0; r < maxRows; r++) {
      for (let c = 0; c <= cols - targetSpan; c++) {
        if (canPlaceAt(r, c, targetSpan, occupied, item.group)) {
          return true;
        }
      }
    }
    return false;
  }

  // Get approximate current cell of an item based on its DOM rect
  function getItemCell(item) {
    const dashboardRect = dashboard.getBoundingClientRect();
    const rect = item.el.getBoundingClientRect();
    const x = rect.left - dashboardRect.left;
    const y = rect.top - dashboardRect.top;
    let col = Math.round(x / (cellWidth + gap));
    let row = Math.round(y / (cellHeight + gap));
    col = Math.max(0, Math.min(cols - 1, col));
    if (row < 0) row = 0;
    if (row >= maxRows) row = maxRows - 1;
    return { row, col };
  }

  // Find a target slot (row,col) for expansion, preferring the item's current row
  function findExpansionSlot(item, targetSpan) {
    const occupied = buildOccupiedFromDOM(item);
    const start = getItemCell(item).row;
    // search starting from current row downward, then from top to start-1
    for (let pass = 0; pass < 2; pass++) {
      const rStart = pass === 0 ? start : 0;
      const rEnd = pass === 0 ? maxRows : start;
      for (let r = rStart; r < rEnd; r++) {
        for (let c = 0; c <= cols - targetSpan; c++) {
          if (canPlaceAt(r, c, targetSpan, occupied, item.group)) {
            return { row: r, col: c };
          }
        }
      }
    }
    return null;
  }

  // Positionner tous les widgets en fonction de leur span
  function layout(skipEl = null) {
    computeCols();

    const occupied = [];
    let maxRow = 0;

    // Réserver la colonne 3 (4ème position) dans les 3 premières lignes pour le widget fixe
    const fixedCol = 3;
    const fixedRows = 3;
    for (let r = 0; r < fixedRows; r++) {
      const cellIndex = r * cols + fixedCol;
      occupied[cellIndex] = true;
    }

    // Positionner le widget fixe
    const fixedWidget = dashboard.querySelector(".widget-fixed");
    if (fixedWidget) {
      const fixedX = fixedCol * (cellWidth + gap);
      const fixedY = 0; // Commence à la première ligne
      fixedWidget.style.width = cellWidth + "px";
      fixedWidget.style.height = 3 * cellHeight + 2 * gap + "px";
      fixedWidget.style.transform = `translate(${fixedX}px, ${fixedY}px)`;
    }

    items.forEach((item) => {
      const el = item.el;
      const span = Math.max(1, Math.min(item.span || 1, cols)); // span réel

      // Chercher la première place libre
      let placed = false;
      let row = 0;
      let col = 0;

      while (!placed) {
        // stop searching past the allowed rows
        if (row >= maxRows) break;
        for (col = 0; col <= cols - span; col++) {
          if (canPlaceAt(row, col, span, occupied, item.group)) {
            placed = true;
            break;
          }
        }
        if (!placed) {
          row++;
        }
      }

      // Fallback: if we didn't find a spot within maxRows, try scanning
      // all allowed rows for any free cell; if still none, force to last cell
      if (!placed) {
        let found = false;
        for (let rr = 0; rr < maxRows && !found; rr++) {
          for (let cc = 0; cc <= cols - span; cc++) {
            if (canPlaceAt(rr, cc, span, occupied, item.group)) {
              row = rr;
              col = cc;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          row = maxRows - 1;
          col = Math.max(0, cols - span);
        }
      }

      const x = col * (cellWidth + gap);
      const y = row * (cellHeight + gap);
      maxRow = Math.max(maxRow, row);

      // Calcul de la largeur: span=1 -> cellWidth, span=2 -> 2×cellWidth + gap
      const width = span === 1 ? cellWidth : 2 * cellWidth + gap;
      el.style.width = width + "px";
      el.style.height = cellHeight + "px";

      if (el !== skipEl) {
        el.style.transform = `translate(${x}px, ${y}px)`;
      }

      occupyCells(row, col, span, occupied);
    });

    // Fix dashboard height to the maximum allowed rows so widgets cannot go lower
    const totalHeight = maxRows * cellHeight + (maxRows - 1) * gap;
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

  function getCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function startInteraction(e) {
    const widget = e.target.closest(".widget");
    if (!widget) return;
    if (e.type === "mousedown" && e.button !== 0) return; // bouton gauche uniquement
    if (widget.dataset.fixed) return; // Ignore fixed widgets for grid drag

    const coords = getCoords(e);
    const handle = e.target.closest(".widget-resize-handle");

    // --- Resize si clic/touch sur le handle ---
    if (handle) {
      e.preventDefault();
      const item = findItemByElement(widget);
      if (!item) return;

      resizingItem = item;

      const widgetRect = widget.getBoundingClientRect();
      resizeStartX = coords.x;
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
    dragOffsetX = coords.x - widgetRect.left;
    dragOffsetY = coords.y - widgetRect.top;

    widget.classList.add("dragging");
    widget.style.transition = "none";
    document.body.style.userSelect = "none";
  }

  dashboard.addEventListener("mousedown", startInteraction);
  dashboard.addEventListener("touchstart", startInteraction, {
    passive: false,
  });

  // mousemove / touchmove : drag OU resize
  function handleMove(e) {
    const coords = getCoords(e);
    // --- DRAG ---
    if (draggingItem) {
      const el = draggingItem.el;
      const dashboardRect = dashboard.getBoundingClientRect();

      let x = coords.x - dashboardRect.left - dragOffsetX;
      let y = coords.y - dashboardRect.top - dragOffsetY;

      // Contraintes de zone
      const width = el.offsetWidth;
      if (draggingItem.group === "left") {
        x = Math.min(x, leftAreaWidth - width);
        x = Math.max(0, x);
      } else {
        x = Math.max(x, leftAreaWidth + gap);
      }

      // Clamp vertical movement to the canvas maxRows
      const bottomY =
        maxRows * cellHeight + (maxRows - 1) * gap - el.offsetHeight;
      y = Math.max(0, Math.min(y, bottomY));

      el.style.transform = `translate(${x}px, ${y}px)`;

      let col = Math.round(x / (cellWidth + gap));
      let row = Math.round(y / (cellHeight + gap));

      col = Math.max(0, Math.min(cols - 1, col));
      if (row < 0) row = 0;
      if (row >= maxRows) row = maxRows - 1;

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

      const dx = coords.x - resizeStartX;
      let newWidth = resizeStartWidth + dx;

      const minWidth = cellWidth; // 242px
      const maxWidth = cols * (cellWidth + gap) - gap;
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      // feedback visuel continu
      el.style.width = newWidth + "px";

      // Déterminer le span basé sur la largeur: cellWidth = span 1, 2×cellWidth+gap = span 2
      // Utiliser un seuil à mi-chemin entre les deux tailles
      const doubleSpanWidth = 2 * cellWidth + gap;
      const threshold = (cellWidth + doubleSpanWidth) / 2;
      let newSpan = newWidth < threshold ? 1 : 2;
      newSpan = Math.max(1, Math.min(2, newSpan));

      if (newSpan !== resizingItem.span) {
        if (newSpan > resizingItem.span) {
          // Allow expansion if there is any free spot in the grid; if so,
          // set the new span and relayout (which will shift other widgets).
          if (canExpandSomewhere(resizingItem, newSpan)) {
            // find a slot for expansion (prefer current row)
            const slot = findExpansionSlot(resizingItem, newSpan);
            if (slot) {
              // move item in the logical items array to the target index so layout places it there
              const currentIndex = findIndexByElement(resizingItem.el);
              if (currentIndex !== -1) {
                const [moved] = items.splice(currentIndex, 1);
                const targetIndex = Math.min(
                  items.length,
                  slot.row * cols + slot.col
                );
                items.splice(targetIndex, 0, moved);
              }
            }
            resizingItem.span = newSpan;
            layout(el);
          } else {
            // no-op: expansion not possible anywhere, keep current span
          }
        } else {
          // shrinking is always allowed
          resizingItem.span = newSpan;
          layout(el);
        }
      }

      return;
    }
  }

  document.addEventListener("mousemove", handleMove);
  document.addEventListener(
    "touchmove",
    (e) => {
      if (draggingItem || resizingItem) {
        e.preventDefault();
      }
      handleMove(e);
    },
    { passive: false }
  );

  // mouseup / touchend : fin drag / resize
  function handleEnd() {
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
      // Snap to exact width: cellWidth for span 1, 2×cellWidth+gap for span 2
      const targetWidth =
        resizingItem.span === 1 ? cellWidth : 2 * cellWidth + gap;
      el.style.width = targetWidth + "px";
      el.classList.remove("resizing");
      el.style.transition = "";
      document.body.style.userSelect = "";
      resizingItem = null;
      layout();
    }
  }

  document.addEventListener("mouseup", handleEnd);
  document.addEventListener("touchend", handleEnd, { passive: false });

  // Double-clic : toggle 1 ↔ 2 colonnes (en plus du resize)
  widgets.forEach((widget) => {
    widget.addEventListener("dblclick", () => {
      const item = findItemByElement(widget);
      if (!item) return;
      const targetSpan = item.span === 1 ? 2 : 1;
      if (targetSpan > item.span) {
        if (!canExpandSomewhere(item, targetSpan)) {
          // cannot expand anywhere; ignore
          return;
        }

        // find a suitable slot and move the item in items array so layout will place it there
        const slot = findExpansionSlot(item, targetSpan);
        if (slot) {
          const currentIndex = findIndexByElement(item.el);
          if (currentIndex !== -1) {
            const [moved] = items.splice(currentIndex, 1);
            const targetIndex = Math.min(
              items.length,
              slot.row * cols + slot.col
            );
            items.splice(targetIndex, 0, moved);
          }
        }
      }

      item.span = targetSpan;
      layout();
    });
  });

  // Recalcul du layout au resize fenêtre
  window.addEventListener("resize", () => {
    const el = draggingItem?.el || resizingItem?.el || null;
    layout(el);
  });

  // Première mise en page
  layout();
});
