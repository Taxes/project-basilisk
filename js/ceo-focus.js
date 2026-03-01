// js/ceo-focus.js — CEO Focus system
// Design doc: docs/design-docs/ceo-focus.md

import { gameState } from './game-state.js';
import { getActiveCount } from './purchasable-state.js';
import { BALANCE, FUNDRAISE_ROUNDS } from '../data/balance.js';

// --- Constants ---
export const BUILDUP_TIME = 120;   // seconds to reach max for continuous activities
export const IR_BUILDUP_TIME = 90; // IR-specific: faster base time-to-cap (uses sqrt of efficiency)
export const DECAY_TIME = 360;     // seconds to fully decay
export const MASTERY_BUILDUP_TIME = 5 * 365; // 5 game-years (~1825 seconds real-time)
export const MASTERY_DECAY_TIME = 5 * 365;   // 5 game-years (~1825 seconds real-time)

// Activity definitions
const ACTIVITIES = {
  grants: {
    id: 'grants',
    name: 'Grant Writing',
    type: 'continuous',
    unlock: () => true,
  },
  research: {
    id: 'research',
    name: 'Hands-on Research',
    type: 'mixed',  // discrete + continuous
    unlock: () => true,
  },
  ir: {
    id: 'ir',
    name: 'Investor Relations',
    type: 'continuous',
    unlock: () => gameState.fundraiseRounds?.seed?.raised === true,
  },
  operations: {
    id: 'operations',
    name: 'Operations',
    type: 'continuous',
    unlock: () => gameState.fundraiseRounds?.series_a?.raised === true,
  },
  public_positioning: {
    id: 'public_positioning',
    name: 'Public Positioning',
    type: 'continuous',
    unlock: () => gameState.fundraiseRounds?.series_b?.raised === true,
  },
};

export function getAvailableActivities() {
  return Object.values(ACTIVITIES).filter(a => a.unlock());
}

export function getSelectedActivity() {
  return ACTIVITIES[gameState.ceoFocus.selectedActivity] || ACTIVITIES.research;
}

export function selectActivity(activityId) {
  if (ACTIVITIES[activityId] && ACTIVITIES[activityId].unlock()) {
    gameState.ceoFocus.selectedActivity = activityId;
    computeEffects();  // Update computed state immediately (needed for paused UI)
  }
}

export function isQueueEmpty() {
  return gameState.focusQueue.length === 0;
}

/** CEO is idle when queue is empty or the active item is paused (e.g. insufficient funds) */
function isEffectivelyIdle() {
  if (gameState.focusQueue.length === 0) return true;
  return gameState.focusQueue[0].paused === true;
}

function isFundraiseActive() {
  return gameState.focusQueue.some(item => item.type === 'fundraise');
}

/** Main tick — called from processQueue's location in the game loop */
export function processCEOFocus(deltaTime) {
  const idle = isEffectivelyIdle();
  const selected = gameState.ceoFocus.selectedActivity;
  const buildup = gameState.ceoFocus.buildup;

  // Update buildup/decay for all continuous activities
  for (const [id, activity] of Object.entries(ACTIVITIES)) {
    if (activity.type === 'discrete') continue;
    const isContinuous = activity.type === 'continuous' || activity.type === 'mixed';
    if (!isContinuous) continue;

    if (idle && id === selected) {
      // Build up — IR benefits from focused efficiency
      const baseTime = id === 'ir' ? IR_BUILDUP_TIME : BUILDUP_TIME;
      const rate = deltaTime / baseTime;
      const effectiveRate = id === 'ir' ? rate * Math.sqrt(gameState.focusSpeed || 1) : rate;
      buildup[id] = Math.min(1, (buildup[id] || 0) + effectiveRate);
    } else {
      // Decay — special case: IR paused during active fundraise
      if (id === 'ir' && isFundraiseActive()) continue;
      buildup[id] = Math.max(0, (buildup[id] || 0) - deltaTime / DECAY_TIME);
    }
  }

  // Mastery: builds when active buildup is maxed, decays otherwise
  const mastery = gameState.ceoFocus.mastery || (gameState.ceoFocus.mastery = {});
  for (const [id, activity] of Object.entries(ACTIVITIES)) {
    const isContinuous = activity.type === 'continuous' || activity.type === 'mixed';
    if (!isContinuous) continue;

    if (idle && id === selected && (buildup[id] || 0) >= 1.0) {
      // Active buildup is maxed — build mastery
      mastery[id] = Math.min(1, (mastery[id] || 0) + deltaTime / MASTERY_BUILDUP_TIME);
    } else {
      // Decay mastery
      mastery[id] = Math.max(0, (mastery[id] || 0) - deltaTime / MASTERY_DECAY_TIME);
    }
  }

  // Decay fundraise multipliers (skip when IR is active)
  const irActive = idle && selected === 'ir';
  for (const [roundId, round] of Object.entries(FUNDRAISE_ROUNDS)) {
    const state = gameState.fundraiseRounds[roundId];
    if (!state?.available || state.raised) continue;
    if (state.currentMultiplier === undefined) {
      state.currentMultiplier = state.startingMultiplier || round.startingMultiplier;
    }
    if (irActive) continue;
    if (gameState.focusQueue.some(item => item.type === 'fundraise' && item.target === roundId)) continue;
    const decay = (state.currentMultiplier - round.floorMultiplier) * (1 - Math.pow(0.5, deltaTime / round.halfLife));
    state.currentMultiplier = Math.max(round.floorMultiplier, state.currentMultiplier - decay);
  }

  // Compute and store effective values for other systems to read
  computeEffects();
}

