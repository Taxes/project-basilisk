// Player-facing text: see docs/message-registry.json
// Message Choice Effects
// Applies effects from action message choices

import { gameState } from './game-state.js';
import { addNewsMessage } from './messages.js';
import { applyMoratoriumEffect } from './moratoriums.js';
import { incrementCount } from './purchasable-state.js';

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

  // Apply research rate multiplier
  if (effects.researchRateMultiplier) {
    gameState.eventMultipliers.researchRate *= effects.researchRateMultiplier;
  }

  // Apply compute rate multiplier
  if (effects.computeRateMultiplier) {
    gameState.eventMultipliers.computeRate *= effects.computeRateMultiplier;
  }

  // Strategic choice effects
  if (effects.strategicChoice) {
    const { choiceId, optionId } = effects.strategicChoice;
    if (gameState.strategicChoices[choiceId]) {
      gameState.strategicChoices[choiceId].selected = optionId;
    } else {
      gameState.strategicChoices[choiceId] = { selected: optionId, trigger: 'message' };
    }
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

  // Add news message if specified
  if (effects.newsMessage) {
    addNewsMessage(effects.newsMessage, effects.newsTags || ['internal']);
  }

  // Grant free researcher(s)
  if (effects.grantResearcher) {
    for (let i = 0; i < effects.grantResearcher; i++) {
      incrementCount('junior_researcher');
    }
  }

  // Moratorium effect
  if (effects.moratorium) {
    applyMoratoriumEffect(effects.moratorium.id, effects.moratorium.action);
  }
}


// Export for testing
if (typeof window !== 'undefined') {
  window.applyMessageChoiceEffects = applyMessageChoiceEffects;
}
