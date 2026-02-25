// js/ui/tab-notifications.js
// Central notification engine for infrastructure sub-tab dots.
// Each tab can have one or more notification checks. When any check fires,
// the tab's dot becomes visible and hovering it shows an actionable tooltip.

import { gameState } from '../game-state.js';
import { getAllPurchasables, PERSONNEL_IDS, COMPUTE_IDS } from '../content/purchasables.js';
import { getCount } from '../purchasable-state.js';
import { POOL_IDS } from '../talent-pool.js';
import { BALANCE } from '../../data/balance.js';
import { $ } from '../utils/dom-cache.js';
import { registerUpdate, SLOW } from './scheduler.js';
import { attachTooltip } from './stats-tooltip.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** seenItems as a Set (hydrated from gameState.ui.seenItems array). */
let seenItems = new Set();

/** Active notifications grouped by tab: { finance: [{priority, text}], ... } */
const activeNotifications = {
  finance: [],
  personnel: [],
  compute: [],
  admin: [],
  data: [],
};

/** Consecutive negative-demand-delta check count (for mispricing flicker guard). */
let negativeDemandStreak = 0;
let positiveDemandStreak = 0;

// ---------------------------------------------------------------------------
// Notification checks
// ---------------------------------------------------------------------------

/**
 * Each check returns { tab, priority, text } or null.
 * Lower priority number = shown first in tooltip.
 */
const CHECKS = [
  // -- Finance: fundraise available --
  {
    tab: 'finance',
    priority: 10,
    check() {
      const rounds = gameState.fundraiseRounds;
      if (!rounds) return null;
      for (const [, r] of Object.entries(rounds)) {
        if (r.available && !r.raised) {
          return `${r.name || 'Funding'} round available`;
        }
      }
      return null;
    },
  },

  // -- Finance: demand churn (sustained negative delta) --
  {
    tab: 'finance',
    priority: 20,
    check() {
      const delta = gameState.resources.acquiredDemandDelta || 0;
      if (delta < 0) {
        negativeDemandStreak++;
        positiveDemandStreak = 0;
      } else {
        positiveDemandStreak++;
        negativeDemandStreak = 0;
      }
      // Only fire after 3+ consecutive negative checks (~3s at SLOW)
      if (negativeDemandStreak >= 3) {
        return 'Customers churning \u2014 consider lowering price';
      }
      return null;
    },
  },

  // -- Finance: massive underpricing --
  {
    tab: 'finance',
    priority: 25,
    check() {
      const supply = gameState.resources.tokensPerSecond || 0;
      const demand = gameState.resources.acquiredDemand || 0;
      if (supply > 0 && demand > supply * 2) {
        return 'Demand suggests room to raise prices';
      }
      return null;
    },
  },

  // -- Personnel: new content --
  {
    tab: 'personnel',
    priority: 10,
    check() {
      return checkNewContent('personnel');
    },
  },

  // -- Personnel: talent pool warning --
  {
    tab: 'personnel',
    priority: 20,
    check() {
      if (BALANCE.TALENT_POOL_ENABLED && gameState.talentPools?.warningShown) {
        return 'Hiring will stall soon \u2014 expand talent pool';
      }
      return null;
    },
  },

  // -- Compute: new content --
  {
    tab: 'compute',
    priority: 10,
    check() {
      return checkNewContent('compute');
    },
  },

  // -- Admin: new content --
  {
    tab: 'admin',
    priority: 10,
    check() {
      return checkNewContent('admin');
    },
  },

  // -- Data: new content --
  {
    tab: 'data',
    priority: 10,
    check() {
      return checkNewContent('data');
    },
  },

  // -- Data: low effectiveness --
  {
    tab: 'data',
    priority: 20,
    check() {
      if (!gameState.data?.dataTabRevealed) return null;
      const eff = gameState.data.effectiveness;
      if (eff != null && eff < 0.8) {
        return 'Research slowed \u2014 need more data sources';
      }
      return null;
    },
  },

  // -- Data: low quality --
  {
    tab: 'data',
    priority: 30,
    check() {
      if (!gameState.data?.qualityRevealed) return null;
      const q = gameState.data.quality;
      if (q != null && q < 0.5) {
        return 'Data quality degrading \u2014 check synthetic ratio';
      }
      return null;
    },
  },
];

// ---------------------------------------------------------------------------
// "New content" helper
// ---------------------------------------------------------------------------

