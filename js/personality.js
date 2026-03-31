// Personality System - Tracks player behavior in Arc 2 to determine AI archetype at ending
// Two axes: Authority/Liberty (-1 to +1) and Pluralist/Optimizer (-1 to +1)

import { gameState } from './game-state.js';
import { getChosenOption } from './strategic-choices.js';
import { isEffectivelyIdle } from './ceo-focus.js';

// --- Signal Sampling ---

/**
 * Sample current behavior signals and accumulate for averaging.
 * Called every 60 ticks (~2 seconds) during Arc 2.
 */
export function samplePersonalitySignals() {
  if (gameState.arc !== 2) return;

  const tracking = gameState.personalityTracking;
  const tracks = gameState.tracks;
  const cum = tracking.cumulative;

  // Sample allocation percentages
  const cap = tracks.capabilities?.researcherAllocation || 0;
  const app = tracks.applications?.researcherAllocation || 0;
  const ali = tracks.alignment?.researcherAllocation || 0;

  tracking.samples++;
  cum.cap += cap;
  cum.app += app;
  cum.ali += ali;

  // Track total Arc 2 ticks (for ratio denominators)
  cum.totalArc2Ticks++;

  // Sample CEO focus time distribution (only when CEO is idle on selected activity)
  const idle = isEffectivelyIdle();
  if (idle) {
    const activity = gameState.ceoFocus.selectedActivity;
    if (cum.ceoFocusTime[activity] !== undefined) {
      cum.ceoFocusTime[activity]++;
    }
    cum.queueIdleTicks++;
  }
}

// --- Signal Weight Table ---
// Each signal contributes to one or both axes.
// axisA = Authority (+) / Liberty (-), axisB = Optimizer (+) / Pluralist (-)

/**
 * Compute CEO focus time fractions from accumulated samples.
 * Returns object with fraction for each activity (0-1), or null if no data.
 */
export function getCeoFocusFractions(cum) {
  if (!cum) return null;
  const ft = cum.ceoFocusTime;
  const totalFocus = ft.research + ft.grants + ft.ir + ft.operations + ft.public_positioning;
  if (totalFocus === 0) return null;
  return {
    research: ft.research / totalFocus,
    grants: ft.grants / totalFocus,
    ir: ft.ir / totalFocus,
    operations: ft.operations / totalFocus,
    public_positioning: ft.public_positioning / totalFocus,
  };
}

/**
 * Compute CEO mastery concentration from live mastery values.
 * Returns 0-1 where 1 = all mastery in one area, 0.2 = perfectly spread.
 */
export function getMasteryConcentration() {
  const m = gameState.ceoFocus?.mastery;
  if (!m) return 0;
  const values = [m.research, m.grants, m.ir, m.operations, m.public_positioning];
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  return Math.max(...values) / total;
}

/**
 * Calculate personality axes from accumulated samples and strategic choices.
 * Called after sampling to keep axes up-to-date.
 */
