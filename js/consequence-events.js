// Consequence Events — Ratio-based alignment failure events
// Part of the alignment consequences system (Arc 2 only)

import { gameState } from './game-state.js';
import { CONSEQUENCE_EVENTS, TIER_TO_POOL, TIER4_AUTONOMY_THRESHOLD } from './content/consequence-events.js';
import { getAlignmentRatioTier, getAlignmentRatio } from './resources.js';
import { addNewsMessage } from './messages.js';
import { BALANCE } from '../data/balance.js';

// Track which one-shot events have fired
let firedOneShotEvents = new Set();

/**
 * Check if consequence events should fire based on alignment ratio
 * Uses Poisson process with ratio-scaled probability
 * Called each tick from game loop (Arc 2 only)
 * @param {number} deltaTime - Time since last tick in seconds
 */
export function checkConsequenceEvents(deltaTime) {
  // Only in Arc 2
  if (gameState.arc < 2) return;

  // Check cooldown
  const now = gameState.timeElapsed;
  if (gameState.consequenceEventCooldown && now < gameState.consequenceEventCooldown) {
    return;
  }

  // Check circuit breaker
  if (isCircuitBreakerActive()) {
    return;
  }

  // Get current tier and corresponding pool
  const tier = getAlignmentRatioTier();
  if (tier === 'healthy') return;

  // Calculate firing probability
  const probability = calculateEventProbability(deltaTime);

  // Roll for event
  if (Math.random() > probability) return;

  // Select and fire event
  const event = selectEvent(tier);
  if (event) {
    fireConsequenceEvent(event);
  }
}

/**
 * Calculate event firing probability for this tick
 * Scales with ratio above threshold, reduced by high alignment allocation
 */
function calculateEventProbability(deltaTime) {
  const config = BALANCE.CONSEQUENCE_EVENTS;
  const ratio = getAlignmentRatio();
  const thresholds = BALANCE.ALIGNMENT_RATIO_THRESHOLDS;

  // Base probability per tick
  let probability = config.BASE_PROBABILITY_PER_TICK * deltaTime * 30; // Normalize to ~30 ticks/s

  // Scale by ratio above threshold
  const excessRatio = Math.max(0, ratio - thresholds.MODERATE);
  probability *= (1 + excessRatio * config.RATIO_MULTIPLIER);

  // Reduce if high alignment allocation (recovery mechanic)
  const alignmentAlloc = gameState.tracks?.alignment?.researcherAllocation || 0;
  if (alignmentAlloc > config.HIGH_ALIGNMENT_THRESHOLD) {
    probability *= config.HIGH_ALIGNMENT_REDUCTION;
  }

  return probability;
}

/**
 * Check if circuit breaker is active (too many recent events)
 */
function isCircuitBreakerActive() {
  const config = BALANCE.CONSEQUENCE_EVENTS;
  const now = gameState.timeElapsed;
  const periodStart = now - (config.PERIOD_SECONDS * 1000);

  // Clean old entries
  gameState.consequenceEventLog = (gameState.consequenceEventLog || [])
    .filter(ts => ts > periodStart);

  return gameState.consequenceEventLog.length >= config.MAX_EVENTS_PER_PERIOD;
}

/**
 * Select an event from the appropriate pool
 * Critical tier can access tier 4 if autonomy threshold met
 */
