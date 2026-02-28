// Cue Card Renderer
// Positions overlay cards near target DOM elements using getBoundingClientRect().
// Uses a semi-transparent backdrop to dim the rest of the UI.
// Game auto-pauses when a card shows. Backdrop blocks interaction (no click-to-dismiss).

import { gameState } from '../game-state.js';
import { completeTutorialStep, skipTutorial, showTutorialStep } from '../tutorial-state.js';
import { switchTab } from './tab-navigation.js';
import { TUTORIAL_STEPS, MAJOR_STEP_COUNT, STEP_NAMES } from '../content/tutorial-steps.js';
import { isDebugMode } from '../debug-commands.js';

// Compute player-facing step number (only counts major steps)
function getMajorDisplayNum(stepDef) {
  return TUTORIAL_STEPS
    .filter(s => s.major !== false && s.phase === 'main' && s.id <= stepDef.id)
    .length;
}

// Build step counter HTML — main major steps get "Step N of M"; debug mode adds step name
function buildStepCounter(stepDef) {
  const debugId = isDebugMode()
    ? ` <span class="cue-card-step-id">${STEP_NAMES[stepDef.id] || `step_${stepDef.id}`}</span>`
    : '';
  if (stepDef.phase === 'main' && stepDef.major !== false) {
    return `<div class="cue-card-step-counter">Step ${getMajorDisplayNum(stepDef)} of ${MAJOR_STEP_COUNT}${debugId}</div>`;
  }
  if (debugId) {
    return `<div class="cue-card-step-counter">${debugId}</div>`;
  }
  return '';
}

let backdropEl = null;
let cardEl = null;
let currentStepDef = null;
let highlightedEl = null;
let highlightedAncestors = [];

// Initialize DOM elements (call once from initializeGame)
export function initCueCards() {
  // Test harness flag — disable tutorial entirely so cards never appear
  if (typeof window !== 'undefined' && window.__TEST_DISABLE_TUTORIAL) {
    gameState.tutorial.disabled = true;
    return;  // Don't create backdrop/card DOM at all
  }

  backdropEl = document.createElement('div');
  backdropEl.className = 'cue-card-backdrop';
  document.body.appendChild(backdropEl);

  cardEl = document.createElement('div');
  cardEl.className = 'cue-card';
  document.body.appendChild(cardEl);

  // Backdrop does NOT dismiss on click — only explicit buttons dismiss
}

// Show a specific step's card
export function showCard(stepDef) {
  if (!cardEl || !backdropEl) return;

  currentStepDef = stepDef;

  // Auto-pause the game
  if (stepDef.pauseOnShow !== false && !gameState.paused) {
    gameState.paused = true;
    gameState.pauseStartTime = Date.now();
  }

  // Build card content
  const stepCounter = buildStepCounter(stepDef);
  const bodyHtml = formatBody(stepDef.content.body);
  const buttonsHtml = buildButtons(stepDef);
  const skipHtml = stepDef.phase === 'main'
    ? '<a class="cue-card-skip">Skip tutorial</a>'
    : '';

  const hasAdvanceGate = typeof stepDef.advance === 'function';
  // In review mode, action-gated steps show "Got it" so player can read and move on
  const showButtons = !hasAdvanceGate || stepDef.reviewMode;
  const actualButtonsHtml = showButtons ? buttonsHtml : '';

  cardEl.innerHTML = `
    ${stepCounter}
    <div class="cue-card-body">${bodyHtml}</div>
    <div class="cue-card-buttons">${skipHtml}${actualButtonsHtml}</div>
  `;

  // Wire button handlers
  cardEl.querySelectorAll('.cue-card-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action));
  });

  const skipLink = cardEl.querySelector('.cue-card-skip');
  if (skipLink) {
    skipLink.addEventListener('click', handleSkip);
  }

  // Position card
  positionCard(stepDef);

  // Highlight target element (not action-gated in review mode — just informational)
  const isActionGated = hasAdvanceGate && !stepDef.reviewMode;
  highlightTarget(stepDef.target, isActionGated);

  // Auto-unpause when player interacts with the gated element
  if (isActionGated && highlightedEl) {
    const unpauseOnInteract = () => {
      if (gameState.paused) {
        gameState.paused = false;
        gameState.pauseStartTime = null;
      }
    };
    highlightedEl.addEventListener('pointerdown', unpauseOnInteract, { once: true });
    highlightedEl._cueCardUnpauseHandler = unpauseOnInteract;
  }

  // Show
  backdropEl.classList.add('active');
  cardEl.classList.add('visible');

  showTutorialStep(stepDef.id);
}

