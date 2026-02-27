// Strategic Choices System
// Permanent, mutually exclusive decisions that shape player playstyle.

import { gameState } from './game-state.js';
import { STRATEGIC_CHOICES, ALIGNMENT } from '../data/balance.js';
import { applyHiddenAlignmentEffect } from './capabilities.js';
import { strategicChoiceDefinitions } from '../data/strategic-choices.js';
import { addNewsItem } from './news-feed.js';
import { addActionMessage, hasMessageBeenTriggered, markMessageTriggered } from './messages.js';
import { strategicChoiceMessages } from './content/message-content.js';
import { newsContent } from './content/news-content.js';
import { milestone } from './analytics.js';

// Check if a capability is unlocked in any track
function isCapUnlocked(capId) {
  for (const trackId of Object.keys(gameState.tracks)) {
    if (gameState.tracks[trackId]?.unlockedCapabilities?.includes(capId)) {
      return true;
    }
  }
  return false;
}

// Check if a fundraise series has been completed
function isSeriesCompleted(seriesId) {
  return gameState.fundraiseRounds?.[seriesId]?.raised === true;
}

// Get player and competitor AGI progress
function getProgressValues() {
  const playerProgress = gameState.agiProgress || 0;
  const competitorProgress = gameState.competitor?.progressToAGI || 0;
  return { playerProgress, competitorProgress };
}

// Check unlock conditions for all choices, update game state
export function checkChoiceUnlocks() {
  for (const choice of strategicChoiceDefinitions) {
    // Skip disabled choices
    if (choice.enabled === false) continue;

    const existing = gameState.strategicChoices[choice.id];
    // Skip if already available or chosen
    if (existing) continue;

    // Check if we already sent the message for this choice
    const messageKey = `strategic_choice:${choice.id}`;
    if (hasMessageBeenTriggered(messageKey)) continue;

    const unlock = choice.unlock;
    let trigger = null;

    // Step 1: Check series gate (required minimum, unless alternative gate is met)
    let seriesGateMet = false;
    if (unlock.seriesCompleted) {
      seriesGateMet = isSeriesCompleted(unlock.seriesCompleted);
    } else {
      // No series gate required
      seriesGateMet = true;
    }

    // Alternative gate: competitor above threshold (for choice 3)
    if (!seriesGateMet && unlock.seriesOrCompetitor !== undefined) {
      const { competitorProgress } = getProgressValues();
      if (competitorProgress >= unlock.seriesOrCompetitor) {
        seriesGateMet = true;
        trigger = 'pressure'; // Competitor pressure triggered this
      }
    }

    // If series gate not met, skip this choice
    if (!seriesGateMet) continue;

    // Step 2: Check additional criteria (research milestone OR pressure trigger)

    // Check research milestone
    if (!trigger && unlock.research && isCapUnlocked(unlock.research)) {
      trigger = 'research';
    }

    // Check competitor pressure (competitor ahead by X points)
    if (!trigger && unlock.competitorAhead !== undefined) {
      const { playerProgress, competitorProgress } = getProgressValues();
      if (competitorProgress > playerProgress + unlock.competitorAhead) {
        trigger = 'pressure';
      }
    }

    if (trigger) {
      // Mark the choice as available in game state
      gameState.strategicChoices[choice.id] = { selected: null, trigger };

      // Send action message for this strategic choice
      const messageTemplate = strategicChoiceMessages[choice.id];
      if (messageTemplate) {
        addActionMessage(
          messageTemplate.sender,
          messageTemplate.subject,
          messageTemplate.body,
          messageTemplate.signature,
          messageTemplate.choices,
          messageTemplate.priority || 'normal',
          messageTemplate.tags || ['strategic'],
          messageKey
        );
        markMessageTriggered(messageKey);
      } else {
        // Fallback to old news item if no message template
        addNewsItem(`Internal: Board requests decision on ${choice.name}`, 'internal');
      }
    }
  }
}

// Check if a choice is available (unlocked but not yet chosen)
export function isChoiceAvailable(choiceId) {
  const entry = gameState.strategicChoices[choiceId];
  return entry != null && entry.selected === null;
}

// Check if a choice has been made
export function isChoiceChosen(choiceId) {
  const entry = gameState.strategicChoices[choiceId];
  return entry != null && entry.selected != null;
}

// Get the chosen option ID for a choice (or null)
export function getChosenOption(choiceId) {
  const entry = gameState.strategicChoices[choiceId];
  return entry?.selected || null;
}

