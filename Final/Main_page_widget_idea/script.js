// === Maquette 3.2 : grille iOS-like + widgets de tailles différentes + resize handle (FINAL REVERTED VERSION) ===
document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.getElementById("dashboard");
  // Exclude fixed widgets from the draggable widgets list
  const widgets = Array.from(dashboard.querySelectorAll(".widget")).filter(
    (w) => !w.dataset.fixed
  );

  // Paramètres de la "grille virtuelle"
  let cellWidth = 189;
  const baseCellWidth = 250; // largeur "idéale" d'une cellule sur grand écran
  const cellHeight = 130;
  const gap = 10;
  let cols = 1;
  const maxCols = 7; // user-requested horizontal limit

  // GESTURE STATE
  let activeTouches = 0;
  let gestureItem = null;
  let initialDistance = 0;
  let initialWidgetWidth = 0;
  let lastDistance = 0;
  let animationFrameId = null; 

  // Width targets (dépendent maintenant de cellWidth et seront recalculés)
  // Width targets (dépendent maintenant de cellWidth et seront recalculés)
let singleSpanWidth = cellWidth;
let doubleSpanWidth = 2 * cellWidth + gap;
let tripleSpanWidth = 3 * cellWidth + 2 * gap;
// Seuils entre 1↔2 colonnes et 2↔3 colonnes
let spanThreshold12 = (singleSpanWidth + doubleSpanWidth) / 2;
let spanThreshold23 = (doubleSpanWidth + tripleSpanWidth) / 2;

  // Each item logic (unchanged)
  const items = widgets.map((el, index) => ({
    el,
    index,
    span: Math.max(1, Math.min(3, parseInt(el.dataset.span) || 1)),
    group: el.dataset.group || (index < 13 ? "left" : "main"),
  }));

  // Helper functions 
  function findItemByElement(el) {
    return items.find((it) => it.el === el) || null;
  }

  function findIndexByElement(el) {
    return items.findIndex((it) => it.el === el);
  }
  
  function addDeleteButtons() {
    items.forEach((item) => {
      const el = item.el;
      if (el.querySelector(".widget-delete")) return;
      const btn = document.createElement("button");
      btn.className = "widget-delete";
      btn.type = "button";
      btn.setAttribute("aria-label", "Delete widget");
      btn.innerHTML = "−";
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (!editing) return;
        const idx = items.findIndex((it) => it.el === el);
        if (idx !== -1) {
          if (draggingItem === items[idx]) draggingItem = null;
          if (resizingItem === items[idx]) resizingItem = null;
          if (gestureItem === items[idx]) gestureItem = null; 
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
          items.splice(idx, 1);
        }
        if (el.parentElement) el.parentElement.removeChild(el);
        layout();
      });
      el.appendChild(btn);
    });
  }

  addDeleteButtons();

  const leftAreaCols = 3;
  let leftAreaWidth = leftAreaCols * (cellWidth + gap) - gap;
  const maxRows = 5;

  function computeCols() {
    // On garde toujours 7 colonnes logiques
    cols = maxCols;

    // Largeur disponible dans le wrapper (ou la fenêtre si pas de wrapper)
    const wrapper = dashboard.parentElement;
    const wrapperWidth = wrapper ? wrapper.clientWidth : window.innerWidth;

    // Petit "padding" pour éviter de coller aux bords
    const horizontalPadding = 8;
    const availableWidth = wrapperWidth - horizontalPadding;

    // Largeur maximale de la grille si on garde la taille idéale
    const idealGridWidth = maxCols * (baseCellWidth + gap) - gap;

    // Si on a assez de place, on garde la taille idéale des cellules
    let newCellWidth = baseCellWidth;

    // Si l'écran est plus petit, on réduit la largeur des cellules pour que la grille tienne
    if (availableWidth < idealGridWidth) {
      newCellWidth = Math.floor((availableWidth + gap) / maxCols) - gap;
      // On fixe une largeur minimale pour ne pas avoir des widgets ridiculement petits
      newCellWidth = Math.max(60, newCellWidth);
    }

    // Met à jour les largeurs dérivées
    // Met à jour les largeurs dérivées
cellWidth = newCellWidth;
singleSpanWidth = cellWidth;
doubleSpanWidth = 2 * cellWidth + gap;
tripleSpanWidth = 3 * cellWidth + 2 * gap;

spanThreshold12 = (singleSpanWidth + doubleSpanWidth) / 2;
spanThreshold23 = (doubleSpanWidth + tripleSpanWidth) / 2;

leftAreaWidth = leftAreaCols * (cellWidth + gap) - gap;
  }

  function canPlaceAt(row, col, span, occupied, group) {
    if (row >= maxRows) return false;
    if (col < 0 || col >= maxCols) return false;
    if (col + span > maxCols) return false;
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

  function occupyCells(row, col, span, occupied) {
    for (let c = 0; c < span; c++) {
      const cellIndex = row * cols + (col + c);
      occupied[cellIndex] = true;
    }
  }

  function buildOccupiedFromDOM(excludeItem = null) {
    computeCols();
    const occupied = [];
    const dashboardRect = dashboard.getBoundingClientRect();
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

  function findExpansionSlot(item, targetSpan) {
    const occupied = buildOccupiedFromDOM(item);
    const start = getItemCell(item).row;
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

  function layout(skipEl = null) {
    computeCols();

    const occupied = [];
    let maxRow = 0;

    const fixedCol = 3;
    const fixedRows = 3;
    for (let r = 0; r < fixedRows; r++) {
      const cellIndex = r * cols + fixedCol;
      occupied[cellIndex] = true;
    }

    const fixedWidget = dashboard.querySelector(".widget-fixed");
    if (fixedWidget) {
      const fixedX = fixedCol * (cellWidth + gap);
      const fixedY = 0;
      fixedWidget.style.width = cellWidth + "px";
      fixedWidget.style.height = 3 * cellHeight + 2 * gap + "px";
      fixedWidget.style.transform = `translate(${fixedX}px, ${fixedY}px)`;
    }

    items.forEach((item) => {
      const el = item.el;
      const span = Math.max(1, Math.min(item.span || 1, cols));

      let placed = false;
      let row = 0;
      let col = 0;

      while (!placed) {
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

      
      
      let width;
if (span === 1) width = singleSpanWidth;
else if (span === 2) width = doubleSpanWidth;
else width = tripleSpanWidth;

// Ne pas écraser la largeur pendant un drag ou un pinch
if (el !== skipEl && el !== gestureItem?.el) {
  el.style.width = width + "px";
}
      el.style.height = cellHeight + "px";


      if (el !== skipEl) {
        el.style.transform = `translate(${x}px, ${y}px)`;
      }

      occupyCells(row, col, span, occupied);
    });

    const totalHeight = maxRows * cellHeight + (maxRows - 1) * gap;
    dashboard.style.height = totalHeight + "px";
    renderPlaceholders(occupied);
  }

  function renderPlaceholders(occupied) {
    const prev = dashboard.querySelectorAll(".widget-empty");
    prev.forEach((p) => p.remove());

    if (!editing) return;

    const occ = occupied || buildOccupiedFromDOM(null);

    for (let r = 0; r < maxRows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (occ[idx]) continue;

        let group = c < leftAreaCols ? "left" : "main";
        if (!canPlaceAt(r, c, 1, occ, group)) continue;

        // Coordinates of the placeholder
        const x = c * (cellWidth + gap);
        const y = r * (cellHeight + gap);

        const ph = document.createElement("div");
        ph.className = "widget widget-empty";
        ph.style.width = cellWidth + "px";
        ph.style.height = cellHeight + "px";
        ph.style.transform = `translate(${x}px, ${y}px)`;

        const btn = document.createElement("button");
        btn.className = "widget-add";
        btn.type = "button";
        btn.innerHTML = "+";
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          if (!editing) return;

          // FIX: Capture the target coordinates from the placeholder
          const targetX = x;
          const targetY = y;

          // Create a new widget DOM element
          const newEl = document.createElement("div");
          newEl.className = "widget";
          newEl.setAttribute("data-span", "1");
          newEl.dataset.group = group;
          
          // FIX: Immediately set the visual position and size to match the placeholder
          newEl.style.transform = `translate(${targetX}px, ${targetY}px)`;
          newEl.style.width = singleSpanWidth + "px"; 
          newEl.style.height = cellHeight + "px"; 
          
          const h = document.createElement("h2");
          h.textContent = "New widget";
          const val = document.createElement("div");
          val.className = "value big";
          val.textContent = "—";
          newEl.appendChild(h);
          newEl.appendChild(val);
          const resizeHandle = document.createElement("div");
          resizeHandle.className = "widget-resize-handle";
          newEl.appendChild(resizeHandle);
          newEl.addEventListener("dblclick", () => {
            if (!editing) return;
            const item = findItemByElement(newEl);
            if (!item) return;
            const targetSpan = item.span === 1 ? 2 : (item.span === 2 ? 3 : 1);
            if (targetSpan > item.span) {
              if (!canExpandSomewhere(item, targetSpan)) return;
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

          // Insert into DOM and logical items at approximate index
          dashboard.appendChild(newEl);
          const insertIndex = Math.min(items.length, r * cols + c);
          const newItem = { el: newEl, index: insertIndex, span: 1, group };
          items.splice(insertIndex, 0, newItem);
          addDeleteButtons();
          
          // layout() will now run, confirming the position (no jump) and shifting others.
          layout();
        });

        ph.appendChild(btn);
        dashboard.appendChild(ph);
      }
    }
  }

  let draggingItem = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let editing = false;
  let resizingItem = null;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  function getCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }
  
  function getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function updateGestureSize() {
      if (!gestureItem || activeTouches !== 2) {
          animationFrameId = null;
          return;
      }
      
      const el = gestureItem.el;
      const delta = lastDistance - initialDistance; 
      let newWidth = initialWidgetWidth + delta;
      
      const maxWidth = tripleSpanWidth;
      
      newWidth = Math.max(singleSpanWidth, Math.min(maxWidth, newWidth));
      
      el.style.width = newWidth + "px";

      animationFrameId = requestAnimationFrame(updateGestureSize);
  }
  
  function startGesture(e) {
    const widget = e.target.closest(".widget");
    if (!editing || !widget || widget.dataset.fixed || e.touches.length !== 2) return;
    if (e.target.closest(".widget-resize-handle")) return;

    e.stopPropagation();
    e.preventDefault(); 
    
    gestureItem = findItemByElement(widget);
    if (!gestureItem) return;

    const rect = widget.getBoundingClientRect();
    initialDistance = getDistance(e.touches);
    lastDistance = initialDistance;
    initialWidgetWidth = rect.width;

    widget.classList.add("resizing");
    widget.style.transition = "none";
    
    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(updateGestureSize);
    }
  }


  function startInteraction(e) {
    activeTouches = e.touches ? e.touches.length : (e.type === 'mousedown' ? 1 : 0);
    
    // FIX: Ignore interaction if the target is the delete or add button
    if (e.target.closest(".widget-delete") || e.target.closest(".widget-add")) {
        return; 
    }

    if (activeTouches === 2) {
      startGesture(e);
      return;
    }
    
    if (!editing || activeTouches > 1) return;
    
    const widget = e.target.closest(".widget");
    if (!widget) return;
    if (e.type === "mousedown" && e.button !== 0) return;
    if (widget.dataset.fixed) return;

    const coords = getCoords(e);
    const handle = e.target.closest(".widget-resize-handle");

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
  
  function handlePinchMove(e) {
    if (!gestureItem || e.touches.length !== 2) return;
    
    e.preventDefault();
    lastDistance = getDistance(e.touches);
  }

  function handleMove(e) {
    if (e.touches && e.touches.length === 2) {
      handlePinchMove(e);
      return;
    }
    
    const coords = getCoords(e);
    // --- DRAG ---
    if (draggingItem) {
      const el = draggingItem.el;
      const dashboardRect = dashboard.getBoundingClientRect();

      let x = coords.x - dashboardRect.left - dragOffsetX;
      let y = coords.y - dashboardRect.top - dragOffsetY;

      const width = el.offsetWidth;
      if (draggingItem.group === "left") {
        x = Math.min(x, leftAreaWidth - width);
        x = Math.max(0, x);
      } else {
        x = Math.max(x, leftAreaWidth + gap);
        const rightX = cols * (cellWidth + gap) - gap - el.offsetWidth;
        x = Math.min(x, rightX);
      }

      const bottomY =
        maxRows * cellHeight + (maxRows - 1) * gap - el.offsetHeight;
      y = Math.max(0, Math.min(y, bottomY));

      // 1. Visually move the dragging item
      el.style.transform = `translate(${x}px, ${y}px)`;

      // --- REVERTED DRAG LOGIC (Simple index calculation based on top-left corner) ---
      
      let col = Math.round(x / (cellWidth + gap));
      let row = Math.round(y / (cellHeight + gap));

      col = Math.max(0, Math.min(maxCols - 1, col));
      if (row < 0) row = 0;
      if (row >= maxRows) row = maxRows - 1;

      let targetIndex = row * cols + col;
      const maxIndex = items.length - 1;
      
      // Cap the target index to prevent array overflow when dropping near the end
      if (targetIndex > maxIndex) {
        targetIndex = maxIndex;
      }
      const maxPossibleIndex = items.length;
      targetIndex = Math.min(Math.max(0, targetIndex), maxPossibleIndex);

      const currentIndex = findIndexByElement(el);
      if (currentIndex === -1) return;

      // 3. Update Logical Index and trigger layout (Original behavior)
      if (targetIndex !== currentIndex) {
        const [moved] = items.splice(currentIndex, 1);
        items.splice(targetIndex, 0, moved);
        layout(el); // relayout the others
      }

      return;
    }

    // --- RESIZE (Handle) ---
    if (resizingItem) {
      const el = resizingItem.el;

      const dx = coords.x - resizeStartX;
      let newWidth = resizeStartWidth + dx;

      const minWidth = cellWidth;
let maxWidth;
if (resizingItem.group === 'left') {
  maxWidth = tripleSpanWidth;
} else {
  maxWidth = tripleSpanWidth;
}

      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      el.style.width = newWidth + "px";

      let newSpan;
if (newWidth < spanThreshold12) newSpan = 1;
else if (newWidth < spanThreshold23) newSpan = 2;
else newSpan = 3;

const maxSpan = resizingItem.group === 'left'
  ? Math.min(3, leftAreaCols)
  : 3;

newSpan = Math.max(1, Math.min(maxSpan, newSpan));

      if (newSpan !== resizingItem.span) {
        if (newSpan > resizingItem.span) {
          if (canExpandSomewhere(resizingItem, newSpan)) {
            const slot = findExpansionSlot(resizingItem, newSpan);
            if (slot) {
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
          }
        } else {
          resizingItem.span = newSpan;
          layout(el);
        }
      }

      return;
    }
  }

  dashboard.addEventListener("mousedown", startInteraction);
  dashboard.addEventListener("touchstart", (e) => {
      activeTouches = e.touches ? e.touches.length : 0;
      startInteraction(e);
  }, { passive: false });

  document.addEventListener("mousemove", handleMove);
  document.addEventListener(
    "touchmove",
    (e) => {
      if (draggingItem || resizingItem || gestureItem) {
        e.preventDefault();
      }
      handleMove(e);
    },
    { passive: false }
  );

  function handleEnd(e) {
    if (e.touches) {
        activeTouches = e.touches.length;
    }
    
    // --- GESTURE END: Finalize the span change and snap to grid size ---
    if (gestureItem && (!e.touches || e.touches.length === 0)) {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        const el = gestureItem.el;
        const currentVisualWidth = el.offsetWidth;
        const currentSpan = gestureItem.span;
        
        let targetSpan;
if (currentVisualWidth < spanThreshold12) targetSpan = 1;
else if (currentVisualWidth < spanThreshold23) targetSpan = 2;
else targetSpan = 3;

        if (targetSpan !== currentSpan) {
             if (targetSpan > currentSpan) {
                if (canExpandSomewhere(gestureItem, targetSpan)) {
                    const slot = findExpansionSlot(gestureItem, targetSpan);
                    if (slot) {
                      const currentIndex = findIndexByElement(el);
                      if (currentIndex !== -1) {
                        const [moved] = items.splice(currentIndex, 1);
                        const targetIndex = Math.min(items.length, slot.row * cols + slot.col);
                        items.splice(targetIndex, 0, moved);
                      }
                    }
                    gestureItem.span = targetSpan;
                } else {
                    targetSpan = currentSpan; 
                }
            } else {
                gestureItem.span = targetSpan;
            }
        }
        
        el.classList.remove("resizing");
        el.style.transition = ""; 
        document.body.style.userSelect = "";
        
        gestureItem = null;
        initialDistance = 0;
        initialWidgetWidth = 0;
        lastDistance = 0;
        
        layout();
    }
    
    // --- DRAG END ---
    if (draggingItem) {
      const el = draggingItem.el;
      el.classList.remove("dragging");
      el.style.transition = "";
      document.body.style.userSelect = "";
      draggingItem = null;
      layout();
    }

    // --- RESIZE END ---
    if (resizingItem) {
      const el = resizingItem.el;
let targetWidth;
if (resizingItem.span === 1) targetWidth = singleSpanWidth;
else if (resizingItem.span === 2) targetWidth = doubleSpanWidth;
else targetWidth = tripleSpanWidth;
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
  document.addEventListener("touchcancel", handleEnd, { passive: false });

  widgets.forEach((widget) => {
    widget.addEventListener("dblclick", () => {
      if (!editing) return;
      const item = findItemByElement(widget);
if (!item) return;
const targetSpan = item.span === 1 ? 2 : (item.span === 2 ? 3 : 1);
      if (targetSpan > item.span) {
        if (!canExpandSomewhere(item, targetSpan)) return;
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

  window.addEventListener("resize", () => {
    const el = draggingItem?.el || resizingItem?.el || gestureItem?.el || null;
    layout(el);
  });

  layout();

  const customizeBtn = document.querySelector(".customize-btn");
  if (customizeBtn) {
    document.body.classList.add("static-mode");
    customizeBtn.addEventListener("click", () => {
      editing = !editing;
      document.body.classList.toggle("static-mode", !editing);
      customizeBtn.classList.toggle("active", editing);
      customizeBtn.setAttribute("aria-pressed", String(editing));
      customizeBtn.textContent = editing ? "Done" : "Customize";
      layout(); 
    });
  }
});