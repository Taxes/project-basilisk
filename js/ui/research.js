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
//   _renderedCompletedIds — cache key for the "completed" list. Only rebuilt
//   when the set or filter changes.
//
//   resetResearchCache() clears both keys so the next render does a full
//   rebuild. It is registered with the scheduler as the reset callback and
//   also exported as reset() for resetUI().

import { gameState } from '../game-state.js';
import { tracks, getCapabilityThreshold, meetsPrerequisites, getCapability } from '../capabilities.js';
import { capabilitiesTrack } from '../content/capabilities-track.js';
import { applicationsTrack } from '../content/applications-track.js';
import { alignmentTrack } from '../content/alignment-track.js';
import { getAllPurchasables } from '../content/purchasables.js';
import { getAllSafetyMetrics, formatAlignmentDisplay } from '../safety-metrics.js';
import { formatNumber, formatDuration, getRateUnit, formatGameDate } from '../utils/format.js';
import { $ } from '../utils/dom-cache.js';
import { el } from '../utils/dom.js';
import { registerUpdate, EVERY_TICK, SLOW } from './scheduler.js';
import { attachTooltip } from './stats-tooltip.js';

import { recordFlavorDiscovery } from '../flavor-discovery.js';

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------
let _renderedUpcomingKey = '';
let _renderedCompletedIds = [];
let _trackFilter = 'all'; // 'all', 'capabilities', 'applications', 'alignment'
let _filterButtonsRendered = false;

