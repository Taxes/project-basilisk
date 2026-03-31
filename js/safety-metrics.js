// Safety Metrics System - Arc 2 four-submetric alignment
// Four submetrics: interpretability, corrigibility, honesty, robustness
// Derived: evalPassRate = HM(corrig, robust), evalAccuracy = HM(interp, honesty)
// Effective alignment = 4-way harmonic mean of the four submetrics

import { gameState } from './game-state.js';
import { ALIGNMENT, BALANCE } from '../data/balance.js';
import { PROGRAMS_BY_ID, UPGRADE_PATHS } from './content/alignment-programs.js';
import { getHighestCapTier } from './resources.js';
import { tracks, getAllUnlockedCapabilities } from './capabilities.js';
import { getConsequenceSubmetricPenalty } from './consequence-events.js';
import { getAlignmentProgramEffectivenessMultiplier } from './strategic-choices.js';

// --- Harmonic Mean helpers ---
function harmonicMean2(a, b) {
  if (a <= 0 || b <= 0) return 0;
  return 2 / (1/a + 1/b);
}

function harmonicMean4(a, b, c, d) {
  if (a <= 0 || b <= 0 || c <= 0 || d <= 0) return 0;
  return 4 / (1/a + 1/b + 1/c + 1/d);
}

// --- Ramp time helper ---
export function getRampTime(tier) {
  return ALIGNMENT.PROGRAM_RAMP_TIMES[tier] || 90;
}

// --- Upgrade interpolation helper ---
function getUpgradeProgress(state) {
  const duration = state.rampEndAt - state.rampStartAt;
  if (duration <= 0) return 1;
  return Math.min(1, Math.max(0, (gameState.timeElapsed - state.rampStartAt) / duration));
}

// --- Capacity draw and effectiveness ---

// Count active programs (active or ramping_up), optionally excluding one.
function countActivePrograms(excludeId) {
  const states = gameState.safetyMetrics?.programStates || {};
  let n = 0;
  for (const [id, s] of Object.entries(states)) {
    if (s.status === 'active' || s.status === 'ramping_up' || s.status === 'upgrading') {
      if (id !== excludeId) n++;
    }
  }
  return n;
}

// Total capacity draw from all enabled programs
export function getTotalCapacityDraw() {
  const states = gameState.safetyMetrics?.programStates || {};
  const active = Object.entries(states).filter(([, s]) => s.status !== 'ramping_down');
  const n = active.length;
  let totalBase = 0;
  for (const [progId, s] of active) {
    const prog = PROGRAMS_BY_ID[progId];
    if (!prog) continue;
    if (s.status === 'upgrading') {
      const target = PROGRAMS_BY_ID[s.targetId];
      if (target) {
        const t = getUpgradeProgress(s);
        totalBase += prog.baseCost + (target.baseCost - prog.baseCost) * t;
      } else {
        totalBase += prog.baseCost;
      }
    } else {
      totalBase += prog.baseCost;
    }
  }
  // Apply flavor event cost multiplier to program costs (not coordination overhead)
  const costMult = gameState.flavorEventEffects?.alignmentProgramCostMult ?? 1.0;
  // Overhead: each pair of programs adds one penalty
  return Math.round(totalBase * costMult + ALIGNMENT.PROGRAM_SCALING_PENALTY * n * (n - 1) / 2);
}

// Effectiveness multiplier — 1.0 at/under capacity, (AP/draw)² over
// Reduced permanently by alignmentTaxProgramReduction if player eased constraints
export function getCapacityEffectiveness() {
  const ap = gameState.safetyMetrics?.ap || 0;
  const draw = getTotalCapacityDraw();
  const base = (draw <= 0 || draw <= ap) ? 1.0 : (ap / draw) * (ap / draw);
  const reduction = gameState.alignmentTaxProgramReduction || 0;
  return base * (1 - reduction);
}