export function calculatePersonalityAxes() {
  if (gameState.arc !== 2) return;

  const tracking = gameState.personalityTracking;
  const personality = gameState.personality;
  const cum = tracking.cumulative;

  // Default to neutral if no samples
  if (tracking.samples === 0) {
    personality.authorityLiberty = 0;
    personality.pluralistOptimizer = 0;
    return;
  }

  // Calculate averages
  const avgCap = cum.cap / tracking.samples;
  const avgApp = cum.app / tracking.samples;
  const avgAli = cum.ali / tracking.samples;

  // CEO focus fractions (null if no idle time recorded yet)
  const ceo = getCeoFocusFractions(cum) || { research: 0, grants: 0, ir: 0, operations: 0, public_positioning: 0 };

  // Queue idle ratio
  const idleRatio = cum.totalArc2Ticks > 0 ? cum.queueIdleTicks / cum.totalArc2Ticks : 0;

  // CEO switching frequency (switches per sample)
  const switchFreq = tracking.samples > 0 ? cum.ceoSwitches / tracking.samples : 0;

  // CEO mastery concentration
  const masteryConc = getMasteryConcentration();

  // Discrete decisions
  const autonomy = gameState.autonomyGranted || 0;
  const equitySold = gameState.totalEquitySold || 0;
  const moratoriumsAccepted = (gameState.moratoriums.accepted || []).length;

  // Strategic choices
  const govChoice = getChosenOption('government_vs_independent');
  const openChoice = getChosenOption('open_vs_proprietary');
  const paceChoice = getChosenOption('rapid_vs_careful');

  // --- Axis A: Authority (+) / Liberty (-) ---
  let authorityLiberty = 0;

  // CEO Focus time — primary axis A contributions
  // Research/Grants/Ops → Authority, IR/PP → Liberty
  // Each maps: (fraction - 0.2) * weight, where 0.2 is the "neutral" even split
  authorityLiberty += (ceo.research - 0.2) * 0.75;     // ±0.15 max (Auth)
  authorityLiberty += (ceo.grants - 0.2) * 0.40;       // ±0.08 max (Auth mild)
  authorityLiberty += (ceo.operations - 0.2) * 0.40;   // ±0.08 max (Auth mild)
  authorityLiberty -= (ceo.ir - 0.2) * 0.60;           // ±0.12 max (Lib)
  authorityLiberty -= (ceo.public_positioning - 0.2) * 0.30; // ±0.06 max (Lib mild)

  // Queue idle ratio — high idle = Liberty (trusting automation)
  authorityLiberty -= (idleRatio - 0.3) * 0.17;        // ±0.12 max

  // Autonomy grants (0-5): 0 = Auth(+0.25), 5 = Lib(-0.25)
  authorityLiberty += 0.25 - (autonomy / 5) * 0.50;

  // Moratoriums accepted (0-3): first=0.10, second=0.10, final=0.05 → max 0.25
  const moratoriumWeights = [0.10, 0.10, 0.05];
  for (let i = 0; i < moratoriumsAccepted && i < 3; i++) {
    authorityLiberty += moratoriumWeights[i];
  }

  // Equity sold — high = Liberty (inviting outside influence)
  authorityLiberty -= equitySold * 0.30;                // 0 to -0.15 (max equity ~0.5)

  // Strategic choice: gov_vs_independent
  if (govChoice === 'government_partnership') {
    authorityLiberty += 0.25;
  } else if (govChoice === 'independent_lab') {
    authorityLiberty -= 0.25;
  }

  // --- Axis B: Optimizer (+) / Pluralist (-) ---
  let pluralistOptimizer = 0;

  // CEO mastery concentration — deep mastery = Optimizer
  // masteryConc ranges 0.2 (even) to 1.0 (all in one area)
  pluralistOptimizer += (masteryConc - 0.4) * 0.33;     // ±0.20 max

  // CEO switching frequency — high switching = Pluralist
  // Normalize: ~0.1 switches/sample = moderate, cap effect at ~0.3
  pluralistOptimizer -= Math.min(switchFreq, 0.3) * 0.50; // 0 to -0.15 max

  // CEO focus time — secondary axis B contributions
  pluralistOptimizer += (ceo.research - 0.2) * 0.25;    // ±0.05 max (Opt subtle)
  pluralistOptimizer += (ceo.operations - 0.2) * 0.25;  // ±0.05 max (Opt subtle)
  pluralistOptimizer -= (ceo.grants - 0.2) * 0.25;      // ±0.05 max (Plur subtle)
  pluralistOptimizer -= (ceo.public_positioning - 0.2) * 0.25; // ±0.05 max (Plur subtle)

  // Allocation spread — concentrated = Optimizer, balanced = Pluralist
  const allocSpread = Math.abs(avgCap - 0.33) + Math.abs(avgApp - 0.33) + Math.abs(avgAli - 0.33);
  pluralistOptimizer += (allocSpread - 0.3) * 0.25;     // ±0.15 max

  // Autonomy — secondary: high grants = Pluralist (trusting diverse approaches)
  pluralistOptimizer -= (autonomy / 5) * 0.08;          // 0 to -0.08

  // Moratoriums — secondary: accepted = Pluralist (pausing to consider broadly)
  pluralistOptimizer -= moratoriumsAccepted * 0.027;     // 0 to -0.08 (3 * 0.027)

  // Strategic choice: rapid_vs_careful
  if (paceChoice === 'rapid_deployment') {
    pluralistOptimizer += 0.20;
  } else if (paceChoice === 'careful_validation') {
    pluralistOptimizer -= 0.20;
  }

  // Strategic choice: open_vs_proprietary
  if (openChoice === 'proprietary_models') {
    pluralistOptimizer += 0.25;
  } else if (openChoice === 'open_research') {
    pluralistOptimizer -= 0.25;
  }

  // Clamp to [-1, 1]
  personality.authorityLiberty = Math.max(-1, Math.min(1, authorityLiberty));
  personality.pluralistOptimizer = Math.max(-1, Math.min(1, pluralistOptimizer));
}