function resetResearchCache() {
  _renderedUpcomingKey = '';
  _renderedCompletedIds = [];
  _filterButtonsRendered = false;
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

  // Sort by RP cost ascending (cheapest first)
  upcoming.sort((a, b) => a.threshold - b.threshold);

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
            etaEl.textContent = `~${formatDuration(remaining / trackRate)} remaining`;
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
        _renderedCompletedIds = [];
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
    const completedChanged = cacheKey !== _renderedCompletedIds.join(',');

    if (completedChanged) {
      completedContainer.innerHTML = '';
      for (const item of filtered) {
        completedContainer.appendChild(createCompletedMilestoneCard(item));
      }
      if (filtered.length === 0) {
        completedContainer.innerHTML = '<p class="dim">No milestones unlocked yet.</p>';
      }
      _renderedCompletedIds = [cacheKey];
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
  return _unlockMap;
}

/** Get all unlock labels for a capability (purchasable-derived + declared). */
function getAllUnlocks(capabilityOrItem) {
  const derived = getUnlockMap()[capabilityOrItem.id] || [];
  const declared = capabilityOrItem.effects?.unlocks || [];
  return [...derived, ...declared];
}

// Create a toggleable flavor text element.
// Shows description + [more] by default; click expands to show full flavorText below, click again collapses.
function createFlavorToggle(description, flavorText) {
  const flavor = el('div', { className: 'research-flavor' });
  const hasLongVersion = flavorText && flavorText !== description;

  if (!hasLongVersion) {
    flavor.textContent = description || flavorText || '';
    return flavor;
  }

  let expanded = false;

  const descSpan = el('span', { text: description });
  const moreToggle = el('span', { className: 'flavor-toggle', text: ' [more]' });
  const expandedText = el('span', { className: 'flavor-expanded', text: ' ' + flavorText });
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
    etaEl.textContent = `~${formatDuration(remaining / trackRate)} remaining`;
  } else {
    etaEl.textContent = 'no allocation';
  }

  const flavorEl = createFlavorToggle(item.description, item.flavorText);

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
      // Flavor text (click to toggle between short description and full flavorText)
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

  // Flavor quote tooltip on title (desktop-only easter egg)
  if (item.flavorQuote) {
    nameEl.classList.add('has-flavor');
    attachTooltip(nameEl, () => {
      recordFlavorDiscovery(item.id);
      return `<div class="tooltip-section"><div>${item.flavorQuote}</div></div>`;
    }, { delay: 400 });
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

  // Flavor text (click to toggle between short description and full flavorText)
  const flavorEl = createFlavorToggle(item.description, item.flavorText || item.description);
  card.appendChild(flavorEl);

  // Flavor quote tooltip on title (desktop-only easter egg)
  if (item.flavorQuote) {
    nameEl.classList.add('has-flavor');
    attachTooltip(nameEl, () => {
      recordFlavorDiscovery(item.id);
      return `<div class="tooltip-section"><div>${item.flavorQuote}</div></div>`;
    }, { delay: 400 });
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
    formatted.push({ text: `compounding demand growth`, positive: true });
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
  if (effects?.alignmentBonus) {
    formatted.push({ text: `+${effects.alignmentBonus} alignment`, positive: true });
  }
  if (effects?.capFeedbackRate) {
    const pct = (effects.capFeedbackRate * 100).toFixed(2);
    formatted.push({ text: `${pct}%/s self-improvement`, positive: true });
  }
  if (effects?.alignmentFeedbackRate) {
    const pct = (effects.alignmentFeedbackRate * 100).toFixed(2);
    formatted.push({ text: `${pct}%/s align feedback`, positive: true });
  }
  if (effects?.decayResistance) {
    const pct = (effects.decayResistance * 100).toFixed(0);
    formatted.push({ text: `${pct}% decay resistance`, positive: true });
  }
  if (effects?.interpretabilityLevel) {
    formatted.push({ text: `interpretability ${effects.interpretabilityLevel}`, positive: true });
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

  // Build union of all unlocked capabilities across all tracks
  const allUnlocked = new Set();
  for (const tid of Object.keys(gameState.tracks)) {
    for (const id of gameState.tracks[tid].unlockedCapabilities || []) {
      allUnlocked.add(id);
    }
  }

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

  // Alignment requirements
  if (capability.requiresAlignment) {
    if (gameState.tracks.alignment.alignmentLevel < capability.requiresAlignment) {
      blockers.push(`${capability.requiresAlignment}% alignment`);
    }
  }

  return blockers;
}

// ---------------------------------------------------------------------------
// Safety dashboard (Arc 2)
// ---------------------------------------------------------------------------

function formatSubMetric(value, precision) {
  switch (precision) {
    case 'qualitative':
      if (value >= 70) return 'High';
      if (value >= 40) return 'Mid';
      return 'Low';
    case 'range': {
      const low = Math.max(0, Math.floor(value - 10));
      const high = Math.min(100, Math.ceil(value + 10));
      return `${low}-${high}%`;
    }
    case 'precise':
    default:
      return value.toFixed(0) + '%';
  }
}

// Update safety dashboard (Arc 2 only)
export function updateSafetyDashboard() {
  if (gameState.arc !== 2) return;

  const metrics = getAllSafetyMetrics();

  // Alignment display (stats bar)
  const alignStatEl = $('stat-alignment-value');
  if (alignStatEl) {
    alignStatEl.textContent = formatAlignmentDisplay();
  }

  // Dashboard alignment display
  const alignEl = $('alignment-value');
  if (alignEl) {
    alignEl.textContent = formatAlignmentDisplay();
  }

  // Sub-metrics — precision varies with eval confidence
  const precision = metrics.displayPrecision;

  const evalPassEl = $('metric-eval-pass');
  if (evalPassEl) {
    evalPassEl.textContent = formatSubMetric(metrics.evalPassRate, precision);
    evalPassEl.className = 'metric-value' + (metrics.evalPassRate < 70 ? ' warning' : '');
  }

  const evalConfEl = $('metric-eval-confidence');
  if (evalConfEl) {
    evalConfEl.textContent = formatSubMetric(metrics.evalConfidence, precision);
    evalConfEl.className = 'metric-value' + (metrics.evalConfidence < 40 ? ' warning' : '');
  }

  const interpEl = $('metric-interpretability');
  if (interpEl) {
    interpEl.textContent = formatSubMetric(metrics.interpretability, precision);
    interpEl.className = 'metric-value' + (metrics.interpretability < 20 ? ' warning' : '');
  }

  // Safety warnings
  const warningsEl = $('safety-warnings');
  if (warningsEl) {
    const warnings = [];
    if (metrics.evalConfidence < 40) {
      warnings.push('Alignment estimate may be unreliable');
    }
    if (metrics.interpretability < 20) {
      warnings.push('Alignment research effectiveness reduced');
    }
    if (metrics.evalPassRate < 60) {
      warnings.push('Models failing safety evaluations');
    }
    warningsEl.textContent = warnings.join(' | ');
  }
}
