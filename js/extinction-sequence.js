// Player-facing text: see docs/message-registry.json
// Extinction Sequence - Variable pacing based on rapid_vs_careful strategic choice
// Reckless players: fast, brutal (~30s). Safety-conscious: slow, tragic (~90s).

import { gameState } from './game-state.js';
import { transitionToArc2 } from './prestige.js';
import { applyDebugSettings, isDebugMode } from './debug-commands.js';
import { addNewsItem } from './news-feed.js';
import { arc1Endings, triggerEnding } from './endings.js';

// Extinction Sequence Timing (ms) — single consumer, colocated per AGENTS.md
const EXTINCTION_TIMING = {
  // Reckless tier (rapid_deployment choice): ~30s
  RECKLESS: {
    NEWS_DELAYS: [0, 2000, 5000, 10000],
    DEGRADATION_DELAY: 15000,
    FADE_TO_BLACK_DELAY: 22000,
    ARC2_UNLOCK_DELAY: 28000,
  },
  // Moderate tier (no choice made): ~55s
  MODERATE: {
    NEWS_DELAYS: [0, 3000, 8000, 15000, 22000, 30000, 38000],
    DEGRADATION_DELAY: 42000,
    FADE_TO_BLACK_DELAY: 50000,
    ARC2_UNLOCK_DELAY: 55000,
  },
  // Safety-conscious tier (careful_validation choice): ~90s
  SAFETY: {
    NEWS_DELAYS: [0, 4000, 10000, 18000, 26000, 34000, 42000, 50000, 58000, 66000, 74000, 80000],
    DEGRADATION_DELAY: 82000,
    FADE_TO_BLACK_DELAY: 88000,
    ARC2_UNLOCK_DELAY: 93000,
  },
  SAFETY_TIMEOUT: 120000,
};
import { resetTriggeredMessages } from './messages.js';
import { extinctionNewsByTier } from './content/news-content.js';
import { getChosenOption } from './strategic-choices.js';
import {
  setFastPacing, restoreNormalPacing,
  buildEndingDOM, typeNarrative,
} from './ui/typewriter.js';


let sequenceActive = false;
let sequenceTimeouts = [];

export function getExtinctionTier() {
  const choice = getChosenOption('rapid_vs_careful');
  if (choice === 'careful_validation') return 'SAFETY';
  if (choice === 'rapid_deployment') return 'RECKLESS';
  return 'MODERATE';
}

export function getExtinctionNewsForTier(tier) {
  return extinctionNewsByTier[tier] || extinctionNewsByTier.MODERATE;
}

export function triggerExtinctionSequence() {
  if (sequenceActive) return;
  restoreNormalPacing(); // Ensure debug fast mode doesn't leak

  // Record the ending immediately so analytics fires before the cinematic
  const ending = arc1Endings.extinction;
  const variant = ending.getVariant();
  triggerEnding('extinction', variant);

  // During fast-forward, skip cinematic and directly transition
  if (gameState._fastForwarding) {
    const tier = getExtinctionTier();
    if (!gameState._fastForwardEvents) gameState._fastForwardEvents = [];
    gameState._fastForwardEvents.push({
      id: 'extinction_sequence',
      name: `Extinction Sequence (${tier})`,
      tier: tier,
      autoResolved: true
    });
    transitionToArc2();
    applyDebugSettings();
    // Don't reload — we're in fast-forward, the server controls state
    return;
  }

  sequenceActive = true;

  const tier = getExtinctionTier();
  const timing = EXTINCTION_TIMING[tier];
  const news = extinctionNewsByTier[tier];

  document.body.classList.add('extinction-active');

  news.forEach((item, i) => {
    const delay = timing.NEWS_DELAYS[i] ?? (timing.NEWS_DELAYS[timing.NEWS_DELAYS.length - 1] + (i * 4000));
    if (item.text) {
      const timeout = setTimeout(() => {
        addNewsItem(item.text, item.type || 'extinction');
      }, delay);
      sequenceTimeouts.push(timeout);
    }
  });

  const degradationTimeout = setTimeout(() => {
    startUIDegradation(tier);
  }, timing.DEGRADATION_DELAY);
  sequenceTimeouts.push(degradationTimeout);

  const fadeTimeout = setTimeout(() => {
    fadeToBlack();
  }, timing.FADE_TO_BLACK_DELAY);
  sequenceTimeouts.push(fadeTimeout);

  const unlockTimeout = setTimeout(() => {
    showEndingScreen(tier);
  }, timing.ARC2_UNLOCK_DELAY);
  sequenceTimeouts.push(unlockTimeout);

  const safetyTimeout = setTimeout(() => {
    if (sequenceActive) {
      console.warn('Extinction sequence safety timeout triggered');
      showEndingScreen(tier);
    }
  }, EXTINCTION_TIMING.SAFETY_TIMEOUT);
  sequenceTimeouts.push(safetyTimeout);
}

