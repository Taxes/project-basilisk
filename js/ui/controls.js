// js/ui/controls.js
// Allocation sliders (research, compute, data strategy) and focus queue display.
//
// Caching strategy (queue display):
//   _renderedQueueIds        — ordered array of queue item IDs currently in the
//                              DOM. When the set or order changes we do a full
//                              DOM rebuild; otherwise we patch only the text
//                              content via stashed ._textSpan refs on each
//                              queue-item element.
//   _renderedQueueActiveCount — number of items with "active" styling last
//                              render. A change triggers full rebuild to
//                              re-classify active vs pending items.
//   _renderedQueuePaused     — per-item paused booleans. A toggle triggers
//                              full rebuild for class changes.
//
//   resetQueueCache() clears all three so the next render does a full rebuild.
//   It is registered with the scheduler as the reset callback and also exported
//   via reset() for resetUI().

import { gameState } from '../game-state.js';
import { BALANCE } from '../../data/balance.js';
import { getPurchasableById } from '../content/purchasables.js';
import { createCultureItem, addToQueue, getCultureSpeedMultiplier } from '../focus-queue.js';
import { getPurchasableState } from '../purchasable-state.js';
import { formatNumber, getRateUnit, formatDuration, formatFunding } from '../utils/format.js';
import { $ } from '../utils/dom-cache.js';
import { enhanceInput } from '../utils/dom.js';
import { registerUpdate, EVERY_TICK, FAST } from './scheduler.js';
import { requestFullUpdate } from './signals.js';
import { getTotalResearcherCount } from './economics.js';
import { getTrackResearchRate } from './research.js';
import { logSliderChange } from '../playtest-logger.js';
import { getCultureBonuses } from '../resources.js';
import { attachTooltip } from './stats-tooltip.js';

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------
let _renderedQueueIds = [];
let _renderedQueueActiveCount = 0;
let _renderedQueuePaused = [];
let _emptyTickCount = 0; // debounce empty-state message to avoid 1-frame flash
let _userCleared = false; // bypass debounce on explicit user clear (#751)

function resetQueueCache() {
  _renderedQueueIds = [];
  _renderedQueueActiveCount = 0;
  _renderedQueuePaused = [];
  _emptyTickCount = 0;
}

export function reset() {
  resetQueueCache();
}

/** Signal that the user explicitly cleared the queue — skip empty-state debounce. */
export function signalUserClear() {
  _userCleared = true;
}

// ---------------------------------------------------------------------------
// Scheduler registration
// ---------------------------------------------------------------------------
registerUpdate(updateAllocationDisplay, FAST);
registerUpdate(updateResearchBreakdown, FAST);
registerUpdate(updateTrackRates, FAST);
registerUpdate(updateCultureDisplay, FAST);
registerUpdate(updateComputeAllocationDisplay, FAST);
registerUpdate(updateComputeStats, FAST);
registerUpdate(updateQueueDisplay, EVERY_TICK, { reset: resetQueueCache });

// ---------------------------------------------------------------------------
// Research allocation sliders
// ---------------------------------------------------------------------------

/** Set up research allocation sliders and number inputs, attach handlers. */
export function initAllocationSliders() {
  const tracks = ['capabilities', 'applications', 'alignment'];

  for (const track of tracks) {
    const slider = $(`${track}-allocation`);
    const numInput = $(`${track}-percent-input`);

    if (slider) {
      // Set initial value from game state
      const allocation = Math.round(gameState.tracks[track].researcherAllocation * 100);
      slider.value = allocation;

      // Slider drag updates allocation + syncs number input
      slider.addEventListener('input', (e) => {
        const newValue = parseInt(e.target.value, 10);
        updateAllocation(track, newValue);
        updateAllocationDisplay();  // immediate feedback on drag
        logSliderChange('research', gameState.targetAllocation);
      });
    }

    if (numInput) {
      enhanceInput(numInput);
      // Number input updates allocation + syncs slider
      numInput.addEventListener('change', (e) => {
        let newValue = parseInt(e.target.value, 10);
        if (isNaN(newValue)) newValue = 0;
        newValue = Math.max(0, Math.min(100, newValue));
        e.target.value = newValue;
        updateAllocation(track, newValue);
        updateAllocationDisplay();
        logSliderChange('research', gameState.targetAllocation);
      });
    }
  }

  // Culture shift button handler
  const cultureBtn = $('culture-shift-btn');
  if (cultureBtn) {
    cultureBtn.addEventListener('click', () => {
      const target = gameState.targetAllocation;
      if (!target) return;

      // Check if already in queue
      const alreadyQueued = gameState.focusQueue.some(item => item.type === 'culture');
      if (alreadyQueued) return;

      // Queue focused culture drift
      const item = createCultureItem({
        capabilities: target.capabilities,
        applications: target.applications,
        alignment: target.alignment,
      });
      addToQueue(item);
      requestFullUpdate();
    });

    // Custom tooltip
    attachTooltip(cultureBtn, () => {
      const speedMult = getCultureSpeedMultiplier();
      let html = '<div class="tooltip-header">Culture Shift</div>';
      html += '<div class="tooltip-row"><span>Queue focused drift toward target allocation</span></div>';
      html += '<div class="tooltip-row"><span>Speed vs passive</span><span>6\u00d7 faster</span></div>';
      html += `<div class="tooltip-row"><span>Org-size modifier</span><span>\u00d7${speedMult.toFixed(2)}</span></div>`;
      if (speedMult < 0.5) {
        html += '<div class="tooltip-row dim"><span>Large orgs shift culture slowly</span></div>';
      }
      return html;
    });
  }

  // Initial display sync
  updateAllocationDisplay();
}