// Hide the current card and backdrop
export function hideCard() {
  if (!cardEl || !backdropEl) return;

  backdropEl.classList.remove('active');
  cardEl.classList.remove('visible');
  cardEl.classList.remove('cue-card-center');
  unhighlightTarget();
  clearBackdropCutout();
  currentStepDef = null;
}

// Dismiss card content but keep backdrop visible to avoid flash when
// the next tutorial step replaces this card on the very next tick.
export function dismissCard() {
  if (!cardEl || !backdropEl) return;

  cardEl.classList.remove('visible');
  cardEl.classList.remove('cue-card-center');
  unhighlightTarget();
  clearBackdropCutout();
  currentStepDef = null;
}

// Replace current card content without toggling backdrop/visibility (flicker-free)
export function replaceCard(stepDef) {
  if (!cardEl || !backdropEl) return;

  currentStepDef = stepDef;

  // Auto-pause if needed
  if (stepDef.pauseOnShow !== false && !gameState.paused) {
    gameState.paused = true;
    gameState.pauseStartTime = Date.now();
  }

  // Rebuild content
  const stepCounter = buildStepCounter(stepDef);
  const bodyHtml = formatBody(stepDef.content.body);
  const buttonsHtml = buildButtons(stepDef);
  const skipHtml = stepDef.phase === 'main'
    ? '<a class="cue-card-skip">Skip tutorial</a>'
    : '';

  const hasAdvanceGate = typeof stepDef.advance === 'function';
  const showButtons = !hasAdvanceGate || stepDef.reviewMode;
  const actualButtonsHtml = showButtons ? buttonsHtml : '';

  cardEl.innerHTML = `
    ${stepCounter}
    <div class="cue-card-body">${bodyHtml}</div>
    <div class="cue-card-buttons">${skipHtml}${actualButtonsHtml}</div>
  `;

  // Re-wire handlers
  cardEl.querySelectorAll('.cue-card-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action));
  });
  const skipLink = cardEl.querySelector('.cue-card-skip');
  if (skipLink) skipLink.addEventListener('click', handleSkip);

  // Reposition and re-highlight (not action-gated in review mode)
  const isActionGated = hasAdvanceGate && !stepDef.reviewMode;
  positionCard(stepDef);
  highlightTarget(stepDef.target, isActionGated);

  showTutorialStep(stepDef.id);
}

// Show follow-up card for a step (replaces content, retargets highlight, unpauses)
export function showFollowUpCard(stepDef) {
  if (!cardEl || !backdropEl) return;
  const followUp = stepDef.followUp;
  if (!followUp) return;

  // Keep the same step counter
  const stepCounter = buildStepCounter(stepDef);
  const bodyHtml = formatBody(followUp.body);
  const skipHtml = stepDef.phase === 'main'
    ? '<a class="cue-card-skip">Skip tutorial</a>'
    : '';

  // Follow-up cards have an advance gate but also show "Got it" as manual escape
  const dismissBtn = '<button class="cue-card-btn cue-card-btn-primary" data-action="dismiss">Got it</button>';
  cardEl.innerHTML = `
    ${stepCounter}
    <div class="cue-card-body">${bodyHtml}</div>
    <div class="cue-card-buttons">${skipHtml}${dismissBtn}</div>
  `;

  cardEl.querySelectorAll('.cue-card-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action));
  });
  const skipLink = cardEl.querySelector('.cue-card-skip');
  if (skipLink) skipLink.addEventListener('click', handleSkip);

  // Retarget highlight and position to follow-up target
  const followUpPositioning = {
    target: followUp.target,
    position: followUp.position,
    id: stepDef.id,
  };
  positionCard(followUpPositioning);
  highlightTarget(followUp.target, false);

  // Unpause so the queue can process
  if (gameState.paused) {
    gameState.paused = false;
    gameState.pauseStartTime = null;
  }
}

// Is a card currently showing?
export function isCardVisible() {
  return cardEl?.classList.contains('visible') ?? false;
}

// Is the backdrop still active (e.g. after dismissCard)?
export function isBackdropActive() {
  return backdropEl?.classList.contains('active') ?? false;
}

// Is an action-gated card currently showing? (blocks manual pause toggle)
export function isActionGatedCardVisible() {
  return isCardVisible() && currentStepDef && typeof currentStepDef.advance === 'function';
}

// --- Positioning ---

