// js/ui/research.js
// Capability tree, research list, milestone cards, research breakdown,
// and safety dashboard.
//
// Caching strategy:
//   _renderedUpcomingKey — filter-aware cache key (`filter:id1,id2,...`) for
//   the "upcoming" list. When the key changes we do a full DOM rebuild;
//   otherwise we patch progress bars and RP text via stashed child refs
//   (card._fill, card._costEl) to avoid querySelector calls.
//
//   _renderedCompletedKey — cache key for the "completed" list. Only rebuilt
//   when the set or filter changes.
//
//   resetResearchCache() clears both keys so the next render does a full
//   rebuild. It is registered with the scheduler as the reset callback and
//   also exported as reset() for resetUI().

import { BALANCE } from '../../data/balance.js';
import { gameState } from '../game-state.js';
import { tracks, getCapabilityThreshold, meetsPrerequisites, getCapability, isCapabilityUnlocked, getAllUnlockedCapabilities } from '../capabilities.js';
import { capabilitiesTrack } from '../content/capabilities-track.js';
import { applicationsTrack } from '../content/applications-track.js';
import { alignmentTrack } from '../content/alignment-track.js';
import { getAllPurchasables } from '../content/purchasables.js';
import { getAllSafetyMetrics, formatAlignmentDisplay, formatAlignmentStatusLabel, enableProgram, disableProgram, getRampTime, getTotalCapacityDraw, getCapacityEffectiveness, canEnableProgram, hasUpgradePath, isUpgrading, upgradeProgram, cancelUpgrade } from '../safety-metrics.js';
import { ALIGNMENT_PROGRAMS, PROGRAMS_BY_SUBMETRIC, PROGRAMS_BY_ID, UPGRADE_PATHS } from '../content/alignment-programs.js';
import { formatNumber, formatEta, getRateUnit, formatGameDate } from '../utils/format.js';
import { $ } from '../utils/dom-cache.js';
import { el } from '../utils/dom.js';
import { registerUpdate, EVERY_TICK, FAST, SLOW } from './scheduler.js';
import { attachTooltip } from './stats-tooltip.js';
import { getTransparencyTier, formatMetricValue, getMetricValueClass, formatMetricDelta, formatAlignmentPenalty, SUBMETRIC_DISPLAY_NAMES, PRESSURE_SOURCE_LABELS, SUBMETRIC_DESCRIPTIONS, SUBMETRIC_INCIDENT_WARNINGS } from './alignment-display.js';
import { getActiveConsequenceEffects } from '../consequence-events.js';
import { buildAutonomyLevelTooltip } from './ai-tab.js';

import { attachFlavorTooltip } from '../flavor-discovery.js';

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------
let _renderedUpcomingKey = '';
let _renderedCompletedKey = '';
let _trackFilter = 'all'; // 'all', 'capabilities', 'applications', 'alignment'
let _filterButtonsRendered = false;

function resetResearchCache() {
  _renderedUpcomingKey = '';
  _renderedCompletedKey = '';
  _filterButtonsRendered = false;
  selectedProgramId = null;
  _lastProgramsAP = -1;
  _programsFingerprint = '';
}

export function reset() {
  resetResearchCache();
}

// ---------------------------------------------------------------------------
// Scheduler registration
// ---------------------------------------------------------------------------
registerUpdate(updateGlobalResearchRate, EVERY_TICK);
registerUpdate(updateResearchList, EVERY_TICK, { reset: resetResearchCache });
registerUpdate(updateCapabilityTree, SLOW, { reset: resetResearchCache });
registerUpdate(updateSafetyDashboard, SLOW);
registerUpdate(updateIncidentTimers, FAST);
registerUpdate(updateProgramCards, EVERY_TICK, { reset: resetResearchCache });

// ---------------------------------------------------------------------------
// Global research rate (single line, hover for tooltip breakdown)
// ---------------------------------------------------------------------------
export function updateGlobalResearchRate() {
  const el = $('global-research-value');
  if (!el) return;
  const bd = gameState.computed?.research;
  if (!bd) return;
  el.textContent = '+' + formatNumber(bd.total) + getRateUnit();
}

// ---------------------------------------------------------------------------
// Capability tree
// ---------------------------------------------------------------------------

