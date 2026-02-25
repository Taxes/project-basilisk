// UI Rendering and Updates

import { gameState, resetGame } from './game-state.js';
import { tracks } from './capabilities.js';
// getPurchasableById — moved to js/ui/controls.js
import { enqueueFundraise, clearQueue, moveInQueue, cancelFromQueue, resetQueueIdCounter } from './focus-queue.js';
import { resetTriggeredMessages } from './messages.js';
// applyChoiceEffects — moved to js/ui/modals.js
// getEndingById, getEndingStats, triggerEnding, getEndingNarrative — moved to js/ui/modals.js
// calculatePrestigeGain, applyPrestigeGains, resetForPrestige — moved to js/ui/modals.js
import { BALANCE } from '../data/balance.js';
// (old data-strategy imports removed — data quality system reworked)
// (old strategy panel imports removed — strategic choices now use message system)
// triggerExtinctionSequence — moved to js/ui/modals.js
import { initializeNewsFeed } from './news-feed.js';
// getOutputMultiplier — moved to js/ui/controls.js
import { formatNumber, getRateUnit } from './utils/format.js';
import { requestFullUpdate, consumeFullUpdate } from './ui/signals.js';
import { runScheduledUpdates, forceFullUpdate, resetAllCaches, FAST, SLOW } from './ui/scheduler.js';
import { invalidateCache } from './utils/dom-cache.js';
import { applyDebugSettings, isDebugMode } from './debug-commands.js';
// Domain UI modules — each self-registers with the scheduler at module scope.
// Named imports pull in init functions; the import itself triggers registerUpdate().
import { initTokenPricing, initAutopricer, initLedgerTooltips, initPricingTooltips, initLedgerSummary } from './ui/economics.js';
import { initCEOFocusPanel } from './ui/ceo-focus.js';
import { initStatsTooltips, attachTooltip } from './ui/stats-tooltip.js';
import { initResearchTooltips } from './ui/research-tooltips.js';
import './ui/research.js';  // no named exports needed; side-effect registration only
import { initInfraTabs } from './ui/infrastructure.js';
import {
  initAllocationSliders,
  initComputeAllocationSlider,
  updateComputeAllocationDisplay,
} from './ui/controls.js';
import {
  initModals,
  showStatsModal,
  hideStatsModal,
  checkChangelogNew,
  showSettingsModal,
  hideSettingsModal,
  initSettingsModal,
  wireBackdropDismiss,
  showDebugModal,
  hideDebugModal,
  initDebugModal,
} from './ui/modals.js';

// Track what UI elements have been unlocked
const uiUnlocks = {
  computeAllocation: false,
  researchAllocation: false,
  alignmentTrack: false,
  priceControls: false,
  autopricer: false,
};

// Unlock a UI section
export function unlockUISection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.remove('hidden-until-unlocked');
    section.classList.add('unlocked');
  }
}