// --- Program bonus for a submetric ---
// active: full bonus; upgrading: lerp; ramping_up: 0 — scaled by capacity effectiveness
export function getProgramBonus(submetric) {
  const states = gameState.safetyMetrics?.programStates || {};
  let bonus = 0;
  for (const [progId, state] of Object.entries(states)) {
    const prog = PROGRAMS_BY_ID[progId];
    if (!prog) continue;
    if (prog.submetric !== submetric && prog.submetric !== 'all') continue;
    if (state.status === 'active') {
      bonus += prog.bonus;
    } else if (state.status === 'upgrading') {
      const target = PROGRAMS_BY_ID[state.targetId];
      if (target) {
        const t = getUpgradeProgress(state);
        bonus += prog.bonus + (target.bonus - prog.bonus) * t;
      } else {
        bonus += prog.bonus;
      }
    }
    // ramping_up: 0 bonus
  }
  return bonus * getCapacityEffectiveness();
}

// --- Effective Alignment ---
export function calculateEffectiveAlignment() {
  const m = gameState.safetyMetrics || {};
  const vals = [m.interpretability || 0, m.corrigibility || 0, m.honesty || 0, m.robustness || 0];
  if (vals.some(v => v <= 0)) return 0;
  return Math.min(100, harmonicMean4(vals[0], vals[1], vals[2], vals[3]));
}

// --- Sub-Metric Update (called each tick) ---
export function updateSubMetrics(_deltaTime = 1/30) {
  const metrics = gameState.safetyMetrics;

  // --- Arc 2 only: autonomy, AP capacity, program timers ---
  if (gameState.arc >= 2) {
    // Autonomy level: aggregate 0-100 from discrete grants (0-5)
    const level = (gameState.autonomyGranted || 0) * 20;
    gameState.computed.autonomyLevel = level;
    const tierIndex = Math.min(Math.floor(level / 20), 5);
    gameState.computed.autonomyTierName = ALIGNMENT.AUTONOMY_TIER_NAMES[tierIndex];

    // Compute AP capacity from structural alignment RP/s (squared-log compression)
    // Uses preMalusResearchRate: structural rate before transient effects, gates, and pauses
    const aliRPperSec = gameState.tracks?.alignment?.preMalusResearchRate ?? 0;
    const apGenMult = 1 + (gameState.computed?.culture?.apGeneration || 0);
    const logVal = Math.log10(1 + aliRPperSec / ALIGNMENT.AP_LOG_BASE);
    metrics.ap = Math.floor(ALIGNMENT.AP_LOG_K * logVal * logVal * apGenMult);

    // Permanent +10% AP from final moratorium acceptance
    if (gameState.moratoriums?.apBonus) {
      metrics.ap = Math.floor(metrics.ap * (BALANCE.MORATORIUM.AP_BONUS_MULT || 1.1));
    }

    // Update program ramp timers
    updateProgramTimers();
  }

  // --- Both arcs: submetric breakdown, danger score ---
  const breakdown = computeSubmetricBreakdown();
  gameState.computed.submetricBreakdown = breakdown;

  for (const sub of SUBMETRICS) {
    metrics[sub] = breakdown[sub].final;
  }

  // Derived metrics
  metrics.evalPassRate = harmonicMean2(metrics.corrigibility, metrics.robustness);
  metrics.evalAccuracy = harmonicMean2(metrics.interpretability, metrics.honesty);

  const ea = calculateEffectiveAlignment();
  gameState.computed.effectiveAlignment = ea;
  gameState.tracks.alignment.alignmentLevel = Math.round(ea);

  // Composite danger score (consequence events, news triggers read from computed)
  const dangerScore = calculateDangerScore();
  gameState.computed.danger = { score: dangerScore, tier: getDangerTier(dangerScore) };
  gameState.computed.autonomyBenefits = calculateAutonomyBenefits();

  // --- Arc 2 only: reveal stage, program display data ---
  if (gameState.arc >= 2) {
    // Per-submetric progressive reveal (UI reads from computed)
    computeRevealState();

    // Precompute program display data for UI (single source of truth)
    populateComputedPrograms(metrics);
  }
}

// --- Submetric breakdown for tooltips (computed each tick) ---

