// Exposes internal functions to window for the playtester harness.
// If an import fails here, the function was renamed/moved -- update this file.

import { gameState, saveGame, loadGame, resetGame } from './game-state.js';
import { updateResources, getCurrentFeedbackRate, computeCostState, computeResearchState, computeComputeState } from './resources.js';
import { updateUI } from './ui.js';
import { updateCompetitor } from './competitor.js';
import { checkEndings, triggerEnding } from './endings.js';
import { showEndingModal } from './ui/modals.js';
import { checkChoiceUnlocks } from './strategic-choices.js';
import { strategicChoiceDefinitions } from '../data/strategic-choices.js';
import { VERSION } from './version.js';
import {
  initAllocationSliders, updateAllocation, updateAllocationDisplay,
  initComputeAllocationSlider, updateComputeAllocationDisplay,
} from './ui/controls.js';
import { initTokenPricing, updateTokenEconomicsDisplay } from './ui/economics.js';
import { requestFullUpdate } from './ui/signals.js';
import { BALANCE } from '../data/balance.js';
import {
  calculateDataScore, calculateEffectiveness, calculateQuality,
  getTotalGenerationRate, getSyntheticQuality,
} from './data-quality.js';
import { getCount, getActiveCount } from './purchasable-state.js';
import { canUnpause, updatePauseState } from './messages.js';
import { createPurgeItem, addToQueue, enqueuePurchase } from './focus-queue.js';
import { debugEnding } from './extinction-sequence.js';

if (typeof window !== 'undefined') {
  Object.assign(window, {
    // From main.js
    gameState,
    saveGame,
    loadGame,
    resetGame,
    updateUI,
    updateResources,
    getCurrentFeedbackRate,
    computeCostState,
    computeResearchState,
    computeComputeState,
    updateCompetitor,
    checkEndings,
    triggerEnding,
    showEndingModal,
    checkChoiceUnlocks,
    strategicChoiceDefinitions,
    __GAME_VERSION: VERSION,

    // From ui/controls.js
    initAllocationSliders,
    updateAllocation,
    updateAllocationDisplay,
    initComputeAllocationSlider,
    updateComputeAllocationDisplay,
    // From ui/economics.js
    initTokenPricing,
    updateTokenEconomicsDisplay,

    // From ui/signals.js
    requestFullUpdate,

    // From data/balance.js
    BALANCE,

    // From data-quality.js
    calculateDataScore,
    calculateEffectiveness,
    calculateQuality,
    getTotalGenerationRate,
    getSyntheticQuality,
    // From purchasable-state.js
    getCount,
    getActiveCount,
    // From focus-queue.js
    enqueuePurchase,

    // From messages.js
    canUnpause,
    updatePauseState,

    // From focus-queue.js
    createPurgeItem,
    addToQueue,

    // From extinction-sequence.js
    debugEnding,
  });
}
