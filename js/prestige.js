// Prestige System - Handle arc resets and meta-progression

import { gameState, createDefaultGameState, saveGame } from './game-state.js';
import { FUNDING } from '../data/balance.js';
import { resetQueueIdCounter } from './focus-queue.js';

// Calculate prestige upgrade gains based on current progress
export function calculatePrestigeGain() {
  const progress = gameState.agiProgress || 0;

  // Diminishing returns formula: gain = base * sqrt(progress / 100)
  const baseGain = 0.2;
  // baseGain 0.2 → up to 20% per bonus at 100% progress
  const multiplier = Math.sqrt(progress / 100);

  if (gameState.arc === 1) {
    return {
      researchMultiplier: baseGain * multiplier,
      startingFunding: baseGain * multiplier,
      revenueMultiplier: baseGain * multiplier * 0.5,
    };
  } else {
    return {
      safetyResearchSpeed: baseGain * multiplier,
      incidentDetection: baseGain * multiplier,
      interpretabilityBonus: baseGain * multiplier * 0.5,
    };
  }
}

// Apply prestige gains to current upgrades
export function applyPrestigeGains(gains) {
  if (gameState.arc === 1) {
    gameState.arc1Upgrades.researchMultiplier *= 1 + (gains.researchMultiplier || 0);
    gameState.arc1Upgrades.startingFunding *= 1 + (gains.startingFunding || 0);
    gameState.arc1Upgrades.revenueMultiplier *= 1 + (gains.revenueMultiplier || 0);
  } else {
    gameState.arc2Upgrades.safetyResearchSpeed *= 1 + (gains.safetyResearchSpeed || 0);
    gameState.arc2Upgrades.incidentDetection *= 1 + (gains.incidentDetection || 0);
    gameState.arc2Upgrades.interpretabilityBonus += gains.interpretabilityBonus || 0;
  }
}

// Reset game for prestige (within same arc)
export function resetForPrestige() {
  const currentArc = gameState.arc;
  const arcUnlocked = gameState.arcUnlocked;
  const prestigeCount = gameState.prestigeCount + 1;

  // Preserve upgrades
  const arc1Upgrades = { ...gameState.arc1Upgrades };
  const arc2Upgrades = { ...gameState.arc2Upgrades };

  // Preserve onboarding flag
  const onboardingComplete = gameState.onboardingComplete;

  // Preserve UI state that persists across prestige
  const seenCards = gameState.ui?.seenCards ? [...gameState.ui.seenCards] : [];
  const everUnlockedSections = gameState.ui?.everUnlockedSections ? [...gameState.ui.everUnlockedSections] : [];

  // Preserve UI arrays that persist across prestige
  const discoveredFlavor = gameState.ui?.discoveredFlavor ? [...gameState.ui.discoveredFlavor] : [];

  // Accumulate all-time lifetime stats before reset
  const lifetimeAllTime = { ...gameState.lifetimeAllTime };
  lifetimeAllTime.prestigeResets = (lifetimeAllTime.prestigeResets || 0) + 1;
  const lt = gameState.lifetime || {};
  lifetimeAllTime.peakFundingRate = Math.max(lifetimeAllTime.peakFundingRate || 0, lt.peakFundingRate || 0);
  lifetimeAllTime.peakResearchRate = Math.max(lifetimeAllTime.peakResearchRate || 0, lt.peakResearchRate || 0);
  lifetimeAllTime.dataCollapses = (lifetimeAllTime.dataCollapses || 0) + (lt.dataCollapses || 0);

  // Get fresh state
  const fresh = createDefaultGameState();

  // Restore preserved values
  Object.assign(gameState, fresh);
  gameState.arc = currentArc;
  gameState.arcUnlocked = arcUnlocked;
  gameState.prestigeCount = prestigeCount;
  gameState.arc1Upgrades = arc1Upgrades;
  gameState.arc2Upgrades = arc2Upgrades;
  gameState.lifetimeAllTime = lifetimeAllTime;
  gameState.onboardingComplete = onboardingComplete;
  gameState.ui.seenCards = seenCards;
  gameState.ui.everUnlockedSections = everUnlockedSections;
  gameState.ui.discoveredFlavor = discoveredFlavor;

  // Explicitly clear dynamic state that createDefaultGameState doesn't include
  // (Object.assign only copies properties from fresh — it doesn't delete extras)
  gameState.endingTriggered = null;
  gameState.endingVariant = null;
  gameState.endingTime = null;
  gameState.bankrupted = false;

  // Apply starting bonuses from upgrades
  if (currentArc === 1) {
    gameState.resources.funding = FUNDING.SEED_AMOUNT * arc1Upgrades.startingFunding;
  }

  resetQueueIdCounter();
  gameState.lastTick = Date.now();
  saveGame();
}