function positionCard(stepDef) {
  if (stepDef.position === 'center' || !stepDef.target) {
    cardEl.classList.add('cue-card-center');
    cardEl.style.top = '';
    cardEl.style.left = '';
    cardEl.style.right = '';
    cardEl.style.bottom = '';
    return;
  }

  cardEl.classList.remove('cue-card-center');

  const targetEl = document.querySelector(stepDef.target);
  if (!targetEl) {
    console.warn(`[tutorial] Target selector not found: "${stepDef.target}" for step ${stepDef.id}`);
    cardEl.classList.add('cue-card-center');
    return;
  }

  const targetRect = targetEl.getBoundingClientRect();

  // Target exists but hasn't laid out yet (zero dimensions) — retry next frame
  if (targetRect.width === 0 && targetRect.height === 0) {
    cardEl.classList.add('cue-card-center');
    requestAnimationFrame(() => positionCard(stepDef));
    return;
  }
  const cardWidth = 380;
  const gap = 12;
  let top, left;

  switch (stepDef.position) {
    case 'below':
      top = targetRect.bottom + gap;
      left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
      break;
    case 'above':
      top = targetRect.top - gap;
      left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
      break;
    case 'right':
      top = targetRect.top;
      left = targetRect.right + gap;
      break;
    case 'left':
      top = targetRect.top;
      left = targetRect.left - cardWidth - gap;
      break;
    default:
      top = targetRect.bottom + gap;
      left = targetRect.left;
  }

  // Clamp to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  left = Math.max(12, Math.min(left, vw - cardWidth - 12));
  top = Math.max(12, Math.min(top, vh - 200));

  cardEl.style.top = `${top}px`;
  cardEl.style.left = `${left}px`;
  cardEl.style.right = '';
  cardEl.style.bottom = '';
}

// Check if an outline (with offset) around the element would be clipped
// by the viewport or by any ancestor with overflow hidden/auto/scroll.
function wouldOutlineClip(el) {
  const rect = el.getBoundingClientRect();
  const margin = 6;  // outline-offset (4px) + outline-width (1px) + 1px buffer

  // Check viewport edges
  if (rect.left < margin || rect.right > window.innerWidth - margin ||
      rect.top < margin || rect.bottom > window.innerHeight - margin) {
    return true;
  }

  // Check overflow-clipping ancestors (only check axes that actually clip)
  let ancestor = el.parentElement;
  while (ancestor && ancestor !== document.body) {
    const style = getComputedStyle(ancestor);
    const ovX = style.overflowX || style.overflow;
    const ovY = style.overflowY || style.overflow;
    const clipsX = ovX === 'hidden' || ovX === 'auto' || ovX === 'scroll';
    const clipsY = ovY === 'hidden' || ovY === 'auto' || ovY === 'scroll';
    if (clipsX || clipsY) {
      const aRect = ancestor.getBoundingClientRect();
      if (clipsX && (rect.left - aRect.left < margin || aRect.right - rect.right < margin)) {
        return true;
      }
      if (clipsY && (rect.top - aRect.top < margin || aRect.bottom - rect.bottom < margin)) {
        return true;
      }
    }
    ancestor = ancestor.parentElement;
  }
  return false;
}

function highlightTarget(selector, isActionGated = false) {
  unhighlightTarget();
  if (!selector) return;
  const el = document.querySelector(selector);
  if (!el) return;

  el.classList.add('cue-card-target-highlight');
  if (isActionGated) {
    el.classList.add('cue-card-action-gate');
  }
  highlightedEl = el;

  // Use inset fallback if outline would be clipped by viewport or overflow ancestors
  if (wouldOutlineClip(el)) {
    el.classList.add('cue-card-highlight-inset');
  }

  // Ensure element is positioned (z-index requires it) — but don't override
  // existing position values (would break sticky/absolute/fixed elements)
  const elStyle = getComputedStyle(el);
  if (elStyle.position === 'static') {
    el.dataset.cueCardAddedPosition = '1';
    el.style.position = 'relative';
  }

  // Walk up ancestors and elevate stacking contexts that already exist
  // so the highlighted element's z-901 can punch through the z-900 backdrop.
  // Detects stacking contexts from position+z-index AND from CSS contain.
  highlightedAncestors = [];
  let ancestor = el.parentElement;
  while (ancestor && ancestor !== document.body) {
    const style = getComputedStyle(ancestor);
    let touched = false;
    if (style.zIndex !== 'auto' && style.position !== 'static') {
      ancestor.dataset.cueCardPrevZ = ancestor.style.zIndex || '';
      ancestor.style.zIndex = '901';
      touched = true;
    }
    // contain: paint/content/strict also creates a stacking context that
    // traps child z-index.  Temporarily disable it so the highlight escapes.
    const contain = style.contain;
    if (contain && contain !== 'none' && contain !== 'style' && contain !== 'size') {
      ancestor.dataset.cueCardPrevContain = ancestor.style.contain ?? '';
      ancestor.style.contain = 'none';
      touched = true;
    }
    if (touched) highlightedAncestors.push(ancestor);
    ancestor = ancestor.parentElement;
  }

  // For action-gated steps, cut a hole in the backdrop so the player can
  // click the highlighted element.  This avoids z-index stacking issues:
  // the backdrop simply doesn't cover the target area.
  // For non-gated steps, clear any stale cutout from the previous step.
  if (isActionGated && backdropEl) {
    updateBackdropCutout(el);
  } else {
    clearBackdropCutout();
  }
}

