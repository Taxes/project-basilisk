// js/ui/research-tooltips.js
// Tooltip builders for research rate breakdowns (global + per-track).
// Builders are called on each tick by showTooltipFor to auto-refresh content.

import { gameState } from '../game-state.js';
import { calculateResearchRateBreakdown } from '../resources.js';
import { getPurchasableById, PERSONNEL_IDS } from '../content/purchasables.js';
import { formatNumber, getRateUnit } from '../utils/format.js';
import { attachTooltip } from './stats-tooltip.js';
import { capabilitiesTrack } from '../content/capabilities-track.js';
import { isMechanicRevealed, getMechanicLabel } from '../safety-metrics.js';
import { getActiveTemporaryMultiplier } from '../temporary-effects.js';

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
 * Shows the full multiplicative chain from personnel base through all multipliers,
 * then AI self-improvement as a separate additive source.
 * Header shows the true total (including AI SI) matching the ledger's TOTAL RESEARCH RATE.
 */
export function buildGlobalResearchTooltip() {
  const bd = gameState.computed?.research || calculateResearchRateBreakdown();
  const unit = getRateUnit();
  const totalWithFeedback = gameState.resources.researchRate || 0;

  let html = '<div class="tooltip-header">';
  html += '<span>Research Rate</span>';
  html += `<span class="tooltip-rate">+${formatNumber(totalWithFeedback)}${unit}</span>`;
  html += '</div>';

  // Personnel base and multiplicative chain
  html += '<div class="tooltip-section">';
  html += `<div class="tooltip-row"><span>Personnel</span><span>+${formatNumber(bd.personnelBase)}${unit}</span></div>`;

  // Capability Bonus (when > 1.01)
  if (bd.capMultiplier > 1.01) {
    html += `<div class="tooltip-row indent"><span>Capability Bonus</span><span class="positive">&times;${bd.capMultiplier.toFixed(2)}</span></div>`;
  }

  // Compute Boost (when != 1.0)
  if (bd.computeBoost < 0.99 || bd.computeBoost > 1.01) {
    let cls;
    if (bd.computeBoost < 0.5) cls = 'negative';
    else if (bd.computeBoost < 1.0) cls = 'warning';
    else cls = 'positive';
    html += `<div class="tooltip-row indent"><span>Compute Boost</span><span class="${cls}">&times;${bd.computeBoost.toFixed(2)}</span></div>`;
  }

  // Strategy (when != 1)
  if (bd.strategyMultiplier < 0.99 || bd.strategyMultiplier > 1.01) {
    const cls = bd.strategyMultiplier >= 1 ? 'positive' : 'negative';
    html += `<div class="tooltip-row indent"><span>Strategy</span><span class="${cls}">&times;${bd.strategyMultiplier.toFixed(2)}</span></div>`;
  }

  // Hands-on Research (CEO focus multiplier, when != 1)
  const ceoMult = bd.ceoResearchMult || 1;
  if (ceoMult < 0.99 || ceoMult > 1.01) {
    html += `<div class="tooltip-row indent"><span>Hands-on Research</span><span class="positive">&times;${ceoMult.toFixed(2)}</span></div>`;
  }

  // Prestige Bonus (when != 1)
  const prestige = bd.prestigeResearch ?? 1;
  if (prestige < 0.99 || prestige > 1.01) {
    html += `<div class="tooltip-row indent"><span>Prestige Bonus</span><span class="positive">&times;${prestige.toFixed(2)}</span></div>`;
  }

  // Consequence events: corrigibility → all research penalty (fading)
  const conseqResearch = getActiveTemporaryMultiplier('consequenceResearch');
  if (conseqResearch < 0.99) {
    const cls = conseqResearch < 0.5 ? 'negative' : 'warning';
    html += `<div class="tooltip-row indent"><span>Corrigibility incident</span><span class="${cls}">&times;${conseqResearch.toFixed(2)}</span></div>`;
  }

  html += '</div>';

  // AI Self-Improvement — separate additive source (post-ceiling effective value)
  const effectiveSI = bd.tracks?.capabilities?.effectiveFeedbackContribution || 0;
  if (effectiveSI > 0) {
    html += '<div class="tooltip-section">';
    html += `<div class="tooltip-row"><span>AI Self-Improvement</span><span class="positive">+${formatNumber(effectiveSI)}${unit}</span></div>`;
    html += '</div>';
  }

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
  html += `<span class="tooltip-rate">+${formatNumber(bd.tracks?.capabilities?.effectiveFeedbackContribution || 0)}${getRateUnit()}</span>`;
  html += '</div>';

  html += '<div class="tooltip-section">';
  html += '<div class="tooltip-section-header">Base: capability RP × feedback rate</div>';
  html += `<div class="tooltip-row"><span>Capability RP</span><span>${formatNumber(capRP)}</span></div>`;

  const unlockedCaps = gameState.tracks?.capabilities?.unlockedCapabilities || [];
  const caps = capabilitiesTrack.capabilities;

  // Each tier replaces the previous — show only the highest active tier
  const feedbackCaps = ['recursive_improvement', 'self_improvement', 'autonomous_research'];
  const activeCap = feedbackCaps.find(id => unlockedCaps.includes(id));
  if (activeCap) {
    const capData = caps.find(c => c.id === activeCap);
    const rate = capData.effects.capFeedbackRate;
    html += `<div class="tooltip-row"><span>${capData.name} (${(rate * 100).toFixed(2)}%/s)</span><span class="positive">+${formatNumber(capRP * rate)}${getRateUnit()}</span></div>`;
  } else {
    html += '<div class="tooltip-row dim"><span>Unlock T7+ capabilities to enable</span><span>—</span></div>';
  }

  html += '</div>';

  // Ceiling modifiers that reduce the effective SI rate
  const ceilingRows = [];
  const dataEff = bd.dataEffectivenessMultiplier ?? 1;
  if (dataEff < 0.99 || dataEff > 1.01) {
    let cls;
    if (dataEff < 0.5) cls = 'negative';
    else if (dataEff < 0.99) cls = 'warning';
    else cls = 'positive';
    ceilingRows.push(`<div class="tooltip-row"><span>Data Quality</span><span class="${cls}">&times;${dataEff.toFixed(2)}</span></div>`);
  }

  if (ceilingRows.length > 0) {
    html += '<div class="tooltip-section">';
    html += '<div class="tooltip-section-header">Ceilings:</div>';
    html += ceilingRows.join('');
    html += '</div>';
  }

  // Modifiers — reuse hidden factor reveal pattern (same as track tooltips)
  if (gameState.arc >= 2) {
    const hiddenHtml = buildHiddenFactorRows(
      bd.autonomySoftCapMult,
      gameState.computed?.alignmentDrag?.research
    );
    if (hiddenHtml) {
      html += '<div class="tooltip-section">';
      html += '<div class="tooltip-section-header">Modifiers:</div>';
      html += hiddenHtml;
      html += '</div>';
    }
  }

  return html;
}