/**
 * Update allocation — sets TARGET allocation; actual drifts toward it via
 * culture system.
 */
export function updateAllocation(changedTrack, newValue) {
  // In Arc 1, alignment is hidden — only work with capabilities and applications
  const isArc1 = gameState.arc === 1;
  const tracks = isArc1
    ? ['capabilities', 'applications']
    : ['capabilities', 'applications', 'alignment'];

  // If trying to change alignment in Arc 1, ignore
  if (isArc1 && changedTrack === 'alignment') {
    return;
  }

  const otherTracks = tracks.filter(t => t !== changedTrack);

  // Clamp newValue between 0 and 100
  newValue = Math.max(0, Math.min(100, newValue));

  // Calculate remaining percentage for other tracks
  const remaining = 100 - newValue;

  if (isArc1) {
    // In Arc 1, no alignment — cap/app split the full 100%
    gameState.targetAllocation = gameState.targetAllocation || {
      capabilities: gameState.tracks.capabilities.researcherAllocation,
      applications: gameState.tracks.applications.researcherAllocation,
      alignment: 0,
    };
    const otherValue = 100 - newValue;
    gameState.targetAllocation[changedTrack] = newValue / 100;
    gameState.targetAllocation[otherTracks[0]] = otherValue / 100;
    gameState.targetAllocation.alignment = 0;
  } else {
    gameState.targetAllocation = gameState.targetAllocation || {
      capabilities: gameState.tracks.capabilities.researcherAllocation,
      applications: gameState.tracks.applications.researcherAllocation,
      alignment: gameState.tracks.alignment.researcherAllocation,
    };
    // Get current target allocations of other tracks
    const currentOther1 = (gameState.targetAllocation[otherTracks[0]] ?? gameState.tracks[otherTracks[0]].researcherAllocation) * 100;
    const currentOther2 = (gameState.targetAllocation[otherTracks[1]] ?? gameState.tracks[otherTracks[1]].researcherAllocation) * 100;
    const otherSum = currentOther1 + currentOther2;

    let newOther1, newOther2;

    if (otherSum > 0) {
      // Distribute remaining proportionally based on existing ratios
      const ratio1 = currentOther1 / otherSum;
      const ratio2 = currentOther2 / otherSum;
      newOther1 = remaining * ratio1;
      newOther2 = remaining * ratio2;
    } else {
      // If other tracks are both zero, split evenly
      newOther1 = remaining / 2;
      newOther2 = remaining / 2;
    }

    // Update target allocation (convert percentage to decimal 0-1)
    gameState.targetAllocation[changedTrack] = newValue / 100;
    gameState.targetAllocation[otherTracks[0]] = newOther1 / 100;
    gameState.targetAllocation[otherTracks[1]] = newOther2 / 100;
  }

  // Update display
  updateAllocationDisplay();
}

/**
 * Sync UI with game state — shows both actual allocation and target
 * (with drift arrow).
 */