/** Compute effective values from CEO Focus for other systems to consume.
 *  Called from processCEOFocus (each tick) and updateForecasts (during pause). */
export function computeEffects() {
  const focus = gameState.ceoFocus;
  const buildup = focus.buildup;
  const idle = isEffectivelyIdle();
  const selected = focus.selectedActivity;
  const fundraiseCount = focus.completedFundraiseCount || 0;
  const efficiency = idle ? gameState.focusSpeed : 1.0;

  // Grant Writing: $1000/s base × 2^fundraiseCount × efficiency (only when idle + selected)
  const grantsActive = idle && selected === 'grants';
  const grantBaseRate = 1000 * Math.pow(2, fundraiseCount);
  // --- Mastery bonuses (all scale with active × mastery) ---
  const mastery = focus.mastery || {};

  // Grant Writing: active buildup 1×→2×, mastery adds up to 4× (8× total at max active + max mastery)
  const grantActiveMultiplier = 1 + (buildup.grants || 0); // 1× to 2×
  const grantMasteryFactor = (buildup.grants || 0) * (mastery.grants || 0); // scales with active × mastery
  const grantMasteryMultiplier = 1 + 3 * grantMasteryFactor; // 1× to 4×

  const grantRate = grantsActive ? grantBaseRate * efficiency * grantActiveMultiplier * grantMasteryMultiplier : 0;
  const potentialGrantRate = grantBaseRate * (gameState.focusSpeed || 1) * grantActiveMultiplier * grantMasteryMultiplier;

  // Hands-on Research: +10 RP/s discrete × efficiency (only when idle + selected)
  const researchActive = idle && selected === 'research';
  const flatRP = researchActive ? 10 * efficiency : 0;
  // +25% personnel multiplier from buildup (always applies based on buildup level)
  const personnelMultiplier = 1 + 0.25 * (buildup.research || 0);

  // Operations: cost reduction based on buildup (additive bonuses)
  const hasCOO = getActiveCount('coo') > 0;
  const hasProcessOpt = gameState.tracks?.applications?.unlockedCapabilities?.includes('process_optimization');
  let opsFloor = 0;
  let opsCap = 0.10;
  if (hasCOO) { opsFloor += 0.05; opsCap += 0.05; }
  if (hasProcessOpt) opsCap += 0.10;
  const opsBonus = opsFloor + (opsCap - opsFloor) * (buildup.operations || 0);

  // Operations: automation throughput bonus (mirrors cost reduction structure)
  let autoFloor = 0;
  let autoCap = 0.50;
  if (hasCOO) { autoFloor += 0.125; autoCap += 0.125; }
  if (hasProcessOpt) autoCap += 0.25;
  const opsAutomationBonus = autoFloor + (autoCap - autoFloor) * (buildup.operations || 0);

  // Investor Relations: bonus to next fundraise
  // 20K/s base growth rate, cap = 2.4M; 4x per fundraise after the one that unlocks IR
  const irBuildup = buildup.ir || 0;
  const irFundraiseScaling = Math.max(0, fundraiseCount - 1);
  const IR_CAP_BASE = 5000000;  // $5M base cap at full buildup
  // Hands-on Research: +50% org tier amplification, compute cap 3→5×
  const researchMastery = (buildup.research || 0) * (mastery.research || 0);
  const orgTierBonus = 0.50 * researchMastery;           // 0 to 0.50
  const computeCapBonus = 2.0 * researchMastery;         // raises soft cap by 0 to 2.0 (3→5)

  // Investor Relations: 2× IR overshoot ceiling + extra revenue multiple from mastery
  const irMastery = (buildup.ir || 0) * (mastery.ir || 0);
  const irCapMultiplier = 1 + irMastery; // 1× to 2×
  const irMasteryMultFraction = 0.20 * irMastery; // 0 to 0.20 extra mult fraction from mastery

  const irFundraiseCap = IR_CAP_BASE * Math.pow(8, irFundraiseScaling);
  const irFundraiseBonus = irFundraiseCap * irBuildup;
  const irMultFraction = 0.20 * irBuildup + irMasteryMultFraction;  // buildup + mastery contributions

  // Estimate total IR raise bonus for display (fixed + mult-based revenue for next round)
  // Clamped to the overshoot ceiling so the panel doesn't promise more than the raise delivers
  let irTotalEstimate = irFundraiseBonus;
  const nextRound = Object.entries(FUNDRAISE_ROUNDS).find(
    ([rid]) => gameState.fundraiseRounds[rid]?.available && !gameState.fundraiseRounds[rid]?.raised
  );
  if (nextRound) {
    const [roundId, round] = nextRound;
    if (irMultFraction > 0) {
      const annualRevenue = (gameState.computed?.revenue?.annual || 0);
      const currentMult = gameState.fundraiseRounds[roundId]?.currentMultiplier ?? round.startingMultiplier;
      irTotalEstimate += annualRevenue * (irMultFraction * currentMult) * round.equityPercent;
    }
    // Cap estimate to overshoot headroom: IR can add at most maxRaise × overshoot above the normal cap
    if (round.maxRaise) {
      const overshootHeadroom = round.maxRaise * BALANCE.IR_MAX_OVERSHOOT * irCapMultiplier;
      irTotalEstimate = Math.min(irTotalEstimate, overshootHeadroom);
    }
  }

  // Public Positioning: acquisition growth + market edge preservation + bonus revenue
  const ppBuildup = buildup.public_positioning || 0;
  const acquiredDemandGrowthMultiplier = 1 + 1.0 * ppBuildup;
  const edgeDecayReduction = 0.30 * ppBuildup;       // up to 30% slower market edge decay
  const bonusRevenueMultiplier = 0.10 * ppBuildup;   // up to 10% bonus revenue

  // Operations: +50% TFLOPS
  const opsMastery = (buildup.operations || 0) * (mastery.operations || 0);
  const tflopsMultiplier = 1 + 0.50 * opsMastery; // 1× to 1.50×

  // Public Positioning: -20% upfront purchase costs
  const ppMastery = ppBuildup * (mastery.public_positioning || 0);
  const purchaseCostDiscount = 1 - 0.20 * ppMastery; // 1.0 to 0.80

  // Store computed effects for other systems to read
  if (!gameState.computed) gameState.computed = {};
  gameState.computed.ceoFocus = {
    grantRate,
    potentialGrantRate,
    grantBaseRate,
    grantActiveMultiplier,
    efficiency,
    potentialEfficiency: gameState.focusSpeed,
    flatRP,
    personnelMultiplier,
    opsBonus,
    opsCap,
    opsFloor,
    opsAutomationBonus,
    autoFloor,
    autoCap,
    irFundraiseBonus,
    irFundraiseCap,
    irMultFraction,
    irTotalEstimate,
    acquiredDemandGrowthMultiplier,
    edgeDecayReduction,
    bonusRevenueMultiplier,
    grantMasteryMultiplier,
    orgTierBonus,
    computeCapBonus,
    irCapMultiplier,
    irMasteryMultFraction,
    tflopsMultiplier,
    purchaseCostDiscount,
    mastery: { ...mastery },
    idle,
    selected,
    buildup: { ...buildup },
  };
}

export function onFundraiseCompleted() {
  gameState.ceoFocus.completedFundraiseCount++;
  // Reset IR buildup after completing a raise
  gameState.ceoFocus.buildup.ir = 0;
}

// Expose for testing
if (typeof window !== 'undefined') {
  window.processCEOFocus = processCEOFocus;
  window.selectCEOActivity = selectActivity;
  window.onFundraiseCompleted = onFundraiseCompleted;
}

export { ACTIVITIES };
