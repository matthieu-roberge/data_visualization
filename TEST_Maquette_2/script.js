const dashboard = document.getElementById("dashboard");
const widgets = Array.from(dashboard.querySelectorAll(".widget"));

let draggedEl = null;
let startX = 0;
let startY = 0;

// Fonction utilitaire : savoir si la souris est au-dessus d'un widget
function isPointerOverWidget(widget, x, y) {
  const rect = widget.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// On met en place les events sur chaque widget
widgets.forEach(widget => {
  widget.addEventListener("mousedown", e => {
    // On commence à drag uniquement avec le bouton gauche
    if (e.button !== 0) return;

    draggedEl = widget;
    draggedEl.classList.add("dragging");

    // Position de la souris au moment du clic
    startX = e.clientX;
    startY = e.clientY;

    // On empêche la sélection de texte pendant le drag
    document.body.style.userSelect = "none";
  });
});

// On écoute le mouvement sur tout le document
document.addEventListener("mousemove", e => {
  if (!draggedEl) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  // On applique un translate au widget → il suit la souris
  draggedEl.style.transform = `translate(${dx}px, ${dy}px)`;
});

// Quand on lâche la souris
document.addEventListener("mouseup", e => {
  if (!draggedEl) return;

  // Rect avant réorganisation (position visuelle pendant le drag)
  const rectBefore = draggedEl.getBoundingClientRect();

  // On cherche sur quel widget on a lâché
  const children = Array.from(dashboard.children);
  const dropX = e.clientX;
  const dropY = e.clientY;

  let target = null;
  for (const w of children) {
    if (w !== draggedEl && isPointerOverWidget(w, dropX, dropY)) {
      target = w;
      break;
    }
  }

  if (target) {
    // On réorganise les widgets : même logique qu'avant
    const draggedIndex = children.indexOf(draggedEl);
    const targetIndex = children.indexOf(target);

    if (draggedIndex < targetIndex) {
      dashboard.insertBefore(draggedEl, target.nextSibling);
    } else {
      dashboard.insertBefore(draggedEl, target);
    }
  }

  // On enlève la classe de drag (transition réactivée)
  draggedEl.classList.remove("dragging");
  document.body.style.userSelect = "";

  // On enlève temporairement le translate pour connaître la position finale dans la grille
  draggedEl.style.transform = "";
  const rectAfter = draggedEl.getBoundingClientRect();

  // On calcule la différence entre l'ancienne position visuelle et la nouvelle position logique
  const deltaX = rectBefore.left - rectAfter.left;
  const deltaY = rectBefore.top - rectAfter.top;

  // On remet le widget à son ancienne position visuelle via transform
  draggedEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

  // Force un reflow pour que le navigateur prenne en compte le transform initial
  // avant de lancer la transition vers translate(0,0)
  // eslint-disable-next-line no-unused-expressions
  draggedEl.offsetWidth; // lecture forcée

  // Puis on anime en le ramenant à sa nouvelle place (transition CSS sur transform)
  requestAnimationFrame(() => {
    draggedEl.style.transform = "translate(0, 0)";
  });

  draggedEl = null;
});

// Double-clic : changer la taille du widget
widgets.forEach(widget => {
  widget.addEventListener("dblclick", () => {
    widget.classList.toggle("large");
  });
});