export function updateAllocationDisplay() {
  // Unlock allocation section once basic_transformer is unlocked
  const section = document.getElementById('research-breakdown-section');
  const hasBasicTransformer = gameState.tracks?.capabilities?.unlockedCapabilities?.includes('basic_transformer');
  if (section && hasBasicTransformer) {
    section.classList.remove('hidden-until-unlocked');
  }

  const trackNames = ['capabilities', 'applications', 'alignment'];
  const state = gameState;
  const totalResearchers = getTotalResearcherCount();
  const target = state.targetAllocation;

  for (const track of trackNames) {
    const slider = $(`${track}-allocation`);
    const numInput = $(`${track}-percent-input`);
    const driftDisplay = $(`${track}-drift`);

    if (slider) {
      const actualAlloc = state.tracks[track].researcherAllocation * 100;
      const targetAlloc = target ? target[track] * 100 : actualAlloc;

      // Slider shows target value (what player is aiming for)
      slider.value = Math.round(targetAlloc);

      // Number input shows target value (only update if not focused to avoid clobbering user typing)
      if (numInput && document.activeElement !== numInput) {
        numInput.value = Math.round(targetAlloc);
      }

      // Show drift indicator when target differs from actual
      if (driftDisplay) {
        const diff = Math.abs(targetAlloc - actualAlloc);
        if (diff > 1 && target) {
          driftDisplay.textContent = `${Math.round(actualAlloc)}%\u2192`;
        } else {
          driftDisplay.textContent = '';
        }
      }
    }
  }

  // Update total researchers display
  const totalEl = $('total-researchers');
  if (totalEl) {
    totalEl.textContent = totalResearchers;
  }

  // In Arc 1, hide alignment slider row
  const alignmentRow = document.querySelector('.allocation-row[data-track="alignment"]');
  if (gameState.arc === 1) {
    if (alignmentRow) alignmentRow.classList.add('hidden-until-unlocked');
  } else {
    if (alignmentRow) alignmentRow.classList.remove('hidden-until-unlocked');
  }

  // Culture shift button: show when target differs from actual
  const cultureBtn = $('culture-shift-btn');
  if (cultureBtn) {
    // Check if any track has significant difference
    let hasDiff = false;
    if (target) {
      for (const track of trackNames) {
        const actual = state.tracks[track].researcherAllocation * 100;
        const tgt = target[track] * 100;
        if (Math.abs(actual - tgt) > 1) {
          hasDiff = true;
          break;
        }
      }
    }
    // Hide if already queued
    const alreadyQueued = gameState.focusQueue.some(item => item.type === 'culture');
    cultureBtn.classList.toggle('hidden', !hasDiff || alreadyQueued);
  }

  // Passive drift estimate — show when target differs and no culture item in queue
  const driftEl = $('passive-drift-estimate');
  if (driftEl) {
    const alreadyQueued = gameState.focusQueue.some(item => item.type === 'culture');
    let hasDiff = false;
    let maxTrackDiff = 0;
    if (target) {
      for (const track of trackNames) {
        const diff = Math.abs(target[track] - state.tracks[track].researcherAllocation);
        if (diff > 0.01) { hasDiff = true; }
        if (diff > maxTrackDiff) maxTrackDiff = diff;
      }
    }
    if (hasDiff && !alreadyQueued && maxTrackDiff > BALANCE.CULTURE_COMPLETION_THRESHOLD) {
      const passiveRate = BALANCE.CULTURE_PASSIVE_DRIFT_RATE * getCultureSpeedMultiplier();
      const estimate = maxTrackDiff / passiveRate;
      driftEl.textContent = `Passive drift: ~${formatDuration(estimate)} to target`;
      driftEl.classList.remove('hidden');
    } else {
      driftEl.classList.add('hidden');
    }
  }
}

// ---------------------------------------------------------------------------
// Per-track research rates (left side, below total)
// ---------------------------------------------------------------------------

const TRACK_ABBREVS = { capabilities: 'cap', applications: 'app', alignment: 'ali' };

/** Build the combined modifier for a track (data quality, culture bonuses, etc.) */
function getTrackModifier(trackId) {
  const breakdown = gameState.computed?.research?.tracks?.[trackId];
  if (!breakdown) return { combined: 1, parts: [] };

  const parts = [];

  if (trackId === 'capabilities') {
    const dataEff = breakdown.dataEffectiveness ?? 1;
    if (Math.abs(dataEff - 1) > 0.005) {
      parts.push({ label: 'Data quality', value: dataEff });
    }
    const capCulture = breakdown.cultureCapBonus ?? 0;
    if (capCulture > 0.005) {
      parts.push({ label: 'Cap focus culture', value: 1 + capCulture });
    }
    const custFeedback = breakdown.customerFeedback ?? 0;
    if (custFeedback > 0.005) {
      parts.push({ label: 'Customer feedback', value: 1 + custFeedback });
    }
    const autonomy = breakdown.autonomyGrant ?? 0;
    if (autonomy && Math.abs(autonomy - 1) > 0.005) {
      parts.push({ label: 'Autonomy grant', value: autonomy });
    }
    if (breakdown.paused) {
      parts.push({ label: 'Research paused', value: 0 });
    }
  }

  if (trackId === 'alignment') {
    const decay = breakdown.alignmentDecay ?? 1;
    if (Math.abs(decay - 1) > 0.005) {
      parts.push({ label: 'Alignment decay', value: decay });
    }
  }

  // Balanced bonus applies to all tracks
  const balanced = breakdown.balancedBonus ?? 0;
  if (balanced > 0.005) {
    parts.push({ label: 'Balanced culture', value: 1 + balanced });
  }

  const combined = parts.length > 0
    ? parts.reduce((acc, p) => acc * p.value, 1)
    : 1;

  return { combined, parts };
}

