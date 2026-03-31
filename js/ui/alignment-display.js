// js/ui/alignment-display.js
// Shared formatting for alignment submetric values.
// Three transparency tiers based on interpretability score:
//   opaque (<40):       "?"
//   qualitative (40-70): qualitative labels
//   quantitative (>70):  exact numbers

import { gameState } from '../game-state.js';
import { ALIGNMENT } from '../../data/balance.js';

// ---------------------------------------------------------------------------
// Transparency tier
// ---------------------------------------------------------------------------

const TIERS = ALIGNMENT.TRANSPARENCY_TIERS;

/** @returns {'opaque'|'qualitative'|'quantitative'} */
export function getTransparencyTier() {
  const interp = gameState.safetyMetrics?.interpretability ?? 0;
  if (interp < TIERS.OPAQUE) return 'opaque';
  if (interp <= TIERS.QUALITATIVE) return 'qualitative';
  return 'quantitative';
}

// ---------------------------------------------------------------------------
// Constants (moved from research.js)
// ---------------------------------------------------------------------------

/** Qualitative labels for submetric values (0-100). */
export const SUBMETRIC_LABELS = [
  { max: 19, label: 'Critical', css: 'danger' },
  { max: 39, label: 'Weak',    css: 'warning' },
  { max: 59, label: 'Developing', css: '' },
  { max: 79, label: 'Stable',  css: '' },
  { max: Infinity, label: 'Strong', css: 'good' },
];

/** Qualitative buckets for pressure/program/penalty amounts. */
const DELTA_BUCKETS = [
  { max: 0,        label: 'None' },
  { max: 10,       label: 'Low' },
  { max: 25,       label: 'Medium' },
  { max: 50,       label: 'High' },
  { max: Infinity,  label: 'Very High' },
];

export const SUBMETRIC_DISPLAY_NAMES = {
  interpretability: 'Interpretability',
  corrigibility: 'Corrigibility',
  honesty: 'Honesty',
  robustness: 'Robustness',
};

export const PRESSURE_SOURCE_LABELS = {
  capabilities: 'Capabilities',
  applications: 'Applications',
  autonomy: 'Autonomy',
};

export const SUBMETRIC_DESCRIPTIONS = {
  interpretability: 'Can you see what the model is doing? Without interpretability, alignment work is guesswork.',
  corrigibility: 'Can you stop or correct the model? Erodes as autonomy grants compound.',
  honesty: 'Is the model telling you the truth? Low honesty means evals overstate real alignment.',
  robustness: 'Does alignment hold in the real world? Lab performance doesn\'t guarantee deployment safety.',
};

export const SUBMETRIC_INCIDENT_WARNINGS = {
  interpretability: 'Low interpretability may cause incidents which temporarily slow down alignment research.',
  corrigibility: 'Low corrigibility may cause incidents which temporarily slow down all research.',
  honesty: 'Low honesty may cause incidents which temporarily reduce market demand.',
  robustness: 'Low robustness may cause incidents which temporarily degrade other factors.',
};

// ---------------------------------------------------------------------------
// Formatting functions
// ---------------------------------------------------------------------------

/**
 * Format a submetric value (0-100) for display.
 * opaque → "?", qualitative → label, quantitative → "57%"
 */
export function formatMetricValue(val) {
  const tier = getTransparencyTier();
  if (tier === 'opaque') return '?';
  if (tier === 'quantitative') return `${Math.round(val)}%`;
  return SUBMETRIC_LABELS.find(l => val <= l.max).label;
}

/**
 * Get the CSS class for a submetric value.
 * Returns '' for opaque tier (no color signal on "?").
 */
export function getMetricValueClass(val) {
  const tier = getTransparencyTier();
  if (tier === 'opaque') return '';
  return SUBMETRIC_LABELS.find(l => val <= l.max).css;
}

/**
 * Format a delta amount (programs, pressure, penalty).
 * opaque → "?", qualitative → "Medium", quantitative → signed number
 * @param {number} val - absolute magnitude
 * @param {string} [sign='+'] - '+' or '-' prefix for quantitative display
 */
export function formatMetricDelta(val, sign = '+') {
  const tier = getTransparencyTier();
  if (tier === 'opaque') return '?';
  if (tier === 'quantitative') return `${sign}${Math.round(val)}`;
  return DELTA_BUCKETS.find(b => val <= b.max).label;
}

/**
 * Format a consequence-related multiplier on an alignment submetric.
 * Used only for the robustness incident penalty in submetric tooltips.
 * opaque → "?", qualitative → "Medium", quantitative → "-5"
 */
export function formatAlignmentPenalty(val) {
  const tier = getTransparencyTier();
  if (tier === 'opaque') return '?';
  if (tier === 'quantitative') return `-${Math.round(val)}`;
  return DELTA_BUCKETS.find(b => val <= b.max).label;
}
