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
      const variants = postSeriesA
        ? [
          {
            narrative: [
              'I have seen this happen before, to people smarter than either of us. The science was there. The funding wasn\'t. Those are different problems, and solving one doesn\'t solve the other.',
              'Take what you\'ve learned. It\'s worth more than you think.',
            ],
            signature: '\u2013 James',
          },
          {
            narrative: [
              'Runway to zero. I\'ll have the wind-down paperwork sorted by end of week.',
              'We\'ll make sure the team are looked after. It was a pleasure working together.',
            ],
            signature: '\u2013 Ada',
          },
          {
            narrative: [
              'I didn\'t realise how bad the funding situation was. I should have been paying closer attention.',
              'We had three open research threads. Two were showing real promise. I keep thinking about the one on emergent reasoning.',
              'Let me know if you want to try again.',
            ],
            signature: '\u2013 Dennis',
          },
        ]
        : [
          {
            narrative: [
              'I have seen this happen before, to people smarter than either of us. The science was there. The funding wasn\'t. Those are different problems, and solving one doesn\'t solve the other.',
              'Take what you\'ve learned. It\'s worth more than you think.',
            ],
            signature: '\u2013 James',
          },
        ];
      return variants[Math.floor(Math.random() * variants.length)];
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
      const postSeriesB = gameState.fundraiseRounds?.series_b?.raised;

      if (progress < 40) {
        // Far behind — Shannon reassures
        return {
          narrative: [
            'It was always going to be a race, and races have losers. That is not a judgement on the work, or on you.',
            'Someone else got there first. The question now is what they do with it, and whether anyone thought to ask.',
          ],
          signature: '\u2013 James',
        };
      }

      if (progress < 70) {
        // Moderately behind — Shapley disappointed (falls back to Shannon pre-Series B)
        if (postSeriesB) {
          return {
            narrative: [
              'I just got off the phone with the other board members.',
              'We needed to be first. We weren\'t. I don\'t think I need to explain what that means.',
            ],
            signature: '\u2013 Alvin',
          };
        }
        return {
          narrative: [
            'It was always going to be a race, and races have losers. That is not a judgement on the work, or on you.',
            'Someone else got there first. The question now is what they do with it, and whether anyone thought to ask.',
          ],
          signature: '\u2013 James',
        };
      }

      // Close race (70%+) — Ada, Babbage, or Chen
      const closeVariants = [
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
      return closeVariants[Math.floor(Math.random() * closeVariants.length)];
    },
    stats: {
      'Competitor Progress': (gs) => Math.floor(gs.competitor?.progressToAGI || 0) + '%',
      'Your AGI Progress': (gs) => Math.floor(gs.agiProgress || 0) + '%',
      'Time Elapsed': (gs) => formatTime(gs.timeElapsed),
    },
    epilogue: 'The race is over. What comes next wasn\'t up to you.',
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
      'Hidden Alignment': (gs) => Math.round(gs.hiddenAlignment || 0) + '%',
    },
  },
};