/** Update the per-track rate rows on the left side. */
function updateTrackRates() {
  const tracks = ['capabilities', 'applications', 'alignment'];
  const abbrevs = TRACK_ABBREVS;

  // Show applications row only after basic_transformer unlocked
  const appRow = $('track-rate-app-row');
  if (appRow) {
    const hasBasicTransformer = gameState.tracks?.capabilities?.unlockedCapabilities?.includes('basic_transformer');
    appRow.classList.toggle('hidden-until-unlocked', !hasBasicTransformer);
  }

  // Show alignment row only in Arc 2
  const aliRow = $('track-rate-ali-row');
  if (aliRow) {
    aliRow.classList.toggle('hidden-until-unlocked', gameState.arc === 1);
  }

  for (const track of tracks) {
    const abbr = abbrevs[track];
    const allocEl = $(`track-alloc-${abbr}`);
    const modEl = $(`track-mod-${abbr}`);
    const rateEl = $(`track-rate-${abbr}`);

    const actualAlloc = gameState.tracks[track].researcherAllocation;
    const targetAlloc = gameState.targetAllocation?.[track];
    const rate = getTrackResearchRate(track);
    const mod = getTrackModifier(track);

    if (allocEl) {
      // Show target allocation (what player set) when available, to avoid
      // drift threshold making 50% display as 49% (#462)
      const displayAlloc = targetAlloc != null ? targetAlloc : actualAlloc;
      allocEl.textContent = `(${Math.round(displayAlloc * 100)}%)`;
    }

    if (modEl) {
      if (Math.abs(mod.combined - 1) > 0.005) {
        modEl.textContent = `\u00d7${mod.combined.toFixed(2)}`;
        modEl.classList.remove('hidden');

        // Color code: penalty or bonus
        modEl.classList.toggle('mod-penalty', mod.combined < 1);
        modEl.classList.toggle('mod-bonus', mod.combined > 1);

        // Attach tooltip (once)
        if (!modEl._hasModTooltip) {
          attachTooltip(modEl, () => {
            const currentMod = getTrackModifier(track);
            const html = currentMod.parts.map(p =>
              `<div class="tooltip-row"><span>${p.label}</span><span>\u00d7${p.value.toFixed(2)}</span></div>`
            ).join('');
            return `<div class="tooltip-header"><span>Modifiers</span></div>${html}`;
          });
          modEl._hasModTooltip = true;
        }
      } else {
        modEl.classList.add('hidden');
      }
    }

    if (rateEl) {
      rateEl.textContent = '+' + formatNumber(rate) + getRateUnit();
    }
  }
}

// ---------------------------------------------------------------------------
// Culture display (right side, below allocation sliders)
// ---------------------------------------------------------------------------

const CULTURE_THRESHOLD = BALANCE.CULTURE_BALANCED_THRESHOLD;

/** Determine the culture label based on actual allocation. */
function getCultureLabel() {
  const cap = gameState.tracks.capabilities.researcherAllocation;
  const app = gameState.tracks.applications.researcherAllocation;
  const ali = gameState.tracks.alignment.researcherAllocation;

  const max = Math.max(cap, app, ali);
  if (max <= CULTURE_THRESHOLD) return 'Generalist';

  // Dominant = strictly above threshold AND highest (ties = Generalist)
  const aboveThreshold = [];
  if (cap > CULTURE_THRESHOLD) aboveThreshold.push({ track: 'capabilities', value: cap });
  if (app > CULTURE_THRESHOLD) aboveThreshold.push({ track: 'applications', value: app });
  if (ali > CULTURE_THRESHOLD) aboveThreshold.push({ track: 'alignment', value: ali });

  if (aboveThreshold.length !== 1) return 'Generalist';

  const dominant = aboveThreshold[0].track;
  if (dominant === 'capabilities') return 'Breakthrough';
  if (dominant === 'applications') return 'Commercial';
  if (dominant === 'alignment') return 'Safety-first';
  return 'Generalist';
}

/** Update the culture label and bonus display. */
function updateCultureDisplay() {
  const display = $('culture-display');
  if (!display) return;

  const culture = getCultureBonuses();
  const label = getCultureLabel();

  // Build bonus lines
  const lines = [];

  if (culture.capBonus > 0.005) {
    lines.push(`<span class="positive">+${Math.round(culture.capBonus * 100)}%</span> capabilities research`);
  }
  if (culture.appEdgeSlow > 0.005) {
    lines.push(`<span class="positive">+${Math.round(culture.appEdgeSlow * 100)}%</span> market edge retention`);
  }
  if (culture.aliMult > 1.005) {
    lines.push(`<span class="positive">\u00d7${culture.aliMult.toFixed(1)}</span> alignment effectiveness`);
  }
  if (culture.balancedResearch > 0.005) {
    lines.push(`<span class="positive">+${Math.round(culture.balancedResearch * 100)}%</span> all research`);
  }
  if (culture.balancedRevenue > 0.005) {
    lines.push(`<span class="positive">+${Math.round(culture.balancedRevenue * 100)}%</span> revenue`);
  }

  // Show section only when there are active bonuses
  if (lines.length === 0) {
    display.classList.add('hidden');
    return;
  }

  display.classList.remove('hidden');

  const labelEl = $('culture-label');
  if (labelEl) {
    const text = `Lab Culture: ${label}`;
    if (labelEl.textContent !== text) labelEl.textContent = text;
  }

  const bonusesEl = $('culture-bonuses');
  if (bonusesEl) {
    const html = lines.map(l => `<div class="culture-bonus-line">${l}</div>`).join('');
    if (bonusesEl.innerHTML !== html) bonusesEl.innerHTML = html;
  }
}