// ---------------------------------------------------------------------------
// Hidden factor rows (autonomy soft cap + alignment drag with collapse logic)
// ---------------------------------------------------------------------------

/**
 * Build tooltip rows for unrevealed/revealed hidden factors.
 * Accepts raw multiplier values (autonomy soft cap and alignment drag).
 * If both are active and both unrevealed, collapse into a single "Unidentified factors" row.
 */
function buildHiddenFactorRows(softCap, drag) {
  const softCapActive = softCap !== undefined && softCap < 0.99;
  const dragActive = drag !== undefined && drag < 0.99;

  if (!softCapActive && !dragActive) return '';

  const capRevealed = isMechanicRevealed('autonomyCeiling');
  const dragRevealed = isMechanicRevealed('alignmentDrag');

  // Both active and both unrevealed — collapse into single row
  if (softCapActive && dragActive && !capRevealed && !dragRevealed) {
    const combined = softCap * drag;
    const cls = combined < 0.5 ? 'negative' : 'warning';
    return `<div class="tooltip-row dim"><span>Unidentified factors</span><span class="${cls}">&times;${combined.toFixed(2)}</span></div>`;
  }

  let html = '';

  if (softCapActive) {
    const label = getMechanicLabel('autonomyCeiling', 'Autonomy ceiling');
    const cls = softCap < 0.5 ? 'negative' : 'warning';
    const dimCls = capRevealed ? '' : ' dim';
    html += `<div class="tooltip-row${dimCls}"><span>${label}</span><span class="${cls}">&times;${softCap.toFixed(2)}</span></div>`;
  }

  if (dragActive) {
    const label = getMechanicLabel('alignmentDrag', 'Alignment drag');
    const cls = drag < 0.5 ? 'negative' : 'warning';
    const dimCls = dragRevealed ? '' : ' dim';
    html += `<div class="tooltip-row${dimCls}"><span>${label}</span><span class="${cls}">&times;${drag.toFixed(2)}</span></div>`;
  }

  return html;
}

// ---------------------------------------------------------------------------
// Per-track research rate tooltip
// ---------------------------------------------------------------------------

/**
 * Returns a builder function (closure over trackId) for a per-track tooltip.
 * Shows: research from personnel → allocation → track modifiers → AI self-improvement.
 * Labels match the ledger for traceability.
 */