// Make a strategic choice. Returns true on success, false if invalid.
export function makeStrategicChoice(choiceId, optionId) {
  // Must be available
  if (!isChoiceAvailable(choiceId)) return false;

  // Validate option exists
  const choiceDef = strategicChoiceDefinitions.find(c => c.id === choiceId);
  if (!choiceDef) return false;

  const optionDef = choiceDef.options.find(o => o.id === optionId);
  if (!optionDef) return false;

  gameState.strategicChoices[choiceId].selected = optionId;
  milestone('strategic_choice', { choice_id: choiceId, option_id: optionId }, `strategic_choice_${choiceId}`);

  // Trigger news item with delay (5-15s) so it feels like external news reacting
  const newsEntry = newsContent.strategic_choice[optionId];
  if (newsEntry) {
    const delay = 5000 + Math.random() * 10000; // 5-15 seconds
    setTimeout(() => {
      addNewsItem(newsEntry.text, newsEntry.type);
    }, delay);
  }

  // Apply hidden alignment effect from strategic choice
  const alignmentEffects = {
    government_partnership: ALIGNMENT.GOVERNMENT_ALIGNMENT_EFFECT,
    independent_lab: ALIGNMENT.INDEPENDENT_ALIGNMENT_EFFECT,
    rapid_deployment: ALIGNMENT.RAPID_ALIGNMENT_EFFECT,
    careful_validation: ALIGNMENT.CAREFUL_ALIGNMENT_EFFECT,
  };
  if (alignmentEffects[optionId]) {
    applyHiddenAlignmentEffect(optionId, alignmentEffects[optionId]);
  }

  return true;
}

// --- Multiplier Getters ---
// Each returns the combined multiplier from all active strategic choices.
// Called by resource calculation functions.

export function getResearchRateMultiplier() {
  let mult = 1.0;
  if (getChosenOption('open_vs_proprietary') === 'open_research') {
    mult *= STRATEGIC_CHOICES.OPEN_RESEARCH_RATE_BONUS;
  }
  if (getChosenOption('open_vs_proprietary') === 'proprietary_models') {
    mult *= STRATEGIC_CHOICES.PROPRIETARY_RESEARCH_PENALTY;
  }
  if (getChosenOption('government_vs_independent') === 'independent_lab') {
    mult *= STRATEGIC_CHOICES.INDEPENDENT_RESEARCH_BONUS;
  }
  return mult;
}

export function getPersonnelCostMultiplier() {
  if (getChosenOption('open_vs_proprietary') === 'open_research') {
    return STRATEGIC_CHOICES.OPEN_RESEARCHER_COST_REDUCTION;
  }
  return 1.0;
}

export function getComputeCapacityMultiplier() {
  if (getChosenOption('government_vs_independent') === 'government_partnership') {
    return STRATEGIC_CHOICES.GOVERNMENT_COMPUTE_BONUS;
  }
  return 1.0;
}

export function getTokenRevenueMultiplier() {
  let mult = 1.0;
  if (getChosenOption('open_vs_proprietary') === 'proprietary_models') {
    mult *= STRATEGIC_CHOICES.PROPRIETARY_TOKEN_REVENUE_BONUS;
  }
  return mult;
}

export function getDemandMultiplier() {
  if (getChosenOption('rapid_vs_careful') === 'rapid_deployment') {
    return STRATEGIC_CHOICES.RAPID_DEMAND_BONUS;
  }
  return 1.0;
}

export function getAcquiredDemandGrowthMultiplier() {
  if (getChosenOption('rapid_vs_careful') === 'rapid_deployment') {
    return STRATEGIC_CHOICES.RAPID_ACQUIRED_DEMAND_GROWTH_BONUS;
  }
  return 1.0;
}

export function getMarketEdgeDecayMultiplier() {
  if (getChosenOption('rapid_vs_careful') === 'rapid_deployment') {
    return STRATEGIC_CHOICES.RAPID_EDGE_DECAY_REDUCTION;
  }
  return 1.0;
}

export function getGovernmentFundingBonus() {
  if (getChosenOption('government_vs_independent') === 'government_partnership') {
    return STRATEGIC_CHOICES.GOVERNMENT_FUNDING_RATE;
  }
  return 0;
}

export function getIncidentRateMultiplier() {
  if (getChosenOption('rapid_vs_careful') === 'careful_validation') {
    return STRATEGIC_CHOICES.CAREFUL_INCIDENT_REDUCTION;
  }
  return 1.0;
}

export function getMarketEdgeBoostMultiplier() {
  if (getChosenOption('open_vs_proprietary') === 'proprietary_models') {
    return STRATEGIC_CHOICES.PROPRIETARY_MARKET_EDGE_BONUS;
  }
  return 1.0;
}

// Get choice definitions (for UI)
export function getStrategicChoiceDefinitions() {
  return strategicChoiceDefinitions;
}

// Get the trigger type for a choice (for UI urgency styling)
export function getChoiceTrigger(choiceId) {
  return gameState.strategicChoices[choiceId]?.trigger || null;
}

// Get count of pending (available but unchosen) choices
export function getPendingChoiceCount() {
  let count = 0;
  for (const choiceId of Object.keys(gameState.strategicChoices)) {
    if (isChoiceAvailable(choiceId)) count++;
  }
  return count;
}

if (typeof window !== 'undefined') {
  window.makeStrategicChoice = makeStrategicChoice;
  window.isChoiceAvailable = isChoiceAvailable;
  window.isChoiceChosen = isChoiceChosen;
  window.getChosenOption = getChosenOption;
  window.getStrategicChoiceDefinitions = getStrategicChoiceDefinitions;
  window.getPendingChoiceCount = getPendingChoiceCount;
  window.getChoiceTrigger = getChoiceTrigger;
}
