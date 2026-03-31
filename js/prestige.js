// Prestige System - Handle arc resets and meta-progression

import { gameState, createDefaultGameState, saveGame } from './game-state.js';
import { FUNDING, PRESTIGE } from '../data/balance.js';
import { resetQueueIdCounter } from './focus-queue.js';
import { resetAnalytics } from './analytics.js';

/**
 * Get effective prestige multiplier for a given key, respecting game mode.
 * Narrative mode always returns 1 (no prestige bonuses).
 * @param {string} key - Upgrade key (e.g. 'researchMultiplier', 'startingFunding', 'revenueMultiplier')
 * @returns {number}
 */
export function getPrestigeMultiplier(key) {
  if (gameState.gameMode === 'narrative') return 1;
  return gameState.arc1Upgrades?.[key] ?? 1;
}

// Calculate prestige upgrade gains based on current progress
// Same three bonuses for both arcs, with soft cap diminishing returns
export function calculatePrestigeGain() {
  const progress = gameState.agiProgress || 0;
  const progressScale = progress / 100;

  const bonuses = {
    startingFunding: PRESTIGE.GAIN_STARTING_FUNDING,
    researchMultiplier: PRESTIGE.GAIN_RESEARCH_MULTIPLIER,
    revenueMultiplier: PRESTIGE.GAIN_REVENUE_MULTIPLIER,
  };

  const caps = {
    startingFunding: PRESTIGE.CAP_STARTING_FUNDING,
    researchMultiplier: PRESTIGE.CAP_RESEARCH_MULTIPLIER,
    revenueMultiplier: PRESTIGE.CAP_REVENUE_MULTIPLIER,
  };

  const result = {};
  for (const [key, rawGain] of Object.entries(bonuses)) {
    const scaled = rawGain * progressScale;
    const current = gameState.arc1Upgrades?.[key] ?? 1;
    const cap = caps[key];

    if (current >= cap) {
      // Past soft cap: diminishing returns via sqrt
      result[key] = scaled * Math.sqrt(cap / current);
    } else {
      result[key] = scaled;
    }
  }

  return result;
}

// Apply prestige gains to current upgrades (always arc1Upgrades — used for both arcs)
export function applyPrestigeGains(gains) {
  gameState.arc1Upgrades.researchMultiplier += gains.researchMultiplier || 0;
  gameState.arc1Upgrades.startingFunding += gains.startingFunding || 0;
  gameState.arc1Upgrades.revenueMultiplier += gains.revenueMultiplier || 0;
}

// --- Core reset helper ---
// All reset functions share the same pattern: snapshot → wipe → restore → cleanup.
// Centralizing prevents the class of bugs where a new preserve rule is added to one
// function but missed in the others (historically 7+ bugs from this pattern).

/**
 * @param {Object} opts
 * @param {string[]} opts.preserve - top-level gameState keys to snapshot and restore
 * @param {Object}   opts.set     - key/value overrides applied after restore
 * @param {Function} [opts.afterReset] - called after restore, before save (arc-specific init)
 */
function resetGameState({ preserve = [], set = {}, afterReset } = {}) {
  // 1. Snapshot preserved top-level values (shallow copy)
  const snapshot = {};
  for (const key of preserve) {
    const val = gameState[key];
    if (Array.isArray(val)) snapshot[key] = [...val];
    else if (val && typeof val === 'object') snapshot[key] = { ...val };
    else snapshot[key] = val;
  }

  // 2. Snapshot UI sub-keys (nested under gameState.ui, need special handling)
  const uiSnapshot = {
    seenCards: gameState.ui?.seenCards ? [...gameState.ui.seenCards] : [],
    discoveredFlavor: gameState.ui?.discoveredFlavor ? [...gameState.ui.discoveredFlavor] : [],
  };

  // 3. Tutorial needs transient state cleared after restore
  const tutorial = gameState.tutorial ? { ...gameState.tutorial } : null;

  // 4. Wipe — delete keys not in defaults (kills transient runtime flags like
  //    _backgroundMode, _fastForwarding), then overlay fresh defaults.
  //    This is deny-by-default: new dynamic fields are wiped automatically,
  //    preventing the class of bug where a forgotten cleanup leaks state (#981).
  const fresh = createDefaultGameState();
  for (const key of Object.keys(gameState)) {
    if (!(key in fresh)) delete gameState[key];
  }
  Object.assign(gameState, fresh);

  // 5. Restore snapshots
  for (const key of preserve) {
    if (key === 'tutorial') continue; // handled below
    if (snapshot[key] !== undefined) gameState[key] = snapshot[key];
  }

  // Always restore UI familiarity (every reset type preserves these)
  gameState.ui.seenCards = uiSnapshot.seenCards;
  gameState.ui.discoveredFlavor = uiSnapshot.discoveredFlavor;

  // Restore tutorial with transient state cleared
  if (tutorial) {
    gameState.tutorial = tutorial;
    gameState.tutorial.active = false;
    gameState.tutorial.shownStep = 0;
  }

  // 6. Apply explicit overrides
  for (const [k, v] of Object.entries(set)) {
    gameState[k] = v;
  }

  // 7. Post-reset hook (arc-specific initialization)
  if (afterReset) afterReset();

  // 8. Shared cleanup
  resetQueueIdCounter();
  resetAnalytics();
  gameState.lastTick = Date.now();
  saveGame();
}

