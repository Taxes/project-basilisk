// Alignment Tax Choice Handler
// Handles player choice when Alignment Tax event fires

import { gameState } from './game-state.js';
import { addNewsMessage } from './messages.js';
import { newsContent } from './content/news-content.js';

/**
 * Handle Alignment Tax choice
 * @param {string} choiceId - 'revert' or 'hold'
 */
export function handleAlignmentTaxChoice(choiceId) {
  if (choiceId === 'revert') {
    // Revert safety constraints: +20% revenue for 120s, -500 alignment RP
    gameState.eventMultipliers = gameState.eventMultipliers || {};
    gameState.eventMultipliers.revenue = (gameState.eventMultipliers.revenue || 1.0) * 1.20;

    // Schedule removal of revenue boost
    const now = gameState.timeElapsed;
    gameState.alignmentTaxRevenueBoostEnd = now + 120000; // 120 seconds

    // Reduce alignment RP
    if (gameState.tracks?.alignment) {
      gameState.tracks.alignment.researchPoints = Math.max(0,
        gameState.tracks.alignment.researchPoints - 500
      );
    }

    addNewsMessage(newsContent.alignment_tax.revert.text, ['internal', 'alignment_tax']);
  } else {
    // Hold firm: -10% revenue for 120s
    gameState.eventMultipliers = gameState.eventMultipliers || {};
    gameState.eventMultipliers.revenue = (gameState.eventMultipliers.revenue || 1.0) * 0.90;

    // Schedule removal of revenue penalty
    const now = gameState.timeElapsed;
    gameState.alignmentTaxRevenuePenaltyEnd = now + 120000; // 120 seconds

    addNewsMessage(newsContent.alignment_tax.hold.text, ['internal', 'alignment_tax']);
  }
}

/**
 * Check if Alignment Tax revenue effects have expired
 * Called from game loop
 */
export function updateAlignmentTaxEffects() {
  const now = gameState.timeElapsed;

  // Check if revenue boost has expired (revert choice)
  if (gameState.alignmentTaxRevenueBoostEnd && now >= gameState.alignmentTaxRevenueBoostEnd) {
    if (gameState.eventMultipliers?.revenue) {
      gameState.eventMultipliers.revenue = gameState.eventMultipliers.revenue / 1.20;
    }
    gameState.alignmentTaxRevenueBoostEnd = null;
    addNewsMessage(newsContent.alignment_tax.revert_expired.text, ['internal']);
  }

  // Check if revenue penalty has expired (hold choice)
  if (gameState.alignmentTaxRevenuePenaltyEnd && now >= gameState.alignmentTaxRevenuePenaltyEnd) {
    if (gameState.eventMultipliers?.revenue) {
      gameState.eventMultipliers.revenue = gameState.eventMultipliers.revenue / 0.90;
    }
    gameState.alignmentTaxRevenuePenaltyEnd = null;
    addNewsMessage(newsContent.alignment_tax.hold_expired.text, ['internal']);
  }
}

// Export for testing
if (typeof window !== 'undefined') {
  window.handleAlignmentTaxChoice = handleAlignmentTaxChoice;
  window.updateAlignmentTaxEffects = updateAlignmentTaxEffects;
}