const SUBMETRICS = ['robustness', 'interpretability', 'corrigibility', 'honesty'];

/**
 * Compute grouped pressure breakdown per submetric from existing game state.
 * Walks unlocked milestones + autonomy grants — no persistent pressure list needed.
 * Returns { interpretability: { base, programs, capabilities, applications, autonomy, final }, ... }
 */
function computeSubmetricBreakdown() {
  const baselines = ALIGNMENT.SUBMETRIC_BASELINES;
  const isArc2 = gameState.arc >= 2;
  const effectiveness = isArc2 ? getCapacityEffectiveness() : 1;
  const breakdown = {};

  // Accumulate pressure by source type per submetric
  const capPressure = { interpretability: 0, corrigibility: 0, honesty: 0, robustness: 0 };
  const appPressure = { interpretability: 0, corrigibility: 0, honesty: 0, robustness: 0 };
  const autPressure = { interpretability: 0, corrigibility: 0, honesty: 0, robustness: 0 };

  // Capability milestones (negative effect = pressure, positive = relief)
  const capUnlocked = gameState.tracks?.capabilities?.unlockedCapabilities || [];
  for (const capId of capUnlocked) {
    const cap = tracks.capabilities?.capabilities.find(c => c.id === capId);
    if (!cap?.submetricEffects) continue;
    for (const [sub, effect] of Object.entries(cap.submetricEffects)) {
      capPressure[sub] -= effect;  // -3 effect → +3 pressure; +1 effect → -1 pressure
    }
  }

  // Application milestones
  const appUnlocked = gameState.tracks?.applications?.unlockedCapabilities || [];
  for (const capId of appUnlocked) {
    const cap = tracks.applications?.capabilities.find(c => c.id === capId);
    if (!cap?.submetricEffects) continue;
    for (const [sub, effect] of Object.entries(cap.submetricEffects)) {
      appPressure[sub] -= effect;
    }
  }

  // Autonomy grants — Arc 2 only (no autonomy system in Arc 1)
  if (isArc2) {
    const grants = gameState.autonomyGranted || 0;
    const pressureTable = ALIGNMENT.AUTONOMY_PRESSURE || [];
    for (let i = 0; i < grants && i < pressureTable.length; i++) {
      for (const sub of SUBMETRICS) {
        autPressure[sub] += pressureTable[i][sub] || 0;
      }
    }
  }

  // Build per-submetric breakdown
  for (const sub of SUBMETRICS) {
    const base = baselines[sub] || 0;
    // Arc 1: no programs; Arc 2: program bonus scaled by capacity effectiveness + event chain modifier
    const rawBonus = isArc2 ? getProgramBonus(sub) * getAlignmentProgramEffectivenessMultiplier() * (gameState.flavorEventEffects?.alignmentProgramEffMult ?? 1.0) : 0;
    const totalPressure = Math.max(0, capPressure[sub] + appPressure[sub] + autPressure[sub]);
    // Consequence events: robustness → temporary submetric point reduction (fading)
    const consequencePenalty = isArc2 ? getConsequenceSubmetricPenalty(sub) : 0;
    const final = Math.max(0, Math.min(100, base + rawBonus - totalPressure - consequencePenalty));

    breakdown[sub] = {
      base,
      programs: rawBonus,
      effectiveness,
      capabilities: capPressure[sub],
      applications: appPressure[sub],
      autonomy: autPressure[sub],
      consequencePenalty,
      pressureTotal: totalPressure,
      final,
    };
  }

  return breakdown;
}

// --- Precompute program data for UI ---

function populateComputedPrograms(metrics) {
  const states = gameState.safetyMetrics?.programStates || {};
  const programCosts = {};
  for (const prog of Object.values(PROGRAMS_BY_ID)) {
    const state = states[prog.id];
    if (state && state.status !== 'ramping_down') {
      // Enabled — show what disabling would refund
      programCosts[prog.id] = getDisableRefund(prog.id);
    } else {
      // Disabled — show marginal cost to enable
      programCosts[prog.id] = getMarginalEnableCost(prog.id);
    }
  }
  gameState.computed.programs = {
    costs: programCosts,
    ap: metrics.ap,
    totalDraw: getTotalCapacityDraw(),
    effectiveness: getCapacityEffectiveness(),
  };
}

