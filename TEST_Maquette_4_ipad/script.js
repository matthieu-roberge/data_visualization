// === Maquette 3.2 : grille iOS-like + widgets de tailles différentes + resize handle ===
document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.getElementById("dashboard");
  const widgets = Array.from(dashboard.querySelectorAll(".widget"));
  console.log("Le script JS est bien chargé !");
  
  let cellWidth = 260;
  const cellHeight = 150;
  const gap = 20;
  let cols = 1;

  const items = widgets.map((el, index) => ({
    el,
    index,
    span: Math.max(1, Math.min(2, parseInt(el.dataset.span) || 1)),
    rowSpan: Math.max(1, parseInt(el.dataset.rowspan) || 1)
  }));

  function computeCols() {
    const width = dashboard.clientWidth || dashboard.offsetWidth || 1100;
    cols = 7;
    const totalGap = gap * (cols - 1);
    cellWidth = (width - totalGap) / cols;
  }

  function canPlaceAt(row, col, span, rowSpan, occupied) {
    if (col + span > cols) return false;
    for (let r = 0; r < rowSpan; r++) {
      for (let c = 0; c < span; c++) {
        const cellIndex = (row + r) * cols + (col + c);
        if (occupied[cellIndex]) return false;
      }
    }
    return true;
  }

  function occupyCells(row, col, span, rowSpan, occupied) {
    for (let r = 0; r < rowSpan; r++) {
      for (let c = 0; c < span; c++) {
        const cellIndex = (row + r) * cols + (col + c);
        occupied[cellIndex] = true;
      }
    }
  }

  function layout(skipEl = null) {
    computeCols();
    const occupied = [];
    let maxRow = 0;

    items.forEach((item) => {
      const el = item.el;
      const span = Math.max(1, Math.min(item.span || 1, cols));
      const rowSpan = Math.max(1, item.rowSpan || 1);

      let placed = false;
      let row = 0;
      let col = 0;

      while (!placed) {
        for (col = 0; col <= cols - span; col++) {
          if (canPlaceAt(row, col, span, rowSpan, occupied)) {
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
      maxRow = Math.max(maxRow, row + rowSpan - 1);

      const width = span * cellWidth + (span - 1) * gap;
      const height = rowSpan * cellHeight + (rowSpan - 1) * gap;
      el.style.width = width + "px";
      el.style.height = height + "px";

      if (el !== skipEl) {
        el.style.transform = `translate(${x}px, ${y}px)`;
      }

      occupyCells(row, col, span, rowSpan, occupied);
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
  let resizeStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;

  // Setup Hammer.js for each widget
  widgets.forEach((widget) => {
    const mc = new Hammer(widget);
    
    // Enable pan events
    mc.get('pan').set({ direction: Hammer.DIRECTION_ALL });
    
    let isResizing = false;
    let startEvent = null;

    // Handle pan start (drag/resize start)
    mc.on('panstart', (e) => {
      const handle = e.target.closest(".widget-resize-handle");
      
      if (handle) {
        // Start resize
        isResizing = true;
        const item = findItemByElement(widget);
        if (!item) return;

        resizingItem = item;
        const widgetRect = widget.getBoundingClientRect();
        resizeStartX = e.center.x;
        resizeStartY = e.center.y;
        resizeStartWidth = widgetRect.width;
        resizeStartHeight = widgetRect.height;

        widget.classList.add("resizing");
        widget.style.transition = "none";
      } else {
        // Start drag
        isResizing = false;
        draggingItem = findItemByElement(widget);
        if (!draggingItem) return;

        const widgetRect = widget.getBoundingClientRect();
        dragOffsetX = e.center.x - widgetRect.left;
        dragOffsetY = e.center.y - widgetRect.top;

        widget.classList.add("dragging");
        widget.style.transition = "none";
      }
    });

    // Handle pan move (drag/resize)
    mc.on('panmove', (e) => {
      if (isResizing && resizingItem) {
        // Resize logic
        const el = resizingItem.el;
        const dx = e.center.x - resizeStartX;
        let newWidth = resizeStartWidth + dx;

        const minWidth = cellWidth;
        const maxWidth = cols * (cellWidth + gap) - gap;
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        const spanFloat = newWidth / (cellWidth + gap);
        let newSpan = Math.round(spanFloat);
        newSpan = Math.max(1, Math.min(2, newSpan));
        if (newSpan !== resizingItem.span) {
          resizingItem.span = newSpan;
        }

        const dy = e.center.y - resizeStartY;
        let newHeight = resizeStartHeight + dy;

        const minHeight = cellHeight;
        const maxRowSpan = 4;
        const maxHeight = maxRowSpan * (cellHeight + gap) - gap;
        newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

        const rowSpanFloat = newHeight / (cellHeight + gap);
        let newRowSpan = Math.round(rowSpanFloat);
        newRowSpan = Math.max(1, Math.min(maxRowSpan, newRowSpan));
        if (newRowSpan !== resizingItem.rowSpan) {
          resizingItem.rowSpan = newRowSpan;
        }

        el.style.width = newWidth + "px";
        el.style.height = newHeight + "px";
        layout(el);
      } else if (draggingItem) {
        // Drag logic
        const el = draggingItem.el;
        const dashboardRect = dashboard.getBoundingClientRect();

        let x = e.center.x - dashboardRect.left - dragOffsetX;
        let y = e.center.y - dashboardRect.top - dragOffsetY;

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
          layout(el);
        }
      }
    });

    // Handle pan end (drag/resize end)
    mc.on('panend pancancel', () => {
      if (draggingItem) {
        const el = draggingItem.el;
        el.classList.remove("dragging");
        el.style.transition = "";
        draggingItem = null;
        layout();
      }

      if (resizingItem) {
        const el = resizingItem.el;
        el.classList.remove("resizing");
        el.style.transition = "";
        resizingItem = null;
        layout();
      }

      isResizing = false;
    });

    // Handle double tap (toggle span)
    mc.on('doubletap', () => {
      const item = findItemByElement(widget);
      if (!item) return;
      item.span = item.span === 1 ? 2 : 1;
      layout();
    });
  });

  window.addEventListener("resize", () => {
    const el = draggingItem?.el || resizingItem?.el || null;
    layout(el);
  });

  layout();
});