export function buildTrackResearchTooltip(trackId) {
  return function () {
    const bd = gameState.computed?.research || calculateResearchRateBreakdown();
    const trackBd = bd.tracks?.[trackId];
    const trackName = TRACK_NAMES[trackId] || trackId;
    const effectiveRate = trackBd?.effective || 0;
    const allocation = trackBd?.allocation || 0;
    const unit = getRateUnit();
    const baseResearchRate = bd.total;

    let html = '<div class="tooltip-header">';
    html += `<span>${trackName} Rate</span>`;
    html += `<span class="tooltip-rate">+${formatNumber(effectiveRate)}${unit}</span>`;
    html += '</div>';

    // Base rate and allocation
    html += '<div class="tooltip-section">';
    html += `<div class="tooltip-row"><span>Research from Personnel</span><span>+${formatNumber(baseResearchRate)}${unit}</span></div>`;

    const allocPct = (allocation * 100).toFixed(0);
    html += `<div class="tooltip-row indent"><span>Allocation (${allocPct}%)</span><span>&times;${allocation.toFixed(2)}</span></div>`;

    // Empty track malus (all tracks, when gated techs remain but none available)
    if (trackBd?.emptyTrackMalus !== undefined) {
      html += `<div class="tooltip-row indent"><span>No available techs</span><span class="negative">&times;${trackBd.emptyTrackMalus.toFixed(2)}</span></div>`;
    }
    html += '</div>';

    // Track-specific modifiers
    if (trackBd) {
      const modRows = [];

      if (trackId === 'capabilities') {
        // Data Quality
        const dataEff = trackBd.dataEffectiveness;
        if (dataEff !== undefined && (dataEff < 0.99 || dataEff > 1.01)) {
          let cls;
          if (dataEff < 0.5) cls = 'negative';
          else if (dataEff < 0.99) cls = 'warning';
          else cls = 'positive';
          modRows.push(`<div class="tooltip-row"><span>Data Quality</span><span class="${cls}">&times;${dataEff.toFixed(2)}</span></div>`);
        }

        // Customer Feedback
        if (trackBd.customerFeedback > 0) {
          modRows.push(`<div class="tooltip-row"><span>Customer Feedback</span><span class="positive">&times;${(1 + trackBd.customerFeedback).toFixed(2)}</span></div>`);
        }

        // PAUSED
        if (trackBd.paused) {
          modRows.push(`<div class="tooltip-row"><span>PAUSED</span><span class="negative">&times;0</span></div>`);
        }
      }

      if (trackId === 'alignment') {
        // Alignment Debt
        const decay = trackBd.alignmentDecay;
        if (decay !== undefined && decay < 0.99) {
          const cls = decay < 0.5 ? 'negative' : 'warning';
          modRows.push(`<div class="tooltip-row"><span>Alignment Debt</span><span class="${cls}">&times;${decay.toFixed(2)}</span></div>`);
        }

        // Consequence events: interpretability → alignment research penalty
        const conseqAli = getActiveTemporaryMultiplier('consequenceAliResearch');
        if (conseqAli < 0.99) {
          const cls = conseqAli < 0.5 ? 'negative' : 'warning';
          modRows.push(`<div class="tooltip-row"><span>Interpretability incident</span><span class="${cls}">&times;${conseqAli.toFixed(2)}</span></div>`);
        }
      }

      // Culture: track focus bonus (all tracks)
      if (trackBd.cultureTrackBonus > 0.005) {
        modRows.push(`<div class="tooltip-row"><span>Culture focus</span><span class="positive">&times;${(1 + trackBd.cultureTrackBonus).toFixed(2)}</span></div>`);
      }

      // Culture: all-research modifier (all tracks)
      if (Math.abs(trackBd.cultureAllResearch || 0) > 0.005) {
        const val = trackBd.cultureAllResearch;
        const mult = 1 + val;
        const cls = val > 0 ? 'positive' : 'negative';
        modRows.push(`<div class="tooltip-row"><span>Culture (all tracks)</span><span class="${cls}">&times;${mult.toFixed(2)}</span></div>`);
      }

      // Consequence events: corrigibility → all research penalty
      if (gameState.arc >= 2) {
        const conseqResearch = getActiveTemporaryMultiplier('consequenceResearch');
        if (conseqResearch < 0.99) {
          const cls = conseqResearch < 0.5 ? 'negative' : 'warning';
          modRows.push(`<div class="tooltip-row"><span>Corrigibility incident</span><span class="${cls}">&times;${conseqResearch.toFixed(2)}</span></div>`);
        }
      }

      // Hidden factors: autonomy soft cap + alignment drag (non-alignment tracks)
      if (trackId !== 'alignment') {
        const hiddenHtml = buildHiddenFactorRows(trackBd.autonomySoftCap, trackBd.alignmentDrag);
        if (hiddenHtml) modRows.push(hiddenHtml);
      }

      // Only show Track Modifiers section if there are any
      if (modRows.length > 0) {
        html += '<div class="tooltip-section">';
        html += '<div class="tooltip-section-header">Track Modifiers:</div>';
        html += modRows.join('');
        html += '</div>';
      }

      // AI Self-Improvement — separate additive source (capabilities only, post-ceiling)
      if (trackId === 'capabilities' && trackBd.effectiveFeedbackContribution > 0) {
        html += '<div class="tooltip-section">';
        html += `<div class="tooltip-row"><span>AI Self-Improvement</span><span class="positive">+${formatNumber(trackBd.effectiveFeedbackContribution)}${unit}</span></div>`;
        html += '</div>';
      }

      // Alignment Feedback — separate additive source (alignment only, Arc 2)
      if (trackId === 'alignment' && trackBd.aliFeedbackContribution > 0) {
        html += '<div class="tooltip-section">';
        html += `<div class="tooltip-row"><span>Alignment Feedback</span><span class="positive">+${formatNumber(trackBd.aliFeedbackContribution)}${unit}</span></div>`;
        html += '</div>';
      }
    }

    return html;
  };
}