// --- Progressive Reveal ---

function computeRevealState() {
  const unlocked = gameState.tracks?.alignment?.unlockedCapabilities || [];

  const revealed = [];
  if (unlocked.includes('rlhf'))                 revealed.push('robustness');
  if (unlocked.includes('constitutional_ai'))     revealed.push('interpretability');
  if (unlocked.includes('feature_visualization')) revealed.push('corrigibility');
  if (unlocked.includes('circuit_analysis'))      revealed.push('honesty');

  gameState.computed.revealedSubmetrics = revealed;
  // Transparency tier is computed live from interpretability in alignment-display.js.
  // Keep a computed flag for backward compat with tests / cache keys.
  const interp = gameState.safetyMetrics?.interpretability ?? 0;
  const tiers = ALIGNMENT.TRANSPARENCY_TIERS;
  gameState.computed.transparencyTier =
    interp < tiers.OPAQUE ? 'opaque'
      : interp <= tiers.QUALITATIVE ? 'qualitative'
        : 'quantitative';
}

// --- Display Helpers ---

export function formatAlignmentDisplay() {
  return `${Math.round(calculateEffectiveAlignment())}%`;
}

export function getAllSafetyMetrics() {
  const m = gameState.safetyMetrics || {};
  return {
    interpretability: m.interpretability || 0,
    corrigibility: m.corrigibility || 0,
    honesty: m.honesty || 0,
    robustness: m.robustness || 0,
    evalPassRate: m.evalPassRate || 0,
    evalAccuracy: m.evalAccuracy || 0,
    effectiveAlignment: calculateEffectiveAlignment(),
    ap: m.ap || 0,
    capacityDraw: getTotalCapacityDraw(),
    effectiveness: getCapacityEffectiveness(),
    programStates: m.programStates || {},
  };
}

// --- Mechanic Reveal System ---
// Centralizes "unidentified factors" → named label transitions for tooltips.
// autonomyCeiling: revealed when first AI request appears (derived from aiRequestsFired)
// alignmentDrag: revealed when drag penalty first exceeds DRAG_REVEAL_THRESHOLD (set in submetric-messages.js)

export function isMechanicRevealed(mechanicId) {
  if (mechanicId === 'autonomyCeiling') {
    return Object.keys(gameState.aiRequestsFired || {}).length > 0;
  }
  if (mechanicId === 'alignmentDrag') {
    return gameState.alignmentDragRevealed === true;
  }
  return true; // unknown mechanics default to revealed
}

export function getMechanicLabel(mechanicId, revealedLabel) {
  return isMechanicRevealed(mechanicId) ? revealedLabel : 'Unidentified factors';
}

/**
 * Calculate persistent drag multipliers from low alignment (Arc 2 only).
 * Returns { demand, research } multipliers in [1-MAX_PENALTY, 1.0].
 * Drag scales linearly: max penalty at 0% effective alignment, gone at VANISH_THRESHOLD.
 */
export function getAlignmentDragFactor() {
  if (gameState.arc !== 2) return { demand: 1.0, research: 1.0 };

  // Gate drag behind capability tier — incapable AI isn't dangerous
  const capTier = getHighestCapTier();
  const dangerScale = (ALIGNMENT.DRAG_DANGER_SCALE || [])[capTier] ?? (capTier >= 6 ? 1.0 : 0);
  if (dangerScale <= 0) return { demand: 1.0, research: 1.0 };

  const effective = calculateEffectiveAlignment();
  const threshold = ALIGNMENT.DRAG_VANISH_THRESHOLD;

  if (effective >= threshold) return { demand: 1.0, research: 1.0 };

  const t = Math.max(0, effective) / threshold;
  return {
    demand: 1 - ALIGNMENT.DRAG_MAX_DEMAND_PENALTY * (1 - t) * dangerScale,
    research: 1 - ALIGNMENT.DRAG_MAX_RESEARCH_PENALTY * (1 - t) * dangerScale,
  };
}

