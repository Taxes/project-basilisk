// Cue Card Renderer
// Positions overlay cards near target DOM elements using getBoundingClientRect().
// Uses a semi-transparent backdrop to dim the rest of the UI.
// Game auto-pauses when a card shows. Backdrop blocks interaction (no click-to-dismiss).

import { gameState } from '../game-state.js';
import { completeTutorialStep, skipTutorial, showTutorialStep } from '../tutorial-state.js';
import { switchTab } from './tab-navigation.js';
import { TUTORIAL_STEPS, MAJOR_STEP_COUNT } from '../content/tutorial-steps.js';

// Compute player-facing step number (only counts major steps)
function getMajorDisplayNum(stepDef) {
  return TUTORIAL_STEPS
    .filter(s => s.major !== false && s.phase === 'main' && s.id <= stepDef.id)
    .length;
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
  const stepCounter = (stepDef.phase === 'main' && stepDef.major !== false)
    ? `<div class="cue-card-step-counter">Step ${getMajorDisplayNum(stepDef)} of ${MAJOR_STEP_COUNT}</div>`
    : '';
  const bodyHtml = formatBody(stepDef.content.body);
  const buttonsHtml = buildButtons(stepDef);
  const skipHtml = stepDef.phase === 'main'
    ? '<a class="cue-card-skip">Skip tutorial</a>'
    : '';

  const isNavStep = stepDef.major === false && typeof stepDef.advance === 'function';
  const actualButtonsHtml = isNavStep ? '' : buttonsHtml;

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

  // Highlight target element
  highlightTarget(stepDef.target);

  // Show
  backdropEl.classList.add('active');
  cardEl.classList.add('visible');

  showTutorialStep(stepDef.id);
}

// Hide the current card
export function hideCard() {
  if (!cardEl || !backdropEl) return;

  backdropEl.classList.remove('active');
  cardEl.classList.remove('visible');
  cardEl.classList.remove('cue-card-center');
  unhighlightTarget();
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
  const stepCounter = (stepDef.phase === 'main' && stepDef.major !== false)
    ? `<div class="cue-card-step-counter">Step ${getMajorDisplayNum(stepDef)} of ${MAJOR_STEP_COUNT}</div>`
    : '';
  const bodyHtml = formatBody(stepDef.content.body);
  const buttonsHtml = buildButtons(stepDef);
  const skipHtml = stepDef.phase === 'main'
    ? '<a class="cue-card-skip">Skip tutorial</a>'
    : '';

  const isNavStep = stepDef.major === false && typeof stepDef.advance === 'function';
  const actualButtonsHtml = isNavStep ? '' : buttonsHtml;

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

  // Reposition and re-highlight
  positionCard(stepDef);
  highlightTarget(stepDef.target);

  showTutorialStep(stepDef.id);
}

// Is a card currently showing?
export function isCardVisible() {
  return cardEl?.classList.contains('visible') ?? false;
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

  // Check overflow-clipping ancestors
  let ancestor = el.parentElement;
  while (ancestor && ancestor !== document.body) {
    const style = getComputedStyle(ancestor);
    const ov = style.overflow + style.overflowX + style.overflowY;
    if (ov.includes('hidden') || ov.includes('auto') || ov.includes('scroll')) {
      const aRect = ancestor.getBoundingClientRect();
      if (rect.left - aRect.left < margin || aRect.right - rect.right < margin ||
          rect.top - aRect.top < margin || aRect.bottom - rect.bottom < margin) {
        return true;
      }
    }
    ancestor = ancestor.parentElement;
  }
  return false;
}

function highlightTarget(selector) {
  unhighlightTarget();
  if (!selector) return;
  const el = document.querySelector(selector);
  if (!el) return;

  el.classList.add('cue-card-target-highlight');
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

  // Walk up ancestors and elevate any stacking contexts so the highlighted
  // element can punch through the z-900 backdrop
  highlightedAncestors = [];
  let ancestor = el.parentElement;
  while (ancestor && ancestor !== document.body) {
    const style = getComputedStyle(ancestor);
    if (style.zIndex !== 'auto' && style.position !== 'static') {
      ancestor.dataset.cueCardPrevZ = ancestor.style.zIndex || '';
      ancestor.style.zIndex = '901';
      highlightedAncestors.push(ancestor);
    }
    ancestor = ancestor.parentElement;
  }
}

function unhighlightTarget() {
  if (highlightedEl) {
    highlightedEl.classList.remove('cue-card-target-highlight');
    highlightedEl.classList.remove('cue-card-highlight-inset');
    if (highlightedEl.dataset.cueCardAddedPosition) {
      highlightedEl.style.position = '';
      delete highlightedEl.dataset.cueCardAddedPosition;
    }
    highlightedEl = null;
  }
  for (const ancestor of highlightedAncestors) {
    ancestor.style.zIndex = ancestor.dataset.cueCardPrevZ || '';
    delete ancestor.dataset.cueCardPrevZ;
  }
  highlightedAncestors = [];
}

// --- Content formatting ---

function formatBody(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p>${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`)
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
  hideCard();
  completeTutorialStep(stepDef.id, 'dismiss');

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