/** Accumulate lifetime stats into lifetimeAllTime before a reset wipes them. */
function accumulateLifetimeStats() {
  const all = { ...gameState.lifetimeAllTime };
  all.prestigeResets = (all.prestigeResets || 0) + 1;
  const lt = gameState.lifetime || {};
  all.peakFundingRate = Math.max(all.peakFundingRate || 0, lt.peakFundingRate || 0);
  all.peakResearchRate = Math.max(all.peakResearchRate || 0, lt.peakResearchRate || 0);
  all.dataCollapses = (all.dataCollapses || 0) + (lt.dataCollapses || 0);
  return all;
}

function initArc2Allocations() {
  gameState.tracks.capabilities.researcherAllocation = 1.0;
  gameState.tracks.applications.researcherAllocation = 0.0;
  gameState.tracks.alignment.researcherAllocation = 0.0;
}

// --- Public reset functions ---

// Reset game for prestige (within same arc)
export function resetForPrestige() {
  const currentArc = gameState.arc;
  const lifetimeAllTime = accumulateLifetimeStats();

  // Record current ending before reset wipes endingTriggered
  const endingsSeen = [...(gameState.endingsSeen || [])];
  if (gameState.endingTriggered) {
    const endingKey = gameState.endingVariant
      ? `${gameState.endingTriggered}_${gameState.endingVariant}`
      : gameState.endingTriggered;
    if (!endingsSeen.includes(endingKey)) endingsSeen.push(endingKey);
  }

  resetGameState({
    preserve: ['arc1Upgrades', 'onboardingComplete', 'gameMode'],
    set: {
      arc: currentArc,
      arcUnlocked: gameState.arcUnlocked,
      prestigeCount: gameState.prestigeCount + 1,
      lifetimeAllTime,
      endingsSeen,
    },
    afterReset: () => {
      gameState.resources.funding = FUNDING.SEED_AMOUNT * getPrestigeMultiplier('startingFunding');
      if (currentArc === 2) {
        initArc2Allocations();
        gameState.onboardingComplete = true;
      }
    },
  });
}

// Reset after extinction ending — grants prestige bonuses, then resets
// Keeps: prestige upgrades (with new gains), onboarding, UI familiarity,
//        endings seen, lifetimeAllTime stats
// Wipes: resources, progress, everything else mechanical
export function resetForExtinction(endingId, variant) {
  // Calculate prestige gains BEFORE reset (needs current agiProgress)
  const gains = calculatePrestigeGain();

  // Prepare upgraded prestige values
  const arc1Upgrades = { ...gameState.arc1Upgrades };
  arc1Upgrades.researchMultiplier += gains.researchMultiplier || 0;
  arc1Upgrades.startingFunding += gains.startingFunding || 0;
  arc1Upgrades.revenueMultiplier += gains.revenueMultiplier || 0;

  // Record this ending before reset wipes state
  const endingsSeen = [...(gameState.endingsSeen || [])];
  const endingKey = variant ? `${endingId}_${variant}` : endingId;
  if (!endingsSeen.includes(endingKey)) endingsSeen.push(endingKey);

  resetGameState({
    preserve: ['onboardingComplete', 'gameMode', 'lifetimeAllTime'],
    set: {
      prestigeCount: gameState.prestigeCount + 1,
      arc1Upgrades,
      endingsSeen,
    },
    afterReset: () => {
      gameState.resources.funding = FUNDING.SEED_AMOUNT * getPrestigeMultiplier('startingFunding');
    },
  });
}

// Reset for arc/mode switch — wipes mechanical + prestige state, preserves meta-progress
// Used by: settings arc selector, extinction→Arc 2 transition
export function resetForArcSwitch(targetArc, targetMode) {
  resetGameState({
    preserve: ['onboardingComplete', 'lifetimeAllTime'],
    set: {
      arc: targetArc,
      arcUnlocked: gameState.arcUnlocked,
      gameMode: targetMode,
      endingsSeen: [...(gameState.endingsSeen || [])],
      prestigeCount: 0,
    },
    afterReset: () => {
      gameState.resources.funding = FUNDING.SEED_AMOUNT; // No prestige multiplier
      if (targetArc === 2) {
        initArc2Allocations();
        gameState.onboardingComplete = true;
      }
    },
  });
}

// Transition from Arc 1 to Arc 2 (one-way door)
// Note: initializeNewsFeed() is NOT called here because the page reloads
// after Arc 2 transition, and main.js will call it during startup.
export function transitionToArc2() {
  // Ensure arcUnlocked is upgraded before arc reset snapshots it
  gameState.arcUnlocked = Math.max(gameState.arcUnlocked, 2);
  resetForArcSwitch(2, gameState.gameMode);
}

// Export for testing
if (typeof window !== 'undefined') {
  window.getPrestigeMultiplier = getPrestigeMultiplier;
  window.calculatePrestigeGain = calculatePrestigeGain;
  window.applyPrestigeGains = applyPrestigeGains;
  window.resetForPrestige = resetForPrestige;
  window.resetForExtinction = resetForExtinction;
  window.resetForArcSwitch = resetForArcSwitch;
  window.transitionToArc2 = transitionToArc2;
}