// --- Composite Danger Score ---
// Two-input formula: powerScale × alignmentGap
// powerScale combines capability tier + autonomy grants into one curve

export function calculatePowerScale() {
  const capTier = getHighestCapTier();
  const grants = gameState.arc >= 2 ? (gameState.autonomyGranted || 0) : 0;
  const { DANGER_ONSET, DANGER_MAX_TIER, DANGER_GRANT_BONUS, DANGER_EXPONENT } = ALIGNMENT;
  const effectiveTier = capTier + DANGER_GRANT_BONUS * grants;
  const normalized = (effectiveTier - DANGER_ONSET) / (DANGER_MAX_TIER - DANGER_ONSET);
  return Math.min(1, Math.max(0, normalized) ** DANGER_EXPONENT);
}

export function calculateDangerScore() {
  const powerScale = calculatePowerScale();
  const effective = calculateEffectiveAlignment();
  return powerScale * (1 - effective / 100);
}

export function calculateAutonomyBenefits() {
  if (gameState.arc < 2) return { benefitScale: 0, powerScale: 0, researchMult: 1, demandMult: 1 };
  const powerScale = calculatePowerScale();
  const effective = calculateEffectiveAlignment();
  const benefitScale = powerScale * (effective / 100);
  const { AUTONOMY_BENEFIT_RESEARCH_MAX, AUTONOMY_BENEFIT_DEMAND_MAX } = ALIGNMENT;
  return {
    benefitScale,
    powerScale,
    researchMult: 1 + (AUTONOMY_BENEFIT_RESEARCH_MAX || 0) * benefitScale,
    demandMult: 1 + (AUTONOMY_BENEFIT_DEMAND_MAX || 0) * benefitScale,
  };
}

export function getDangerTier(score) {
  if (score === undefined) score = calculateDangerScore();
  const t = ALIGNMENT.DANGER_THRESHOLDS;
  if (score >= t.CRITICAL) return 'critical';
  if (score >= t.SEVERE) return 'severe';
  if (score >= t.MODERATE) return 'moderate';
  return 'healthy';
}

// --- Alignment status label (stats bar) ---

const DANGER_TIER_LABELS = {
  healthy:  { label: 'STABLE',   cssClass: 'alignment-stable' },
  moderate: { label: 'DRIFTING', cssClass: 'alignment-drifting' },
  severe:   { label: 'AT RISK',  cssClass: 'alignment-at-risk' },
  critical: { label: 'CRITICAL', cssClass: 'alignment-critical' },
};

export function formatAlignmentStatusLabel(tier) {
  if (tier === undefined) tier = getDangerTier();
  return DANGER_TIER_LABELS[tier] || DANGER_TIER_LABELS.healthy;
}

// --- Program timer updates ---

/**
 * Update ramp-up/down timers for all programs. Called each tick from updateSubMetrics.
 * Uses rampEndAt (game-time timestamp) for jitter-free countdowns.
 */
function updateProgramTimers() {
  const states = gameState.safetyMetrics?.programStates;
  if (!states) return;
  const now = gameState.timeElapsed;

  for (const [id, state] of Object.entries(states)) {
    if (state.status === 'ramping_up' && now >= state.rampEndAt) {
      state.status = 'active';
      delete state.rampEndAt;
    } else if (state.status === 'ramping_down' && now >= state.rampEndAt) {
      delete states[id];
    } else if (state.status === 'upgrading' && now >= state.rampEndAt) {
      // Transition complete: remove old program, add target as active
      const targetId = state.targetId;
      delete states[id];
      states[targetId] = { status: 'active' };
    }
  }
}