// ---------------------------------------------------------------------------
// Research rate breakdown (left side of personnel subtab split)
// ---------------------------------------------------------------------------

/** Attach a hover tooltip to a research breakdown row element. */
function _addBreakdownTooltip(el, builderFn) {
  el.style.cursor = 'help';
  attachTooltip(el, builderFn);
}

function updateResearchBreakdown() {
  const research = gameState.computed?.research;
  if (!research) return;

  const base = $('research-personnel-base');
  if (base) base.textContent = '+' + formatNumber(research.personnelBase) + getRateUnit();

  // Compute boost (always shown; warn when low)
  const boostGroup = $('research-compute-boost-group');
  const boost = $('research-compute-boost');
  if (boostGroup && boost) {
    const val = research.computeBoost ?? 0;
    boost.textContent = '\u00d7' + val.toFixed(2);
    boost.classList.toggle('warning', val >= 0.8 && val < 1.0);
    boost.classList.toggle('negative', val < 0.8);
    if (!boostGroup._hasTooltip) {
      _addBreakdownTooltip(boostGroup, () => {
        const r = gameState.computed?.research;
        const cb = r?.computeBoost ?? 0;
        const comp = gameState.computed?.compute;
        const totalTflops = comp?.total || 0;
        const allocPct = Math.round((comp?.allocation || 0) * 100);
        const internalTflops = comp?.internal || 0;
        return '<div class="tooltip-header"><span>Compute Boost</span></div>' +
          `<div class="tooltip-row"><span>Total Compute</span><span>${formatNumber(totalTflops)} TFLOPS</span></div>` +
          `<div class="tooltip-row"><span>Research Allocation</span><span>${allocPct}% → ${formatNumber(internalTflops)} TFLOPS</span></div>` +
          `<div class="tooltip-row"><span>Multiplier</span><span>\u00d7${cb.toFixed(2)}</span></div>` +
          '<div class="tooltip-row dim"><span>More compute relative to RP = higher boost</span></div>';
      });
      boostGroup._hasTooltip = true;
    }
  }

  // Capability bonus (hide when x1.00)
  const capGroup = $('research-cap-bonus-group');
  const cap = $('research-cap-bonus');
  if (capGroup && cap) {
    const val = research.capMultiplier || 1;
    capGroup.classList.toggle('hidden', Math.abs(val - 1) < 0.005);
    cap.textContent = '\u00d7' + val.toFixed(2);
    if (!capGroup._hasTooltip) {
      _addBreakdownTooltip(capGroup, () => {
        const cm = gameState.computed?.research?.capMultiplier || 1;
        return '<div class="tooltip-header"><span>Capability Bonus</span></div>' +
          `<div class="tooltip-row"><span>From unlocked research</span><span>\u00d7${cm.toFixed(2)}</span></div>` +
          '<div class="tooltip-row dim"><span>Certain capabilities boost all research</span></div>';
      });
      capGroup._hasTooltip = true;
    }
  }

  // Research from personnel subtotal = base x all multipliers
  const fromPersonnel = (research.personnelBase || 0)
    * (research.computeBoost ?? 0)
    * (research.capMultiplier || 1)
    * (research.strategyMultiplier || 1);
  const fpEl = $('research-from-personnel');
  if (fpEl) fpEl.textContent = '+' + formatNumber(fromPersonnel) + getRateUnit();

  // AI self-improvement (hide when 0)
  const aiGroup = $('research-ai-group');
  const aiRate = $('research-ai-rate');
  if (aiGroup && aiRate) {
    const val = research.feedbackContribution || 0;
    aiGroup.classList.toggle('hidden', val === 0);
    aiRate.textContent = '+' + formatNumber(val) + getRateUnit();
  }

  // Total research rate
  const total = (research.total || 0) + (research.feedbackContribution || 0);
  const totalEl = $('research-total-rate');
  if (totalEl) totalEl.textContent = '+' + formatNumber(total) + getRateUnit();
}

// ---------------------------------------------------------------------------
// Compute allocation slider
// ---------------------------------------------------------------------------