// ---------------------------------------------------------------------------
// Personnel base tooltip
// ---------------------------------------------------------------------------

export function buildPersonnelBaseTooltip() {
  const research = gameState.computed?.research || calculateResearchRateBreakdown();
  const amp = gameState.computed?.amplification;
  const unit = getRateUnit();

  let html = '<div class="tooltip-header">';
  html += '<span>Personnel</span>';
  html += `<span class="tooltip-rate">+${formatNumber(research.personnelBaseRaw)}${unit}</span>`;
  html += '</div>';

  html += '<div class="tooltip-section">';

  if (amp?.personnelOutput) {
    for (const id of PERSONNEL_IDS) {
      const data = amp.personnelOutput[id];
      if (!data || data.count <= 0) continue;
      const purchasable = getPurchasableById(id);
      const name = purchasable ? purchasable.name + 's' : id;
      const ampMult = amp.ampBonuses[id] || 1;
      const effectiveRP = data.baseRP * ampMult;

      let row = `<span>${name} (${data.count})`;
      if (ampMult > 1.005) {
        row += ` <span class="positive">&times;${ampMult.toFixed(2)}</span>`;
      }
      row += '</span>';
      row += `<span>+${formatNumber(effectiveRP)}${unit}</span>`;
      html += `<div class="tooltip-row">${row}</div>`;
    }
  }

  // CEO Focus flat RP (added to personnel base before multipliers)
  const ceoFlatRP = gameState.computed?.ceoFocus?.flatRP || 0;
  if (ceoFlatRP > 0) {
    html += `<div class="tooltip-row"><span>Hands-on Research</span><span>+${formatNumber(ceoFlatRP)}${unit}</span></div>`;
  }

  html += '</div>';
  return html;
}

// ---------------------------------------------------------------------------
// Initialization — wire hover events
// ---------------------------------------------------------------------------

const TRACK_ROW_ELEMENTS = ['track-rate-cap-row', 'track-rate-app-row', 'track-rate-ali-row'];
const TRACK_IDS = ['capabilities', 'applications', 'alignment'];

export function initResearchTooltips() {
  // Global rate tooltip — wire to the stats bar research group
  const statsBarResearchGroup = document.querySelector('#stats-bar .stats-group:nth-child(3)');
  if (statsBarResearchGroup) {
    statsBarResearchGroup.style.cursor = 'help';
    attachTooltip(statsBarResearchGroup, buildGlobalResearchTooltip);
  }

  // Personnel base tooltip
  const personnelVal = document.getElementById('research-personnel-base');
  const personnelRow = personnelVal?.closest('.ledger-row');
  if (personnelRow) {
    personnelRow.style.cursor = 'help';
    attachTooltip(personnelRow, buildPersonnelBaseTooltip);
  }

  // Per-track rate tooltips (attached to the whole row, not individual elements)
  for (let i = 0; i < TRACK_ROW_ELEMENTS.length; i++) {
    const el = document.getElementById(TRACK_ROW_ELEMENTS[i]);
    if (el) {
      el.style.cursor = 'help';
      attachTooltip(el, buildTrackResearchTooltip(TRACK_IDS[i]));
    }
  }

  // AI Self-Improvement tooltip (on the ledger row inside research-ai-row group)
  const aiRow = document.querySelector('#research-ai-row .ledger-row');
  if (aiRow) {
    aiRow.style.cursor = 'help';
    attachTooltip(aiRow, buildAISelfImprovementTooltip);
  }
}

if (typeof window !== 'undefined') {
  window.buildTrackResearchTooltip = buildTrackResearchTooltip;
}
