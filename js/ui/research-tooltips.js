// js/ui/research-tooltips.js
// Tooltip builders for research rate breakdowns (global + per-track).
// Builders are called on each tick by showTooltipFor to auto-refresh content.

import { gameState } from '../game-state.js';
import { calculateResearchRateBreakdown } from '../resources.js';
import { formatNumber, getRateUnit } from '../utils/format.js';
import { attachTooltip } from './stats-tooltip.js';
import { capabilitiesTrack } from '../content/capabilities-track.js';

const TRACK_NAMES = {
  capabilities: 'Capabilities',
  applications: 'Applications',
  alignment: 'Alignment',
};

// ---------------------------------------------------------------------------
// Global research rate tooltip
// ---------------------------------------------------------------------------

/**
 * Builder function for the global research rate tooltip.
 * Shows personnel base, capability bonus, compute boost, strategy, and AI self-improvement.
 * Passed by reference to showTooltipFor (same pattern as buildFundingTooltip).
 */
export function buildGlobalResearchTooltip() {
  const bd = gameState.computed?.research || calculateResearchRateBreakdown();

  let html = '<div class="tooltip-header">';
  html += '<span>Research Rate</span>';
  html += `<span class="tooltip-rate">+${formatNumber(bd.total)}${getRateUnit()}</span>`;
  html += '</div>';

  html += '<div class="tooltip-section">';
  html += '<div class="tooltip-section-header">Sources:</div>';

  // Personnel Base (always shown)
  html += `<div class="tooltip-row"><span>Personnel Base</span><span>${formatNumber(bd.personnelBase)}${getRateUnit()}</span></div>`;

  // Capability Bonus (when > 1.01)
  if (bd.capMultiplier > 1.01) {
    html += `<div class="tooltip-row"><span>Capability Bonus</span><span class="positive">&times;${bd.capMultiplier.toFixed(2)}</span></div>`;
  }

  // Compute Boost (when != 1.0)
  if (bd.computeBoost < 0.99 || bd.computeBoost > 1.01) {
    let cls;
    if (bd.computeBoost < 0.5) cls = 'negative';
    else if (bd.computeBoost < 1.0) cls = 'warning';
    else cls = 'positive';
    html += `<div class="tooltip-row"><span>Compute Boost</span><span class="${cls}">&times;${bd.computeBoost.toFixed(2)}</span></div>`;
  }

  // Strategy (when != 1)
  if (bd.strategyMultiplier < 0.99 || bd.strategyMultiplier > 1.01) {
    const cls = bd.strategyMultiplier >= 1 ? 'positive' : 'negative';
    html += `<div class="tooltip-row"><span>Strategy</span><span class="${cls}">&times;${bd.strategyMultiplier.toFixed(2)}</span></div>`;
  }

  // CEO Focus: Hands-on Research multiplier (when > 1.01)
  if (bd.ceoResearchMult > 1.01) {
    const pct = Math.round((bd.ceoResearchMult - 1) * 100);
    html += `<div class="tooltip-row"><span>CEO Research</span><span class="positive">+${pct}%</span></div>`;
  }


  // AI Self-Improvement (when feedbackContribution > 0)
  if (bd.feedbackContribution > 0) {
    html += `<div class="tooltip-row"><span>AI Self-Improvement</span><span class="positive">+${formatNumber(bd.feedbackContribution)}${getRateUnit()}</span></div>`;
  }

  html += '</div>';
  return html;
}

// ---------------------------------------------------------------------------
// AI Self-Improvement tooltip
// ---------------------------------------------------------------------------

/**
 * Builder for AI self-improvement row tooltip.
 * Shows which T7+ capabilities contribute and their individual rates.
 */
export function buildAISelfImprovementTooltip() {
  const bd = gameState.computed?.research || {};
  const capRP = gameState.tracks?.capabilities?.researchPoints || 0;

  let html = '<div class="tooltip-header">';
  html += '<span>AI Self-Improvement</span>';
  html += `<span class="tooltip-rate">+${formatNumber(bd.feedbackContribution || 0)}${getRateUnit()}</span>`;
  html += '</div>';

  html += '<div class="tooltip-section">';
  html += '<div class="tooltip-section-header">Formula: capability RP × rate × data effectiveness</div>';
  html += `<div class="tooltip-row"><span>Capability RP</span><span>${formatNumber(capRP)}</span></div>`;

  const unlockedCaps = gameState.tracks?.capabilities?.unlockedCapabilities || [];
  const caps = capabilitiesTrack.capabilities;

  // Each tier replaces the previous — show only the highest active tier
  const feedbackCaps = ['recursive_improvement', 'self_improvement', 'autonomous_research'];
  const activeCap = feedbackCaps.find(id => unlockedCaps.includes(id));
  if (activeCap) {
    const capData = caps.find(c => c.id === activeCap);
    const rate = capData.effects.capFeedbackRate;
    const dataEff = bd.dataEffectivenessMultiplier ?? 1;
    html += `<div class="tooltip-row"><span>${capData.name} (${(rate * 100).toFixed(2)}%/s)</span><span class="positive">+${formatNumber(capRP * rate * dataEff)}${getRateUnit()}</span></div>`;
  } else {
    html += '<div class="tooltip-row dim"><span>Unlock T7+ capabilities to enable</span><span>—</span></div>';
  }

  html += '</div>';
  return html;
}