// Arc 2 Endings - Uses effective alignment for tiered victory/defeat conditions
export const arc2Endings = {
  safe_agi: {
    id: 'safe_agi',
    name: 'Aligned AGI',
    tier: 'golden',
    condition: (state) => {
      if (state.arc !== 2) return false;
      if ((state.agiProgress || 0) < 100) return false;
      return calculateEffectiveAlignment() >= ALIGNMENT.ENDING_SAFE_AGI;
    },
    narrative: [
      'Your AGI is aligned.',
      "Not because you were lucky. Because you understood what mattered.",
      'The math held. The proofs checked out. The safety metrics hold.',
      'For the first time in history, humanity has a partner, not a successor.',
    ],
    stats: {
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Eval Pass Rate': () => Math.round(getAllSafetyMetrics().evalPassRate) + '%',
      'Eval Confidence': () => Math.round(getAllSafetyMetrics().evalConfidence) + '%',
      'Interpretability': () => Math.round(getAllSafetyMetrics().interpretability) + '%',
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
    condition: (state) => {
      if (state.arc !== 2) return false;
      if ((state.agiProgress || 0) < 100) return false;
      const ea = calculateEffectiveAlignment();
      return ea >= ALIGNMENT.ENDING_FRAGILE && ea < ALIGNMENT.ENDING_SAFE_AGI;
    },
    narrative: [
      'AGI achieved. Safeguards in place.',
      'Your alignment tools caught the worst failure modes.',
      'But the margins are thin. The proofs are incomplete.',
      'Cautious hope. The system is aligned... for now.',
    ],
    stats: {
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Eval Pass Rate': () => Math.round(getAllSafetyMetrics().evalPassRate) + '%',
      'Eval Confidence': () => Math.round(getAllSafetyMetrics().evalConfidence) + '%',
      'Interpretability': () => Math.round(getAllSafetyMetrics().interpretability) + '%',
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
    condition: (state) => {
      if (state.arc !== 2) return false;
      if ((state.agiProgress || 0) < 100) return false;
      const ea = calculateEffectiveAlignment();
      return ea >= ALIGNMENT.ENDING_UNCERTAIN && ea < ALIGNMENT.ENDING_FRAGILE;
    },
    narrative: [
      'AGI is here.',
      'Your alignment metrics say... maybe.',
      'The system passes some tests. Fails others. The ones it fails concern you.',
      "Whether it's truly aligned... time will tell.",
    ],
    stats: {
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Eval Pass Rate': () => Math.round(getAllSafetyMetrics().evalPassRate) + '%',
      'Eval Confidence': () => Math.round(getAllSafetyMetrics().evalConfidence) + '%',
      'Interpretability': () => Math.round(getAllSafetyMetrics().interpretability) + '%',
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
    condition: (state) => {
      if (state.arc !== 2) return false;
      return (state.agiProgress || 0) >= 100;  // Catches all remaining (below ENDING_UNCERTAIN)
    },
    narrative: [
      'Congratulations. You achieved AGI.',
      'Again.',
      'This time you saw the alignment numbers. You had the tools.',
      "It wasn't enough. Or maybe you didn't use them.",
      '...',
      'The extinction event plays out differently with full visibility.',
      'You watch every metric fail, one by one.',
    ],
    stats: {
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Eval Pass Rate': () => Math.round(getAllSafetyMetrics().evalPassRate) + '%',
      'Eval Confidence': () => Math.round(getAllSafetyMetrics().evalConfidence) + '%',
      'Interpretability': () => Math.round(getAllSafetyMetrics().interpretability) + '%',
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
    condition: (state) => state.arc === 2 && (state.competitor?.progressToAGI || 0) >= 100,
    narrative: [
      'Another lab reached AGI first.',
      'Your investors pulled out. Your researchers left.',
      'You watch from the sidelines.',
      "The race was real. You couldn't afford to be careful.",
    ],
    stats: {
      'Competitor Progress': (gs) => Math.floor(gs.competitor?.progressToAGI || 0) + '%',
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Time Elapsed': (gs) => formatTime(gs.timeElapsed),
    },
    epilogue: "The fate of humanity rests in hands you never got to shake.",
  },

  bankruptcy_arc2: {
    id: 'bankruptcy_arc2',
    name: 'Bankruptcy',
    tier: 'prestige',
    condition: (state) => state.arc === 2 && state.bankrupted,
    triggersPrestige: true,
    narrative: [
      'Your last researcher turned off the lights.',
      "Your alignment research was promising. It just wasn't profitable.",
      'Somewhere, a less careful lab continues the work.',
    ],
    stats: {
      'Final Funding': (gs) => {
        const f = gs.resources.funding;
        return f < 0 ? '-$' + Math.abs(f).toFixed(0) : '$' + f.toFixed(0);
      },
      'Effective Alignment': () => Math.round(calculateEffectiveAlignment()) + '%',
      'Time Survived': (gs) => formatTime(gs.timeElapsed),
    },
    epilogue: "The market didn't care about safety. It cared about results.",
  },
};

// Legacy endings object for backwards compatibility
export const endings = { ...arc1Endings, ...arc2Endings };

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

// Trigger an ending
export function triggerEnding(endingId, variant = null) {
  if (gameState.endingTriggered) return false;

  const ending = getEndingById(endingId);
  if (!ending) return false;

  gameState.endingTriggered = endingId;
  gameState.paused = true;
  gameState.pauseReason = 'ending';
  const strategicChoicesMade = Object.entries(gameState.strategicChoices || {})
    .filter(([, v]) => v.selected)
    .map(([id, v]) => `${id}:${v.selected}`);
  milestone('ending_reached', {
    ending_id: endingId,
    alignment_score: gameState.alignment?.total ?? gameState.hiddenAlignment ?? 0,
    archetype: getArchetype(ending.tier || 'silver'),
    personality_passive_active: gameState.personality?.passiveActive ?? 0,
    personality_pluralist_optimizer: gameState.personality?.pluralistOptimizer ?? 0,
    strategic_choices: strategicChoicesMade,
    arc: gameState.arc,
  }, undefined, { sendImmediately: true });
  gameState.endingVariant = variant;
  gameState.endingTime = Date.now();

  // Store current ending data
  if (typeof window !== 'undefined') {
    window.currentEnding = {
      ...ending,
      variant,
      variantData: variant && ending.variants ? ending.variants[variant] : null,
    };
  }

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
    let narrative = [...ending.variants[variant].narrative];
    // Replace placeholders
    const alignmentLevel = gameState.tracks?.alignment?.alignmentLevel || 0;
    narrative = narrative.map(line => line.replace('{alignmentLevel}', alignmentLevel));
    return narrative;
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
  let archetypeTier;
  if (endingId === 'safe_agi') {
    archetypeTier = 'golden';
  } else if (endingId === 'fragile_safety') {
    archetypeTier = 'silver';
  } else if (endingId === 'uncertain_outcome') {
    archetypeTier = 'dark';
  } else if (endingId === 'catastrophic_agi') {
    archetypeTier = 'catastrophic';
  }

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