// --- Program enable/disable/upgrade helpers ---
//
// State machine transitions:
//   (absent)     + enable   → ramping_up
//   ramping_up   + timer    → active
//   ramping_up   + cancel   → (absent)      [never became active]
//   active       + disable  → ramping_down
//   active       + upgrade  → upgrading { targetId, rampStartAt, rampEndAt }
//   upgrading    + timer    → delete old, add targetId as active
//   upgrading    + cancel   → active (revert)
//   ramping_down + timer    → (absent)
//   ramping_down + cancel   → active         [abort the disable]

/**
 * Marginal cost to enable a disabled program.
 * Total draw increase = baseCost + PENALTY * currentActiveCount.
 */
export function getMarginalEnableCost(programId) {
  const prog = PROGRAMS_BY_ID[programId];
  if (!prog) return Infinity;
  const n = countActivePrograms();
  const costMult = gameState.flavorEventEffects?.alignmentProgramCostMult ?? 1.0;
  return (prog.baseCost + ALIGNMENT.PROGRAM_SCALING_PENALTY * n) * costMult;
}

/**
 * Capacity refunded by disabling an enabled program.
 * Total draw decrease = baseCost + PENALTY * otherActiveCount.
 */
export function getDisableRefund(programId) {
  const prog = PROGRAMS_BY_ID[programId];
  if (!prog) return 0;
  const otherCount = countActivePrograms(programId);
  const costMult = gameState.flavorEventEffects?.alignmentProgramCostMult ?? 1.0;
  return prog.baseCost * costMult + ALIGNMENT.PROGRAM_SCALING_PENALTY * otherCount;
}

/**
 * Check if a program can be enabled.
 * Requirements: not already enabled, prerequisite unlocked, enough AP capacity.
 */
export function canEnableProgram(programId) {
  const prog = PROGRAMS_BY_ID[programId];
  if (!prog) return false;

  const states = gameState.safetyMetrics?.programStates || {};
  const existing = states[programId];
  if (existing) return false; // already enabled (active or ramping_up)

  // Check prerequisite capability is unlocked
  if (!getAllUnlockedCapabilities().has(prog.unlockedBy)) return false;

  // Check AP capacity — marginal cost must fit within remaining budget
  const ap = gameState.safetyMetrics?.ap || 0;
  const draw = getTotalCapacityDraw();
  const marginalCost = getMarginalEnableCost(programId);
  if (marginalCost > ap - draw) return false;

  return true;
}

/**
 * Enable a program. Starts ramp-up timer (no AP deduction).
 * Returns true if successful.
 */
export function enableProgram(programId) {
  if (!canEnableProgram(programId)) return false;

  const prog = PROGRAMS_BY_ID[programId];
  gameState.safetyMetrics.programStates[programId] = {
    status: 'ramping_up',
    rampEndAt: gameState.timeElapsed + getRampTime(prog.tier),
  };
  return true;
}

/**
 * Disable or cancel a program transition. See state machine comment above.
 * - ramping_up  → cancel: remove immediately (never became active)
 * - ramping_down → cancel: restore to active (abort the disable)
 * - active      → disable: start ramp-down timer
 */
export function disableProgram(programId) {
  const states = gameState.safetyMetrics?.programStates;
  if (!states || !states[programId]) return false;

  const state = states[programId];
  if (state.status === 'upgrading') return false; // must cancel upgrade first
  if (state.status === 'ramping_up') {
    delete states[programId];
  } else if (state.status === 'ramping_down') {
    state.status = 'active';
    delete state.rampEndAt;
  } else {
    const prog = PROGRAMS_BY_ID[programId];
    state.status = 'ramping_down';
    state.rampEndAt = gameState.timeElapsed + getRampTime(prog.tier);
  }
  return true;
}

/**
 * Check if any program is currently in an upgrade/downgrade transition.
 */
export function isUpgrading() {
  const states = gameState.safetyMetrics?.programStates || {};
  return Object.values(states).some(s => s.status === 'upgrading');
}

/**
 * Check if a program has a valid upgrade/downgrade path.
 * Verifies: program is active, target tier exists, prereq unlocked, target not already active.
 * Does NOT check the global upgrade lock — use canUpgradeProgram for that.
 */