// ---------------------------------------------------------------------------
// Per-track research rate tooltip
// ---------------------------------------------------------------------------

/**
 * Returns a builder function (closure over trackId) for a per-track tooltip.
 * Shows the multiplicative chain: global rate -> allocation -> track modifiers.
 */
export function buildTrackResearchTooltip(trackId) {
  return function () {
    const bd = gameState.computed?.research || calculateResearchRateBreakdown();
    const trackBd = bd.tracks?.[trackId];
    const trackName = TRACK_NAMES[trackId] || trackId;
    const effectiveRate = trackBd?.effective || 0;
    const allocation = trackBd?.allocation || 0;

    let html = '<div class="tooltip-header">';
    html += `<span>${trackName} Rate</span>`;
    html += `<span class="tooltip-rate">+${formatNumber(effectiveRate)}${getRateUnit()}</span>`;
    html += '</div>';

    html += '<div class="tooltip-section">';
    html += '<div class="tooltip-section-header">Breakdown:</div>';

    // Global Rate (always)
    html += `<div class="tooltip-row"><span>Global Rate</span><span>+${formatNumber(bd.total)}${getRateUnit()}</span></div>`;

    // Allocation
    const allocPct = (allocation * 100).toFixed(0);
    html += `<div class="tooltip-row"><span>Allocation</span><span>&times;${allocation.toFixed(2)} (${allocPct}%)</span></div>`;

    // Track-specific modifiers
    if (trackBd) {
      if (trackId === 'capabilities') {
        // Culture Cap Focus
        if (trackBd.cultureCapBonus > 0) {
          const pct = (trackBd.cultureCapBonus * 100).toFixed(0);
          html += `<div class="tooltip-row"><span>Culture Cap Focus</span><span class="positive">+${pct}%</span></div>`;
        }

        // Data Quality
        const dataEff = trackBd.dataEffectiveness;
        if (dataEff !== undefined && (dataEff < 0.99 || dataEff > 1.01)) {
          let cls;
          if (dataEff < 0.5) cls = 'negative';
          else if (dataEff < 0.99) cls = 'warning';
          else cls = 'positive';
          html += `<div class="tooltip-row"><span>Data Quality</span><span class="${cls}">&times;${dataEff.toFixed(2)}</span></div>`;
        }

        // Customer Feedback
        if (trackBd.customerFeedback > 0) {
          const pct = (trackBd.customerFeedback * 100).toFixed(0);
          html += `<div class="tooltip-row"><span>Customer Feedback</span><span class="positive">+${pct}%</span></div>`;
        }

        // Autonomy Grant
        if (trackBd.autonomyGrant && trackBd.autonomyGrant !== 1) {
          html += `<div class="tooltip-row"><span>Autonomy Grant</span><span class="positive">&times;${trackBd.autonomyGrant.toFixed(2)}</span></div>`;
        }

        // AI Self-Improvement feedback
        if (trackBd.feedbackContribution > 0) {
          html += `<div class="tooltip-row"><span>AI Self-Improvement</span><span class="positive">+${formatNumber(trackBd.feedbackContribution)}${getRateUnit()}</span></div>`;
        }

        // PAUSED
        if (trackBd.paused) {
          html += `<div class="tooltip-row"><span>PAUSED</span><span class="negative">&times;0</span></div>`;
        }
      }

      if (trackId === 'alignment') {
        // Alignment Debt
        const decay = trackBd.alignmentDecay;
        if (decay !== undefined && decay < 0.99) {
          const cls = decay < 0.5 ? 'negative' : 'warning';
          html += `<div class="tooltip-row"><span>Alignment Debt</span><span class="${cls}">&times;${decay.toFixed(2)}</span></div>`;
        }
      }

      // Culture: Balanced bonus (all tracks, when > 0)
      if (trackBd.balancedBonus > 0) {
        const pct = (trackBd.balancedBonus * 100).toFixed(0);
        html += `<div class="tooltip-row"><span>Balanced</span><span class="positive">+${pct}%</span></div>`;
      }

    }

    html += '</div>';
    return html;
  };
}

// ---------------------------------------------------------------------------
// Initialization — wire hover events
// ---------------------------------------------------------------------------

const TRACK_RATE_ELEMENTS = ['track-rate-cap', 'track-rate-app', 'track-rate-ali'];
const TRACK_IDS = ['capabilities', 'applications', 'alignment'];

export function initResearchTooltips() {
  // Global rate tooltip — wire to the stats bar research group
  const statsBarResearchGroup = document.querySelector('#stats-bar .stats-group:nth-child(3)');
  if (statsBarResearchGroup) {
    statsBarResearchGroup.style.cursor = 'help';
    attachTooltip(statsBarResearchGroup, buildGlobalResearchTooltip);
  }

  // Per-track rate tooltips
  for (let i = 0; i < TRACK_RATE_ELEMENTS.length; i++) {
    const el = document.getElementById(TRACK_RATE_ELEMENTS[i]);
    if (el) {
      el.style.cursor = 'help';
      attachTooltip(el, buildTrackResearchTooltip(TRACK_IDS[i]));
    }
  }

  // AI Self-Improvement tooltip (on the research-ai-group ledger row)
  const aiRow = document.querySelector('#research-ai-group .ledger-row');
  if (aiRow) {
    aiRow.style.cursor = 'help';
    attachTooltip(aiRow, buildAISelfImprovementTooltip);
  }
}