/** Returns visible purchasable IDs for a given tab category. */
function getVisibleIdsForTab(category) {
  const allPurchasables = getAllPurchasables();
  return allPurchasables
    .filter(p => {
      const displayCat = p.uiCategory || p.category;
      if (displayCat !== category) return false;
      // Same visibility logic as infrastructure.js rebuildPurchaseList
      if (p.hidden && p.hidden()) return false;
      if (p.requires) {
        if (p.requires.capability) {
          const trackName = p.requires.track || 'capabilities';
          const trackState = gameState.tracks?.[trackName];
          if (!trackState?.unlockedCapabilities?.includes(p.requires.capability)) return false;
        }
        if (p.requires.purchasable) {
          if (getCount(p.requires.purchasable) === 0) return false;
        }
        if (p.requires.fundraise) {
          if (!gameState.fundraiseRounds?.[p.requires.fundraise]?.raised) return false;
        }
      }
      if (p.visibilityGate) {
        if (p.visibilityGate.minPersonnel) {
          const total = PERSONNEL_IDS.reduce((sum, id) => sum + getCount(id), 0);
          if (total < p.visibilityGate.minPersonnel) return false;
        }
        if (p.visibilityGate.minCompute) {
          const total = COMPUTE_IDS.reduce((sum, id) => sum + getCount(id), 0);
          if (total < p.visibilityGate.minCompute) return false;
        }
        if (p.visibilityGate.fundingOrSeriesB) {
          const funded = gameState.fundraiseRounds?.series_b?.raised ||
            gameState.resources.funding > p.visibilityGate.fundingOrSeriesB;
          if (!funded) return false;
        }
        if (p.visibilityGate.minPersonnelOrCompute) {
          const min = p.visibilityGate.minPersonnelOrCompute;
          const totalP = PERSONNEL_IDS.reduce((sum, id) => sum + getCount(id), 0);
          const totalC = COMPUTE_IDS.reduce((sum, id) => sum + getCount(id), 0);
          if (totalP < min && totalC < min) return false;
        }
      }
      return true;
    })
    .map(p => p.id);
}

/** Check if any visible item on this tab hasn't been seen yet. */
function checkNewContent(category) {
  const visible = getVisibleIdsForTab(category);
  for (const id of visible) {
    if (!seenItems.has(id)) return 'New option available';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** DOT elements per tab (cached on init). */
const dots = {};

/** Run all checks, update dot visibility, store active notifications. */
export function updateTabNotifications() {
  // Hydrate seenItems from gameState on every tick (cheap — just a reference check)
  const arr = gameState.ui?.seenItems;
  if (Array.isArray(arr) && !(arr._hydrated)) {
    seenItems = new Set(arr);
    arr._hydrated = true;
  }

  // Get active sub-tab
  const activeCategory = document.querySelector('.sub-tab.active')?.dataset.category || 'finance';

  // Clear previous results
  for (const tab of Object.keys(activeNotifications)) {
    activeNotifications[tab].length = 0;
  }

  // Run all checks
  for (const { tab, priority, check } of CHECKS) {
    const text = check();
    if (text) {
      activeNotifications[tab].push({ priority, text });
    }
  }

  // Sort each tab's notifications by priority
  for (const tab of Object.keys(activeNotifications)) {
    activeNotifications[tab].sort((a, b) => a.priority - b.priority);
  }

  // Update dot visibility (hidden if tab is active or no notifications)
  for (const [tab, notifs] of Object.entries(activeNotifications)) {
    const dot = dots[tab];
    if (!dot) continue;
    const shouldShow = notifs.length > 0;
    dot.classList.toggle('hidden', !shouldShow);
  }
}

/** Get sorted notification list for a tab (used by tooltip builder). */
export function getNotificationsForTab(tab) {
  return activeNotifications[tab] || [];
}

/**
 * Mark all currently visible items on this tab as seen.
 * Called when the player switches to a sub-tab.
 */
export function markTabSeen(category) {
  const visible = getVisibleIdsForTab(category);
  let changed = false;
  for (const id of visible) {
    if (!seenItems.has(id)) {
      seenItems.add(id);
      changed = true;
    }
  }
  if (changed) {
    // Persist back to gameState
    gameState.ui.seenItems = [...seenItems];
    gameState.ui.seenItems._hydrated = true;
  }
}

// ---------------------------------------------------------------------------
// Tooltip builder
// ---------------------------------------------------------------------------

function buildNotifTooltip(tab) {
  const notifs = activeNotifications[tab];
  if (!notifs || notifs.length === 0) return '';
  let html = '<div class="notif-tooltip">';
  for (const { text } of notifs) {
    html += `<div class="notif-item">\u25CF ${text}</div>`;
  }
  html += '</div>';
  return html;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initTabNotifications() {
  // Cache dot elements and attach tooltips to parent buttons
  for (const tab of ['finance', 'personnel', 'compute', 'admin', 'data']) {
    const dot = $(`${tab}-notify`);
    if (dot) {
      dots[tab] = dot;
      const btn = dot.closest('.sub-tab');
      if (btn) {
        attachTooltip(btn, () => buildNotifTooltip(tab), { delay: 100 });
      }
    }
  }

  // Hydrate seenItems from saved state
  const arr = gameState.ui?.seenItems;
  if (Array.isArray(arr)) {
    seenItems = new Set(arr);
  }

  // Mark items on the initially active tab as seen
  const activeCategory = document.querySelector('.sub-tab.active')?.dataset.category || 'finance';
  markTabSeen(activeCategory);
}

// Register with scheduler (SLOW = ~1/sec — notifications don't need per-frame updates)
registerUpdate(updateTabNotifications, SLOW);
