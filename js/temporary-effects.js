// js/temporary-effects.js
// Generic temporary multiplier system
// Used by moratoriums, autonomy revocation, consequence events

import { gameState } from './game-state.js';

// --- Write API ---

function ensureArray() {
  if (!gameState.temporaryMultipliers) gameState.temporaryMultipliers = [];
}

/** Add a fixed multiplier that expires after `duration` seconds of game time. */
export function addTemporaryMultiplier(type, mult, duration, extras = {}) {
  ensureArray();
  gameState.temporaryMultipliers.push({
    type, mult,
    expiresAt: gameState.timeElapsed + duration,
    ...extras,
  });
}

/** Add a multiplier that fades linearly from `mult` toward 1.0 over `duration` seconds. */
export function addFadingMultiplier(type, mult, duration, extras = {}) {
  ensureArray();
  gameState.temporaryMultipliers.push({
    type, mult,
    fadesLinearly: true,
    startedAt: gameState.timeElapsed,
    duration,
    ...extras,
  });
}

/** Remove all multipliers of a given type. */
export function stripTemporaryMultipliers(type) {
  if (!gameState.temporaryMultipliers) return;
  gameState.temporaryMultipliers = gameState.temporaryMultipliers.filter(m => m.type !== type);
}

// --- Read API ---

/**
 * Get the combined active multiplier for a given type.
 * Returns 1.0 if no active multipliers of that type exist.
 */
export function getActiveTemporaryMultiplier(type) {
  const mults = gameState.temporaryMultipliers || [];
  let combined = 1.0;

  for (const m of mults) {
    if (m.type !== type) continue;

    if (m.fadesLinearly) {
      const elapsed = gameState.timeElapsed - m.startedAt;
      const progress = Math.max(0, Math.min(1, elapsed / m.duration));
      // Lerp from mult toward 1.0
      combined *= m.mult + (1.0 - m.mult) * progress;
    } else {
      // Fixed multiplier until expiry
      if (gameState.timeElapsed < m.expiresAt) {
        combined *= m.mult;
      }
    }
  }

  return combined;
}

/**
 * Remove expired temporary multipliers. Call once per tick.
 */
export function processTemporaryMultipliers() {
  if (!gameState.temporaryMultipliers) return;
  gameState.temporaryMultipliers = gameState.temporaryMultipliers.filter(m => {
    if (m.fadesLinearly) {
      return (gameState.timeElapsed - m.startedAt) < m.duration;
    }
    return gameState.timeElapsed < m.expiresAt;
  });
}

if (typeof window !== 'undefined') {
  window.addTemporaryMultiplier = addTemporaryMultiplier;
  window.addFadingMultiplier = addFadingMultiplier;
  window.stripTemporaryMultipliers = stripTemporaryMultipliers;
  window.getActiveTemporaryMultiplier = getActiveTemporaryMultiplier;
  window.processTemporaryMultipliers = processTemporaryMultipliers;
}
