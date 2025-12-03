
    // === Maquette 3 : système de grille façon iOS (vanilla JS) ===
    document.addEventListener("DOMContentLoaded", () => {
      const dashboard = document.getElementById("dashboard");
      const widgets = Array.from(dashboard.querySelectorAll(".widget"));

      // Paramètres de la "grille virtuelle"
      const cellWidth = 260;
      const cellHeight = 150;
      const gap = 20;
      let cols = 1;

      // Chaque item = un widget + sa position logique (order dans la grille)
      const items = widgets.map((el, index) => ({ el, index }));

      // Calcule le nombre de colonnes possible selon la largeur du dashboard
      function computeCols() {
        const width = dashboard.clientWidth || dashboard.offsetWidth || 1100;
        // on ajoute le gap pour éviter une colonne fantôme
        const maxCols = Math.max(
          1,
          Math.floor((width + gap) / (cellWidth + gap))
        );
        cols = maxCols;
      }

      // Met à jour la position (translate) de tous les widgets
      function layout(skipEl = null) {
        computeCols();

        let maxRow = 0;

        items.forEach((item, order) => {
          item.index = order;
          const row = Math.floor(order / cols);
          const col = order % cols;
          const x = col * (cellWidth + gap);
          const y = row * (cellHeight + gap);
          maxRow = Math.max(maxRow, row);

          const el = item.el;

          el.style.width = cellWidth + "px";
          el.style.height = cellHeight + "px";

          if (el === skipEl) return; // on laisse le drag gérer sa position

          el.style.transform = `translate(${x}px, ${y}px)`;
        });

        const totalHeight =
          (maxRow + 1) * cellHeight + (maxRow) * gap;
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

      // Démarrage du drag
      dashboard.addEventListener("mousedown", (e) => {
        const target = e.target.closest(".widget");
        if (!target) return;
        if (e.button !== 0) return; // bouton gauche uniquement

        e.preventDefault();

        draggingItem = findItemByElement(target);
        if (!draggingItem) return;

        const dashboardRect = dashboard.getBoundingClientRect();
        const widgetRect = target.getBoundingClientRect();

        dragOffsetX = e.clientX - widgetRect.left;
        dragOffsetY = e.clientY - widgetRect.top;

        target.classList.add("dragging");
        target.style.transition = "none";

        document.body.style.userSelect = "none";
      });

      // Pendant le drag : le widget suit la souris + réorganisation des autres
      document.addEventListener("mousemove", (e) => {
        if (!draggingItem) return;

        const el = draggingItem.el;
        const dashboardRect = dashboard.getBoundingClientRect();

        // Position brute du widget dans le dashboard
        let x = e.clientX - dashboardRect.left - dragOffsetX;
        let y = e.clientY - dashboardRect.top - dragOffsetY;

        // On évite de sortir trop du dashboard
        x = Math.max(0, x);
        y = Math.max(0, y);

        // On applique la position visuelle
        el.style.transform = `translate(${x}px, ${y}px)`;

        // On calcule approximativement la cellule (row, col) visée
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
          // On déplace l'item dans le tableau items[]
          const [moved] = items.splice(currentIndex, 1);
          items.splice(targetIndex, 0, moved);

          // On relayout tous les autres widgets
          layout(el);
        }
      });

      // Fin du drag
      document.addEventListener("mouseup", () => {
        if (!draggingItem) return;

        const el = draggingItem.el;
        el.classList.remove("dragging");
        // On remet la transition définie dans le CSS
        el.style.transition = "";

        document.body.style.userSelect = "";

        draggingItem = null;

        // On relayout tout le monde, y compris le widget qui vient d'être lâché
        layout();
      });

      // Double-clic : exemple de bascule de taille (classe .large à exploiter plus tard)
      widgets.forEach((widget) => {
        widget.addEventListener("dblclick", () => {
          widget.classList.toggle("large");
          // On pourrait adapter la logique de cellWidth / cellHeight
          // pour gérer des widgets de tailles différentes.
        });
      });

      // Recalcul du layout au resize
      window.addEventListener("resize", () => {
        layout(draggingItem ? draggingItem.el : null);
      });

      // Première mise en page
      layout();
    });
