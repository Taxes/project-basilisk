// Upgrade Definitions for Purchasables
//
// The upgrade purchase flow (UI, pricing, unlock gates) was removed when the
// Build/Upgrades tabs were replaced by sub-tabs. The type definitions and
// effect getters remain so the system can be re-enabled later — upgrade state
// on gameState.upgrades is still honoured by getCostReduction/getOutputMultiplier.

import { gameState } from '../game-state.js';

// Upgrade type definitions
export const UPGRADE_TYPES = {
  cost: {
    id: 'cost',
    name: 'Cost Reduction',
    description: 'Reduces base purchase cost',
    maxLevel: 5,
    reductionPerLevel: 0.10, // -10% per level
  },
  scaling: {
    id: 'scaling',
    name: 'Scaling Reduction',
    description: 'Reduces exponential cost growth',
    maxLevel: 3,
    scalingFactors: {
      1.05: [1.05, 1.04, 1.03, 1.02],
      1.10: [1.10, 1.08, 1.06, 1.04],
      1.15: [1.15, 1.12, 1.09, 1.06],
    },
  },
  output: {
    id: 'output',
    name: 'Output Boost',
    description: 'Increases output from this item',
    maxLevel: 5,
    boostPerLevel: 0.20, // +20% per level
  },
};

// Get upgrade state for a purchasable (initializes if needed)
export function getUpgradeState(purchasableId) {
  if (!gameState.upgrades) {
    gameState.upgrades = {};
  }
  if (!gameState.upgrades[purchasableId]) {
    gameState.upgrades[purchasableId] = {
      cost: 0,
      scaling: 0,
      output: 0,
    };
  }
  return gameState.upgrades[purchasableId];
}

// Get cost reduction multiplier for a purchasable
export function getCostReduction(purchasableId) {
  const state = getUpgradeState(purchasableId);
  const level = state.cost || 0;
  return 1 - (level * UPGRADE_TYPES.cost.reductionPerLevel);
}

// Get output multiplier for a purchasable
export function getOutputMultiplier(purchasableId) {
  const state = getUpgradeState(purchasableId);
  const level = state.output || 0;
  return 1 + (level * UPGRADE_TYPES.output.boostPerLevel);
}