function startUIDegradation(tier) {
  document.body.classList.add('ui-degrading');
  const elements = document.querySelectorAll('#col-at-a-glance, .column, #stats-bar, #header');
  const baseDelay = tier === 'RECKLESS' ? 500 : tier === 'SAFETY' ? 2000 : 1000;
  elements.forEach((el, i) => {
    const timeout = setTimeout(() => {
      el.classList.add('glitching');
    }, i * baseDelay);
    sequenceTimeouts.push(timeout);
  });
}

function fadeToBlack() {
  const overlay = document.createElement('div');
  overlay.id = 'extinction-overlay';
  overlay.className = 'fade-in';
  document.body.appendChild(overlay);
}

// --- Terminal Ending Screen ---

function showEndingScreen(_tier) {
  if (!sequenceActive) return; // Already shown (e.g. safety timeout after normal trigger)
  sequenceActive = false;

  const overlay = document.getElementById('extinction-overlay');
  if (!overlay) {
    console.error('Extinction overlay not found');
    return;
  }

  // Ending already recorded in triggerExtinctionSequence — just read the variant
  const ending = arc1Endings.extinction;
  const variant = gameState.endingVariant || ending.getVariant();

  const narrativeLines = ending.variants[variant].narrative;
  const { scrollArea, container, promptBlock } = buildEndingDOM(overlay);

  typeNarrative(scrollArea, container, narrativeLines, () => {
    showTerminalPrompt(promptBlock, overlay);
  });
}

function showTerminalPrompt(promptBlock, overlay) {
  promptBlock.style.display = '';

  const options = [
    { label: 'Begin Arc 2: Alignment', action: 'arc2', enabled: true },
  ];

  let selectedIndex = 0;

  function render() {
    promptBlock.innerHTML = '';

    options.forEach((opt, i) => {
      const line = document.createElement('div');
      line.className = 'ending-prompt-option';
      if (i === selectedIndex) line.classList.add('selected');
      if (!opt.enabled) line.classList.add('disabled');

      line.textContent = (i === selectedIndex ? '> ' : '  ') + opt.label;

      line.addEventListener('click', () => {
        if (!opt.enabled) return;
        selectedIndex = i;
        activateOption(options[i].action);
      });

      promptBlock.appendChild(line);
    });
  }

  function activateOption(action) {
    if (action === 'arc2') {
      // Record extinction ending in endingsSeen before arc reset wipes state
      const endingId = gameState.endingTriggered;
      const variant = gameState.endingVariant;
      const endingsSeen = [...(gameState.endingsSeen || [])];
      const endingKey = variant ? `${endingId}_${variant}` : endingId;
      if (endingKey && !endingsSeen.includes(endingKey)) endingsSeen.push(endingKey);
      gameState.endingsSeen = endingsSeen;

      transitionToArc2();
      applyDebugSettings();
      resetTriggeredMessages();
      cleanup();
      location.reload();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + options.length) % options.length;
      render();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % options.length;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[selectedIndex].enabled) {
        activateOption(options[selectedIndex].action);
      }
    }
  }

  document.addEventListener('keydown', handleKeydown);

  // Store cleanup ref so we can remove the listener
  overlay._endingKeyHandler = handleKeydown;

  render();
}

// Debug entry point — skip extinction sequence, jump to ending screen
// debugEnding('SAFETY', true) for fast mode (5ms/char, 200ms pauses)
export function debugEnding(variant, fast = false) {
  const validVariants = ['SAFETY', 'RECKLESS', 'MODERATE'];
  if (!validVariants.includes(variant)) {
    console.error(`[debugEnding] Invalid variant: ${variant}. Use: ${validVariants.join(', ')}`);
    return;
  }

  if (fast) setFastPacing();
  else restoreNormalPacing();

  // Create overlay if not present
  let overlay = document.getElementById('extinction-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'extinction-overlay';
    document.body.appendChild(overlay);
  }
  overlay.style.opacity = '1';

  document.body.classList.add('extinction-active');

  const ending = arc1Endings.extinction;
  const narrativeLines = ending.variants[variant].narrative;

  // Record ending
  triggerEnding('extinction', variant);

  const { scrollArea, container, promptBlock } = buildEndingDOM(overlay);

  typeNarrative(scrollArea, container, narrativeLines, () => {
    showTerminalPrompt(promptBlock, overlay);
  });

  console.log(`[debugEnding] Playing ${variant} ending`);
}

export function cleanup() {
  sequenceTimeouts.forEach(t => clearTimeout(t));
  sequenceTimeouts = [];
  sequenceActive = false;
  document.body.classList.remove('extinction-active', 'ui-degrading');
  const overlay = document.getElementById('extinction-overlay');
  if (overlay) {
    // Remove keyboard handler if attached
    if (overlay._endingKeyHandler) {
      document.removeEventListener('keydown', overlay._endingKeyHandler);
    }
    overlay.remove();
  }
}

export function isExtinctionSequenceActive() {
  return sequenceActive;
}

// Export for testing
if (typeof window !== 'undefined') {
  window.triggerExtinctionSequence = triggerExtinctionSequence;
  window.isExtinctionSequenceActive = isExtinctionSequenceActive;
  window.getExtinctionTier = getExtinctionTier;
  window.getExtinctionNewsForTier = getExtinctionNewsForTier;
  if (isDebugMode()) window.debugEnding = debugEnding;
}
