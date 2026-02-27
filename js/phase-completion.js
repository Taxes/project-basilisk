// Phase Completion System

import { gameState, saveGame } from './game-state.js';
import { isCapabilityUnlocked } from './capabilities.js';
import { triggerNewsForEvent } from './news-feed.js';
import { showNarrativeModal, getNarrativeOnDismiss, clearNarrativeOnDismiss } from './narrative-modal.js';
import { senders } from './content/message-content.js';
import { milestone } from './analytics.js';

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
    milestone('phase_transition', {
      from_phase: 1, to_phase: 2,
      tokens_per_second: gameState.resources.tokensPerSecond,
      total_funding_earned: gameState.lifetime?.totalFundingEarned || 0,
      total_research_earned: gameState.lifetime?.totalResearchEarned || 0,
      customer_count: gameState.resources.acquiredDemand || 0,
      research_count: Object.keys(gameState.capabilities || {}).length,
      funding: gameState.resources.funding,
    }, 'phase_transition_2');
    triggerNewsForEvent('phase_transition', 'phase2');

    // Persist that we've shown the completion
    gameState.phaseCompletion.phase1Shown = true;
    saveGame();
    return;
  }

  // Check Phase 2 → Phase 3 transition
  if (gameState.phase === 2 && !gameState.phaseCompletion?.phase2Shown && isCapabilityUnlocked('reasoning_breakthroughs')) {
    showPhase2Completion();

    // Progress to Phase 3
    gameState.phase = 3;
    milestone('phase_transition', {
      from_phase: 2, to_phase: 3,
      tokens_per_second: gameState.resources.tokensPerSecond,
      total_funding_earned: gameState.lifetime?.totalFundingEarned || 0,
      total_research_earned: gameState.lifetime?.totalResearchEarned || 0,
      customer_count: gameState.resources.acquiredDemand || 0,
      research_count: Object.keys(gameState.capabilities || {}).length,
      funding: gameState.resources.funding,
    }, 'phase_transition_3');
    triggerNewsForEvent('phase_transition', 'phase3');

    // Persist that we've shown the completion
    gameState.phaseCompletion.phase2Shown = true;
    saveGame();
  }
}

// Show Phase 1 completion modal
function showPhase1Completion() {
  const narrative = `
    <p>I remember when scaling laws were a hypothesis. You just proved them. Every variable snaps into place — compute, data, parameters — and the curve keeps going up. I haven't seen results this clean since the early connectionist work.</p>
    <p>The foundation model era starts here. I want to be honest with you: from this point, the models get big enough that surprises become the norm. That's exciting. It should also make you careful.</p>
  `;

  showNarrativeModal({
    title: 'The Transformer Era',
    narrative,
    phaseClass: 'phase-forward',
    inbox: {
      sender: senders.shannon,
      subject: 'The Transformer Era',
      body: 'I remember when scaling laws were a hypothesis. You just proved them. '
        + 'Every variable snaps into place — compute, data, parameters — and the curve keeps going up. '
        + 'I haven\'t seen results this clean since the early connectionist work.\n\n'
        + 'The foundation model era starts here. I want to be honest with you: '
        + 'from this point, the models get big enough that surprises become the norm. '
        + 'That\'s exciting. It should also make you careful.',
      tags: ['narrative', 'phase'],
      triggeredBy: 'phase_completion_1',
    },
    buttonText: 'Enter the Foundation Model Era',
  });
}

// Show Phase 2 completion modal
function showPhase2Completion() {
  const narrative = `
    <p>The reasoning benchmarks came back. Our models are outperforming the evaluation suite. Not by a small margin. I had to rerun the tests because I didn't believe the numbers.</p>
    <p>I'm seeing optimization patterns in the training logs that I didn't put there. The models are finding shortcuts we didn't design. That's either the best result we've ever produced or a problem I don't know how to frame yet.</p>
  `;

  showNarrativeModal({
    title: 'The Foundation Model Era',
    narrative,
    phaseClass: 'phase-ominous',
    inbox: {
      sender: senders.babbage,
      subject: 'Something in the training logs',
      body: 'The reasoning benchmarks came back. Our models are outperforming the evaluation suite. '
        + 'Not by a small margin. I had to rerun the tests because I didn\'t believe the numbers.\n\n'
        + 'I\'m seeing optimization patterns in the training logs that I didn\'t put there. '
        + 'The models are finding shortcuts we didn\'t design. '
        + 'That\'s either the best result we\'ve ever produced or a problem I don\'t know how to frame yet.',
      tags: ['narrative', 'phase'],
      triggeredBy: 'phase_completion_2',
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

  // Call onDismiss callback if set (e.g. onboarding modal)
  const onDismiss = getNarrativeOnDismiss();
  if (onDismiss) {
    clearNarrativeOnDismiss();
    onDismiss();
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