/** Set up compute split slider and number inputs, attach handlers. */
export function initComputeAllocationSlider() {
  const slider = $('compute-allocation-slider');
  const internalInput = $('compute-internal-input');
  const externalInput = $('compute-external-input');
  if (!slider) return;

  // Set initial values
  const initial = Math.round(gameState.resources.computeAllocation * 100);
  slider.value = initial;
  if (internalInput) internalInput.value = initial;
  if (externalInput) externalInput.value = 100 - initial;

  // Slider drag updates allocation + syncs number inputs
  slider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    gameState.resources.computeAllocation = value / 100;
    if (internalInput) internalInput.value = value;
    if (externalInput) externalInput.value = 100 - value;
    updateComputeAllocationDisplay();
    logSliderChange('compute', value / 100);
  });

  // Internal input updates allocation + syncs slider and external input
  if (internalInput) {
    enhanceInput(internalInput);
    internalInput.addEventListener('change', (e) => {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v)) v = 0;
      v = Math.max(0, Math.min(100, v));
      e.target.value = v;
      gameState.resources.computeAllocation = v / 100;
      slider.value = v;
      if (externalInput) externalInput.value = 100 - v;
      updateComputeAllocationDisplay();
      logSliderChange('compute', v / 100);
    });
  }

  // External input updates allocation + syncs slider and internal input
  if (externalInput) {
    enhanceInput(externalInput);
    externalInput.addEventListener('change', (e) => {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v)) v = 0;
      v = Math.max(0, Math.min(100, v));
      e.target.value = v;
      const internal = 100 - v;
      gameState.resources.computeAllocation = internal / 100;
      slider.value = internal;
      if (internalInput) internalInput.value = internal;
      updateComputeAllocationDisplay();
      logSliderChange('compute', internal / 100);
    });
  }

  updateComputeAllocationDisplay();
}

/** Render compute allocation breakdown (internal vs external TFLOPS). */
export function updateComputeAllocationDisplay() {
  const state = gameState;

  // Always calculate from raw values to avoid stale computed state issues
  const internalCompute = state.resources.compute * state.resources.computeAllocation;
  const externalCompute = state.resources.compute * (1 - state.resources.computeAllocation);

  const internalDisplay = $('internal-compute-display');
  const externalDisplay = $('external-compute-display');
  const researchBoost = $('research-boost-display');
  const tokenRate = $('token-rate-display');

  if (internalDisplay) {
    internalDisplay.textContent = formatNumber(internalCompute) + ' TFLOPS';
  }
  if (externalDisplay) {
    externalDisplay.textContent = formatNumber(externalCompute) + ' TFLOPS';
  }
  if (researchBoost) {
    const cb = state.computed?.research?.computeBoost ?? 0;
    if (cb > 0.01) {
      researchBoost.textContent = `Research: ×${cb.toFixed(2)}`;
    } else {
      researchBoost.textContent = `Research: —`;
    }
  }
  if (tokenRate) {
    tokenRate.textContent = `Tokens: ${formatNumber(state.resources.tokensPerSecond)}${getRateUnit()}`;
  }
}

// ---------------------------------------------------------------------------
// Compute stats panel
// ---------------------------------------------------------------------------

/** Update the compute stats panel (right side of compute subtab split). */
function updateComputeStats() {
  const stats = gameState.computed?.computeStats;
  if (!stats) return;

  const extTflops = $('compute-ext-tflops');
  if (extTflops) extTflops.textContent = formatNumber(stats.externalTflops) + ' TFLOPS';

  const efficiency = $('compute-token-efficiency');
  if (efficiency) efficiency.textContent = formatNumber(stats.tokenEfficiency) + '/TFLOP';

  const generated = $('compute-tokens-generated');
  if (generated) generated.textContent = formatNumber(stats.tokensGenerated) + getRateUnit();

  const demand = $('compute-token-demand');
  if (demand) {
    demand.textContent = formatNumber(stats.tokenDemand) + ' / ' + formatNumber(stats.demandAtPrice);
  }

  const avgCost = $('compute-avg-cost');
  if (avgCost) avgCost.textContent = stats.avgCostPerMTokens > 0
    ? formatFunding(stats.avgCostPerMTokens)
    : '-';
}

// ---------------------------------------------------------------------------
// Focus Queue Display
// ---------------------------------------------------------------------------

/**
 * Get background style for queue item progress fill.
 * Active items show current progress, pending purchase items show saved progress (dimmed).
 */
function getQueueItemProgressStyle(item, isActive) {
  // Only purchase items have saveable progress
  if (item.type !== 'purchase') {
    const currentProgress = item.progress || 0;
    if (currentProgress <= 0 || !isActive) return '';
    return `background: linear-gradient(to right, rgba(78, 205, 196, 0.3) ${currentProgress * 100}%, transparent ${currentProgress * 100}%);`;
  }

  const currentProgress = item.progress || 0;
  const savedProgress = getPurchasableState(item.target)?.savedProgress || 0;

  // Active items show current progress
  // Pending items with saved progress show that as "banked" progress (dimmer)
  const displayProgress = isActive ? currentProgress : savedProgress;

  if (displayProgress <= 0) return '';

  // Use lower opacity for banked (non-active) progress to distinguish from active
  const opacity = isActive ? 0.3 : 0.15;
  return `background: linear-gradient(to right, rgba(78, 205, 196, ${opacity}) ${displayProgress * 100}%, transparent ${displayProgress * 100}%);`;
}