function selectEvent(tier) {
  let poolName = TIER_TO_POOL[tier];
  let pool = CONSEQUENCE_EVENTS[poolName];

  // Critical tier: chance to get tier 4 events if autonomy granted
  if (tier === 'critical') {
    const autonomy = gameState.autonomyGranted || 0;
    if (autonomy >= TIER4_AUTONOMY_THRESHOLD && Math.random() < 0.3) {
      pool = CONSEQUENCE_EVENTS.tier4_deceptive;
      poolName = 'tier4_deceptive';
    }
  }

  if (!pool || pool.length === 0) return null;

  // Filter out one-shot events that have already fired
  const available = pool.filter(e => !e.oneShot || !firedOneShotEvents.has(e.id));
  if (available.length === 0) return null;

  // Random selection
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Fire a consequence event
 */
function fireConsequenceEvent(event) {
  const config = BALANCE.CONSEQUENCE_EVENTS;
  const now = gameState.timeElapsed;

  // Mark one-shot events
  if (event.oneShot) {
    firedOneShotEvents.add(event.id);
  }

  // Record for circuit breaker
  gameState.consequenceEventLog = gameState.consequenceEventLog || [];
  gameState.consequenceEventLog.push(now);

  // Set cooldown
  gameState.consequenceEventCooldown = now + (config.COOLDOWN_SECONDS * 1000);

  // Show news
  addNewsMessage(event.text, ['consequence', 'alignment_failure']);

  // Apply consequences
  applyConsequence(event.consequence);
}

/**
 * Apply event consequences
 */
function applyConsequence(consequence) {
  if (!consequence) return;

  // Temporary revenue multiplier
  if (consequence.revenueMult && consequence.revenueMultDuration) {
    const existing = gameState.eventMultipliers?.revenue || 1.0;
    gameState.eventMultipliers = gameState.eventMultipliers || {};
    gameState.eventMultipliers.revenue = existing * consequence.revenueMult;

    // Schedule removal
    setTimeout(() => {
      if (gameState.eventMultipliers) {
        gameState.eventMultipliers.revenue = (gameState.eventMultipliers.revenue || 1.0) / consequence.revenueMult;
      }
    }, consequence.revenueMultDuration * 1000);
  }

  // Funding hit (scaled to game phase)
  if (consequence.fundingHit) {
    const hit = getScaledFundingHit(consequence.fundingHit);
    gameState.resources.funding = gameState.resources.funding - hit;
  }

  // Research pause (capabilities only)
  if (consequence.researchPauseDuration) {
    // Add to existing pause or set new one
    const existingPause = gameState.capResearchPauseEnd || 0;
    const now = gameState.timeElapsed;
    const newEnd = Math.max(existingPause, now + (consequence.researchPauseDuration * 1000));
    gameState.capResearchPauseEnd = newEnd;
  }

  // Alignment research boost (for values_revelation event)
  if (consequence.alignmentResearchBoost) {
    gameState.eventMultipliers = gameState.eventMultipliers || {};
    gameState.eventMultipliers.alignmentResearch = (gameState.eventMultipliers.alignmentResearch || 1.0) * consequence.alignmentResearchBoost;
  }
}

/**
 * Get funding hit amount scaled to current game phase
 */
function getScaledFundingHit(type) {
  const fundingRate = gameState.computed?.revenue?.gross || 0;

  if (type === 'scale_large') {
    // For tier 4 events - 5x normal scale
    if (fundingRate < 5000) return 500000;
    if (fundingRate < 150000) return 25000000;
    return 1000000000;
  }

  // Normal scale
  if (fundingRate < 5000) {
    return 10000 + Math.random() * 90000;  // $10K - $100K
  }
  if (fundingRate < 150000) {
    return 500000 + Math.random() * 4500000;  // $500K - $5M
  }
  return 20000000 + Math.random() * 180000000;  // $20M - $200M
}

/**
 * Check if capabilities research is paused by consequence event
 */
export function isConsequenceResearchPaused() {
  if (!gameState.capResearchPauseEnd) return false;
  return gameState.timeElapsed < gameState.capResearchPauseEnd;
}

/**
 * Reset one-shot tracking (for new game)
 */
export function resetConsequenceEvents() {
  firedOneShotEvents.clear();
  gameState.consequenceEventLog = [];
  gameState.consequenceEventCooldown = 0;
  gameState.capResearchPauseEnd = 0;
}

// Export for testing
if (typeof window !== 'undefined') {
  window.checkConsequenceEvents = checkConsequenceEvents;
  window.isConsequenceResearchPaused = isConsequenceResearchPaused;
  window.resetConsequenceEvents = resetConsequenceEvents;
}
