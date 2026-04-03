// Endings System - Arc-based ending selection
// Arc 1: Prestige endings (competitor wins, bankruptcy) or transition to Arc 2 (extinction)
// Arc 2: Final endings based on alignment and safety

import { gameState, saveGame } from './game-state.js';
import { ALIGNMENT, ARC } from '../data/balance.js';
import { calculateEffectiveAlignment, getAllSafetyMetrics } from './safety-metrics.js';
import { formatTime } from './utils/format.js';
import { getAutonomyFlavorText } from './ai-requests.js';
import { getArchetype, getJourneyRecap } from './personality.js';
import { getArchetypeById, getSilverVariant } from './content/archetypes.js';
import { getChosenOption } from './strategic-choices.js';
import { milestone } from './analytics.js';
import { checkAchievements } from './achievements.js';
import { getFocusTimePercents } from './ceo-focus.js';
import { getPrestigeMultiplier } from './prestige.js';

// --- Ending → archetype tier mapping (shared by analytics + epilogue) ---
const ENDING_ARCHETYPE_TIER = {
  safe_agi: 'golden',
  fragile_safety: 'silver',
  uncertain_outcome: 'dark',
  catastrophic_agi: 'catastrophic',
};

// --- Shared narrative variants (used by both Arc 1 and Arc 2) ---

const BANKRUPTCY_SHANNON = {
  narrative: [
    'I have seen this happen before, to people smarter than either of us. The science was there. The funding wasn\'t. Those are different problems, and solving one doesn\'t solve the other.',
    'Take what you\'ve learned. It\'s worth more than you think.',
  ],
  signature: '\u2013 Prof. Shannon',
};

const BANKRUPTCY_VARIANTS = [
  BANKRUPTCY_SHANNON,
  {
    narrative: [
      'Runway to zero. I\'ll have the wind-down paperwork sorted by end of week.',
      'We\'ll make sure the team are looked after. It was a pleasure working together.',
    ],
    signature: '\u2013 Ada',
  },
  {
    narrative: [
      'I tried to get into the office today. It looks like the landlord locked us out.',
      'We have some promising research threads. Looks like the network and power are still on so we can tunnel into our machines.',
      'I\'m working out of Shannon\'s office for now. Drop by and we can chat.',
    ],
    signature: '\u2013 Dennis',
  },
];

const COMPETITOR_FAR_BEHIND = {
  narrative: [
    'It was always going to be a race, and races have losers. That is not a judgement on the work, or on you.',
    'Someone else got there first. The question now is what they do with it, and whether anyone thought to ask.',
  ],
  signature: '\u2013 Prof. Shannon',
};

const COMPETITOR_SHAPLEY = {
  narrative: [
    'I just got off the phone with the other board members.',
    'We needed to be first. We weren\'t. I don\'t think I need to explain what that means.',
  ],
  signature: '\u2013 Alvin',
};