/** Create a DOM element for a single queue item. */
function createQueueItemElement(item, isActive) {
  const itemEl = document.createElement('div');
  itemEl.className = `queue-item ${isActive ? 'active' : 'pending'}${item.paused ? ' paused' : ''}`;
  itemEl.dataset.queueId = item.id;

  const progressStyle = getQueueItemProgressStyle(item, isActive);
  if (progressStyle) itemEl.style.cssText = progressStyle;

  const prefix = isActive ? '>' : ' ';
  const text = formatQueueItemText(item);

  const prefixSpan = document.createElement('span');
  prefixSpan.className = 'queue-item-prefix';
  prefixSpan.textContent = prefix;

  const typeMarker = document.createElement('span');
  typeMarker.className = 'queue-item-type';
  const typeSymbols = { purchase: '$', fundraise: 'F', furlough: '-', culture: '~', purge_synthetic: '~' };
  typeMarker.textContent = typeSymbols[item.type] || '?';

  const textSpan = document.createElement('span');
  textSpan.className = 'queue-item-text';
  textSpan.textContent = text;

  const controlsSpan = document.createElement('span');
  controlsSpan.className = 'queue-item-controls';

  const upBtn = document.createElement('button');
  upBtn.dataset.action = 'up';
  upBtn.dataset.queueId = item.id;
  upBtn.setAttribute('aria-label', 'Move up');
  attachTooltip(upBtn, () => 'Move up');
  upBtn.textContent = '^';

  const downBtn = document.createElement('button');
  downBtn.dataset.action = 'down';
  downBtn.dataset.queueId = item.id;
  downBtn.setAttribute('aria-label', 'Move down');
  attachTooltip(downBtn, () => 'Move down');
  downBtn.textContent = 'v';

  const removeBtn = document.createElement('button');
  removeBtn.dataset.action = 'remove';
  removeBtn.dataset.queueId = item.id;
  removeBtn.setAttribute('aria-label', 'Remove');
  attachTooltip(removeBtn, () => 'Remove');
  removeBtn.textContent = 'x';

  controlsSpan.appendChild(upBtn);
  controlsSpan.appendChild(downBtn);
  controlsSpan.appendChild(removeBtn);

  itemEl.appendChild(prefixSpan);
  itemEl.appendChild(typeMarker);
  itemEl.appendChild(textSpan);
  itemEl.appendChild(controlsSpan);

  itemEl._textSpan = textSpan;

  return itemEl;
}

