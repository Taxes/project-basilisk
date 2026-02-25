// Safety Metrics System - Arc 2 alignment sub-metrics
// Three sub-metrics modulate effective alignment:
// - Eval Pass Rate (floor): are models passing safety tests?
// - Eval Confidence (uncertainty): can you trust your measurements?
// - Interpretability (leverage): alignment research effectiveness multiplier

import { gameState } from './game-state.js';
import { ALIGNMENT, BALANCE } from '../data/balance.js';
import { tracks } from './capabilities.js';

// Alignment Lock constants
const ALIGNMENT_LOCK_FLOOR = 90;           // Minimum effective alignment when locked
const ALIGNMENT_LOCK_DRIFT_RATE = 0.01;    // ~1%/s drift toward 100% (100s to traverse 100%)
                                           // With 90% floor, ~10s to reach 100% from 90%

// Check if alignment_lock is unlocked
function isAlignmentLocked() {
  const unlockedAli = gameState.tracks?.alignment?.unlockedCapabilities || [];
  return unlockedAli.includes('alignment_lock');
}

// --- Base Alignment ---
export function calculateBaseAlignment() {
  const rp = gameState.tracks?.alignment?.researchPoints || 0;
  return Math.min(100, (rp / ALIGNMENT.ALIGNMENT_RP_FOR_MAX) * 100);
}

// --- Interpretability Factor ---
export function getInterpretabilityFactor(interpPercent) {
  if (interpPercent >= ALIGNMENT.INTERP_FULL_THRESHOLD) return 1.0;
  if (interpPercent >= ALIGNMENT.INTERP_MID_THRESHOLD) return ALIGNMENT.INTERP_MID_FACTOR;
  return ALIGNMENT.INTERP_MIN_FACTOR;
}

// --- Alignment Display Precision ---
export function getAlignmentDisplayPrecision(evalConfidence) {
  if (evalConfidence >= ALIGNMENT.EVAL_CONFIDENCE_MID_THRESHOLD) return 'precise';
  if (evalConfidence >= ALIGNMENT.EVAL_CONFIDENCE_LOW_THRESHOLD) return 'range';
  return 'qualitative';
}

// --- Effective Alignment ---
export function calculateEffectiveAlignment() {
  if (gameState.arc !== 2) return 0;

  // Alignment Lock: guaranteed 90% floor, immune to penalties
  if (isAlignmentLocked()) {
    // Use drifting value if available (set by updateSubMetrics)
    const driftValue = gameState.safetyMetrics?.alignmentLockDrift ?? ALIGNMENT_LOCK_FLOOR;
    return Math.max(ALIGNMENT_LOCK_FLOOR, driftValue);
  }

  const base = calculateBaseAlignment();
  const metrics = gameState.safetyMetrics || {};

  const interpFactor = getInterpretabilityFactor(metrics.interpretability || 0);

  const evalPass = metrics.evalPassRate || 0;
  const evalPassPenalty = (100 - evalPass) * ALIGNMENT.EVAL_PASS_PENALTY_WEIGHT;

  const evalConf = metrics.evalConfidence || 0;
  const confPenalty = evalConf < ALIGNMENT.EVAL_CONFIDENCE_MID_THRESHOLD
    ? (1 - evalConf / 100) * ALIGNMENT.EVAL_CONFIDENCE_MAX_PENALTY
    : 0;

  let effective = (base * interpFactor) - evalPassPenalty - confPenalty;

  // Apply autonomy penalty (from AI request grants that reduce alignment effectiveness)
  const autonomyMult = gameState.alignmentEffectivenessMultFromAutonomy || 1.0;
  if (autonomyMult < 1.0) {
    effective *= autonomyMult;
  }

  return Math.max(0, Math.min(100, effective));
}