// Check for UI unlocks based on game state
export function checkUIUnlocks() {
  // Unlock research allocation sliders after basic_transformer is unlocked
  if (gameState.tracks.capabilities.unlockedCapabilities.includes('basic_transformer') && !uiUnlocks.researchAllocation) {
    unlockUISection('research-allocation-section');
    uiUnlocks.researchAllocation = true;
  }

  // Unlock compute allocation after first application unlock
  if (gameState.tracks.applications.unlockedCapabilities.length > 0 && !uiUnlocks.computeAllocation) {
    unlockUISection('compute-allocation-section');
    // Re-sync slider/inputs with actual game state (HTML defaults may differ)
    const pct = Math.round(gameState.resources.computeAllocation * 100);
    const slider = document.getElementById('compute-allocation-slider');
    const intIn = document.getElementById('compute-internal-input');
    const extIn = document.getElementById('compute-external-input');
    if (slider) slider.value = pct;
    if (intIn) intIn.value = pct;
    if (extIn) extIn.value = 100 - pct;
    updateComputeAllocationDisplay();
    uiUnlocks.computeAllocation = true;
  }

  const apps = gameState.tracks.applications.unlockedCapabilities;

  // Pricing section: visible once first app (chatbot_assistant) is unlocked
  if (apps.length > 0) {
    unlockUISection('pricing-panel');
  }

  // Stage 1: Price controls + cost/margin + market demand/price + elasticity (T1 app: image_generation)
  // Elasticity shown alongside price controls so players understand demand response to price changes
  if (apps.includes('image_generation') && !uiUnlocks.priceControls) {
    const priceControls = document.getElementById('token-pricing-controls');
    const costRow = document.getElementById('cost-per-m-row');
    const marginRow = document.getElementById('margin-per-m-row');
    const mktDemandRow = document.getElementById('market-demand-row');
    const mktPriceRow = document.getElementById('market-price-row');
    const supplyDivider = document.getElementById('supply-divider');
    const unitEconHeader = document.getElementById('unit-econ-header');
    const priceRow = document.getElementById('price-per-m-row');
    const elasticityRow = document.getElementById('elasticity-row');
    if (priceControls) priceControls.classList.remove('hidden');
    if (supplyDivider) supplyDivider.classList.remove('hidden');
    if (unitEconHeader) unitEconHeader.classList.remove('hidden');
    if (priceRow) priceRow.classList.remove('hidden');
    if (costRow) costRow.classList.remove('hidden');
    if (marginRow) marginRow.classList.remove('hidden');
    if (mktDemandRow) mktDemandRow.classList.remove('hidden');
    if (mktPriceRow) mktPriceRow.classList.remove('hidden');
    if (elasticityRow) elasticityRow.classList.remove('hidden');
    uiUnlocks.priceControls = true;
  }

  // Stage 3: Autopricer + edge (T3 app: process_optimization)
  if (apps.includes('process_optimization') && !uiUnlocks.autopricer) {
    const autopricer = document.getElementById('autopricer-controls');
    const edgeRow = document.getElementById('market-edge-row');
    if (autopricer) autopricer.classList.remove('hidden');
    if (edgeRow) edgeRow.classList.remove('hidden');
    uiUnlocks.autopricer = true;
  }

  // Unlock Admin sub-tab after Seed is raised
  const adminSubTab = document.getElementById('admin-sub-tab');
  if (adminSubTab && gameState.fundraiseRounds?.seed?.raised) {
    adminSubTab.classList.remove('hidden');
  }

  // Set arc data attribute on body for CSS targeting
  document.body.setAttribute('data-arc', gameState.arc || 1);
}

let tickCount = 0;

// Reset all UI state on game reset
export function resetUI() {
  // Reset cached competitor label
  _cachedCompetitorLabel = '';
  _lastCompetitorLabelTime = -30;

  // Reset news feed module state (clears triggeredNews, firedMilestones, etc.)
  initializeNewsFeed();

  // Reset sliders to defaults
  const computeSplit = document.getElementById('compute-allocation-slider');
  if (computeSplit) computeSplit.value = 100;

  const priceDisplay = document.getElementById('token-price-display');
  if (priceDisplay) priceDisplay.textContent = '$0.50';

  // Reset allocation sliders
  ['cap-slider', 'app-slider', 'ali-slider'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = 33;
  });

  // Reset uiUnlocks flags
  Object.keys(uiUnlocks).forEach(k => uiUnlocks[k] = false);

  // Re-hide sections that unlock during play
  document.querySelectorAll('.unlocked').forEach(el => {
    el.classList.remove('unlocked');
    el.classList.add('hidden-until-unlocked');
  });

  // Re-hide pricing panel section (uses hidden-until-unlocked, gated on first app)
  const pricingPanel = document.getElementById('pricing-panel');
  if (pricingPanel) {
    pricingPanel.classList.remove('unlocked');
    pricingPanel.classList.add('hidden-until-unlocked');
  }

  // Reset pricing panel progressive disclosure (uses 'hidden' class, not 'hidden-until-unlocked')
  for (const id of ['token-pricing-controls', 'autopricer-controls', 'supply-divider', 'unit-econ-header', 'price-per-m-row', 'cost-per-m-row', 'margin-per-m-row', 'market-demand-row', 'market-price-row', 'market-edge-row', 'elasticity-row']) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  // Re-hide admin sub-tab (unlocked when seed round is raised)
  const adminSubTab = document.getElementById('admin-sub-tab');
  if (adminSubTab) adminSubTab.classList.add('hidden');

  // Hide open modals
  document.querySelectorAll('.modal').forEach(el => el.classList.add('hidden'));

  // Clear completed research list
  const completedList = document.getElementById('completed-list');
  if (completedList) completedList.innerHTML = '';

  // Clear queue display
  const queueItems = document.getElementById('queue-items');
  if (queueItems) queueItems.innerHTML = '';

  // Reset incremental DOM caches (scheduler-registered + dom-cache)
  resetAllCaches();
  invalidateCache();
}

