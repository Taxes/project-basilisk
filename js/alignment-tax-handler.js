// Alignment Tax Choice Handler
// Handles player choice when Alignment Tax event fires

import { gameState } from './game-state.js';
import { addNewsMessage } from './messages.js';
import { newsContent } from './content/news-content.js';

/**
 * Apply the alignment tax demand malus when the event fires.
 * Called from checkAlignmentTaxEvent before the message is shown.
 */
export function applyAlignmentTaxOnFire() {
  gameState.alignmentTaxDemandMalus = -0.10;
}

/**
 * Handle Alignment Tax choice
 * @param {string} choiceId - 'revert' or 'hold'
 */
export function handleAlignmentTaxChoice(choiceId) {
  if (choiceId === 'revert') {
    // Ease constraints: remove demand malus, permanently reduce programme effectiveness by 5%
    gameState.alignmentTaxDemandMalus = 0;
    gameState.alignmentTaxProgramReduction = 0.05;
    addNewsMessage(newsContent.alignment_tax.revert.text, ['world', 'alignment_tax']);
  } else {
    // Hold position: demand malus stays, programmes unaffected
    addNewsMessage(newsContent.alignment_tax.hold.text, ['world', 'alignment_tax']);
  }
}

// Export for testing
if (typeof window !== 'undefined') {
  window.handleAlignmentTaxChoice = handleAlignmentTaxChoice;
  window.applyAlignmentTaxOnFire = applyAlignmentTaxOnFire;
}