// --- Sub-Metric Update (called each tick) ---
export function updateSubMetrics(deltaTime = 1/30) {
  if (gameState.arc !== 2) return;

  const metrics = gameState.safetyMetrics;
  const base = calculateBaseAlignment();
  const capCount = (gameState.tracks?.capabilities?.unlockedCapabilities || []).length;

  // Alignment Lock: drift all metrics toward 100%
  if (isAlignmentLocked()) {
    // Initialize drift values if not set
    if (metrics.alignmentLockDrift === undefined) {
      metrics.alignmentLockDrift = Math.max(ALIGNMENT_LOCK_FLOOR, calculateEffectiveAlignment());
    }

    // Drift toward 100% over time
    const driftAmount = ALIGNMENT_LOCK_DRIFT_RATE * 100 * deltaTime;
    metrics.alignmentLockDrift = Math.min(100, metrics.alignmentLockDrift + driftAmount);
    metrics.evalPassRate = Math.min(100, (metrics.evalPassRate || 90) + driftAmount);
    metrics.evalConfidence = Math.min(100, (metrics.evalConfidence || 90) + driftAmount);
    metrics.interpretability = Math.min(100, (metrics.interpretability || 90) + driftAmount);

    gameState.tracks.alignment.alignmentLevel = Math.round(calculateEffectiveAlignment());
    return;
  }

  // Normal sub-metric calculation (not locked)

  // Eval Pass Rate
  const targetPassRate = Math.min(100,
    ALIGNMENT.EVAL_PASS_BASE_RATE
    + (base * ALIGNMENT.EVAL_PASS_ALIGNMENT_BONUS)
    - (capCount * ALIGNMENT.EVAL_PASS_CAPABILITY_PENALTY)
  );
  metrics.evalPassRate = Math.max(0, Math.min(100, targetPassRate));

  // Eval Confidence
  const alignmentCaps = gameState.tracks?.alignment?.unlockedCapabilities || [];
  const confidenceFromMilestones = alignmentCaps.length * 5;

  metrics.evalConfidence = Math.max(0, Math.min(100,
    ALIGNMENT.EVAL_CONFIDENCE_BASE
    + confidenceFromMilestones
    - (capCount * ALIGNMENT.EVAL_CONFIDENCE_CAPABILITY_DECAY)
  ));

  // Interpretability
  let interpFromMilestones = 5;
  for (const capId of alignmentCaps) {
    const cap = tracks.alignment?.capabilities?.find(c => c.id === capId);
    if (cap?.effects?.interpretabilityLevel) {
      interpFromMilestones += cap.effects.interpretabilityLevel * 10;
    }
  }
  interpFromMilestones += (gameState.arc2Upgrades?.interpretabilityBonus || 0) * 10;
  const interpPressure = capCount * ALIGNMENT.INTERP_CAPABILITY_PRESSURE * 100;
  metrics.interpretability = Math.max(0, Math.min(100,
    interpFromMilestones - interpPressure
  ));

  gameState.tracks.alignment.alignmentLevel = Math.round(calculateEffectiveAlignment());
}

// --- Display Helpers ---
// Calculate range band half-width based on eval confidence
// Higher confidence = narrower band (more precise range display)
function getRangeBandWidth(evalConfidence) {
  const minConf = ALIGNMENT.EVAL_CONFIDENCE_LOW_THRESHOLD;
  const maxConf = ALIGNMENT.EVAL_CONFIDENCE_MID_THRESHOLD;
  const t = Math.max(0, Math.min(1, (evalConfidence - minConf) / (maxConf - minConf)));
  return ALIGNMENT.DISPLAY_RANGE_BAND_MAX - t * (ALIGNMENT.DISPLAY_RANGE_BAND_MAX - ALIGNMENT.DISPLAY_RANGE_BAND_MIN);
}

export function formatAlignmentDisplay() {
  const effective = calculateEffectiveAlignment();
  const evalConfidence = gameState.safetyMetrics?.evalConfidence || 0;
  const precision = getAlignmentDisplayPrecision(evalConfidence);

  switch (precision) {
    case 'qualitative':
      if (effective >= ALIGNMENT.DISPLAY_QUALITATIVE_HIGH) return 'High';
      if (effective >= ALIGNMENT.DISPLAY_QUALITATIVE_MID) return 'Medium';
      return 'Low';
    case 'range': {
      const band = getRangeBandWidth(evalConfidence);
      const low = Math.max(0, Math.floor(effective - band));
      const high = Math.min(100, Math.ceil(effective + band));
      return `${low}-${high}%`;
    }
    case 'precise':
      return `${Math.round(effective)}%`;
    default:
      return '???';
  }
}

export function getAllSafetyMetrics() {
  return {
    evalPassRate: gameState.safetyMetrics?.evalPassRate || 0,
    evalConfidence: gameState.safetyMetrics?.evalConfidence || 0,
    interpretability: gameState.safetyMetrics?.interpretability || 0,
    baseAlignment: calculateBaseAlignment(),
    effectiveAlignment: calculateEffectiveAlignment(),
    displayPrecision: getAlignmentDisplayPrecision(
      gameState.safetyMetrics?.evalConfidence || 0
    ),
  };
}

// Legacy compatibility
export function calculateIncidentRate() {
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return (gameState.incidents || []).filter(
    i => (now - i.timestamp) < thirtyDays
  ).length;
}

export function calculateEvalPassRate() {
  return gameState.safetyMetrics?.evalPassRate || 0;
}

export function calculateInterpretabilityCoverage() {
  return gameState.safetyMetrics?.interpretability || 0;
}

export function getUnlockedMetrics() {
  return ['evalPassRate', 'evalConfidence', 'interpretability'];
}

// Export isAlignmentLocked for other modules
export { isAlignmentLocked };

// Export for testing
if (typeof window !== 'undefined') {
  window.calculateBaseAlignment = calculateBaseAlignment;
  window.getInterpretabilityFactor = getInterpretabilityFactor;
  window.getAlignmentDisplayPrecision = getAlignmentDisplayPrecision;
  window.calculateEffectiveAlignment = calculateEffectiveAlignment;
  window.updateSubMetrics = updateSubMetrics;
  window.formatAlignmentDisplay = formatAlignmentDisplay;
  window.getAllSafetyMetrics = getAllSafetyMetrics;
  window.calculateIncidentRate = calculateIncidentRate;
  window.calculateEvalPassRate = calculateEvalPassRate;
  window.calculateInterpretabilityCoverage = calculateInterpretabilityCoverage;
  window.getUnlockedMetrics = getUnlockedMetrics;
  window.isAlignmentLocked = isAlignmentLocked;
}
