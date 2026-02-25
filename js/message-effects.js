// Player-facing text: see docs/message-registry.json
// Message Choice Effects
// Applies effects from action message choices

import { gameState } from './game-state.js';
import { addNewsMessage } from './messages.js';
import { applyMoratoriumEffect } from './moratoriums.js';

/**
 * Apply effects from a message choice
 * Supports: resources, capabilities, multipliers, strategic choices, pause capabilities
 */
export function applyMessageChoiceEffects(effects) {
  if (!effects) return;

  // Apply resource changes (funding, compute, etc.)
  if (effects.resources) {
    for (const resource in effects.resources) {
      if (gameState.resources[resource] !== undefined) {
        gameState.resources[resource] += effects.resources[resource];
      }
    }
  }

  // Apply capability unlocks
  if (effects.capabilities) {
    for (const capId in effects.capabilities) {
      if (effects.capabilities[capId].unlocked) {
        // Find which track has this capability and unlock it
        for (const trackId of Object.keys(gameState.tracks)) {
          const track = gameState.tracks[trackId];
          if (track && !track.unlockedCapabilities.includes(capId)) {
            // Check if this track should have this capability
            // For now, just add to capabilities track
            if (trackId === 'capabilities') {
              track.unlockedCapabilities.push(capId);
            }
          }
        }
      }
    }
  }

  // Initialize event multipliers if needed
  if (!gameState.eventMultipliers) {
    gameState.eventMultipliers = {
      researchRate: 1.0,
      computeRate: 1.0,
      capabilitiesPaused: false,
      capabilitiesPauseEndTime: 0,
    };
  }

  // Apply research rate multiplier
  if (effects.researchRateMultiplier) {
    gameState.eventMultipliers.researchRate *= effects.researchRateMultiplier;
  }

  // Apply compute rate multiplier
  if (effects.computeRateMultiplier) {
    gameState.eventMultipliers.computeRate *= effects.computeRateMultiplier;
  }

  // Pause capabilities research (real mechanical effect)
  // Sets cap RP generation to 0 for specified duration, bypasses culture shift
  if (effects.pauseCapabilities) {
    const duration = effects.pauseCapabilities.duration || 30000; // Default 30 seconds
    gameState.eventMultipliers.capabilitiesPaused = true;
    gameState.eventMultipliers.capabilitiesPauseEndTime = gameState.timeElapsed + duration;
    addNewsMessage('Capabilities research paused for safety review', ['internal']);
  }

  // Strategic choice effects
  // Note: The hiddenAlignment effect in the choice will handle alignment changes,
  // so we just need to set the selected option here.
  if (effects.strategicChoice) {
    const { choiceId, optionId } = effects.strategicChoice;
    if (gameState.strategicChoices[choiceId]) {
      gameState.strategicChoices[choiceId].selected = optionId;
    } else {
      gameState.strategicChoices[choiceId] = { selected: optionId, trigger: 'message' };
    }
  }

  // Competitor boost
  if (effects.competitorBoost) {
    if (!gameState.competitor) {
      gameState.competitor = { capabilityLevel: 0, position: "behind", progressToAGI: 0 };
    }
    gameState.competitor.progressToAGI += effects.competitorBoost;
  }

  // Choice tracking (for endings)
  if (effects.choices) {
    for (const choice in effects.choices) {
      if (!gameState.choices[choice]) {
        gameState.choices[choice] = 0;
      }
      gameState.choices[choice] += effects.choices[choice];
    }
  }

  // Hidden alignment effect
  if (effects.hiddenAlignment) {
    gameState.hiddenAlignment = (gameState.hiddenAlignment || 0) + effects.hiddenAlignment;
  }

  // Funding rate modifier (temporary or permanent)
  if (effects.fundingRateMultiplier) {
    // For now, store as event multiplier
    if (!gameState.eventMultipliers.fundingRate) {
      gameState.eventMultipliers.fundingRate = 1.0;
    }
    gameState.eventMultipliers.fundingRate *= effects.fundingRateMultiplier;
  }

  // Add news message if specified
  if (effects.newsMessage) {
    addNewsMessage(effects.newsMessage, effects.newsTags || ['internal']);
  }

  // Moratorium effect
  if (effects.moratorium) {
    applyMoratoriumEffect(effects.moratorium.id, effects.moratorium.action);
  }
}

// Check if capabilities are currently paused
export function areCapabilitiesPaused() {
  if (!gameState.eventMultipliers) return false;
  if (!gameState.eventMultipliers.capabilitiesPaused) return false;

  // Check if pause has expired
  if (gameState.timeElapsed >= gameState.eventMultipliers.capabilitiesPauseEndTime) {
    gameState.eventMultipliers.capabilitiesPaused = false;
    addNewsMessage('Capabilities research resumed', ['internal']);
    return false;
  }

  return true;
}

// Get capabilities pause time remaining (ms)
export function getCapabilitiesPauseRemaining() {
  if (!areCapabilitiesPaused()) return 0;
  return gameState.eventMultipliers.capabilitiesPauseEndTime - gameState.timeElapsed;
}

// Export for testing
if (typeof window !== 'undefined') {
  window.applyMessageChoiceEffects = applyMessageChoiceEffects;
  window.areCapabilitiesPaused = areCapabilitiesPaused;
  window.getCapabilitiesPauseRemaining = getCapabilitiesPauseRemaining;
}