/** Render the focus queue items list with incremental DOM updates. */
export function updateQueueDisplay() {
  const container = $('queue-items');
  const emptyMsg = $('queue-empty-msg');
  const clearBtn = $('clear-queue-btn');
  if (!container) return;

  // Update queue title with speed info
  const titleEl = $('queue-title');
  if (titleEl) {
    const speed = Math.round(gameState.focusSpeed * 100);
    if (speed > 100) {
      titleEl.textContent = `FOCUS QUEUE [${speed}% speed]`;
    } else {
      titleEl.textContent = 'FOCUS QUEUE';
    }
    if (!titleEl._tooltipAttached) {
      titleEl._tooltipAttached = true;
      attachTooltip(titleEl, () => {
        const speed = Math.round(gameState.focusSpeed * 100);
        let html = '<div class="tooltip-header">Focus Queue</div>';
        html += '<div class="tooltip-section">';
        html += `<div class="tooltip-row"><span>Focus Speed</span><span>${speed}%</span></div>`;
        html += '</div>';
        return html;
      });
    }
  }

  const queue = gameState.focusQueue;

  if (queue.length === 0) {
    _emptyTickCount++;
    if (_renderedQueueIds.length > 0) {
      container.innerHTML = '';
      _renderedQueueIds = [];
      _renderedQueueActiveCount = 0;
      _renderedQueuePaused = [];
    }
    // Debounce: only show empty state after 2+ ticks to avoid 1-frame flash
    // when automation or the next queue item hasn't been added yet.
    // Skip debounce when the user explicitly clicked "Clear" (#751).
    if (_userCleared || _emptyTickCount >= 2) {
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      _userCleared = false;
    }
    if (clearBtn) clearBtn.classList.add('hidden');
    // CEO Focus panel updates via its own scheduler registration
    return;
  }

  _emptyTickCount = 0;
  if (emptyMsg) emptyMsg.classList.add('hidden');
  if (clearBtn) clearBtn.classList.remove('hidden');

  const activeCount = queue.length > 0 ? 1 : 0;
  const queueIds = queue.map(i => i.id);
  const pausedStates = queue.map(i => i.paused);

  // Check if structure changed (items added/removed/reordered, active count changed)
  const structureChanged =
    queueIds.length !== _renderedQueueIds.length ||
    queueIds.some((id, i) => id !== _renderedQueueIds[i]) ||
    activeCount !== _renderedQueueActiveCount;

  if (structureChanged) {
    // Incremental DOM diff — remove stale nodes, insert new ones, reuse existing
    const oldIdToEl = new Map();
    for (const child of Array.from(container.children)) {
      oldIdToEl.set(Number(child.dataset.queueId), child);
    }

    // Remove nodes for IDs no longer in queue
    const newIdSet = new Set(queueIds);
    for (const [id, el] of oldIdToEl) {
      if (!newIdSet.has(id)) {
        container.removeChild(el);
        oldIdToEl.delete(id);
      }
    }

    // Walk the queue in order, reusing or creating elements
    let insertBefore = container.firstChild;
    queue.forEach((item, index) => {
      const isActive = index < activeCount;
      let itemEl = oldIdToEl.get(item.id);

      if (itemEl) {
        // Reuse — ensure correct position
        if (itemEl !== insertBefore) {
          container.insertBefore(itemEl, insertBefore);
        } else {
          insertBefore = itemEl.nextSibling;
        }
        // Update active/pending class
        itemEl.className = `queue-item ${isActive ? 'active' : 'pending'}${item.paused ? ' paused' : ''}`;
        const prefixSpan = itemEl.firstChild;
        if (prefixSpan) prefixSpan.textContent = isActive ? '>' : ' ';
      } else {
        // Create new element
        itemEl = createQueueItemElement(item, isActive);
        container.insertBefore(itemEl, insertBefore);
      }

      // Update text and progress
      const textSpan = itemEl._textSpan;
      if (textSpan) textSpan.textContent = formatQueueItemText(item);
      const progressStyle = getQueueItemProgressStyle(item, isActive);
      itemEl.style.cssText = progressStyle || '';

      insertBefore = itemEl.nextSibling;
    });

    _renderedQueueIds = queueIds;
    _renderedQueueActiveCount = activeCount;
    _renderedQueuePaused = pausedStates;
  } else {
    // Incremental update — text, progress fill, and paused state
    // Use container.children[index] to find items by position (no querySelector)
    for (let i = 0; i < queue.length; i++) {
      const itemEl = container.children[i];
      if (!itemEl) continue;
      const textSpan = itemEl._textSpan || itemEl.querySelector('.queue-item-text');
      if (textSpan) {
        textSpan.textContent = formatQueueItemText(queue[i]);
      }
      // Update progress fill background
      const isActive = i < activeCount;
      const progressStyle = getQueueItemProgressStyle(queue[i], isActive);
      itemEl.style.cssText = progressStyle || '';
      // Update paused state without rebuilding DOM
      itemEl.classList.toggle('paused', !!queue[i].paused);
    }
    _renderedQueuePaused = pausedStates;
  }

}

/** Format the display text for a single queue item. */
function formatQueueItemText(item) {
  const time = item.effectiveRemaining != null
    ? formatDuration(item.effectiveRemaining)
    : null;

  switch (item.type) {
    case 'purchase': {
      const purchasable = getPurchasableById(item.target);
      const name = purchasable ? purchasable.name : item.target;
      if (item.paused) {
        return item.quantity > 1
          ? `${name} (${item.completed}/${item.quantity} queued)`
          : `${name} (queued)`;
      }
      if (item.quantity > 1) {
        return time
          ? `${name} (${item.completed}/${item.quantity}, ${time})`
          : `${name} (${item.completed}/${item.quantity})`;
      }
      return time ? `${name} (${time})` : name;
    }
    case 'fundraise': {
      const label = `Fundraise: ${item.target.replace(/_/g, ' ')}`;
      if (item.paused) return `${label} (queued)`;
      return time ? `${label} (${time})` : label;
    }
    case 'culture': {
      const t = item.targetAllocation;
      const label = `Culture: Target ${Math.round(t.capabilities*100)}/${Math.round(t.applications*100)}/${Math.round(t.alignment*100)}`;
      if (item.paused) return `${label} (queued)`;
      if (item.effectiveRemaining != null && item.effectiveRemaining > 0) {
        return `${label} (${formatDuration(item.effectiveRemaining)})`;
      }
      return label;
    }
    case 'furlough': {
      const purchasable = getPurchasableById(item.target);
      const name = purchasable ? purchasable.name : item.target;
      if (item.paused) {
        return item.quantity > 1
          ? `Furlough: ${name} (${item.completed}/${item.quantity} queued)`
          : `Furlough: ${name} (queued)`;
      }
      if (item.quantity > 1) {
        return time
          ? `Furlough: ${name} (${item.completed}/${item.quantity}, ${time})`
          : `Furlough: ${name} (${item.completed}/${item.quantity})`;
      }
      return time ? `Furlough: ${name} (${time})` : `Furlough: ${name}`;
    }
    case 'purge_synthetic': {
      return 'Purging Synthetic Data...';
    }
    default:
      return `Unknown: ${item.type}`;
  }
}

// Window exports moved to js/test-api.js
