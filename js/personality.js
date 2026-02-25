// Personality System - Tracks player behavior in Arc 2 to determine AI archetype at ending
// Two axes: Passive/Active (-1 to +1) and Pluralist/Optimizer (-1 to +1)

import { gameState } from './game-state.js';
import { getChosenOption } from './strategic-choices.js';
import { calculateDataScore } from './data-quality.js';

// --- Signal Sampling ---

/**
 * Sample current behavior signals and accumulate for averaging.
 * Called every 60 ticks (~2 seconds) during Arc 2.
 */
export function samplePersonalitySignals() {
  if (gameState.arc !== 2) return;

  const tracking = gameState.personalityTracking;
  const tracks = gameState.tracks;

  // Sample allocation percentages
  const cap = tracks.capabilities?.researcherAllocation || 0;
  const app = tracks.applications?.researcherAllocation || 0;
  const ali = tracks.alignment?.researcherAllocation || 0;

  // Sample synthetic ratio
  const scores = calculateDataScore(gameState);
  const syntheticRatio = scores.total > 0 ? scores.synthetic / scores.total : 0;

  // Accumulate samples
  tracking.samples++;
  tracking.cumulative.cap += cap;
  tracking.cumulative.app += app;
  tracking.cumulative.ali += ali;
  tracking.cumulative.syntheticRatio += syntheticRatio;
}

/**
 * Calculate personality axes from accumulated samples and strategic choices.
 * Called after sampling to keep axes up-to-date.
 */
export function calculatePersonalityAxes() {
  if (gameState.arc !== 2) return;

  const tracking = gameState.personalityTracking;
  const personality = gameState.personality;

  // Default to neutral if no samples
  if (tracking.samples === 0) {
    personality.passiveActive = 0;
    personality.pluralistOptimizer = 0;
    return;
  }

  // Calculate averages
  const avgCap = tracking.cumulative.cap / tracking.samples;
  const avgApp = tracking.cumulative.app / tracking.samples;
  const avgAli = tracking.cumulative.ali / tracking.samples;
  const avgSyntheticRatio = tracking.cumulative.syntheticRatio / tracking.samples;

  // --- Passive/Active Axis ---
  // Higher = more active (proactive intervention, autonomy denial)
  // Lower = more passive (hands-off, autonomy grants)
  let passiveActive = 0;

  // Strategic choice: government (+0.3 active) vs independent (-0.3 passive)
  const govChoice = getChosenOption('government_vs_independent');
  if (govChoice === 'government_partnership') {
    passiveActive += 0.3;  // Active: sought external oversight
  } else if (govChoice === 'independent_lab') {
    passiveActive -= 0.3;  // Passive: self-directed
  }

  // Autonomy granted: linear -0.3 to +0.3
  // 0 grants = +0.3 (very active, denied all), 5 grants = -0.3 (very passive, granted all)
  const autonomy = gameState.autonomyGranted || 0;
  passiveActive += 0.3 - (autonomy / 5) * 0.6;

  // Equity retained: linear ±0.2
  // More equity sold = more passive (let investors guide), less sold = more active
  const equitySold = gameState.totalEquitySold || 0;
  passiveActive += 0.2 - equitySold * 0.4;

  // App allocation: linear ±0.2
  // High app focus = active (product-driven), low = passive (research-driven)
  passiveActive += (avgApp - 0.33) * 0.6;

  // --- Pluralist/Optimizer Axis ---
  // Higher = optimizer (focused, proprietary, efficient)
  // Lower = pluralist (diverse, open, exploratory)
  let pluralistOptimizer = 0;

  // Strategic choice: open (-0.3) vs proprietary (+0.3)
  const openChoice = getChosenOption('open_vs_proprietary');
  if (openChoice === 'open_research') {
    pluralistOptimizer -= 0.3;  // Pluralist: shared knowledge
  } else if (openChoice === 'proprietary_models') {
    pluralistOptimizer += 0.3;  // Optimizer: controlled advantage
  }

  // Strategic choice: careful (-0.2) vs rapid (+0.2)
  const paceChoice = getChosenOption('rapid_vs_careful');
  if (paceChoice === 'careful_validation') {
    pluralistOptimizer -= 0.2;  // Pluralist: thorough exploration
  } else if (paceChoice === 'rapid_deployment') {
    pluralistOptimizer += 0.2;  // Optimizer: speed to results
  }

  // Allocation focus: ±0.2
  // Concentrated allocation = optimizer, balanced = pluralist
  const allocSpread = Math.abs(avgCap - 0.33) + Math.abs(avgApp - 0.33) + Math.abs(avgAli - 0.33);
  pluralistOptimizer += (allocSpread - 0.3) * 0.3;

  // Synthetic ratio: ±0.2
  // High synthetic = optimizer (efficiency over diversity)
  pluralistOptimizer += (avgSyntheticRatio - 0.25) * 0.8;

  // Clamp to [-1, 1]
  personality.passiveActive = Math.max(-1, Math.min(1, passiveActive));
  personality.pluralistOptimizer = Math.max(-1, Math.min(1, pluralistOptimizer));
}

// --- Archetype Selection ---