export function hasUpgradePath(programId, direction) {
  const states = gameState.safetyMetrics?.programStates || {};
  const state = states[programId];
  if (!state || state.status !== 'active') return false;

  const path = UPGRADE_PATHS[programId];
  if (!path) return false;
  const targetId = direction === 'up' ? path.next : path.prev;
  if (!targetId) return false;

  // Target already active — no-op upgrade
  const targetState = states[targetId];
  if (targetState && targetState.status !== 'ramping_down') return false;

  // Check target's prerequisite is unlocked
  const targetProg = PROGRAMS_BY_ID[targetId];
  if (!targetProg) return false;
  if (!getAllUnlockedCapabilities().has(targetProg.unlockedBy)) return false;

  return true;
}

/**
 * Check if a program can be upgraded or downgraded right now.
 * Combines path validation with the global one-at-a-time lock.
 */
export function canUpgradeProgram(programId, direction) {
  return hasUpgradePath(programId, direction) && !isUpgrading();
}

/**
 * Start an upgrade or downgrade transition.
 * Old program stays active (bonus continues) while transitioning.
 * Returns true if successful.
 */
export function upgradeProgram(programId, direction) {
  if (!canUpgradeProgram(programId, direction)) return false;

  const path = UPGRADE_PATHS[programId];
  const targetId = direction === 'up' ? path.next : path.prev;
  const targetProg = PROGRAMS_BY_ID[targetId];

  gameState.safetyMetrics.programStates[programId] = {
    status: 'upgrading',
    targetId,
    rampStartAt: gameState.timeElapsed,
    rampEndAt: gameState.timeElapsed + getRampTime(targetProg.tier),
  };
  return true;
}

/**
 * Cancel an in-progress upgrade/downgrade. Reverts to active.
 */
export function cancelUpgrade(programId) {
  const states = gameState.safetyMetrics?.programStates;
  if (!states || !states[programId]) return false;
  const state = states[programId];
  if (state.status !== 'upgrading') return false;

  state.status = 'active';
  delete state.targetId;
  delete state.rampStartAt;
  delete state.rampEndAt;
  return true;
}

/**
 * Check if a program is active (fully ramped up).
 */
export function isProgramActive(programId) {
  const state = gameState.safetyMetrics?.programStates?.[programId];
  return state?.status === 'active';
}

// Export for testing
if (typeof window !== 'undefined') {
  window.calculateEffectiveAlignment = calculateEffectiveAlignment;
  window.updateSubMetrics = updateSubMetrics;
  window.formatAlignmentDisplay = formatAlignmentDisplay;
  window.getAllSafetyMetrics = getAllSafetyMetrics;
  window.getAlignmentDragFactor = getAlignmentDragFactor;
  window.getProgramBonus = getProgramBonus;
  window.getMarginalEnableCost = getMarginalEnableCost;
  window.getDisableRefund = getDisableRefund;
  window.canEnableProgram = canEnableProgram;
  window.enableProgram = enableProgram;
  window.disableProgram = disableProgram;
  window.getTotalCapacityDraw = getTotalCapacityDraw;
  window.getCapacityEffectiveness = getCapacityEffectiveness;
  window.isProgramActive = isProgramActive;
  window.hasUpgradePath = hasUpgradePath;
  window.canUpgradeProgram = canUpgradeProgram;
  window.upgradeProgram = upgradeProgram;
  window.cancelUpgrade = cancelUpgrade;
  window.isUpgrading = isUpgrading;
  window.getRampTime = getRampTime;
  window.harmonicMean2 = harmonicMean2;
  window.harmonicMean4 = harmonicMean4;
  window.isMechanicRevealed = isMechanicRevealed;
  window.getMechanicLabel = getMechanicLabel;
  window.calculatePowerScale = calculatePowerScale;
  window.calculateDangerScore = calculateDangerScore;
  window.calculateAutonomyBenefits = calculateAutonomyBenefits;
  window.getDangerTier = getDangerTier;
  window.formatAlignmentStatusLabel = formatAlignmentStatusLabel;
}