// Cut a rectangular hole in the backdrop so clicks pass through to the
// highlighted element.  Uses clip-path with evenodd fill rule: the outer
// rectangle covers the viewport, the inner rectangle (counter-clockwise)
// is excluded.
function updateBackdropCutout(el) {
  const rect = el.getBoundingClientRect();
  const pad = 6;  // match outline-offset + outline-width
  const t = Math.max(0, rect.top - pad);
  const l = Math.max(0, rect.left - pad);
  const b = Math.min(window.innerHeight, rect.bottom + pad);
  const r = Math.min(window.innerWidth, rect.right + pad);
  // Outer rect clockwise, inner rect counter-clockwise → hole via evenodd
  backdropEl.style.clipPath =
    `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0,` +
    ` ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px)`;
}

function clearBackdropCutout() {
  if (backdropEl) backdropEl.style.clipPath = '';
}

function unhighlightTarget() {
  if (highlightedEl) {
    highlightedEl.classList.remove('cue-card-target-highlight');
    highlightedEl.classList.remove('cue-card-highlight-inset');
    highlightedEl.classList.remove('cue-card-action-gate');
    if (highlightedEl._cueCardUnpauseHandler) {
      highlightedEl.removeEventListener('pointerdown', highlightedEl._cueCardUnpauseHandler);
      delete highlightedEl._cueCardUnpauseHandler;
    }
    if (highlightedEl.dataset.cueCardAddedPosition) {
      highlightedEl.style.position = '';
      delete highlightedEl.dataset.cueCardAddedPosition;
    }
    highlightedEl = null;
  }
  for (const ancestor of highlightedAncestors) {
    if ('cueCardPrevZ' in ancestor.dataset) {
      ancestor.style.zIndex = ancestor.dataset.cueCardPrevZ || '';
      delete ancestor.dataset.cueCardPrevZ;
    }
    if ('cueCardPrevContain' in ancestor.dataset) {
      ancestor.style.contain = ancestor.dataset.cueCardPrevContain || '';
      delete ancestor.dataset.cueCardPrevContain;
    }
  }
  highlightedAncestors = [];
}

// --- Content formatting ---

function formatBody(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p>${line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<em class="cue-card-action">$1</em>')
    }</p>`)
    .join('');
}

function buildButtons(stepDef) {
  return stepDef.content.buttons
    .map((btn, i) => {
      const primaryClass = i === 0 ? ' cue-card-btn-primary' : '';
      return `<button class="cue-card-btn${primaryClass}" data-action="${btn.action}">${btn.label}</button>`;
    })
    .join('');
}

// --- Action handlers ---

function handleAction(action) {
  if (!currentStepDef) return;
  const stepDef = currentStepDef;

  switch (action) {
    case 'go_dashboard':
      hideCard();
      completeTutorialStep(stepDef.id, 'action');
      switchTab('dashboard');
      gameState.paused = false;
      break;

    case 'skip_all':
      hideCard();
      skipTutorial();
      gameState.paused = false;
      break;

    case 'dismiss':
    default:
      handleDismiss();
      break;
  }
}

function handleDismiss() {
  if (!currentStepDef) return;
  const stepDef = currentStepDef;
  dismissCard();
  completeTutorialStep(stepDef.id, 'dismiss');

  if (stepDef.onDismiss) stepDef.onDismiss();

  // Auto-unpause unless step requires player action after dismissing
  if (stepDef.unpauseOnDismiss !== false && gameState.paused) {
    gameState.paused = false;
  }
}

function handleSkip() {
  if (!currentStepDef) return;
  hideCard();
  skipTutorial();
  gameState.paused = false;
}
