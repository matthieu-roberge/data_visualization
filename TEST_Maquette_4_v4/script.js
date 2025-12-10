//SWITCH BETWEEN TABS
const buttons = document.querySelectorAll('.row button');
const tabs = {
    overview: document.getElementById('overviewwrap'),
    history: document.getElementById('historywrap'),
    highlight: document.getElementById('highlightwrap'),
    wave: document.getElementById('wavewrap')
};
// header divs
const headTitle = document.querySelector('.headtitle');
const headTrends = document.querySelector('.headtrends');
const Add = headTitle.querySelector('.add')

buttons.forEach(button => {
    if (button.id === 'settings') return; // ignore settings
    button.addEventListener('click', () => {
        // Update button classes
        buttons.forEach(btn => {
            if (btn.id !== 'settings') {
                btn.classList.remove('selection');
                btn.classList.add('selectionoff');
            }
        });
        button.classList.add('selection');
        button.classList.remove('selectionoff');

        // Hide all tabs
        Object.values(tabs).forEach(tab => tab.style.display = 'none');
        // Show the corresponding tab
        tabs[button.id].style.display = 'flex';

        // Show/hide headers
        if (['overview', 'history', 'highlight'].includes(button.id)) {
            headTitle.style.display = 'block'; // show headtitle
            headTrends.style.display = 'none';  // hide headtrends 
            headTitle.style.minHeight = '60px';
        } else if (button.id === 'wave') {
            headTitle.style.display = 'none';   // hide headtitle
            headTrends.style.display = 'block'; // show headtrends
            headTrends.style.minHeight = '110px';
        }
    });
});





//SELECTION HISTORY-HIGHLIGHT
const historyWrap = document.getElementById('historywrap');
const highlightWrap = document.getElementById('highlightwrap');

historyWrap.addEventListener('click', (e) => {
    const button = e.target.closest('.markbutton');
    if (!button) return; 
    const widget = button.closest('.historywidget');
    if (!widget) return;

    // assign ID if needed
    if (!widget.dataset.widgetId) {
        widget.dataset.widgetId = Date.now();
    }

    const widgetId = widget.dataset.widgetId;
    const existing = highlightWrap.querySelector(`[data-widget-id="${widgetId}"]`);

    if (!widget.classList.contains('selected')) {
        // Select widget
        widget.classList.add('selected');
        button.classList.add('active');
        button.textContent = 'Unmark'; // update text

        if (!existing) {
            const clone = widget.cloneNode(true);

            // Remove orange border from clone (keep interactivity)
            clone.style.border = 'none'; 

            // Add interactivity to clone's button
            const cloneButton = clone.querySelector('.markbutton');
            cloneButton.addEventListener('click', () => {
                // Remove clone
                clone.remove();

                // Remove selection from original
                widget.classList.remove('selected');
                button.classList.remove('active');
                button.textContent = 'Mark'; // reset text
            });

            highlightWrap.appendChild(clone);
        }
    } else {
        // Deselect widget
        widget.classList.remove('selected');
        button.classList.remove('active');
        button.textContent = 'Mark'; // reset text
        if (existing) existing.remove();
    }
});






const waveLine = document.getElementById('waveLine');
const waveform = document.getElementById('waveform');
const markContainer = document.getElementById('markcontainer');
const markButton = document.querySelector('.markbutton');
let currentX = waveform.offsetWidth / 2; // initial position

// Click inside waveform to move the waveLine
waveform.addEventListener('click', (e) => {
  const rect = waveform.getBoundingClientRect();
  let x = e.clientX - rect.left;
  x = Math.max(0, Math.min(rect.width, x));
  waveLine.style.left = x + 'px';
  currentX = x;

  // Update main markButton text
  markButton.textContent = findMarkAtX(currentX) ? 'Unmark' : 'Mark';
  markButton.classList.toggle('active', !!findMarkAtX(currentX));
});

// Helper: find mark at approximately this x position
function findMarkAtX(x) {
  const tolerance = 2;
  return Array.from(markContainer.children).find(mark =>
    Math.abs(parseFloat(mark.style.left) - x) <= tolerance
  );
}

