// js/purchasable-state.js
// Consolidated state management for all purchasable items.
// Single source of truth: count, furlough, savedProgress, automation per item.

import { gameState } from './game-state.js';

// Default automation policy for new items
function getDefaultAutomationPolicy() {
  return {
    enabled: false,
    type: 'fixed',
    targetValue: 0,
    targetItem: null,
    priority: 1,
  };
}

// Get or initialize purchasable state for an item
export function getPurchasableState(id) {
  if (!gameState.purchasables) {
    gameState.purchasables = {};
  }
  if (!gameState.purchasables[id]) {
    gameState.purchasables[id] = {
      count: 0,
      furloughed: 0,
      savedProgress: 0,
      automation: {
        ...getDefaultAutomationPolicy(),
      },
    };
  }
  // Backfill automation for entries created before automation existed
  if (!gameState.purchasables[id].automation) {
    gameState.purchasables[id].automation = { ...getDefaultAutomationPolicy() };
  }
  return gameState.purchasables[id];
}

// Get count for an item (returns 0 if not purchased)
export function getCount(id) {
  return gameState.purchasables?.[id]?.count ?? 0;
}

// Set count for an item
export function setCount(id, count) {
  getPurchasableState(id).count = count;
}

// Increment count for an item
export function incrementCount(id) {
  getPurchasableState(id).count++;
}

// Get active count for an item (owned - furloughed)
export function getActiveCount(id) {
  const state = getPurchasableState(id);
  return state.count - state.furloughed;
}

// Get furloughed count for an item
export function getFurloughedCount(id) {
  return getPurchasableState(id).furloughed;
}

// Expose functions to window for playtester harness
if (typeof window !== 'undefined') {
  window.getPurchasableState = getPurchasableState;
  window.getCount = getCount;
  window.setCount = setCount;
  window.incrementCount = incrementCount;
  window.getActiveCount = getActiveCount;
  window.getFurloughedCount = getFurloughedCount;
}