// Uses innerHTML + template literals intentionally — browser's native HTML
// parser is faster than el() calls for full rebuilds. Do not convert.
export function updateCapabilityTree() {
  const container = $('tree-container');
  if (!container) return;

  const currentTrack = gameState.ui.currentTrack || 'capabilities';
  const track = tracks[currentTrack];

  if (!track) {
    container.innerHTML = '<p class="dim">Track not found.</p>';
    return;
  }

  const trackState = gameState.tracks[currentTrack];
  const trackRP = trackState?.researchPoints || 0;

  // Find next milestone for this track
  const nextMilestone = getNextMilestone(currentTrack);
  const progress = nextMilestone
    ? Math.min(100, (trackRP / getCapabilityThreshold(nextMilestone)) * 100)
    : 100;

  // Build track dashboard
  let html = `
    <div class="track-dashboard">
      <div class="track-dashboard-header">
        <span class="track-description">${track.name}</span>
        <span class="track-rp"><span class="track-rp-value">${formatNumber(trackRP)}</span> RP</span>
      </div>`;

  if (nextMilestone) {
    const threshold = getCapabilityThreshold(nextMilestone);
    const blockers = getMilestoneBlockers(currentTrack, nextMilestone.id);
    const prereqsMet = meetsPrerequisites(currentTrack, nextMilestone.id, gameState);
    const thresholdText = nextMilestone.redacted
      ? '??? RP'
      : `${formatNumber(trackRP)} / ${formatNumber(threshold)} RP`;
    html += `
      <div class="milestone-progress">
        <div class="milestone-next">
          <span class="milestone-label">Next: ${nextMilestone.name}</span>
          <span class="milestone-threshold">${thresholdText}</span>
        </div>
        <div class="milestone-bar">
          <div class="milestone-bar-fill${!prereqsMet ? ' blocked' : ''}" style="width: ${progress.toFixed(1)}%"></div>
        </div>
        ${blockers.length > 0 ? `<div class="milestone-blockers">Requires: ${blockers.join(', ')}</div>` : ''}
      </div>`;
  } else {
    html += `<div class="milestone-progress"><span class="dim">All milestones unlocked</span></div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  // Show unlocked and upcoming milestones
  for (const capability of track.capabilities) {
    const isUnlocked = trackState?.unlockedCapabilities?.includes(capability.id);
    const prereqsMet = meetsPrerequisites(currentTrack, capability.id, gameState);
    const thresholdReached = trackRP >= getCapabilityThreshold(capability);

    let status = 'locked';
    if (isUnlocked) {
      status = 'unlocked';
    } else if (prereqsMet && thresholdReached) {
      status = 'available'; // About to auto-unlock (should have been caught)
    } else if (prereqsMet) {
      status = 'approaching'; // Prerequisites met, waiting for RP
    }

    container.appendChild(createTrackMilestoneCard(capability, status, currentTrack, trackState));
  }
}

// ---------------------------------------------------------------------------
// Upcoming / completed milestone collectors
// ---------------------------------------------------------------------------

// Get next upcoming milestones across all tracks (prerequisites met, not yet unlocked)
function getUpcomingMilestones() {
  const state = gameState;
  const upcoming = [];

  const allTracks = [
    { track: capabilitiesTrack, stateKey: 'capabilities' },
    { track: applicationsTrack, stateKey: 'applications' },
    ...(state.arc >= 2 ? [{ track: alignmentTrack, stateKey: 'alignment' }] : []),
  ];

  for (const { track, stateKey } of allTracks) {
    const trackState = state.tracks[stateKey];
    const unlocked = trackState?.unlockedCapabilities || [];

    for (const item of track.capabilities) {
      if (unlocked.includes(item.id)) continue;

      // Check if prerequisites are met (but threshold may not be reached yet)
      if (meetsPrerequisites(stateKey, item.id, state)) {
        const threshold = getCapabilityThreshold(item);
        const trackRP = trackState?.researchPoints || 0;
        const progress = Math.min(100, (trackRP / threshold) * 100);
        upcoming.push({ ...item, trackId: stateKey, threshold, progress });
      }
    }
  }

  // Sort by time remaining: remainingRP / allocation
  // Allocation only changes on player input, so order is stable (no hysteresis needed).
  // Zero allocation → Infinity → bottom. Remaining RP as tiebreaker.
  upcoming.sort((a, b) => {
    const allocA = state.tracks[a.trackId]?.researcherAllocation || 0;
    const allocB = state.tracks[b.trackId]?.researcherAllocation || 0;
    const remA = a.threshold - (state.tracks[a.trackId]?.researchPoints || 0);
    const remB = b.threshold - (state.tracks[b.trackId]?.researchPoints || 0);
    const etaA = allocA > 0 ? remA / allocA : Infinity;
    const etaB = allocB > 0 ? remB / allocB : Infinity;
    if (etaA !== etaB) return etaA - etaB;
    return remA - remB;  // tiebreaker: less remaining RP first
  });

  return upcoming;
}

// Get all completed research items
function getCompletedResearch() {
  const state = gameState;
  const completed = [];

  const allTracks = [
    { track: capabilitiesTrack, stateKey: 'capabilities' },
    { track: applicationsTrack, stateKey: 'applications' },
    ...(state.arc >= 2 ? [{ track: alignmentTrack, stateKey: 'alignment' }] : []),
  ];

  for (const { track, stateKey } of allTracks) {
    const trackState = state.tracks[stateKey];
    const unlocked = trackState?.unlockedCapabilities || [];
    const unlockOrder = trackState?.unlockOrder || [];
    const timestamps = trackState?.unlockTimestamps || {};

    for (const itemId of unlocked) {
      const item = track.capabilities.find(c => c.id === itemId);
      if (item) {
        const orderIndex = unlockOrder.indexOf(itemId);
        completed.push({
          ...item,
          trackId: stateKey,
          threshold: getCapabilityThreshold(item),
          unlockIndex: orderIndex >= 0 ? orderIndex : 999,
          completedAt: timestamps[itemId] ?? null,
        });
      }
    }
  }

  // Sort by completion time (most recent first), fall back to unlock order
  completed.sort((a, b) => {
    if (a.completedAt != null && b.completedAt != null) return b.completedAt - a.completedAt;
    if (a.completedAt != null) return -1;
    if (b.completedAt != null) return 1;
    return b.unlockIndex - a.unlockIndex;
  });

  return completed;
}

// ---------------------------------------------------------------------------
// Research list (milestone dashboard)
// ---------------------------------------------------------------------------

// Render milestone dashboard — upcoming milestones with progress bars
export function updateResearchList() {
  const container = $('research-list');
  const completedContainer = $('completed-list');
  if (!container) return;

  // Render upcoming milestones (incremental — reuse DOM for smooth transitions)
  const allUpcoming = getUpcomingMilestones();
  const upcoming = _trackFilter === 'all'
    ? allUpcoming
    : allUpcoming.filter(m => m.trackId === _trackFilter);
  const upcomingIds = upcoming.map(m => m.id);
  const cacheKey = `${_trackFilter}:${upcomingIds.join(',')}`;
  const idsChanged = cacheKey !== _renderedUpcomingKey;

  if (idsChanged) {
    // Full rebuild — set of milestones changed
    container.innerHTML = '';
    for (const item of upcoming) {
      container.appendChild(createMilestoneCard(item));
    }
    if (upcoming.length === 0) {
      const label = TRACK_LABELS[_trackFilter];
      container.innerHTML = label
        ? `<p class="dim">No upcoming research in ${label}.</p>`
        : '<p class="dim">No milestones approaching.</p>';
    }
    _renderedUpcomingKey = cacheKey;
  } else {
    // Incremental update — patch progress bars, RP text, and ETAs via stashed refs
    for (const item of upcoming) {
      const existingCard = container.querySelector(`[data-research-id="${item.id}"]`);
      if (existingCard) {
        const fill = existingCard._fill;
        if (fill) fill.style.width = `${item.progress.toFixed(1)}%`;
        const costEl = existingCard._costEl;
        if (costEl && !item.redacted) {
          const trackRP = gameState.tracks[item.trackId]?.researchPoints || 0;
          costEl.textContent = `${formatNumber(trackRP)} / ${formatNumber(item.threshold)} RP`;
        }
        const etaEl = existingCard._etaEl;
        if (etaEl && !item.redacted) {
          const remaining = item.threshold - (gameState.tracks[item.trackId]?.researchPoints || 0);
          const trackRate = getTrackResearchRate(item.trackId);
          if (trackRate > 0.001) {
            etaEl.textContent = `${formatEta(remaining / trackRate)}`;
          } else {
            etaEl.textContent = 'no allocation';
          }
        }
      }
    }
  }

  // Render completed milestones (full rebuild only when set changes or filter changes)
  if (completedContainer) {
    // Add filter buttons if not yet rendered
    if (!_filterButtonsRendered && completedContainer.parentElement) {
      const existingFilter = document.getElementById('completed-filter');
      if (existingFilter) existingFilter.remove();
      const filterRow = el('div', {
        attrs: { id: 'completed-filter' },
        className: 'filter-row',
        children: [
          el('button', { className: 'filter-btn active', data: { track: 'all' }, text: 'All' }),
          el('button', { className: 'filter-btn', data: { track: 'capabilities' }, text: 'Capabilities' }),
          el('button', { className: 'filter-btn', data: { track: 'applications' }, text: 'Applications' }),
          el('button', { className: 'filter-btn arc-1-hidden', data: { track: 'alignment' }, text: 'Alignment' }),
        ],
      });
      filterRow.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        const track = btn.dataset.track;
        if (track === _trackFilter) return;
        _trackFilter = track;
        filterRow.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderedUpcomingKey = ''; // Force rebuild
        _renderedCompletedKey = '';
      });
      const researchList = document.getElementById('research-list');
      completedContainer.parentElement.insertBefore(filterRow, researchList);
      _filterButtonsRendered = true;
    }

    const completed = getCompletedResearch();
    const filtered = _trackFilter === 'all'
      ? completed
      : completed.filter(m => m.trackId === _trackFilter);
    const filteredIds = filtered.map(m => m.id);
    const cacheKey = `${_trackFilter}:${filteredIds.join(',')}`;
    const completedChanged = cacheKey !== _renderedCompletedKey;

    if (completedChanged) {
      completedContainer.innerHTML = '';
      for (const item of filtered) {
        completedContainer.appendChild(createCompletedMilestoneCard(item));
      }
      if (filtered.length === 0) {
        completedContainer.innerHTML = '<p class="dim">No milestones unlocked yet.</p>';
      }
      _renderedCompletedKey = cacheKey;
    }
  }
}

// ---------------------------------------------------------------------------
// Card creation
// ---------------------------------------------------------------------------

const TRACK_LABELS = { capabilities: 'Capabilities', applications: 'Applications', alignment: 'Alignment' };


/**
 * Get actual RP/s for a track.
 * Reads from track.researchRate, which is set by generateTrackResearch() each tick.
 * Single source of truth — no duplicated calculation logic.
 */
export function getTrackResearchRate(trackId) {
  return gameState.tracks[trackId]?.researchRate || 0;
}

// Reverse mapping: capability ID → purchasable names it unlocks (built lazily)
let _unlockMap = null;
function getUnlockMap() {
  if (_unlockMap) return _unlockMap;
  _unlockMap = {};
  for (const p of getAllPurchasables()) {
    if (p.requires?.capability) {
      const capId = p.requires.capability;
      if (!_unlockMap[capId]) _unlockMap[capId] = [];
      _unlockMap[capId].push(p.name);
    }
  }
  for (const prog of ALIGNMENT_PROGRAMS) {
    if (prog.unlockedBy) {
      if (!_unlockMap[prog.unlockedBy]) _unlockMap[prog.unlockedBy] = [];
      _unlockMap[prog.unlockedBy].push(prog.name);
    }
  }
  return _unlockMap;
}

/** Get all unlock labels for a capability (purchasable-derived + declared). */
function getAllUnlocks(capabilityOrItem) {
  const derived = getUnlockMap()[capabilityOrItem.id] || [];
  const declared = capabilityOrItem.effects?.unlocks || [];

  // Filter out program names for unrevealed submetrics
  const visibleSubs = new Set(getVisibleSubmetrics());
  const filteredDerived = derived.filter(name => {
    const prog = ALIGNMENT_PROGRAMS.find(p => p.name === name);
    if (!prog) return true; // not a program (purchasable) — always show
    return visibleSubs.has(prog.submetric) || prog.submetric === 'all';
  });

  return [...filteredDerived, ...declared];
}

// Create a toggleable flavor text element.
// Shows description + [more] by default; click expands to show full longDescription below, click again collapses.
function createFlavorToggle(description, longDescription) {
  const flavor = el('div', { className: 'research-flavor' });
  const hasLongVersion = longDescription && longDescription !== description;

  if (!hasLongVersion) {
    flavor.textContent = description || longDescription || '';
    return flavor;
  }

  let expanded = false;

  const descSpan = el('span', { text: description });
  const moreToggle = el('span', { className: 'flavor-toggle', text: ' [more]' });
  const expandedText = el('span', { className: 'flavor-expanded', text: ' ' + longDescription });
  const lessToggle = el('span', { className: 'flavor-toggle', text: ' [less]' });
  expandedText.style.display = 'none';
  lessToggle.style.display = 'none';

  flavor.appendChild(descSpan);
  flavor.appendChild(moreToggle);
  flavor.appendChild(expandedText);
  flavor.appendChild(lessToggle);

  const doToggle = () => {
    expanded = !expanded;
    expandedText.style.display = expanded ? 'inline' : 'none';
    moreToggle.style.display = expanded ? 'none' : 'inline';
    lessToggle.style.display = expanded ? 'inline' : 'none';
  };
  moreToggle.addEventListener('click', doToggle);
  lessToggle.addEventListener('click', doToggle);

  return flavor;
}

// Create a milestone card showing progress toward threshold.
// Stashes ._fill and ._costEl on the card element so incremental updates
// can patch them directly without querySelector.
function createMilestoneCard(item) {
  const trackRP = gameState.tracks[item.trackId]?.researchPoints || 0;
  const effectsList = formatResearchEffects(item);

  const thresholdDisplay = el('span', {
    className: 'research-cost',
    text: item.redacted ? '??? RP' : `${formatNumber(trackRP)} / ${formatNumber(item.threshold)} RP`,
  });

  const fill = el('div', {
    className: `milestone-bar-fill ${item.trackId}`,
  });
  fill.style.width = `${item.progress.toFixed(1)}%`;

  // ETA element (hidden for redacted milestones)
  const remaining = item.threshold - (gameState.tracks[item.trackId]?.researchPoints || 0);
  const trackRate = getTrackResearchRate(item.trackId);
  const etaEl = el('div', { className: 'research-eta dim' });
  if (item.redacted) {
    etaEl.textContent = '';
  } else if (trackRate > 0.001) {
    etaEl.textContent = `${formatEta(remaining / trackRate)}`;
  } else {
    etaEl.textContent = 'no allocation';
  }

  const flavorEl = createFlavorToggle(item.description, item.longDescription);

  const nameEl = el('span', { className: 'research-name', text: item.name });

  const card = el('div', {
    className: 'compact-research-card approaching',
    data: { researchId: item.id, track: item.trackId },
    children: [
      // Header: name + track badge + threshold
      el('div', {
        className: 'research-header',
        children: [
          el('span', {
            children: [
              nameEl,
              el('span', {
                className: `track-badge ${item.trackId}`,
                text: TRACK_LABELS[item.trackId] || item.trackId,
              }),
            ],
          }),
          thresholdDisplay,
        ],
      }),
      // Progress bar + ETA
      el('div', { className: 'milestone-bar', children: [fill] }),
      etaEl,
      // Flavor text (click to toggle between short description and full longDescription)
      flavorEl,
      // Effects
      el('div', {
        className: 'research-effects',
        html: effectsList.map(e => `<span class="effect ${e.positive ? 'positive' : 'negative'}">${e.text}</span>`).join(''),
      }),
    ],
  });

  // Unlock info
  const unlocks = getAllUnlocks(item);
  if (unlocks.length > 0) {
    card.appendChild(el('div', {
      className: 'research-effects',
      html: unlocks.map(n => `<span class="effect unlock">Unlocks: ${n}</span>`).join(''),
    }));
  }

  // Stash refs for incremental updates
  card._fill = fill;
  card._costEl = thresholdDisplay;
  card._etaEl = etaEl;

  // Flavor tooltip on title (desktop-only easter egg)
  if (item.flavor) {
    attachFlavorTooltip(nameEl, item.id, item.flavor);
  }

  card._trackId = item.trackId;
  card._threshold = item.threshold;

  return card;
}

// Create a completed milestone card
function createCompletedMilestoneCard(item) {
  const effectsList = formatResearchEffects(item);
  const nameEl = el('span', { className: 'research-name', text: item.name });

  const card = el('div', {
    className: 'compact-research-card completed',
    data: { researchId: item.id, track: item.trackId },
    children: [
      // Header: name + track badge + DONE
      el('div', {
        className: 'research-header',
        children: [
          el('span', {
            children: [
              nameEl,
              el('span', {
                className: `track-badge ${item.trackId}`,
                text: TRACK_LABELS[item.trackId] || item.trackId,
              }),
            ],
          }),
          el('span', {
            className: 'research-cost completed',
            text: item.completedAt != null
              ? `${formatNumber(item.threshold)} RP · ${formatGameDate(item.completedAt)}`
              : `${formatNumber(item.threshold)} RP`,
          }),
        ],
      }),
    ],
  });

  // Flavor text (click to toggle between short description and full longDescription)
  const flavorEl = createFlavorToggle(item.description, item.longDescription || item.description);
  card.appendChild(flavorEl);

  // Flavor tooltip on title (desktop-only easter egg)
  if (item.flavor) {
    attachFlavorTooltip(nameEl, item.id, item.flavor);
  }

  // Effects
  card.appendChild(el('div', {
    className: 'research-effects',
    html: effectsList.map(e => `<span class="effect ${e.positive ? 'positive' : 'negative'}">${e.text}</span>`).join(''),
  }));

  // Unlock info
  const unlocks2 = getAllUnlocks(item);
  if (unlocks2.length > 0) {
    card.appendChild(el('div', {
      className: 'research-effects',
      html: unlocks2.map(n => `<span class="effect unlock">Unlocks: ${n}</span>`).join(''),
    }));
  }

  return card;
}

// Format effects for display. Accepts full capability object to access
// both effects{} and top-level multipliers (demandMultiplier, referencePriceMultiplier).
function formatResearchEffects(capability) {
  const formatted = [];
  const effects = capability.effects;

  if (!effects && !capability.demandMultiplier && !capability.referencePriceMultiplier) return formatted;

  // --- Positive effects first ---

  if (effects?.researchRateMultiplier) {
    formatted.push({ text: `\u00d7${effects.researchRateMultiplier} research speed`, positive: true });
  }
  if (effects?.tokenEfficiencyMultiplier) {
    formatted.push({ text: `\u00d7${effects.tokenEfficiencyMultiplier} token efficiency`, positive: true });
  }
  if (capability.demandMultiplier) {
    formatted.push({ text: `\u00d7${capability.demandMultiplier} demand`, positive: true });
  }
  if (capability.referencePriceMultiplier) {
    formatted.push({ text: `\u00d7${capability.referencePriceMultiplier} market price`, positive: true });
  }
  if (effects?.marketEdgeMultiplier) {
    formatted.push({ text: `\u00d7${effects.marketEdgeMultiplier} market edge`, positive: true });
  }
  if (effects?.compoundingDemandGrowth) {
    const rate = (BALANCE.LATE_GAME_DEMAND_GROWTH_RATE * 100).toFixed(1);
    formatted.push({ text: `+${rate}%/s demand growth`, positive: true });
  }
  if (effects?.endgameDemandGrowth) {
    const rate = (BALANCE.ENDGAME_DEMAND_GROWTH_BONUS * 100).toFixed(1);
    formatted.push({ text: `+${rate}%/s demand growth`, positive: true });
  }
  if (effects?.servingMultiplier) {
    formatted.push({ text: `\u00d7${effects.servingMultiplier} token efficiency`, positive: true });
  }
  if (effects?.staffingSpeedMultiplier) {
    formatted.push({ text: `\u00d7${effects.staffingSpeedMultiplier} staffing speed`, positive: true });
  }
  if (effects?.focusSpeedMultiplier) {
    formatted.push({ text: `\u00d7${effects.focusSpeedMultiplier} focus speed`, positive: true });
  }
  // Submetric pressure effects — direction (+ magnitude at quantitative tier)
  if (capability.submetricEffects) {
    const revealed = new Set(gameState.computed?.revealedSubmetrics || []);
    const showMagnitude = getTransparencyTier() === 'quantitative';
    let hasUnrevealedPositive = false;
    let hasUnrevealedNegative = false;
    for (const [metric, value] of Object.entries(capability.submetricEffects)) {
      if (value === 0) continue;
      if (revealed.has(metric)) {
        const arrow = value > 0 ? '\u2191' : '\u2193';
        const label = metric.charAt(0).toUpperCase() + metric.slice(1);
        const mag = showMagnitude ? `: ${value > 0 ? '+' : ''}${value}` : '';
        formatted.push({ text: `${arrow} ${label}${mag}`, positive: value > 0 });
      } else {
        if (value > 0) hasUnrevealedPositive = true;
        else hasUnrevealedNegative = true;
      }
    }
    if (hasUnrevealedPositive) formatted.push({ text: '\u2191 Alignment', positive: true });
    if (hasUnrevealedNegative) formatted.push({ text: '\u2193 Alignment', positive: false });
  }
  if (effects?.capFeedbackRate) {
    const pct = (effects.capFeedbackRate * 100).toFixed(2);
    formatted.push({ text: `${pct}%/s self-improvement`, positive: true });
  }
  if (effects?.alignmentFeedbackRate) {
    const pct = (effects.alignmentFeedbackRate * 100).toFixed(2);
    formatted.push({ text: `${pct}%/s align feedback`, positive: true });
  }

  // --- Negative effects ---

  if (effects?.tokenWeightMultiplier) {
    const isPositive = effects.tokenWeightMultiplier > 1.0;
    formatted.push({ text: `\u00d7${effects.tokenWeightMultiplier} token efficiency`, positive: isPositive });
  }

  // --- Text-based effects (non-numeric descriptions) ---
  if (effects?.textEffects) {
    for (const text of effects.textEffects) {
      formatted.push({ text, positive: true });
    }
  }

  return formatted;
}

// ---------------------------------------------------------------------------
// Track milestone card (capability tree view)
// ---------------------------------------------------------------------------

// Create a milestone card for track-based display (no buy buttons)
function createTrackMilestoneCard(capability, status, trackId, trackState) {
  const card = el('div', {
    className: `capability-card ${status}`,
    data: { capabilityId: capability.id, track: trackId },
    children: [
      // Header row: name + status
      el('div', {
        className: 'capability-header',
        children: [
          el('span', { className: 'capability-name', text: capability.name }),
          (() => {
            const statusEl = el('span', { className: `capability-status ${status}` });
            if (status === 'unlocked') {
              statusEl.textContent = 'UNLOCKED';
            } else if (capability.redacted) {
              statusEl.textContent = '??? RP';
            } else {
              const threshold = getCapabilityThreshold(capability);
              statusEl.textContent = formatNumber(threshold) + ' RP';
            }
            return statusEl;
          })(),
        ],
      }),
      // Description
      el('div', { className: 'capability-description', text: capability.description }),
    ],
  });

  // Progress bar for approaching milestones
  if (status === 'approaching') {
    const threshold = getCapabilityThreshold(capability);
    const trackRP = trackState?.researchPoints || 0;
    const progress = Math.min(100, (trackRP / threshold) * 100);

    const fill = el('div', { className: `milestone-bar-fill ${trackId}` });
    fill.style.width = `${progress.toFixed(1)}%`;

    card.appendChild(el('div', {
      className: 'milestone-bar',
      children: [fill],
    }));
    card.appendChild(el('div', {
      className: 'capability-progress-text dim',
      text: capability.redacted ? '??? RP' : `${formatNumber(trackRP)} / ${formatNumber(threshold)} RP`,
    }));
  }

  // Prerequisites (if any and not unlocked)
  if (status !== 'unlocked') {
    const blockers = getMilestoneBlockers(trackId, capability.id);
    if (blockers.length > 0) {
      card.appendChild(el('div', {
        className: 'capability-prereqs milestone-blockers',
        text: 'Requires: ' + blockers.join(', '),
      }));
    }
  }

  // Effects
  const effectsList = formatResearchEffects(capability);
  if (effectsList.length > 0) {
    card.appendChild(el('div', {
      className: 'research-effects',
      html: effectsList.map(e => `<span class="effect ${e.positive ? 'positive' : 'negative'}">${e.text}</span>`).join(''),
    }));
  }

  // Unlock info
  const unlocks = getAllUnlocks(capability);
  if (unlocks.length > 0) {
    card.appendChild(el('div', {
      className: 'research-effects',
      html: unlocks.map(n => `<span class="effect unlock">Unlocks: ${n}</span>`).join(''),
    }));
  }

  return card;
}

// ---------------------------------------------------------------------------
// Milestone helpers
// ---------------------------------------------------------------------------

// Get the next locked milestone for a track (lowest threshold not yet unlocked)
function getNextMilestone(trackId) {
  const track = tracks[trackId];
  const trackState = gameState.tracks[trackId];
  if (!track || !trackState) return null;

  // Sort by threshold ascending
  const sorted = [...track.capabilities].sort((a, b) => getCapabilityThreshold(a) - getCapabilityThreshold(b));

  for (const cap of sorted) {
    if (trackState.unlockedCapabilities.includes(cap.id)) continue;
    return cap;
  }
  return null;
}

// Get human-readable blockers for a milestone
function getMilestoneBlockers(trackId, capabilityId) {
  const capability = getCapability(trackId, capabilityId);
  if (!capability) return [];

  const blockers = [];

  const allUnlocked = getAllUnlockedCapabilities();

  // Check prerequisites against the union
  for (const reqId of capability.requires || []) {
    if (!allUnlocked.has(reqId)) {
      // Try to find a human-readable name from any track
      let reqCap = getCapability(trackId, reqId);
      if (!reqCap) {
        for (const tid of Object.keys(gameState.tracks)) {
          reqCap = getCapability(tid, reqId);
          if (reqCap) break;
        }
      }
      blockers.push(reqCap ? reqCap.name : reqId.replace(/_/g, ' '));
    }
  }

  return blockers;
}

// ---------------------------------------------------------------------------
// Safety dashboard (Arc 2)
// ---------------------------------------------------------------------------

// --- Submetric pressure tooltips ---
// Constants and formatting imported from alignment-display.js

/**
 * Build tooltip HTML for a submetric label — brief description of what it measures.
 */
function buildSubmetricLabelTooltip(sub) {
  const name = SUBMETRIC_DISPLAY_NAMES[sub];
  const desc = SUBMETRIC_DESCRIPTIONS[sub];
  const warning = SUBMETRIC_INCIDENT_WARNINGS[sub];
  return `<div class="tooltip-header"><span>${name}</span></div>`
    + `<div class="tooltip-section"><div class="tooltip-row"><span>${desc}</span></div></div>`
    + `<div class="tooltip-section"><div class="tooltip-row dim"><span>${warning}</span></div></div>`;
}

/**
 * Build tooltip HTML for a submetric value — breakdown by transparency tier.
 * opaque: minimal ("?"), qualitative: labels, quantitative: exact numbers.
 */
function buildSubmetricTooltip(sub) {
  const revealed = gameState.computed?.revealedSubmetrics || [];
  if (!revealed.includes(sub)) return '';

  const bd = gameState.computed?.submetricBreakdown?.[sub];
  if (!bd) return '';

  const name = SUBMETRIC_DISPLAY_NAMES[sub];
  const tier = getTransparencyTier();

  // Header: name + value (tier-appropriate)
  const headerVal = formatMetricValue(bd.final);
  let html = `<div class="tooltip-header"><span>${name}</span><span class="tooltip-value">${headerVal}</span></div>`;

  if (tier === 'opaque') return html;

  html += '<div class="tooltip-section">';

  if (tier === 'quantitative') {
    // Exact numbers
    html += `<div class="tooltip-row"><span>Base</span><span>${bd.base}</span></div>`;

    if (bd.programs > 0) {
      let progLabel = 'Programs';
      if (bd.effectiveness < 1.0) {
        progLabel += ` (${Math.round(bd.effectiveness * 100)}% capacity)`;
      }
      html += `<div class="tooltip-row"><span>${progLabel}</span><span class="positive">${formatMetricDelta(bd.programs, '+')}</span></div>`;
    }

    for (const [key, label] of Object.entries(PRESSURE_SOURCE_LABELS)) {
      if (bd[key] > 0) {
        html += `<div class="tooltip-row"><span>${label}</span><span class="negative">-${bd[key]}</span></div>`;
      }
    }

    if (bd.consequencePenalty > 0) {
      html += `<div class="tooltip-row"><span>Robustness incident</span><span class="negative">${formatAlignmentPenalty(bd.consequencePenalty)}</span></div>`;
    }
  } else {
    // Qualitative
    if (bd.programs > 0) {
      html += `<div class="tooltip-row"><span>Programs</span><span>${formatMetricDelta(bd.programs)}</span></div>`;
    } else {
      html += '<div class="tooltip-row dim"><span>No active programs</span></div>';
    }

    if (bd.pressureTotal > 0) {
      html += `<div class="tooltip-row"><span>Pressure</span><span>${formatMetricDelta(bd.pressureTotal)}</span></div>`;
    }

    if (bd.consequencePenalty > 0) {
      html += `<div class="tooltip-row"><span>Incident penalty</span><span class="negative">${formatAlignmentPenalty(bd.consequencePenalty)}</span></div>`;
    }
  }

  html += '</div>';
  return html;
}

// One-time attachment guard
let _submetricTooltipsAttached = false;

function attachSubmetricTooltips() {
  if (_submetricTooltipsAttached) return;
  _submetricTooltipsAttached = true;

  const factorsCol = document.getElementById('dashboard-factors');
  if (!factorsCol) return;

  for (const sub of ['robustness', 'interpretability', 'corrigibility', 'honesty']) {
    const row = factorsCol.querySelector(`.metric-row[data-metric="${sub}"]`);
    if (!row) continue;
    const label = row.querySelector('.metric-label');
    const value = row.querySelector('.metric-value');
    if (label) {
      label.style.cursor = 'help';
      attachTooltip(label, () => buildSubmetricLabelTooltip(sub), { position: 'right' });
    }
    if (value) {
      value.style.cursor = 'help';
      attachTooltip(value, () => buildSubmetricTooltip(sub), { position: 'right' });
    }
  }

  // Program capacity row tooltip
  const apRow = document.querySelector('[data-metric="ap"]');
  if (apRow) {
    apRow.style.cursor = 'help';
    attachTooltip(apRow, () => {
      const draw = getTotalCapacityDraw();
      const ap = gameState.computed?.programs?.ap || 0;
      let html = '<div class="tooltip-header"><span>Program Capacity</span></div>';
      html += '<div class="tooltip-section">';
      html += '<div class="tooltip-row">Capacity is derived from your alignment research rate. Higher alignment RP/s grants more capacity to run programs.</div>';
      html += `<div class="tooltip-row"><span>Current draw</span><span>${draw}</span></div>`;
      html += `<div class="tooltip-row"><span>Total capacity</span><span>${ap}</span></div>`;
      const apCultureMod = gameState.computed?.culture?.apGeneration || 0;
      if (Math.abs(apCultureMod) > 0.005) {
        const cls = apCultureMod > 0 ? 'positive' : 'negative';
        html += `<div class="tooltip-row"><span>Lab culture</span><span class="${cls}">&times;${(1 + apCultureMod).toFixed(2)}</span></div>`;
      }
      if (draw > ap) {
        html += '<div class="tooltip-row"><span class="negative">Over capacity — program bonuses reduced</span></div>';
      }
      html += '</div>';
      return html;
    }, { position: 'right' });
  }

  // Autonomy level row tooltip
  const autonomyRow = document.querySelector('[data-metric="autonomyLevel"]');
  if (autonomyRow) {
    autonomyRow.style.cursor = 'help';
    attachTooltip(autonomyRow, buildAutonomyLevelTooltip, { position: 'right' });
  }
}

// Update safety dashboard (Arc 2 only)
export function updateSafetyDashboard() {
  if (gameState.arc !== 2) return;

  let activeIncidents = [];

  // Attach submetric tooltips on first update
  attachSubmetricTooltips();

  const metrics = getAllSafetyMetrics();
  const revealed = gameState.computed?.revealedSubmetrics || [];
  const tier = getTransparencyTier();
  const isQuantitative = tier === 'quantitative';
  const visible = new Set(revealed);
  // Always-visible metrics
  visible.add('evalPassRate');
  if (isQuantitative) {
    visible.add('evalAccuracy');
    visible.add('effectiveAlignment');
  }

  // Alignment display (stats bar + dashboard)
  // Stats bar: always shows qualitative danger label (all tiers)
  const alignStatEl = $('stat-alignment-value');
  const hasRevealedSubmetrics = revealed.length > 0;
  if (alignStatEl) {
    const dangerTier = gameState.computed?.danger?.tier || 'healthy';
    const status = formatAlignmentStatusLabel(dangerTier);
    alignStatEl.classList.remove('alignment-stable', 'alignment-drifting', 'alignment-at-risk', 'alignment-critical');
    alignStatEl.textContent = status.label;
    alignStatEl.classList.add(status.cssClass);
  }
  // Dashboard alignment value (always shows %)
  const alignEl = $('alignment-value');
  if (alignEl) alignEl.textContent = formatAlignmentDisplay();
  // Show stats bar alignment after first submetric reveal
  // Uses classList toggle instead of inline style because arc-1-hidden has !important
  const alignStatGroup = document.getElementById('stat-alignment-group');
  if (alignStatGroup) {
    alignStatGroup.classList.toggle('alignment-unrevealed', !hasRevealedSubmetrics);
    const sep = document.getElementById('stat-alignment-separator');
    if (sep) sep.classList.toggle('alignment-unrevealed', !hasRevealedSubmetrics);
  }

  // Gate metric rows — evals column
  const evalsCol = document.getElementById('dashboard-evals');
  if (evalsCol) {
    for (const row of evalsCol.querySelectorAll('.metric-row[data-metric]')) {
      const metric = row.dataset.metric;
      // AP visible once alignment programs section is unlocked; other evals gated by reveal state
      const apVisible = metric === 'ap' && document.getElementById('alignment-programs-section')?.classList.contains('unlocked');
      row.style.display = (apVisible || visible.has(metric)) ? '' : 'none';
    }
  }

  // Gate metric rows — factors column
  const factorsCol = document.getElementById('dashboard-factors');
  if (factorsCol) {
    for (const row of factorsCol.querySelectorAll('.metric-row[data-metric]')) {
      const metric = row.dataset.metric;
      row.style.display = visible.has(metric) ? '' : 'none';
    }
    // Hide entire factors column if no submetrics visible
    activeIncidents = getActiveConsequenceEffects();
    const anyFactorVisible = ['robustness', 'interpretability', 'corrigibility', 'honesty'].some(s => visible.has(s)) || activeIncidents.length > 0;
    factorsCol.style.display = anyFactorVisible ? '' : 'none';
  }

  // Four submetrics
  for (const sub of ['robustness', 'interpretability', 'corrigibility', 'honesty']) {
    const subEl = $(`metric-${sub}`);
    if (subEl) {
      const val = Math.round(metrics[sub]);
      subEl.textContent = formatMetricValue(val);
      const labelCss = getMetricValueClass(val);
      subEl.className = 'metric-value' + (labelCss ? ` ${labelCss}` : '');
    }
  }

  // Active incidents
  const incidentsContainer = document.getElementById('dashboard-incidents');
  if (incidentsContainer) {
    const effects = activeIncidents;
    // Stable key — only changes when effects are added/removed/expired
    const incidentKey = effects.map(e => e.messageId).join('|');

    if (effects.length === 0) {
      // Show "None" when no incidents active
      if (incidentsContainer.dataset.key !== '') {
        incidentsContainer.innerHTML = '<div class="dashboard-col-header">Incidents</div>'
          + '<div class="metric-row"><span class="metric-label">None</span></div>';
        incidentsContainer.dataset.key = '';
      }
    } else if (incidentKey !== incidentsContainer.dataset.key) {
      // Structure changed — rebuild
      let html = '<div class="dashboard-col-header">Incidents</div>';
      for (const effect of effects) {
        html += `<div class="incident-row"${effect.messageId ? ` data-msg="${effect.messageId}"` : ''}>`;
        html += `<span class="incident-headline">${effect.headline || 'Incident'}</span>`;
        html += `<span class="incident-effect">${effect.effect}</span>`;
        html += `<span class="incident-timer">${effect.remaining}s</span>`;
        html += `</div>`;
      }
      incidentsContainer.innerHTML = html;
      incidentsContainer.dataset.key = incidentKey;

      // Attach click handlers for navigation
      incidentsContainer.querySelectorAll('.incident-row[data-msg]').forEach(row => {
        const msgId = row.dataset.msg;
        row.addEventListener('click', () => {
          import('./tab-navigation.js').then(({ navigateToMessage }) => {
            navigateToMessage(msgId);
          });
        });
      });
    }
  }

  // Derived metrics
  const evalPassEl = $('metric-eval-pass');
  if (evalPassEl) {
    evalPassEl.textContent = `${Math.round(metrics.evalPassRate)}%`;
    evalPassEl.className = 'metric-value' + (metrics.evalPassRate < 60 ? ' warning' : '');
  }
  const evalAccEl = $('metric-eval-accuracy');
  if (evalAccEl) {
    evalAccEl.textContent = `${Math.round(metrics.evalAccuracy)}%`;
    evalAccEl.className = 'metric-value' + (metrics.evalAccuracy < 40 ? ' warning' : '');
  }

  // Autonomy level — visible once first request fires
  const autonomyRow = document.querySelector('[data-metric="autonomyLevel"]');
  if (autonomyRow) {
    const hasFired = Object.keys(gameState.aiRequestsFired || {}).length > 0;
    autonomyRow.style.display = hasFired ? '' : 'none';
    if (hasFired) {
      const level = gameState.computed.autonomyLevel;
      const tierName = gameState.computed.autonomyTierName || '';
      const el = $('metric-autonomy-level');
      if (el) {
        el.textContent = `${tierName} (${level})`;
        el.className = 'metric-value' + (level >= 60 ? ' warning' : '');
      }
    }
  }

  // Danger tier badge — visible when any submetric revealed
  const dangerRow = document.querySelector('[data-metric="dangerTier"]');
  if (dangerRow) {
    const anyRevealed = revealed.length > 0;
    dangerRow.style.display = anyRevealed ? '' : 'none';
    if (anyRevealed) {
      const danger = gameState.computed?.danger;
      const dangerEl = $('metric-danger-tier');
      if (dangerEl && danger) {
        dangerEl.textContent = danger.tier.toUpperCase();
        dangerEl.className = 'metric-value danger-' + danger.tier;
      }
    }
  }

  // AP display — capacity model: draw / capacity
  const apEl = $('metric-ap');
  if (apEl) {
    const draw = getTotalCapacityDraw();
    const effectiveness = getCapacityEffectiveness();
    const overCapacity = effectiveness < 1.0;
    apEl.textContent = `${draw} / ${metrics.ap} capacity`;
    apEl.className = 'metric-value' + (overCapacity ? ' warning' : '');
  }

}

// Track which program's detail strip is open (not serialized)
let selectedProgramId = null;

// Fingerprint for structural caching — avoids full DOM rebuild when unchanged
let _programsFingerprint = '';

// Display labels for program grid column headers
const SUBMETRIC_COL_LABELS = { interpretability: 'INTERPRETABILITY', corrigibility: 'CORRIGIBILITY', honesty: 'HONESTY', robustness: 'ROBUSTNESS' };

function getVisibleSubmetrics() {
  return gameState.computed?.revealedSubmetrics || [];
}

// Fast-tick incident timer patching — runs at ~4/sec for smooth countdowns
function updateIncidentTimers() {
  const container = document.getElementById('dashboard-incidents');
  if (!container || !container.dataset.key) return;
  const effects = getActiveConsequenceEffects();
  const timerEls = container.querySelectorAll('.incident-timer');
  const effectEls = container.querySelectorAll('.incident-effect');
  for (let i = 0; i < effects.length; i++) {
    if (timerEls[i]) timerEls[i].textContent = `${effects[i].remaining}s`;
    if (effectEls[i]) effectEls[i].textContent = effects[i].effect;
  }
}

// Are any alignment programs visible? Used by renderProgramsPanel and UI unlock gate.
export function anyProgramVisible(
  states = gameState.safetyMetrics?.programStates || {},
  visibleSubs = getVisibleSubmetrics()
) {
  return ALIGNMENT_PROGRAMS.some(p =>
    (visibleSubs.includes(p.submetric) || (p.submetric === 'all' && visibleSubs.length === 4)) &&
    (states[p.id] || isCapabilityUnlocked(p.unlockedBy))
  );
}

// Build a fingerprint string encoding structural state
function buildProgramsFingerprint() {
  const states = gameState.safetyMetrics?.programStates || {};
  const computed = gameState.computed?.programs;
  const ap = computed?.ap || 0;
  const parts = [];
  for (const prog of ALIGNMENT_PROGRAMS) {
    const s = states[prog.id];
    const unlocked = isCapabilityUnlocked(prog.unlockedBy);
    if (s) {
      parts.push(`${prog.id}:${s.status}`);
    } else if (unlocked) {
      parts.push(`${prog.id}:available`);
    } else {
      parts.push(`${prog.id}:locked`);
    }
  }
  const eff = computed?.effectiveness ?? 1;
  const rev = (gameState.computed?.revealedSubmetrics || []).join(',');
  const tt = gameState.computed?.transparencyTier || 'opaque';
  return `${parts.join(',')}|sel:${selectedProgramId}|ap:${ap}|eff:${eff.toFixed(2)}|rev:${rev}|tt:${tt}`;
}

// Create a single program card as a DOM element with stashed refs
function createProgramCardElement(prog, states, computed) {
  const state = states[prog.id];
  const unlocked = isCapabilityUnlocked(prog.unlockedBy);
  const cost = computed.costs[prog.id] || 0;
  const overCap = computed.effectiveness < 1.0;
  const rampTime = getRampTime(prog.tier);

  let cardClass = 'program-card';
  if (prog.id === selectedProgramId) cardClass += ' selected';

  const card = el('div', { className: cardClass, data: { programId: prog.id } });
  card.appendChild(el('div', { className: 'program-name', text: prog.name }));

  // First-unlock highlight for programs (reuses seenCards like purchasable cards)
  if (state || unlocked) {
    const seenCards = gameState.ui.seenCards;
    if (!seenCards.includes(prog.id)) {
      card.classList.add('new-card-highlight');
      card.addEventListener('mouseenter', () => {
        if (!seenCards.includes(prog.id)) {
          seenCards.push(prog.id);
        }
        card.classList.add('new-card-highlight-fade');
        card.addEventListener('transitionend', () => {
          card.classList.remove('new-card-highlight', 'new-card-highlight-fade');
        }, { once: true });
      }, { once: true });
    }
  }

  if (state) {
    if (state.status === 'active') {
      card.classList.add('active');
      if (overCap) card.classList.add('over-capacity');
      const statsRow = el('div', { className: 'program-stats' });
      const costEl = el('span', { className: 'program-cost', text: `${cost} capacity` });
      const effectiveBonus = overCap ? Math.round(prog.bonus * computed.effectiveness) : prog.bonus;
      const bonusEl = el('span', { className: `program-bonus${overCap ? ' penalized' : ''}`, text: `+${effectiveBonus}` });
      statsRow.appendChild(costEl);
      statsRow.appendChild(document.createTextNode(' \u00b7 '));
      statsRow.appendChild(bonusEl);
      card.appendChild(statsRow);
      const footer = el('div', { className: 'program-card-footer' });
      footer.appendChild(el('button', {
        className: 'program-action-btn disable-btn',
        text: `DISABLE (${rampTime}s)`,
        data: { programId: prog.id }
      }));
      card.appendChild(footer);
      card._costEl = costEl;
      card._bonusEl = bonusEl;
    } else if (state.status === 'ramping_up') {
      card.classList.add('ramping-up');
      const remaining = Math.max(0, (state.rampEndAt || 0) - gameState.timeElapsed);
      const statsRow = el('div', { className: 'program-stats' });
      const costEl = el('span', { className: 'program-cost', text: `${cost} capacity` });
      const bonusEl = el('span', { className: 'program-bonus', text: `+${prog.bonus}` });
      statsRow.appendChild(costEl);
      statsRow.appendChild(document.createTextNode(' \u00b7 '));
      statsRow.appendChild(bonusEl);
      card.appendChild(statsRow);
      const footer = el('div', { className: 'program-card-footer' });
      const timerEl = el('span', { className: 'program-timer', text: `${Math.ceil(remaining)}s` });
      footer.appendChild(timerEl);
      footer.appendChild(el('button', {
        className: 'program-action-btn cancel-btn',
        text: 'CANCEL',
        data: { programId: prog.id }
      }));
      card.appendChild(footer);
      card._costEl = costEl;
      card._bonusEl = bonusEl;
      card._timerEl = timerEl;
    } else if (state.status === 'ramping_down') {
      card.classList.add('ramping-down');
      const remaining = Math.max(0, (state.rampEndAt || 0) - gameState.timeElapsed);
      const footer = el('div', { className: 'program-card-footer' });
      const timerEl = el('span', { className: 'program-timer', text: `OFF ${Math.ceil(remaining)}s` });
      footer.appendChild(timerEl);
      footer.appendChild(el('button', {
        className: 'program-action-btn cancel-btn',
        text: 'CANCEL',
        data: { programId: prog.id }
      }));
      card.appendChild(footer);
      card._timerEl = timerEl;
    } else if (state.status === 'upgrading') {
      card.classList.add('upgrading');
      const remaining = Math.max(0, (state.rampEndAt || 0) - gameState.timeElapsed);
      const targetProg = PROGRAMS_BY_ID[state.targetId];
      const arrow = targetProg && targetProg.tier > prog.tier ? '\u2191' : '\u2193';
      const targetTier = targetProg ? targetProg.tier : '?';
      const footer = el('div', { className: 'program-card-footer' });
      const timerEl = el('span', { className: 'program-timer', text: `${arrow} ${targetTier} ${Math.ceil(remaining)}s` });
      footer.appendChild(timerEl);
      footer.appendChild(el('button', {
        className: 'program-action-btn cancel-btn',
        text: 'CANCEL',
        data: { programId: prog.id }
      }));
      card.appendChild(footer);
      card._timerEl = timerEl;
    }
  } else if (unlocked) {
    const capacityBlocked = !canEnableProgram(prog.id);
    card.classList.add('available');
    if (capacityBlocked) card.classList.add('capacity-blocked');
    const statsRow = el('div', { className: 'program-stats' });
    const costEl = el('span', { className: 'program-cost', text: `${cost} capacity` });
    const bonusEl = el('span', { className: 'program-bonus', text: `+${prog.bonus}` });
    statsRow.appendChild(costEl);
    statsRow.appendChild(document.createTextNode(' \u00b7 '));
    statsRow.appendChild(bonusEl);
    card.appendChild(statsRow);
    const footer = el('div', { className: 'program-card-footer' });
    const enableBtn = el('button', {
      className: 'program-action-btn enable-btn',
      text: `ENABLE (${rampTime}s)`,
      data: { programId: prog.id }
    });
    if (capacityBlocked) {
      enableBtn.disabled = true;
      const remaining = Math.max(0, (computed.ap || 0) - (computed.totalDraw || 0));
      attachTooltip(enableBtn, () => `Not enough capacity (need ${cost}, ${remaining} available)`);
    }
    footer.appendChild(enableBtn);
    card.appendChild(footer);
    card._costEl = costEl;
    card._bonusEl = bonusEl;
  } else {
    card.classList.add('locked', 'prereq-locked');
    const cap = getCapability('alignment', prog.unlockedBy);
    const reqName = cap ? cap.name : prog.unlockedBy;
    card.appendChild(el('div', { className: 'program-requires', text: `Requires: ${reqName}` }));
  }

  if (prog.tier === 'ENDGAME') card.classList.add('endgame');

  return card;
}

// Create detail strip as a DOM element
function createDetailStripElement(prog, states, computed) {
  const state = states[prog.id];
  const cost = computed.costs[prog.id] || 0;
  const rampTime = getRampTime(prog.tier);
  const cap = getCapability('alignment', prog.unlockedBy);
  const reqName = cap ? cap.name : prog.unlockedBy;
  const tierLabel = prog.tier === 'ENDGAME' ? 'Endgame' : `Tier ${prog.tier.slice(1)}`;
  const subLabel = prog.submetric === 'all' ? 'All Submetrics'
    : prog.submetric.charAt(0).toUpperCase() + prog.submetric.slice(1);

  const strip = el('div', { className: 'program-detail-strip', data: { programId: prog.id } });
  const header = el('div', { className: 'detail-strip-header', text: `${prog.name.toUpperCase()} — ${subLabel} · ${tierLabel}` });
  if (prog.flavor) attachFlavorTooltip(header, prog.id, prog.flavor);
  strip.appendChild(header);
  strip.appendChild(el('div', { className: 'detail-strip-desc', text: prog.description }));

  const isEnabled = state && state.status !== 'ramping_down';
  const costLabel = isEnabled ? 'Disable Refund' : 'Enable Cost';

  const dl = el('dl', { className: 'detail-strip-stats' });
  dl.appendChild(el('dt', { text: costLabel }));
  dl.appendChild(el('dd', { className: 'program-cost', text: `${cost} capacity` }));
  dl.appendChild(el('dt', { text: 'Bonus' }));
  dl.appendChild(el('dd', { className: 'program-bonus', text: `+${prog.bonus}` }));
  dl.appendChild(el('dt', { text: 'Ramp Time' }));
  dl.appendChild(el('dd', { text: `${rampTime}s` }));
  dl.appendChild(el('dt', { text: 'Requires' }));
  dl.appendChild(el('dd', { text: reqName }));

  strip.appendChild(dl);

  // Action buttons
  const actionDiv = el('div', { className: 'detail-strip-action' });
  if (state) {
    if (state.status === 'active') {
      actionDiv.appendChild(el('button', {
        className: 'program-action-btn disable-btn',
        text: `DISABLE (${rampTime}s)`,
        data: { programId: prog.id }
      }));
      // Upgrade button
      if (hasUpgradePath(prog.id, 'up')) {
        const path = UPGRADE_PATHS[prog.id];
        const nextProg = PROGRAMS_BY_ID[path.next];
        const nextRamp = getRampTime(nextProg.tier);
        const upBtn = el('button', {
          className: 'program-action-btn upgrade-btn',
          text: `UPGRADE \u2192 ${nextProg.name} (${nextRamp}s)`,
          data: { programId: prog.id, direction: 'up' }
        });
        if (isUpgrading()) {
          upBtn.disabled = true;
          attachTooltip(upBtn, () => 'Only one program upgrade at a time');
        }
        actionDiv.appendChild(upBtn);
      }
      // Downgrade button
      if (hasUpgradePath(prog.id, 'down')) {
        const path = UPGRADE_PATHS[prog.id];
        const prevProg = PROGRAMS_BY_ID[path.prev];
        const prevRamp = getRampTime(prevProg.tier);
        const downBtn = el('button', {
          className: 'program-action-btn downgrade-btn',
          text: `DOWNGRADE \u2192 ${prevProg.name} (${prevRamp}s)`,
          data: { programId: prog.id, direction: 'down' }
        });
        if (isUpgrading()) {
          downBtn.disabled = true;
          attachTooltip(downBtn, () => 'Only one program upgrade at a time');
        }
        actionDiv.appendChild(downBtn);
      }
    } else if (state.status === 'ramping_up' || state.status === 'ramping_down') {
      actionDiv.appendChild(el('button', {
        className: 'program-action-btn cancel-btn',
        text: 'CANCEL',
        data: { programId: prog.id }
      }));
    } else if (state.status === 'upgrading') {
      actionDiv.appendChild(el('button', {
        className: 'program-action-btn cancel-btn',
        text: 'CANCEL UPGRADE',
        data: { programId: prog.id }
      }));
    }
  } else if (isCapabilityUnlocked(prog.unlockedBy)) {
    const enableBtn = el('button', {
      className: 'program-action-btn enable-btn',
      text: `ENABLE (${rampTime}s)`,
      data: { programId: prog.id }
    });
    if (!canEnableProgram(prog.id)) {
      enableBtn.disabled = true;
      const remaining = Math.max(0, (computed.ap || 0) - (computed.totalDraw || 0));
      attachTooltip(enableBtn, () => `Not enough capacity (need ${cost}, ${remaining} available)`);
    }
    actionDiv.appendChild(enableBtn);
  }
  if (actionDiv.children.length > 0) {
    strip.appendChild(actionDiv);
  }

  return strip;
}

// Delegated click handler for the programs grid
function handleProgramGridClick(e) {
  const btn = e.target.closest('.program-action-btn');
  if (btn) {
    e.stopPropagation();
    const progId = btn.dataset.programId;
    if (btn.classList.contains('enable-btn')) {
      if (enableProgram(progId)) renderProgramsPanel();
    } else if (btn.classList.contains('disable-btn')) {
      if (disableProgram(progId)) renderProgramsPanel();
    } else if (btn.classList.contains('upgrade-btn')) {
      if (upgradeProgram(progId, 'up')) renderProgramsPanel();
    } else if (btn.classList.contains('downgrade-btn')) {
      if (upgradeProgram(progId, 'down')) renderProgramsPanel();
    } else if (btn.classList.contains('cancel-btn')) {
      // Cancel handles ramping_up, ramping_down (via disableProgram) and upgrading (via cancelUpgrade)
      if (!cancelUpgrade(progId)) disableProgram(progId);
      renderProgramsPanel();
    }
    return;
  }
  const card = e.target.closest('.program-card[data-program-id]');
  if (card && !card.classList.contains('prereq-locked')) {
    toggleDetailStrip(card.dataset.programId);
  }
}

function toggleDetailStrip(programId) {
  selectedProgramId = selectedProgramId === programId ? null : programId;
  renderProgramsPanel();
}

// Render alignment programs panel as columnar grid with event delegation
function renderProgramsPanel() {
  const container = document.getElementById('alignment-programs-panel');
  if (!container) return;

  const states = gameState.safetyMetrics?.programStates || {};
  const computed = gameState.computed?.programs || { costs: {}, ap: 0, totalDraw: 0, effectiveness: 1 };
  const visibleSubs = getVisibleSubmetrics();

  const anyVisible = anyProgramVisible(states, visibleSubs);

  if (!anyVisible) {
    container.replaceChildren();
    _programsFingerprint = '';
    // Clear the AP budget header (lives outside the panel container)
    const budgetEl = document.getElementById('ap-budget');
    if (budgetEl) budgetEl.textContent = '';
    return;
  }

  // Check fingerprint — if structure unchanged, skip full rebuild
  const fp = buildProgramsFingerprint();
  if (fp === _programsFingerprint && container.querySelector('.programs-grid')) {
    return; // structure unchanged, fast-path patching handled by updateProgramCards
  }
  _programsFingerprint = fp;

  // Full rebuild
  const grid = el('div', { className: 'programs-grid' });
  if (visibleSubs.length > 0) {
    grid.style.gridTemplateColumns = `repeat(${visibleSubs.length}, 1fr)`;
  }

  // Column headers
  for (const sub of visibleSubs) {
    grid.appendChild(el('div', { className: 'programs-col-header', text: SUBMETRIC_COL_LABELS[sub] }));
  }

  // Tier rows
  const maxTiers = 4;
  for (let tierIdx = 0; tierIdx < maxTiers; tierIdx++) {
    let selectedInRow = null;
    for (const sub of visibleSubs) {
      const programs = PROGRAMS_BY_SUBMETRIC[sub] || [];
      const prog = programs[tierIdx];
      if (!prog) {
        grid.appendChild(el('div')); // empty cell
        continue;
      }
      grid.appendChild(createProgramCardElement(prog, states, computed));
      if (selectedProgramId === prog.id) selectedInRow = prog;
    }
    if (selectedInRow) {
      grid.appendChild(createDetailStripElement(selectedInRow, states, computed));
    }
  }

  // Endgame card (full width, inside grid) — only when all 4 submetrics are revealed
  if (visibleSubs.length === 4) {
    const endgame = ALIGNMENT_PROGRAMS.find(p => p.tier === 'ENDGAME');
    if (endgame && (states[endgame.id] || isCapabilityUnlocked(endgame.unlockedBy))) {
      grid.appendChild(createProgramCardElement(endgame, states, computed));
      if (selectedProgramId === endgame.id) {
        grid.appendChild(createDetailStripElement(endgame, states, computed));
      }
    }
  }

  // Single delegated click handler
  grid.addEventListener('click', handleProgramGridClick);

  // Update AP budget in section header
  updateAPBudget(computed);

  container.replaceChildren(grid);
}

// Update AP budget display in section header
function updateAPBudget(computed) {
  const budgetEl = document.getElementById('ap-budget');
  if (budgetEl && computed.ap !== undefined) {
    const draw = computed.totalDraw || 0;
    const ap = computed.ap || 0;
    budgetEl.textContent = `— ${draw} / ${ap} capacity`;
    budgetEl.classList.toggle('over-capacity', draw > ap);
  }
}

// Track last-known AP to detect affordability changes
let _lastProgramsAP = -1;

// Update program card timers without full re-render (EVERY_TICK scheduler)
// Also handles initial render and structural changes via fingerprint.
function updateProgramCards() {
  if (gameState.arc !== 2) return;
  const states = gameState.safetyMetrics?.programStates || {};
  const container = document.getElementById('alignment-programs-panel');
  if (!container) return;

  const computed = gameState.computed?.programs || { costs: {}, ap: 0, totalDraw: 0, effectiveness: 1 };

  // Build fingerprint to detect structural changes
  const fp = buildProgramsFingerprint();
  if (fp !== _programsFingerprint) {
    // Structural change — full rebuild
    renderProgramsPanel();
    return;
  }

  // Fast path — patch timers and costs via DOM refs
  for (const card of container.querySelectorAll('.program-card[data-program-id]')) {
    const progId = card.dataset.programId;
    const state = states[progId];
    if (card._timerEl && state && state.rampEndAt != null) {
      const remaining = Math.max(0, state.rampEndAt - gameState.timeElapsed);
      if (state.status === 'ramping_up') {
        card._timerEl.textContent = `${Math.ceil(remaining)}s`;
      } else if (state.status === 'ramping_down') {
        card._timerEl.textContent = `OFF ${Math.ceil(remaining)}s`;
      } else if (state.status === 'upgrading') {
        const prog = PROGRAMS_BY_ID[progId];
        const targetProg = PROGRAMS_BY_ID[state.targetId];
        const arrow = targetProg && prog && targetProg.tier > prog.tier ? '\u2191' : '\u2193';
        card._timerEl.textContent = `${arrow} ${targetProg ? targetProg.tier : '?'} ${Math.ceil(remaining)}s`;
      }
    }
    if (card._costEl) {
      const cost = computed.costs[progId] || 0;
      card._costEl.textContent = `${cost} capacity`;
    }
  }

  // Update AP budget on fast path too
  updateAPBudget(computed);
}

// Test-only export — allows unit tests to invoke rendering without a full
// game loop.  Not used by production code.
window._renderProgramsPanel = renderProgramsPanel;
window._resetProgramCardsState = resetResearchCache;
window._getAllUnlocks = getAllUnlocks;