// Update all UI elements
export function updateUI() {
  if (gameState._fastForwarding) return;
  if (gameState._backgroundMode) return;

  tickCount++;

  const fullUpdate = consumeFullUpdate();

  // Scheduled domain updates (tiered by frequency)
  if (fullUpdate) {
    forceFullUpdate();           // run ALL registered updates regardless of tier
  } else {
    runScheduledUpdates(tickCount);
  }

  // Orchestrator-owned updates (stay in ui.js)
  updateResourceDisplays();   // EVERY_TICK — core dopamine
  updateAGIProgress();         // EVERY_TICK — cheap

  updatePlaytime();                // EVERY_TICK — cheap, avoids visible jitter on displayed seconds

  if (fullUpdate || tickCount % SLOW === 0) {
    checkUIUnlocks();
  }

  updateNotifications();
}

// AGI progress labels — tone shifts from corporate to ominous
const AGI_LABELS = [
  [100, 'Achieved'],
  [95, 'Imminent'],
  [90, 'Recursive acceleration'],
  [80, 'Self-directed research'],
  [65, 'Beyond human benchmarks'],
  [49, 'Emergent behavior'],
  [36, 'Scaling up'],
  [21, 'Gaining traction'],
  [8,  'Foundational work'],
  [0,  'Early experiments'],
];

function getAGILabel(progress) {
  for (const [threshold, label] of AGI_LABELS) {
    if (progress >= threshold) return label;
  }
  return AGI_LABELS[AGI_LABELS.length - 1][1];
}

// Competitor relative labels
function getCompetitorLabel(playerProgress, competitorProgress) {
  const gap = competitorProgress - playerProgress;
  if (gap <= -6) return 'distant';
  if (gap <= -3) return 'trailing';
  if (gap <= 3)  return 'matched';
  if (gap <= 6)  return 'leading';
  return 'dominant';
}

// Cached competitor label — only updates every 30 game-seconds
let _cachedCompetitorLabel = '';
let _lastCompetitorLabelTime = -30;

// Update AGI progress display
function updateAGIProgress() {
  const agiProgressText = document.getElementById('agi-progress-text');
  if (!agiProgressText) return;

  const progress = gameState.agiProgress || 0;
  agiProgressText.textContent = getAGILabel(progress);

  const competitorEl = document.getElementById('competitor-progress');
  if (competitorEl) {
    // Hide competitor until Series A is raised
    const seriesARaised = gameState.fundraiseRounds?.series_a?.raised === true;
    if (!seriesARaised) {
      competitorEl.style.display = 'none';
    } else {
      competitorEl.style.display = '';
      const cp = gameState.competitor?.progressToAGI || 0;
      // Only recalculate label every 30 game-seconds
      const now = gameState.timeElapsed || 0;
      if (now - _lastCompetitorLabelTime >= 30 || !_cachedCompetitorLabel) {
        _cachedCompetitorLabel = getCompetitorLabel(progress, cp);
        _lastCompetitorLabelTime = now;
      }
      competitorEl.textContent = `(rival: ${_cachedCompetitorLabel})`;
    }
  }
}


