// Phase Completion System

import { gameState, saveGame } from './game-state.js';
import { isCapabilityUnlocked } from './capabilities.js';
import { triggerNewsForEvent } from './news-feed.js';
import { showNarrativeModal } from './narrative-modal.js';
import { senders } from './content/message-content.js';

// No module-level flags — use gameState.phase as the gate instead.
// Module-level flags persisted across game resets, breaking phase transitions.

// Check if phases are complete.
// Gates on gameState.phase (which resets properly) instead of module-level flags.
export function checkPhaseCompletion() {
  // Check Phase 1 → Phase 2 transition
  if (gameState.phase === 1 && !gameState.phaseCompletion?.phase1Shown && isCapabilityUnlocked('scaling_laws')) {
    showPhase1Completion();

    // Progress to Phase 2
    gameState.phase = 2;
    triggerNewsForEvent('phase_transition', 'phase2');

    // Persist that we've shown the completion
    if (!gameState.phaseCompletion) {
      gameState.phaseCompletion = {};
    }
    gameState.phaseCompletion.phase1Shown = true;
    saveGame();
    return;
  }

  // Check Phase 2 → Phase 3 transition
  if (gameState.phase === 2 && !gameState.phaseCompletion?.phase2Shown && isCapabilityUnlocked('reasoning_breakthroughs')) {
    showPhase2Completion();

    // Progress to Phase 3
    gameState.phase = 3;
    triggerNewsForEvent('phase_transition', 'phase3');

    // Persist that we've shown the completion
    if (!gameState.phaseCompletion) {
      gameState.phaseCompletion = {};
    }
    gameState.phaseCompletion.phase2Shown = true;
    saveGame();
  }
}

// Show Phase 1 completion modal
function showPhase1Completion() {
  const narrative = `
    <p>You've proven that attention is all you need. Scaling laws hold. Your models grow smarter with every parameter, every dataset, every GPU-hour. The industry is watching.</p>
    <p>But scaling has a direction, and you haven't chosen yours yet. The foundation model era begins now — and the models are getting big enough to surprise you.</p>
  `;

  showNarrativeModal({
    title: 'The Transformer Era',
    narrative,
    phaseClass: 'phase-forward',
    inbox: {
      sender: senders.shannon,
      subject: 'The Transformer Era',
      body: 'You\'ve proven that attention is all you need. Scaling laws hold. '
        + 'Your models grow smarter with every parameter, every dataset, every GPU-hour. The industry is watching. '
        + 'But scaling has a direction, and you haven\'t chosen yours yet. '
        + 'The foundation model era begins now — and the models are getting big enough to surprise you.',
      tags: ['narrative', 'phase'],
    },
    buttonText: 'Enter the Foundation Model Era',
  });
}

// Show Phase 2 completion modal
function showPhase2Completion() {
  const narrative = `
    <p>Your systems reason at levels that rival human experts. Tool use, agency, world models — each breakthrough built on the last. You built the ladder. Something is climbing it.</p>
    <p>Self-improvement is no longer theoretical. The decisions you make now are the last ones you'll make with a clear advantage.</p>
  `;

  showNarrativeModal({
    title: 'The Foundation Model Era',
    narrative,
    phaseClass: 'phase-ominous',
    inbox: {
      sender: senders.shannon,
      subject: 'The Road to Superintelligence',
      body: 'Your systems reason at levels that rival human experts. '
        + 'Tool use, agency, world models — each breakthrough built on the last. '
        + 'You built the ladder. Something is climbing it. '
        + 'Self-improvement is no longer theoretical. '
        + 'The decisions you make now are the last ones you\'ll make with a clear advantage.',
      tags: ['narrative', 'phase'],
    },
    buttonText: 'Begin the Road to Superintelligence',
  });
}

// Hide Phase completion modal
export function hidePhaseCompletionModal() {
  const modal = document.getElementById('phase-completion-modal');
  if (modal) {
    modal.classList.add('hidden');
    // Remove phase-specific classes
    const content = modal.querySelector('.phase-completion-content');
    if (content) {
      content.classList.remove('phase-forward', 'phase-ominous');
    }
  }

  // Resume game if we paused for phase completion
  if (gameState.pauseReason === 'phase_completion') {
    gameState.paused = false;
    gameState.pauseReason = null;
  }
}

// Initialize phase completion UI listeners
export function initializePhaseCompletion() {
  const continueButton = document.getElementById('phase-completion-continue');

  if (continueButton) {
    continueButton.addEventListener('click', () => {
      hidePhaseCompletionModal();
    });
  }
}
