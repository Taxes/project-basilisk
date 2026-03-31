// Column Layout Controller
// At narrow viewports (≤1400px), merges Operations and Research into tabbed panels.

let activeColumn = 'operations';

function applyColumnVisibility(narrow) {
  const ops = document.getElementById('col-operations');
  const research = document.getElementById('col-research');
  if (!ops || !research) return;

  if (narrow) {
    if (activeColumn === 'operations') {
      ops.classList.remove('narrow-hidden');
      research.classList.add('narrow-hidden');
    } else {
      ops.classList.add('narrow-hidden');
      research.classList.remove('narrow-hidden');
    }
  } else {
    // Wide viewport — show both columns
    ops.classList.remove('narrow-hidden');
    research.classList.remove('narrow-hidden');
  }
}

function switchColumn(column) {
  activeColumn = column;

  // Update tab button states
  document.querySelectorAll('.column-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.column === column);
  });

  applyColumnVisibility(true);
}

export function initColumnLayout() {
  const mq = window.matchMedia('(max-width: 1400px)');

  // Wire tab clicks
  document.querySelectorAll('.column-tab').forEach(btn => {
    btn.addEventListener('click', () => switchColumn(btn.dataset.column));
  });

  // React to viewport changes
  const handler = (e) => applyColumnVisibility(e.matches);
  mq.addEventListener('change', handler);

  // Apply initial state
  applyColumnVisibility(mq.matches);
}