// Pixels → Time
function pixelsToTime(pixelX) {
  const startMinutes = timeStringToMinutes(startTime);
  const minutesFromStart = pixelX / pixelsPerMinute;
  return minutesToTimeString(Math.round(startMinutes + minutesFromStart));
}

// Main markButton listener
markButton.addEventListener('click', () => {
  const existingMark = findMarkAtX(currentX);

  if (existingMark) {
    // Remove mark
    const markX = parseFloat(existingMark.style.left);
    markContainer.removeChild(existingMark);

    // Remove corresponding widget
    const widget = highlightWrap.querySelector(`[data-x="${markX}"]`);
    if (widget) widget.remove();

    // Reset button
    markButton.textContent = 'Mark';
    markButton.classList.remove('active');
  } else {
    // Add waveform mark
    const mark = document.createElement('div');
    mark.classList.add('wavemark');
    mark.style.left = currentX + 'px';
    markContainer.appendChild(mark);

    // Update button
    markButton.textContent = 'Unmark';
    markButton.classList.add('active');

    // Add highlight widget
    const widget = document.createElement('div');
    widget.classList.add('wavewidget');
    widget.dataset.x = currentX;

    const numberEl = document.createElement('r');
    numberEl.classList.add('wavenumber');
    numberEl.textContent = Math.floor(Math.random() * 31) + 60;
    numberEl.style.color = '#FA7921';

    const graphEl = document.createElement('div');
    graphEl.classList.add('wavegraph');

    const timeEl = document.createElement('div');
    timeEl.classList.add('wavenumbertime');
    timeEl.textContent = pixelsToTime(currentX);

    const buttonEl = document.createElement('button');
    buttonEl.classList.add('markbutton', 'active');
    buttonEl.textContent = 'Unmark';

    const markX = currentX; // store exact x for this widget

    // Widget remove button
    buttonEl.addEventListener('click', () => {
      const markInWave = findMarkAtX(markX);
      if (markInWave) markContainer.removeChild(markInWave);
      widget.remove();

      // Reset main button if jumpline is at this mark
      if (Math.abs(markX - parseFloat(waveLine.style.left)) < 1) {
        markButton.textContent = 'Mark';
        markButton.classList.remove('active');
      }
    });

    widget.append(numberEl, graphEl, timeEl, buttonEl);
    highlightWrap.appendChild(widget);
  }
});


// --- Jumping between marks using Prev / Next buttons ---

const prevBtn = document.querySelector('.footerprev');
const nextBtn = document.querySelector('.footernext');

function getSortedMarks() {
  // returns array of x-positions sorted ascending
  return Array.from(markContainer.children)
    .map(m => parseFloat(m.style.left))
    .sort((a, b) => a - b);
}

function moveToMark(x) {
  waveLine.style.left = x + 'px';
  currentX = x;

  // Update main Mark button
  markButton.textContent = 'Unmark';
  markButton.classList.add('active');
}

// Next Button
nextBtn.addEventListener('click', () => {
  const marks = getSortedMarks();
  if (marks.length === 0) return;

  let current = parseFloat(waveLine.style.left) || 0;

  // Find first mark larger than current X
  const next = marks.find(x => x > current);

  // If none, wrap around → first mark
  const target = next !== undefined ? next : marks[0];

  moveToMark(target);
});

// Prev Button
prevBtn.addEventListener('click', () => {
  const marks = getSortedMarks();
  if (marks.length === 0) return;

  let current = parseFloat(waveLine.style.left) || 0;

  // Find last mark smaller than current X
  const prev = [...marks].reverse().find(x => x < current);

  // If none, wrap → last mark
  const target = prev !== undefined ? prev : marks[marks.length - 1];

  moveToMark(target);
});






document.addEventListener('click', (e) => {
    const button = e.target;
    if (button.id === 'byebye') {
        const widget = button.closest('.historywidget');
        if (widget) {
            widget.remove();
        }
    }
});
