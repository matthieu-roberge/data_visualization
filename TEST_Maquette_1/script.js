const dashboard = document.getElementById("dashboard");
const widgets = Array.from(dashboard.querySelectorAll(".widget"));

let draggedEl = null;

// Quand on commence à drag
widgets.forEach(widget => {
  widget.addEventListener("dragstart", e => {
    draggedEl = widget;
    widget.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  // Nécessaire pour autoriser le drop
  widget.addEventListener("dragover", e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  // Quand on lâche sur un autre widget → on échange les positions
  widget.addEventListener("drop", e => {
    e.preventDefault();
    if (!draggedEl || draggedEl === widget) return;

    const children = Array.from(dashboard.children);
    const draggedIndex = children.indexOf(draggedEl);
    const targetIndex = children.indexOf(widget);

    if (draggedIndex < targetIndex) {
      dashboard.insertBefore(draggedEl, widget.nextSibling);
    } else {
      dashboard.insertBefore(draggedEl, widget);
    }
  });

  widget.addEventListener("dragend", () => {
    widget.classList.remove("dragging");
    draggedEl = null;
  });
});