// --- Archetype Selection ---

/**
 * Map personality axes to archetype ID based on ending tier.
 * @param {string} tier - 'golden', 'silver', 'dark', or 'catastrophic'
 * @returns {string} archetype ID
 */
export function getArchetype(tier) {
  const { authorityLiberty, pluralistOptimizer } = gameState.personality;

  // Catastrophic: single archetype
  if (tier === 'catastrophic' || tier === 'dark') {
    if (tier === 'catastrophic') {
      return 'the_unbound';
    }

    // Dark tier: corrupted archetypes based on quadrant
    if (authorityLiberty >= 0 && pluralistOptimizer >= 0) {
      return 'the_tyrant';      // Authority + Optimizer
    } else if (authorityLiberty >= 0 && pluralistOptimizer < 0) {
      return 'the_chaotic';     // Authority + Pluralist
    } else if (authorityLiberty < 0 && pluralistOptimizer >= 0) {
      return 'the_indifferent'; // Liberty + Optimizer
    } else {
      return 'the_absent';      // Liberty + Pluralist
    }
  }

  // Expedient override: high expedient + golden/silver → the_maximizer
  if ((tier === 'golden' || tier === 'silver') && (gameState.personality.expedient || 0) > 0.40) {
    return 'the_maximizer';
  }

  // Golden and Silver: 9 archetypes on 3x3 grid
  // Authority/Liberty: -1 to -0.33 = liberty, -0.33 to 0.33 = balanced, 0.33 to 1 = authority
  // Pluralist/Optimizer: -1 to -0.33 = pluralist, -0.33 to 0.33 = balanced, 0.33 to 1 = optimizer

  let alCategory, poCategory;

  if (authorityLiberty < -0.33) {
    alCategory = 'liberty';
  } else if (authorityLiberty > 0.33) {
    alCategory = 'authority';
  } else {
    alCategory = 'balanced';
  }

  if (pluralistOptimizer < -0.33) {
    poCategory = 'pluralist';
  } else if (pluralistOptimizer > 0.33) {
    poCategory = 'optimizer';
  } else {
    poCategory = 'balanced';
  }

  // Map to archetype ID (grid from design doc)
  const archetypeMap = {
    'authority_pluralist': 'the_shepherd',
    'authority_balanced': 'the_guardian',
    'authority_optimizer': 'the_architect',
    'balanced_pluralist': 'the_partner',
    'balanced_balanced': 'the_collaborator',
    'balanced_optimizer': 'the_advisor',
    'liberty_pluralist': 'the_gardener',
    'liberty_balanced': 'the_steward',
    'liberty_optimizer': 'the_oracle',
  };

  return archetypeMap[`${alCategory}_${poCategory}`] || 'the_collaborator';
}

// --- Journey Recap ---

/**
 * Generate a qualitative description of key choices made during the game.
 * @returns {string}
 */
export function getJourneyRecap() {
  const parts = [];

  // CEO Focus — find dominant activity
  const tracking = gameState.personalityTracking;
  const cum = tracking.cumulative;
  const ceo = getCeoFocusFractions(cum);
  if (!ceo) return 'Your journey to AGI was marked by careful consideration at each step.';
  const focusEntries = Object.entries(ceo).sort((a, b) => b[1] - a[1]);
  if (focusEntries[0][1] >= 0.35) {
    const focusLabels = {
      research: 'spent your days in the lab, hands-on with the research that mattered',
      operations: 'built systems that ran themselves, trusting the process you\'d designed',
      ir: 'understood that capital was a tool, and you raised what you needed to win',
      grants: 'bootstrapped from nothing \u2014 every dollar earned, not given',
      public_positioning: 'shaped the narrative alongside the technology',
    };
    const label = focusLabels[focusEntries[0][0]];
    if (label) parts.push(label);
  }

  // Moratoriums
  const moratoriumsAccepted = (gameState.moratoriums.accepted || []).length;
  const signedAndIgnored = (gameState.moratoriums.signedAndIgnored || []).length;
  if (moratoriumsAccepted === 3) {
    parts.push('paused when the risks became clear, even when no one asked you to');
  } else if (signedAndIgnored > 0) {
    parts.push('signed the letters, made the pledges, and never stopped the work');
  } else if (moratoriumsAccepted === 0 && (gameState.moratoriums.triggered || []).length > 0) {
    parts.push('never hesitated \u2014 the work continued, because you believed it had to');
  }

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
  if (tracking.samples > 0) {
    const avgAli = cum.ali / tracking.samples;
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
