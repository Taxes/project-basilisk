// Upgrade Definitions for Purchasables

import { gameState } from '../game-state.js';
import { canAfford, spendResources } from '../resources.js';

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

// Base costs for upgrade pricing (by purchasable ID)
export const UPGRADE_BASE_COSTS = {
  grad_student: 100000,
  junior_researcher: 1000000,
  team_lead: 10000000,
  elite_researcher: 100000000,
  gpu_consumer: 200000,
  gpu_datacenter: 2000000,
  cloud_compute: 20000000,
  build_datacenter: 200000000,
};

// Cost multipliers for upgrades
export const UPGRADE_COST_MULTIPLIERS = {
  cost: 2.5,
  scaling: 4,
  output: 2.5,
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

// Check if an upgrade type is unlocked via research
export function isUpgradeTypeUnlocked(upgradeType, _level = 1) {
  const unlockedApps = gameState.tracks?.applications?.unlockedCapabilities || [];

  if (upgradeType === 'cost') {
    return unlockedApps.includes('process_optimization');
  }

  if (upgradeType === 'scaling') {
    return unlockedApps.includes('predictive_scaling');
  }

  if (upgradeType === 'output') {
    return unlockedApps.includes('performance_engineering');
  }

  return false;
}

// Get cost for an upgrade
export function getUpgradeCost(purchasableId, upgradeType) {
  const state = getUpgradeState(purchasableId);
  const baseCost = UPGRADE_BASE_COSTS[purchasableId] || 100000;

  const level = state[upgradeType] || 0;
  const typeMultiplier = UPGRADE_COST_MULTIPLIERS[upgradeType] || 2.5;
  const multiplier = Math.pow(typeMultiplier, level + 1);
  return { funding: Math.floor(baseCost * multiplier) };
}

// Check if player can purchase an upgrade
export function canPurchaseUpgrade(purchasableId, upgradeType) {
  const state = getUpgradeState(purchasableId);
  const typeDef = UPGRADE_TYPES[upgradeType];

  if (!typeDef) return false;

  // Check if already maxed
  if (state[upgradeType] >= typeDef.maxLevel) return false;

  // Check research requirements
  const nextLevel = (state[upgradeType] || 0) + 1;
  if (!isUpgradeTypeUnlocked(upgradeType, nextLevel)) return false;

  // Check cost
  const cost = getUpgradeCost(purchasableId, upgradeType);
  return canAfford(cost);
}

// Purchase an upgrade
export function purchaseUpgrade(purchasableId, upgradeType) {
  if (!canPurchaseUpgrade(purchasableId, upgradeType)) {
    return false;
  }

  const cost = getUpgradeCost(purchasableId, upgradeType);
  spendResources(cost);

  const state = getUpgradeState(purchasableId);

  state[upgradeType] = (state[upgradeType] || 0) + 1;

  return true;
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