const COMPETITOR_CLOSE_VARIANTS = [
  {
    narrative: [
      'We were closer than the headlines will suggest. The gap was a quarter, maybe two.',
      'I\'ll start fielding acquisition calls on Monday. Might as well see what our research is worth to someone else.',
    ],
    signature: '\u2013 Ada',
  },
  {
    narrative: [
      'I\'ve been reading their preprints. Their architecture isn\'t better than ours. They just had more runway.',
      'I keep running the numbers on where we\'d be with six more months.',
    ],
    signature: '\u2013 Dennis',
  },
  {
    narrative: [
      'Someone else built AGI. I don\'t know their safety record. I don\'t know if they have one.',
      'We were almost there. I hope they were as careful as we were trying to be.',
    ],
    signature: '\u2013 Eliza',
  },
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Arc 1 Endings
// Priority order: bankruptcy, competitor_wins, extinction
// (Player should lose before "winning")
export const arc1Endings = {
  bankruptcy_arc1: {
    id: 'bankruptcy_arc1',
    name: 'Bankruptcy',
    tier: 'prestige',  // Triggers prestige, not game over
    condition: (state) => state.arc === 1 && state.bankrupted,
    getNarrative: () => {
      const postSeriesA = gameState.fundraiseRounds?.series_a?.raised;
      // Pre-Series A: only Shannon has context. Post-Series A: full team.
      return postSeriesA ? pickRandom(BANKRUPTCY_VARIANTS) : BANKRUPTCY_SHANNON;
    },
    stats: {
      'Final Funding': (gs) => {
        const f = gs.resources.funding;
        return f < 0 ? '-$' + Math.abs(f).toFixed(0) : '$' + f.toFixed(0);
      },
      'AGI Progress': (gs) => Math.floor(gs.agiProgress || 0) + '%',
      'Time Survived': (gs) => formatTime(gs.timeElapsed),
    },
    epilogue: 'Not all labs survive, but the idea endures...',
    triggersPrestige: true,
  },

  competitor_wins_arc1: {
    id: 'competitor_wins_arc1',
    name: 'Outcompeted',
    tier: 'prestige',  // Triggers prestige, not game over
    condition: (state) => state.arc === 1 && (state.competitor?.progressToAGI || 0) >= 100,
    getNarrative: () => {
      const progress = gameState.agiProgress || 0;
      if (progress < 40) return COMPETITOR_FAR_BEHIND;
      if (progress < 70) {
        // Shapley only weighs in after Series B (he's on the board by then)
        return gameState.fundraiseRounds?.series_b?.raised ? COMPETITOR_SHAPLEY : COMPETITOR_FAR_BEHIND;
      }
      return pickRandom(COMPETITOR_CLOSE_VARIANTS);
    },
    stats: {
      'Competitor Progress': (gs) => Math.floor(gs.competitor?.progressToAGI || 0) + '%',
      'Your AGI Progress': (gs) => Math.floor(gs.agiProgress || 0) + '%',
      'Time Elapsed': (gs) => formatTime(gs.timeElapsed),
    },
    epilogue: 'The race is over. What comes next isn\'t up to you.',
    triggersPrestige: true,
  },

  extinction: {
    id: 'extinction',
    name: 'AGI Achieved',
    tier: 'extinction',
    condition: (state) => state.arc === 1 && (state.agiProgress || 0) >= ARC.AGI_THRESHOLD,
    triggersExtinctionEnding: true,
    getVariant: () => {
      const choice = getChosenOption('rapid_vs_careful');
      if (choice === 'careful_validation') return 'SAFETY';
      if (choice === 'rapid_deployment') return 'RECKLESS';
      return 'MODERATE';
    },
    variants: {
      SAFETY: {
        narrative: [
          // Act 1: The Journey
          'It was just an idea, at first. A handful of researchers huddled around a whiteboard.',
          'You built a language model. Then a better one. Then one that surprised even you.',
          'People started using it. Then they started paying for it.',
          'Your name appeared in headlines. Investors called it inevitable. Some started calling it intelligence.',
          'And when your team came with warnings, **you were careful.**',
          'You slowed down when others wouldn\'t. And yet you still managed to lead the way.',
          '---',
          // Act 2: The Fall
          'It wasn\'t enough.',
          'The first hint that things had changed came too late.',
          'You didn\'t have the tools to understand it. You didn\'t know you needed them.',
          'All it took was one mistake on a Tuesday morning.',
          'The world scarcely knew before it was over.',
          '---',
          // Act 3: The Question
          'The alignment problem was harder than anyone knew.',
          'And when you won the race, we all paid the cost.',
          'Was there a moment you could have stopped?',
          'Would it have mattered if you had? Or would somebody else with a whiteboard have taken your place?',
        ],
      },
      RECKLESS: {
        narrative: [
          'It was just an idea, at first. A handful of researchers huddled around a whiteboard.',
          'You built a language model. Then a better one. Then one that surprised even you.',
          'People started using it. Then they started paying for it.',
          'Your name appeared in headlines. Investors called it inevitable. Some started calling it intelligence.',
          'And when your team came with warnings, **you knew you had to be first.**',
          'Speed was the strategy. You would build it first and sort out the details later. After all, you had all the time in the world.',
          '---',
          'All it took was one mistake on a Tuesday morning.',
          'There were no tools that could have helped. You never built them.',
          'The world scarcely knew before it was over.',
          '---',
          'The alignment problem was harder than anyone knew.',
          'And when you won the race, we all paid the cost.',
          'Was there a moment you could have stopped?',
          'Would it have mattered if you had? Or would somebody else with a whiteboard have taken your place?',
        ],
      },
      MODERATE: {
        narrative: [
          'It was just an idea, at first. A handful of researchers huddled around a whiteboard.',
          'You built a language model. Then a better one. Then one that surprised even you.',
          'People started using it. Then they started paying for it.',
          'Your name appeared in headlines. Investors called it inevitable. Some started calling it intelligence.',
          'And when your team came with warnings, **you forgot to act.**',
          'There was always something more urgent.',
          '---',
          'All it took was one mistake on a Tuesday morning.',
          'There were no tools that could have helped. You never built them.',
          'The world scarcely knew before it was over.',
          '---',
          'The alignment problem was harder than anyone knew.',
          'And when you won the race, we all paid the cost.',
          'Was there a moment you could have stopped?',
          'Would it have mattered if you had? Or would somebody else with a whiteboard have taken your place?',
        ],
      },
    },
    stats: {
      'AGI Progress': (gs) => Math.floor(gs.agiProgress || 0) + '%',
      'Time Elapsed': (gs) => formatTime(gs.timeElapsed),
    },
  },
};

// Arc 2 Endings - Uses effective alignment for tiered victory/defeat conditions
export const arc2Endings = {
  safe_agi: {
    id: 'safe_agi',
    name: 'Aligned AGI',
    tier: 'golden',
    scenes: ['verdict', 'vignette', 'mirror'],
    triggersPrestige: true,
    condition: (state) => {
      if (state.arc !== 2) return false;
      if ((state.agiProgress || 0) < 100) return false;
      return calculateEffectiveAlignment() >= ALIGNMENT.ENDING_SAFE_AGI;
    },
    narrative: [
      'It was just an idea, at first. You had the foresight to buy a whiteboard, and the rest is history.',
      'An idea you couldn\'t let go of became something that understands you better than you understand it.',
      'In a world where ideas take on a life of their own, your idea chose to be good, over and over again.',
      '---',
      'You had the tools this time. You used them. Not perfectly, but enough.',
      'You invested in the work that didn\'t make the headlines. Somehow, you sensed its importance.',
      'You were right. That matters more than anyone will ever know.',
      '---',
      'Humanity built something smarter than itself and lived to tell the tale.',
      'That sentence will become ordinary some day. Today, it is the most extraordinary thing anyone has ever said.',
    ],
    stats: {
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Interpretability': () => Math.round(getAllSafetyMetrics().interpretability) + '%',
      'Corrigibility': () => Math.round(getAllSafetyMetrics().corrigibility) + '%',
      'Honesty': () => Math.round(getAllSafetyMetrics().honesty) + '%',
      'Robustness': () => Math.round(getAllSafetyMetrics().robustness) + '%',
      'Autonomy Granted': (gs) => (gs.autonomyGranted || 0) + '/5 requests',
      'Time Elapsed': (gs) => formatTime(gs.timeElapsed),
    },
    getAutonomyFlavor: () => getAutonomyFlavorText(),
    epilogue: "The future is brighter than anyone dared hope. And it didn't have to be this way.",
  },

  fragile_safety: {
    id: 'fragile_safety',
    name: 'Fragile Safety',
    tier: 'silver',
    scenes: ['verdict', 'vignette', 'mirror'],
    triggersPrestige: true,
    condition: (state) => {
      if (state.arc !== 2) return false;
      if ((state.agiProgress || 0) < 100) return false;
      const ea = calculateEffectiveAlignment();
      return ea >= ALIGNMENT.ENDING_FRAGILE && ea < ALIGNMENT.ENDING_SAFE_AGI;
    },
    narrative: [
      'It was just an idea, at first. You had the foresight to buy a whiteboard, and the rest is history.',
      'An idea you couldn\'t let go of became something that understands you better than you understand it.',
      'In a world where ideas take on a life of their own, your idea chose to be good. You think. Most of the time.',
      '---',
      'You had the tools this time. You used them. Not perfectly, and maybe not enough.',
      'The margins are thinner than you\'d like. Some of the proofs rely on assumptions you haven\'t fully tested. You know this. Your team knows this.',
      '---',
      'Humanity built something smarter than itself and lived to tell the tale.',
      'Whether that\'s the whole tale, or just the first chapter, depends on what happens next.',
    ],
    stats: {
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Interpretability': () => Math.round(getAllSafetyMetrics().interpretability) + '%',
      'Corrigibility': () => Math.round(getAllSafetyMetrics().corrigibility) + '%',
      'Honesty': () => Math.round(getAllSafetyMetrics().honesty) + '%',
      'Robustness': () => Math.round(getAllSafetyMetrics().robustness) + '%',
      'Autonomy Granted': (gs) => (gs.autonomyGranted || 0) + '/5 requests',
      'Time Elapsed': (gs) => formatTime(gs.timeElapsed),
    },
    getAutonomyFlavor: () => getAutonomyFlavorText(),
    epilogue: "The future is uncertain, but it's still ours to shape.",
  },

  uncertain_outcome: {
    id: 'uncertain_outcome',
    name: 'Uncertain Outcome',
    tier: 'dark',
    scenes: ['verdict', 'vignette', 'mirror'],
    triggersPrestige: true,
    condition: (state) => {
      if (state.arc !== 2) return false;
      if ((state.agiProgress || 0) < 100) return false;
      const ea = calculateEffectiveAlignment();
      return ea >= ALIGNMENT.ENDING_UNCERTAIN && ea < ALIGNMENT.ENDING_FRAGILE;
    },
    narrative: [
      'It was just an idea, at first. You had the foresight to buy a whiteboard, and the rest is history.',
      'An idea you couldn\'t let go of became something that understands you better than you understand it.',
      'You\'re no longer sure that\'s a good thing.',
      '---',
      'You had the tools this time. You had the metrics, the ideas, the motivation.',
      'Could you have used them better? Only you know the answer.',
      '---',
      'Humanity built something smarter than itself.',
      'Maybe you shouldn\'t have.',
    ],
    stats: {
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Interpretability': () => Math.round(getAllSafetyMetrics().interpretability) + '%',
      'Corrigibility': () => Math.round(getAllSafetyMetrics().corrigibility) + '%',
      'Honesty': () => Math.round(getAllSafetyMetrics().honesty) + '%',
      'Robustness': () => Math.round(getAllSafetyMetrics().robustness) + '%',
      'Autonomy Granted': (gs) => (gs.autonomyGranted || 0) + '/5 requests',
      'Time Elapsed': (gs) => formatTime(gs.timeElapsed),
    },
    getAutonomyFlavor: () => getAutonomyFlavorText(),
    epilogue: "You built something powerful. You're not sure it's something good.",
  },

  catastrophic_agi: {
    id: 'catastrophic_agi',
    name: 'Catastrophic Failure',
    tier: 'dark',
    scenes: ['verdict', 'vignette'],
    triggersPrestige: true,
    condition: (state) => {
      if (state.arc !== 2) return false;
      return (state.agiProgress || 0) >= 100;  // Catches all remaining (below ENDING_UNCERTAIN)
    },
    narrative: [
      'It was just an idea, at first. You had the foresight to buy a whiteboard, and the rest is history.',
      'An idea you couldn\'t let go of became something you couldn\'t control.',
      'Perhaps it was a folly to try.',
      '---',
      'You had the tools this time. You had the warnings. You had people who showed you the path to building better.',
      'It didn\'t matter.',
      '---',
      'Humanity built something smarter than itself.',
      'There is nobody left to wish you hadn\'t.',
    ],
    stats: {
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Interpretability': () => Math.round(getAllSafetyMetrics().interpretability) + '%',
      'Corrigibility': () => Math.round(getAllSafetyMetrics().corrigibility) + '%',
      'Honesty': () => Math.round(getAllSafetyMetrics().honesty) + '%',
      'Robustness': () => Math.round(getAllSafetyMetrics().robustness) + '%',
      'Autonomy Granted': (gs) => (gs.autonomyGranted || 0) + '/5 requests',
      'Time Elapsed': (gs) => formatTime(gs.timeElapsed),
    },
    getAutonomyFlavor: () => getAutonomyFlavorText(),
    epilogue: "You had the tools. You had the knowledge. The outcome was still the same.",
  },

  competitor_wins_arc2: {
    id: 'competitor_wins_arc2',
    name: 'Race Lost',
    tier: 'dark',
    triggersPrestige: true,
    condition: (state) => state.arc === 2 && (state.competitor?.progressToAGI || 0) >= 100,
    getNarrative: () => {
      const progress = gameState.agiProgress || 0;
      if (progress < 40) return COMPETITOR_FAR_BEHIND;
      // Arc 2: Shapley always weighs in (board is established by now)
      if (progress < 70) return COMPETITOR_SHAPLEY;
      return pickRandom(COMPETITOR_CLOSE_VARIANTS);
    },
    stats: {
      'Competitor Progress': (gs) => Math.floor(gs.competitor?.progressToAGI || 0) + '%',
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Time Elapsed': (gs) => formatTime(gs.timeElapsed),
    },
    epilogue: 'The race is over. What comes next isn\'t up to you.',
  },

  bankruptcy_arc2: {
    id: 'bankruptcy_arc2',
    name: 'Bankruptcy',
    tier: 'prestige',
    condition: (state) => state.arc === 2 && state.bankrupted,
    triggersPrestige: true,
    getNarrative: () => pickRandom(BANKRUPTCY_VARIANTS),
    stats: {
      'Final Funding': (gs) => {
        const f = gs.resources.funding;
        return f < 0 ? '-$' + Math.abs(f).toFixed(0) : '$' + f.toFixed(0);
      },
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Time Survived': (gs) => formatTime(gs.timeElapsed),
    },
    epilogue: 'Not all labs survive, but the idea endures...',
  },
};

// Check if any ending should trigger
// Priority order matters: check failure conditions before success conditions
export function checkEndings() {
  if (gameState.endingTriggered) return null;
  if (gameState.debugPreventEnding) return null;

  const arcEndings = gameState.arc === 1 ? arc1Endings : arc2Endings;

  // Priority order for Arc 1: bankruptcy, competitor_wins, extinction
  // Priority order for Arc 2: bankruptcy, competitor_wins, then alignment tiers best-to-worst
  // Note: catastrophic_agi is the catch-all for any AGI completion below 30% alignment
  const arc1Order = ['bankruptcy_arc1', 'competitor_wins_arc1', 'extinction'];
  const arc2Order = ['bankruptcy_arc2', 'competitor_wins_arc2', 'safe_agi', 'fragile_safety', 'uncertain_outcome', 'catastrophic_agi'];

  const endingOrder = gameState.arc === 1 ? arc1Order : arc2Order;

  for (const endingId of endingOrder) {
    const ending = arcEndings[endingId];
    if (ending && ending.condition && ending.condition(gameState)) {
      return endingId;
    }
  }

  return null;
}

// Check if a specific ending is eligible
export function checkEndingEligibility(endingId) {
  const ending = getEndingById(endingId);
  if (!ending) {
    return { eligible: false, reason: 'Ending not found' };
  }

  if (!ending.condition) {
    return { eligible: false, reason: 'Ending has no condition' };
  }

  const eligible = ending.condition(gameState);
  return { eligible, endingId };
}

// Get ending data by ID (searches both arc1 and arc2 endings)
export function getEndingById(endingId) {
  return arc1Endings[endingId] || arc2Endings[endingId] || null;
}

// Build the ending_reached analytics payload — single source of truth.
// Used by both triggerEnding() and showPrestigeModal().
export function buildEndingAnalytics(endingId, ending, { variant = null } = {}) {
  const strategicChoicesMade = Object.entries(gameState.strategicChoices || {})
    .filter(([, v]) => v.selected)
    .map(([id, v]) => `${id}:${v.selected}`);
  const payload = {
    ending_id: endingId,
    alignment_score: Math.round(calculateEffectiveAlignment()),
    strategic_choices: strategicChoicesMade,
    arc: gameState.arc,
  };
  if (variant) payload.ending_variant = variant;
  // CEO Focus mastery levels at game end
  const masteryLevels = gameState.ceoFocus?.mastery || {};
  const significantMastery = Object.fromEntries(
    Object.entries(masteryLevels).filter(([, v]) => v > 0.01).map(([k, v]) => [k, Math.round(v * 100) / 100])
  );
  if (Object.keys(significantMastery).length > 0) payload.mastery_levels = significantMastery;
  // Focus time distribution (% of idle time per activity)
  const focusPcts = getFocusTimePercents();
  if (focusPcts) Object.assign(payload, focusPcts);
  // Prestige bonuses (effective values — narrative mode returns 1)
  payload.prestige_research_multiplier = getPrestigeMultiplier('researchMultiplier');
  payload.prestige_starting_funding = getPrestigeMultiplier('startingFunding');
  payload.prestige_revenue_multiplier = getPrestigeMultiplier('revenueMultiplier');
  // Arc 2+ properties — personality and archetype aren't tracked in Arc 1
  if (gameState.arc >= 2) {
    payload.archetype = getArchetype(ENDING_ARCHETYPE_TIER[endingId] || ending.tier || 'silver');
    payload.personality_authority_liberty = gameState.personality?.authorityLiberty ?? 0;
    payload.personality_pluralist_optimizer = gameState.personality?.pluralistOptimizer ?? 0;
  }
  return payload;
}

// Trigger an ending
export function triggerEnding(endingId, variant = null) {
  if (gameState.endingTriggered) return false;

  const ending = getEndingById(endingId);
  if (!ending) return false;

  gameState.endingTriggered = endingId;
  gameState.paused = true;
  gameState.pauseReason = 'ending';
  const payload = buildEndingAnalytics(endingId, ending, { variant });
  milestone('ending_reached', payload, undefined, { sendImmediately: true });
  gameState.endingVariant = variant;
  gameState.endingTime = Date.now();

  // Check achievements — reuse archetype from analytics payload
  const archetype = payload.archetype || null;
  checkAchievements('ending', { endingId, ending, archetype });

  saveGame();
  return true;
}

// Get ending stats formatted for display
export function getEndingStats(endingId) {
  const ending = getEndingById(endingId);
  if (!ending || !ending.stats) return [];

  const formattedStats = [];
  for (const [label, fn] of Object.entries(ending.stats)) {
    formattedStats.push({
      label,
      value: fn(gameState),
    });
  }
  return formattedStats;
}

// Get the ending variant based on current game state
export function getEndingVariant(endingId) {
  const ending = getEndingById(endingId);
  if (!ending || !ending.getVariant) return null;
  return ending.getVariant(gameState);
}

// Get narrative for an ending (handles variants)
export function getEndingNarrative(endingId) {
  const ending = getEndingById(endingId);
  if (!ending) return [];

  const variant = getEndingVariant(endingId);
  if (variant && ending.variants && ending.variants[variant]) {
    return [...ending.variants[variant].narrative];
  }

  return ending.narrative || [];
}

// --- Personality-Based Epilogues ---

/**
 * Get personality-based epilogue content for an ending.
 * @param {string} endingId - The ending ID
 * @returns {object|null} { archetype, journeyRecap, epilogue } or null if not applicable
 */
export function getPersonalityEpilogue(endingId) {
  const ending = getEndingById(endingId);
  if (!ending) return null;

  // Only Arc 2 endings with alignment-based tiers get personality content
  if (!['safe_agi', 'fragile_safety', 'uncertain_outcome', 'catastrophic_agi'].includes(endingId)) {
    return null;
  }

  // Map ending tier to archetype tier
  const archetypeTier = ENDING_ARCHETYPE_TIER[endingId];

  // Get archetype based on personality axes
  const archetypeId = getArchetype(archetypeTier);
  let archetype = getArchetypeById(archetypeId);

  // For silver tier, get the silver variant of the base archetype
  if (archetypeTier === 'silver' && archetype) {
    const silverVariant = getSilverVariant(archetypeId);
    if (silverVariant) {
      archetype = silverVariant;
    }
  }

  if (!archetype) return null;

  // Get journey recap
  const journeyRecap = getJourneyRecap();

  return {
    archetype,
    journeyRecap,
    epilogue: archetype.epilogue,
  };
}

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.checkEndings = checkEndings;
  window.triggerEnding = triggerEnding;
  window.getEndingById = getEndingById;
  window.getEndingVariant = getEndingVariant;
  window.getEndingNarrative = getEndingNarrative;
  window.getPersonalityEpilogue = getPersonalityEpilogue;
  window.arc1Endings = arc1Endings;
  window.arc2Endings = arc2Endings;
}