// Reset after extinction ending — preserves knowledge, wipes all power
// Keeps: onboarding, UI familiarity (seenCards, everUnlockedSections, discoveredFlavor),
//        endings seen, lifetimeAllTime stats
// Wipes: prestige upgrades, resources, progress, everything mechanical
export function resetForExtinction(endingId, variant) {
  // Preserve cosmetic/informational state
  const onboardingComplete = gameState.onboardingComplete;
  const seenCards = gameState.ui?.seenCards ? [...gameState.ui.seenCards] : [];
  const everUnlockedSections = gameState.ui?.everUnlockedSections ? [...gameState.ui.everUnlockedSections] : [];
  const discoveredFlavor = gameState.ui?.discoveredFlavor ? [...gameState.ui.discoveredFlavor] : [];
  const lifetimeAllTime = { ...gameState.lifetimeAllTime };
  const endingsSeen = [...(gameState.endingsSeen || [])];

  // Record this ending
  const endingKey = variant ? `${endingId}_${variant}` : endingId;
  if (!endingsSeen.includes(endingKey)) {
    endingsSeen.push(endingKey);
  }

  // Full reset
  const fresh = createDefaultGameState();
  Object.assign(gameState, fresh);

  // Restore preserved state
  gameState.onboardingComplete = onboardingComplete;
  gameState.ui.seenCards = seenCards;
  gameState.ui.everUnlockedSections = everUnlockedSections;
  gameState.ui.discoveredFlavor = discoveredFlavor;
  gameState.lifetimeAllTime = lifetimeAllTime;
  gameState.endingsSeen = endingsSeen;

  // Clear dynamic state that Object.assign doesn't remove
  gameState.endingTriggered = null;
  gameState.endingVariant = null;
  gameState.endingTime = null;
  gameState.bankrupted = false;

  resetQueueIdCounter();
  gameState.lastTick = Date.now();
  saveGame();
}

// Transition from Arc 1 to Arc 2 (one-way door)
export function transitionToArc2() {
  const seenCards = gameState.ui?.seenCards ? [...gameState.ui.seenCards] : [];
  const everUnlockedSections = gameState.ui?.everUnlockedSections ? [...gameState.ui.everUnlockedSections] : [];
  const discoveredFlavor = gameState.ui?.discoveredFlavor ? [...gameState.ui.discoveredFlavor] : [];
  const fresh = createDefaultGameState();

  // Reset everything except arcUnlocked
  Object.assign(gameState, fresh);
  gameState.ui.seenCards = seenCards;
  gameState.ui.everUnlockedSections = everUnlockedSections;
  gameState.ui.discoveredFlavor = discoveredFlavor;
  resetQueueIdCounter();
  gameState.arc = 2;
  gameState.arcUnlocked = 2;

  // Explicitly clear ending state (createDefaultGameState doesn't include these,
  // so old values survive Object.assign)
  gameState.endingTriggered = null;
  gameState.endingVariant = null;
  gameState.endingTime = null;
  gameState.prestigeCount = 0;

  // Set Arc 2 default allocations (alignment now visible)
  gameState.tracks.capabilities.researcherAllocation = 0.4;
  gameState.tracks.applications.researcherAllocation = 0.3;
  gameState.tracks.alignment.researcherAllocation = 0.3;

  // Arc 2 starts fresh - no Arc 1 upgrades carry over
  // Note: initializeNewsFeed() is NOT called here because the page reloads
  // after Arc 2 transition, and main.js will call it during startup.
  // Calling it here would cause duplicate "lab begins operations" news.
  gameState.onboardingComplete = true; // If they got to Arc 2, they've seen onboarding

  gameState.lastTick = Date.now();
  saveGame();
}

// Export for testing
if (typeof window !== 'undefined') {
  window.calculatePrestigeGain = calculatePrestigeGain;
  window.applyPrestigeGains = applyPrestigeGains;
  window.resetForPrestige = resetForPrestige;
  window.resetForExtinction = resetForExtinction;
  window.transitionToArc2 = transitionToArc2;
}