// Update playtime and date display
function updatePlaytime() {
  const playtimeEl = document.getElementById('playtime');
  const gameDateEl = document.getElementById('game-date');
  const pauseIndicator = document.getElementById('pause-indicator');

  // Update pause indicator visibility
  if (pauseIndicator) {
    pauseIndicator.classList.toggle('hidden', !gameState.paused);
  }

  // Update in-game date (1 second = 1 day)
  if (gameDateEl) {
    const totalDays = Math.floor(gameState.timeElapsed);
    const year = Math.floor(totalDays / 365);
    const day = (totalDays % 365) + 1; // Day 1-365
    gameDateEl.textContent = `Year ${year}, Day ${day}`;
  }

  // Update real playtime
  if (playtimeEl) {
    const seconds = Math.floor(gameState.timeElapsed);
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      playtimeEl.textContent = `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      playtimeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }
}

// Toggle pause state
export function togglePause() {
  if (gameState.paused) {
    gameState.paused = false;
    gameState.pauseStartTime = null;
  } else {
    // Pausing - record when we paused
    gameState.paused = true;
    gameState.pauseStartTime = Date.now();
  }
  updatePauseButton();
  updatePlaytime();
}

// Update pause button text
function updatePauseButton() {
  const pauseBtn = document.getElementById('pause-button');
  if (pauseBtn) {
    pauseBtn.textContent = gameState.paused ? '▶ Play' : '⏸ Pause';
  }
}

// showStatsModal, hideStatsModal — moved to js/ui/modals.js

// Update resource displays
export function updateResourceDisplays() {
  const state = gameState;

  // Research total + rate
  const researchTotal = document.getElementById('research-total');
  if (researchTotal) researchTotal.textContent = formatNumber(state.resources.research);
  const researchRate = document.getElementById('research-rate');
  if (researchRate) researchRate.textContent = '(+' + formatNumber(state.resources.researchRate) + getRateUnit() + ')';

  // Compute — show total (tooltip via custom system, initialized in initializeUI)
  const computeTotal = document.getElementById('compute-total');
  if (computeTotal) {
    computeTotal.textContent = formatNumber(state.resources.compute);
  }

  // Data effectiveness display (progressive disclosure)
  const dataGroup = document.getElementById('data-effectiveness-group');
  if (dataGroup) {
    if (state.data && state.data.dataTabRevealed) {
      dataGroup.style.display = '';
      const effEl = document.getElementById('data-effectiveness');
      const goalEl = document.getElementById('data-goalpost');
      const eff = state.data.effectiveness;
      if (effEl) {
        effEl.textContent = eff.toFixed(2) + 'x';
        effEl.className = 'stat-value ' + (eff >= 1.0 ? 'positive' : eff >= 0.7 ? 'warning' : 'negative');
      }
      if (goalEl) {
        const score = state.data.dataScore;
        const required = state.data.dataRequired;
        const tierName = state.data.nextTierName;
        const effectiveness = state.data.effectiveness || 0;
      if (effectiveness >= 1.0) {
          goalEl.textContent = `[${Math.floor(score)} — exceeds requirements (${effectiveness.toFixed(2)}x)]`;
        } else if (tierName) {
          goalEl.textContent = `[${Math.floor(score)} / ${Math.floor(required)} for ${tierName}]`;
        } else {
          goalEl.textContent = '';
        }
      }
    } else {
      dataGroup.style.display = 'none';
    }
    // Also reveal the Data sub-tab button in Infrastructure
    const dataSubTab = document.getElementById('data-sub-tab');
    if (dataSubTab) {
      dataSubTab.classList.toggle('hidden', !(state.data && state.data.dataTabRevealed));
    }
  }

  // Funding display — now runs via scheduler (EVERY_TICK in economics.js)
  // Research rate breakdown — now runs via scheduler (EVERY_TICK in research.js)
}

// Re-export formatNumber so existing callers (if any) don't break
export { formatNumber };

// updateCapabilityTree — moved to js/ui/research.js
// updateResearchBreakdown — moved to js/ui/research.js

// _renderedQueueIds, _renderedQueueActiveCount, _renderedQueuePaused — moved to js/ui/controls.js
// _renderedPurchaseFingerprint — moved to js/ui/infrastructure.js

// updateResearchList, createMilestoneCard, createCompletedMilestoneCard,
// formatResearchEffects, createTrackMilestoneCard, getNextMilestone,
// getMilestoneBlockers, getUpcomingMilestones, getCompletedResearch
// — all moved to js/ui/research.js

// updatePurchaseButtons, createPurchaseCard — moved to js/ui/infrastructure.js

// Show notification with optional type
// Types: 'success' (default), 'info', 'warning'
export function notify(title, message, type = 'success') {
  if (gameState._fastForwarding) return;
  const container = document.getElementById('notification-container');
  if (!container) return;

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;

  // Create notification content
  const content = document.createElement('div');
  content.className = 'notification-content';
  content.innerHTML = `<strong>${title}</strong><br><span class="notification-message">${message}</span>`;

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'notification-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');

  notification.appendChild(content);
  notification.appendChild(closeBtn);

  // Add to container with fade-in
  notification.classList.add('notification-enter');
  container.appendChild(notification);

  // Remove enter class after animation
  setTimeout(() => {
    notification.classList.remove('notification-enter');
  }, 300);

  // Function to dismiss notification
  const dismissNotification = () => {
    notification.classList.add('notification-exit');
    setTimeout(() => {
      notification.remove();
    }, 300);
  };

  // Close button handler
  closeBtn.addEventListener('click', dismissNotification);

  // Auto-dismiss after duration
  const autoDismissTimer = setTimeout(dismissNotification, BALANCE.NOTIFICATION_DURATION);

  // Cancel auto-dismiss if manually closed
  closeBtn.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
  });
}

// Update notifications (for queue management if needed)
export function updateNotifications() {
  // Currently notifications are shown immediately
  // This function is reserved for future queue management
}

// showEventModal, hideEventModal — moved to js/ui/modals.js

// Initialize track tabs for capability tree
function initTrackTabs() {
  const trackTabs = document.querySelectorAll('.track-tabs .tab-link');
  trackTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const trackName = tab.getAttribute('data-track');
      switchTrack(trackName);
    });
  });
}

// Switch between research tracks
function switchTrack(trackName) {
  // Update tab active state
  const trackTabs = document.querySelectorAll('.track-tabs .tab-link');
  trackTabs.forEach(tab => {
    if (tab.getAttribute('data-track') === trackName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Store current track
  gameState.ui.currentTrack = trackName;

  // Update capability tree for this track
  requestFullUpdate();
  updateUI();
}

// Initialize UI event listeners
export function initializeUI() {
  // Wire modal callbacks (avoids circular import: modals.js -> ui.js)
  initModals(updateUI, resetUI);

  // Track tabs switching (legacy)
  initTrackTabs();

  // Milestone tabs (Upcoming / Completed)
  const milestoneTabs = document.querySelector('.milestone-tabs');
  if (milestoneTabs) {
    milestoneTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-milestone-tab]');
      if (!btn) return;
      const tab = btn.dataset.milestoneTab;
      milestoneTabs.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const researchList = document.getElementById('research-list');
      const completedList = document.getElementById('completed-list');
      if (tab === 'upcoming') {
        researchList.classList.remove('hidden');
        completedList.classList.add('hidden');
      } else {
        researchList.classList.add('hidden');
        completedList.classList.remove('hidden');
      }
    });
  }

  // Reset button (dev tool)
  const resetButton = document.getElementById('reset-button');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset the game? This will delete all progress.')) {
        resetGame();
        applyDebugSettings();
        resetQueueIdCounter();
        resetTriggeredMessages();
        resetUI();
        requestFullUpdate();
        updateUI();
      }
    });
  }

  // Stats button
  const statsButton = document.getElementById('stats-button');
  if (statsButton) {
    statsButton.addEventListener('click', showStatsModal);
  }

  // Settings button
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) {
    settingsButton.addEventListener('click', showSettingsModal);
  }

  // Settings modal close button
  const settingsClose = document.getElementById('settings-close');
  if (settingsClose) {
    settingsClose.addEventListener('click', hideSettingsModal);
  }

  // Initialize settings modal
  initSettingsModal();

  // Debug UI — only initialize if debug mode is active
  if (isDebugMode()) {
    const debugButton = document.getElementById('debug-button');
    if (debugButton) {
      debugButton.addEventListener('click', showDebugModal);
    }

    const debugClose = document.getElementById('debug-close');
    if (debugClose) {
      debugClose.addEventListener('click', hideDebugModal);
    }

    initDebugModal();
  }

  // Check if changelog has new entries the player hasn't seen
  checkChangelogNew();

  // Backdrop dismiss for debug modal
  if (isDebugMode()) {
    wireBackdropDismiss('debug-modal', hideDebugModal);
  }

  // Pause button
  const pauseButton = document.getElementById('pause-button');
  if (pauseButton) {
    pauseButton.addEventListener('click', togglePause);
  }

  // Reflect restored pause state in button text (e.g. after loading a paused save)
  updatePauseButton();

  // Spacebar to toggle pause (only when not typing in an input)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.matches('input, textarea, select')) {
      e.preventDefault();
      togglePause();
    }
  });

  // Prevent scroll wheel from changing slider values
  document.addEventListener('wheel', (e) => {
    if (e.target.matches('input[type="range"]')) {
      e.preventDefault();
    }
  }, { passive: false });

  // Stats modal close button
  const statsClose = document.getElementById('stats-close');
  if (statsClose) {
    statsClose.addEventListener('click', hideStatsModal);
  }

  // Backdrop click to dismiss (stats, settings)
  wireBackdropDismiss('stats-modal', hideStatsModal);
  wireBackdropDismiss('settings-modal', hideSettingsModal);

  // Initialize allocation sliders
  initAllocationSliders();

  // Initialize compute allocation slider
  initComputeAllocationSlider();

  // Initialize token pricing
  initTokenPricing();

  // Initialize autopricer controls
  initAutopricer();

  // Initialize stats bar tooltips
  initStatsTooltips();

  // Initialize research rate tooltips (global + per-track)
  initResearchTooltips();

  // Initialize ledger row tooltips (custom styled, replaces browser title attributes)
  initLedgerTooltips();

  // Initialize pricing panel tooltips (demand, edge, elasticity)
  initPricingTooltips();

  // Initialize compute breakdown tooltip (stats bar)
  attachTooltip(document.getElementById('compute-total'), () => {
    const mult = gameState.computeMultiplier || 1;
    if (mult > 1.01 && gameState.baseCompute > 0) {
      return `<div class="tooltip-row"><span>${formatNumber(gameState.baseCompute)} base × ${mult.toFixed(1)}x</span></div>`;
    }
    return '';
  });

  // Initialize CEO Focus panel
  initCEOFocusPanel();

  // Initialize ledger summary click handler (left column → Finance sub-tab)
  initLedgerSummary();

  // Initialize infrastructure tabs
  initInfraTabs();

  // Clear queue button
  document.getElementById('clear-queue-btn')?.addEventListener('click', () => {
    clearQueue();
    requestFullUpdate();
  });

  // Fundraise button delegation (one-time — buttons persist across ticks)
  document.getElementById('fundraise-rounds')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-round]');
    if (!btn) return;
    enqueueFundraise(btn.dataset.round);
    requestFullUpdate();
  });

  document.getElementById('fundraise-rounds')?.addEventListener('contextmenu', (e) => {
    const btn = e.target.closest('button[data-round]');
    if (!btn) return;
    e.preventDefault();
    enqueueFundraise(btn.dataset.round, true);
    requestFullUpdate();
  });

  // Queue item control delegation (one-time — buttons persist across ticks)
  document.getElementById('queue-items')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const queueId = parseInt(btn.dataset.queueId);
    const index = gameState.focusQueue.findIndex(item => item.id === queueId);
    if (index === -1) return;
    if (action === 'up') moveInQueue(index, -1);
    else if (action === 'down') moveInQueue(index, 1);
    else if (action === 'remove') {
      let qty = 1;
      if (e.ctrlKey && e.shiftKey) qty = 50;
      else if (e.shiftKey) qty = 10;
      else if (e.ctrlKey) qty = 5;
      cancelFromQueue(index, qty);
    }
    requestFullUpdate();
  });
}

// showEndingModal, showPrestigeModal, resetEndingModalButtons, hideEndingModal — moved to js/ui/modals.js

// initAllocationSliders, updateAllocation, updateAllocationDisplay,
// initComputeAllocationSlider, updateComputeAllocationDisplay,
// (old data-strategy slider functions removed — data quality system reworked)

// formatSubMetric, updateSafetyDashboard — moved to js/ui/research.js

// initInfraTabs, checkUpgradesTabVisibility, updateUpgradesList,
// createUpgradeCard, createUpgradeTrackElement — moved to js/ui/infrastructure.js

// updateQueueDisplay, formatQueueItemText — moved to js/ui/controls.js
// renderStrategyPanel, createChoiceCard, createChoiceOptionElement, formatUnlockCondition,
// updateStrategyButton — removed: strategic choices now use message system

// Window exports moved to js/test-api.js
