// js/automation-policies.js
// Policy evaluation for automation system.
// Overhead functions removed - points system has no overhead.

import { gameState } from './game-state.js';
import {
  canHRHire,
  canProcurementBuy,
} from './automation-state.js';
import { getPurchasableById } from './content/purchasables.js';
import { BALANCE } from '../data/balance.js';
import { getCount, getPurchasableState, getActiveCount } from './purchasable-state.js';
import { getTeamCostMultiplier } from './resources.js';

// Calculate the target active count for an item based on its policy
export function calculateTarget(itemId, policy, options = {}) {
  if (!policy) {
    const state = getPurchasableState(itemId);
    policy = state.automation;
  }

  if (!policy.enabled && !options.preview) {
    return getActiveCount(itemId);
  }

  switch (policy.type) {
    case 'fixed':
      return Math.ceil(policy.targetValue);

    case 'percent_revenue': {
      const revenue = gameState.computed?.revenue?.gross || 0;
      const purchasable = getPurchasableById(itemId);
      if (!purchasable) return 0;
      const rawBaseCost = purchasable.salary || purchasable.runningCost || 1;
      const baseCost = rawBaseCost * getTeamCostMultiplier(itemId);
      const opsDiscount = 1 - (gameState.computed?.ceoFocus?.opsBonus ?? gameState.opsBonus ?? 0);
      const budget = revenue * (policy.targetValue / 100);
      const scaling = BALANCE.COST_SCALING[itemId] || 0;

      if (scaling > 0 && opsDiscount > 0) {
        // Solve: baseCost * N * (1 + scaling * N) * opsDiscount = budget
        // scaling * N² + N = budget / (baseCost * opsDiscount)
        const c = budget / (baseCost * opsDiscount);
        return Math.floor((-1 + Math.sqrt(1 + 4 * scaling * c)) / (2 * scaling));
      } else {
        // No scaling or zero costs — simple division
        const effectiveCost = baseCost * opsDiscount;
        if (effectiveCost <= 0) return 0;
        return Math.floor(budget / effectiveCost);
      }
    }

    case 'percent_item': {
      if (!policy.targetItem) return 0;
      const referenceCount = getActiveCount(policy.targetItem);
      return Math.ceil(referenceCount * (policy.targetValue / 100));
    }

    default:
      return getActiveCount(itemId);
  }
}

// Get the transition state for an item (what the automation is currently doing)
export function getTransitionState(itemId) {
  const state = getPurchasableState(itemId);
  const active = getActiveCount(itemId);
  const owned = getCount(itemId);
  const furloughed = state.furloughed;
  const target = calculateTarget(itemId);

  if (!state.automation.enabled || active === target) {
    return { type: 'idle', active, furloughed, target };
  }

  if (target > active) {
    if (target <= owned) {
      return { type: 'unfurloughing', active, furloughed, target };
    } else {
      return { type: 'hiring', active, furloughed, target };
    }
  } else {
    return { type: 'furloughing', active, furloughed, target };
  }
}

// Check if automation is unlocked for an item (based on which system handles it)
export function isItemAutomatable(itemId) {
  // Check if HR can hire this
  if (canHRHire(itemId)) return true;

  // Check if Procurement can buy this
  if (canProcurementBuy(itemId)) return true;

  return false;
}

if (typeof window !== 'undefined') {
  window.calculateTargetForTest = calculateTarget;
}