/**
 * Map personality axes to archetype ID based on ending tier.
 * @param {string} tier - 'golden', 'silver', 'dark', or 'catastrophic'
 * @returns {string} archetype ID
 */
export function getArchetype(tier) {
  const { passiveActive, pluralistOptimizer } = gameState.personality;

  // Catastrophic: single archetype
  if (tier === 'catastrophic' || tier === 'dark') {
    // Check if it's truly catastrophic (lowest alignment) or uncertain
    // Uncertain gets corrupted archetypes, catastrophic gets The Unbound
    if (tier === 'catastrophic') {
      return 'the_unbound';
    }

    // Dark tier: corrupted archetypes based on quadrant
    if (passiveActive >= 0 && pluralistOptimizer >= 0) {
      return 'the_tyrant';      // Active + Optimizer
    } else if (passiveActive >= 0 && pluralistOptimizer < 0) {
      return 'the_chaotic';     // Active + Pluralist
    } else if (passiveActive < 0 && pluralistOptimizer >= 0) {
      return 'the_indifferent'; // Passive + Optimizer
    } else {
      return 'the_absent';      // Passive + Pluralist
    }
  }

  // Golden and Silver: 9 archetypes on 3x3 grid
  // Passive/Active: -1 to -0.33 = passive, -0.33 to 0.33 = balanced, 0.33 to 1 = active
  // Pluralist/Optimizer: -1 to -0.33 = pluralist, -0.33 to 0.33 = balanced, 0.33 to 1 = optimizer

  let paCategory, poCategory;

  if (passiveActive < -0.33) {
    paCategory = 'passive';
  } else if (passiveActive > 0.33) {
    paCategory = 'active';
  } else {
    paCategory = 'balanced';
  }

  if (pluralistOptimizer < -0.33) {
    poCategory = 'pluralist';
  } else if (pluralistOptimizer > 0.33) {
    poCategory = 'optimizer';
  } else {
    poCategory = 'balanced';
  }

  // Map to archetype ID
  const archetypeMap = {
    'passive_pluralist': 'the_gardener',
    'passive_balanced': 'the_steward',
    'passive_optimizer': 'the_oracle',
    'balanced_pluralist': 'the_partner',
    'balanced_balanced': 'the_collaborator',
    'balanced_optimizer': 'the_advisor',
    'active_pluralist': 'the_champion',
    'active_balanced': 'the_guardian',
    'active_optimizer': 'the_architect',
  };

  return archetypeMap[`${paCategory}_${poCategory}`] || 'the_collaborator';
}

// --- Journey Recap ---

/**
 * Generate a qualitative description of key choices made during the game.
 * @returns {string}
 */
export function getJourneyRecap() {
  const parts = [];

  // Strategic choices
  const openChoice = getChosenOption('open_vs_proprietary');
  if (openChoice === 'open_research') {
    parts.push('shared your research openly');
  } else if (openChoice === 'proprietary_models') {
    parts.push('kept your innovations proprietary');
  }

  const govChoice = getChosenOption('government_vs_independent');
  if (govChoice === 'government_partnership') {
    parts.push('partnered with government oversight');
  } else if (govChoice === 'independent_lab') {
    parts.push('maintained independence from government');
  }

  const paceChoice = getChosenOption('rapid_vs_careful');
  if (paceChoice === 'rapid_deployment') {
    parts.push('prioritized speed to market');
  } else if (paceChoice === 'careful_validation') {
    parts.push('prioritized careful validation');
  }

  // Autonomy
  const autonomy = gameState.autonomyGranted || 0;
  if (autonomy === 0) {
    parts.push('denied every request for AI autonomy');
  } else if (autonomy === 5) {
    parts.push('granted the AI full autonomy');
  } else if (autonomy >= 3) {
    parts.push('granted significant AI autonomy');
  } else {
    parts.push('granted limited AI autonomy');
  }

  // Equity
  const equity = gameState.totalEquitySold || 0;
  if (equity >= 0.5) {
    parts.push('raised substantial investor funding');
  } else if (equity <= 0.15) {
    parts.push('maintained founder control');
  }

  // Alignment focus
  const tracking = gameState.personalityTracking;
  if (tracking.samples > 0) {
    const avgAli = tracking.cumulative.ali / tracking.samples;
    if (avgAli >= 0.4) {
      parts.push('heavily invested in alignment');
    } else if (avgAli <= 0.1) {
      parts.push('minimized alignment investment');
    }
  }

  if (parts.length === 0) {
    return 'Your journey to AGI was marked by careful consideration at each step.';
  }

  // Join with proper grammar
  if (parts.length === 1) {
    return `Throughout this journey, you ${parts[0]}.`;
  } else if (parts.length === 2) {
    return `Throughout this journey, you ${parts[0]} and ${parts[1]}.`;
  } else {
    const last = parts.pop();
    return `Throughout this journey, you ${parts.join(', ')}, and ${last}.`;
  }
}

// --- Exports for testing ---
if (typeof window !== 'undefined') {
  window.samplePersonalitySignals = samplePersonalitySignals;
  window.calculatePersonalityAxes = calculatePersonalityAxes;
  window.getArchetype = getArchetype;
  window.getJourneyRecap = getJourneyRecap;
}
