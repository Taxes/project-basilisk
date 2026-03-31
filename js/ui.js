// UI Rendering and Updates

import { gameState, resetGame, saveGame } from './game-state.js';
// tracks — used transitively by domain modules
// getPurchasableById — moved to js/ui/controls.js
import { enqueueFundraise, clearQueue, moveInQueue, cancelFromQueue, resetQueueIdCounter } from './focus-queue.js';
import { resetTriggeredMessages, canUnpause, getMessageById } from './messages.js';
import { hasTutorialFired } from './tutorial-messages.js';
// getEndingById, getEndingStats, triggerEnding, getEndingNarrative — moved to js/ui/modals.js
import { resetForPrestige } from './prestige.js';
// calculatePrestigeGain, applyPrestigeGains — used in js/ui/modals.js
import { BALANCE } from '../data/balance.js';
// (old data-strategy imports removed — data quality system reworked)
// (old strategy panel imports removed — strategic choices now use message system)
// triggerExtinctionSequence — moved to js/ui/modals.js
import { initializeNewsFeed } from './news-feed.js';
// getOutputMultiplier — moved to js/ui/controls.js
import { formatNumber, getRateUnit } from './utils/format.js';
import { requestFullUpdate, consumeFullUpdate } from './ui/signals.js';
import { runScheduledUpdates, forceFullUpdate, resetAllCaches, SLOW } from './ui/scheduler.js';
import { invalidateCache } from './utils/dom-cache.js';
import { isDebugMode, applyDebugSettings, debug as debugCommands } from './debug-commands.js';
// Domain UI modules — each self-registers with the scheduler at module scope.
// Named imports pull in init functions; the import itself triggers registerUpdate().
import { initTokenPricing, initAutopricer, initLedgerTooltips, initPricingTooltips, initLedgerSummary } from './ui/economics.js';
import { initCEOFocusPanel } from './ui/ceo-focus.js';
import { initStatsTooltips } from './ui/stats-tooltip.js';
import { initResearchTooltips } from './ui/research-tooltips.js';
import { anyProgramVisible } from './ui/research.js';
import { initInfraTabs } from './ui/infrastructure.js';
import { initColumnLayout } from './ui/column-layout.js';
import { initAITab } from './ui/ai-tab.js';
import {
  initAllocationSliders,
  initComputeAllocationSlider,
  updateComputeAllocationDisplay,
  signalUserClear,
} from './ui/controls.js';
import {
  initModals,
  checkChangelogNew,
  showSettingsModal,
  hideSettingsModal,
  initSettingsModal,
  wireBackdropDismiss,
  showDebugModal,
  hideDebugModal,
  initDebugModal,
  showArcModeModal,
  hideArcModeModal,
} from './ui/modals.js';

import { isFundraiseGatePassed } from './capabilities.js';
import { renderMessagesPanel } from './ui/messages-panel.js';
import { updateTabBadge } from './ui/tab-navigation.js';
import { isCardVisible } from './ui/cue-cards.js';

// Late-bound callback to avoid main.js <-> ui.js circular import
let _onHardReset = null;
export function setOnHardReset(callback) { _onHardReset = callback; }

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
    if (slider) { slider.value = pct; slider.style.setProperty('--val', `${pct}%`); }
    if (intIn) intIn.value = pct;
    if (extIn) extIn.value = 100 - pct;
    updateComputeAllocationDisplay();
    uiUnlocks.computeAllocation = true;
  }

  const apps = gameState.tracks.applications.unlockedCapabilities;

  // Pricing section + unit economics: visible once first app (chatbot_assistant) is unlocked
  if (apps.length > 0 && !uiUnlocks.priceControls) {
    unlockUISection('pricing-panel');
    const priceControls = document.getElementById('token-pricing-controls');
    const costRow = document.getElementById('cost-per-m-row');
    const marginRow = document.getElementById('margin-per-m-row');
    const mktDemandRow = document.getElementById('market-demand-row');
    const mktPriceRow = document.getElementById('market-price-row');
    const supplyDivider = document.getElementById('supply-divider');
    const unitEconHeader = document.getElementById('unit-econ-header');
    const priceRow = document.getElementById('price-per-m-row');
    const elasticityRow = document.getElementById('elasticity-row');
    const edgeRow = document.getElementById('market-edge-row');
    if (priceControls) priceControls.classList.remove('hidden');
    if (supplyDivider) supplyDivider.classList.remove('hidden');
    if (unitEconHeader) unitEconHeader.classList.remove('hidden');
    if (priceRow) priceRow.classList.remove('hidden');
    if (costRow) costRow.classList.remove('hidden');
    if (marginRow) marginRow.classList.remove('hidden');
    if (mktDemandRow) mktDemandRow.classList.remove('hidden');
    if (mktPriceRow) mktPriceRow.classList.remove('hidden');
    if (elasticityRow) elasticityRow.classList.remove('hidden');
    if (edgeRow) edgeRow.classList.remove('hidden');
    uiUnlocks.priceControls = true;
  }

  // Stage 3: Autopricer (T3 app: process_optimization)
  if (apps.includes('process_optimization') && !uiUnlocks.autopricer) {
    const autopricer = document.getElementById('autopricer-controls');
    if (autopricer) autopricer.classList.remove('hidden');
    uiUnlocks.autopricer = true;
  }

  // Unlock Admin sub-tab after Seed is raised (or 5× seed revenue on private path)
  const adminSubTab = document.getElementById('admin-sub-tab');
  if (adminSubTab && isFundraiseGatePassed('seed')) {
    adminSubTab.classList.remove('hidden');
  }

  // Reveal AI sub-tab after RLHF unlocked (or chen_intro for legacy saves)
  const safetyDashboardReady = gameState.arc >= 2 && (
    gameState.tracks?.alignment?.unlockedCapabilities?.includes('rlhf') ||
    hasTutorialFired('chen_intro')
  );
  const aiSubTab = document.getElementById('ai-sub-tab');
  if (aiSubTab && safetyDashboardReady) {
    aiSubTab.classList.remove('hidden');
  }

  // Alignment programs panel — visible once Chen has arrived AND at least one program is available
  if (safetyDashboardReady && !uiUnlocks.alignmentPrograms && hasTutorialFired('chen_intro') && anyProgramVisible()) {
    unlockUISection('alignment-programs-section');
    uiUnlocks.alignmentPrograms = true;
  }

  // Autonomy decisions panel — visible after first AI request fires
  if (Object.keys(gameState.aiRequestsFired || {}).length > 0 && !uiUnlocks.autonomyDecisions) {
    unlockUISection('autonomy-decisions-section');
    uiUnlocks.autonomyDecisions = true;
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

  // Reset sliders and controls to defaults
  const computeSplit = document.getElementById('compute-allocation-slider');
  if (computeSplit) { computeSplit.value = 100; computeSplit.style.setProperty('--val', '100%'); }
  const intIn = document.getElementById('compute-internal-input');
  const extIn = document.getElementById('compute-external-input');
  if (intIn) intIn.value = 100;
  if (extIn) extIn.value = 0;

  const priceDisplay = document.getElementById('token-price-display');
  if (priceDisplay) priceDisplay.textContent = '$0.50';

  // Reset autopricer controls
  const autopricerToggle = document.getElementById('autopricer-toggle');
  if (autopricerToggle) autopricerToggle.checked = false;
  const autopricerMode = document.getElementById('autopricer-mode');
  if (autopricerMode) autopricerMode.value = 'balanced';

  // Reset research allocation sliders and inputs to defaults (100% capabilities)
  const allocDefaults = { capabilities: 100, applications: 0, alignment: 0 };
  for (const [track, val] of Object.entries(allocDefaults)) {
    const slider = document.getElementById(`${track}-allocation`);
    const numInput = document.getElementById(`${track}-percent-input`);
    if (slider) slider.value = val;
    if (numInput) numInput.value = val;
  }

  // Reset uiUnlocks flags
  Object.keys(uiUnlocks).forEach(k => uiUnlocks[k] = false);

  // Re-hide all sections that unlock during play
  document.querySelectorAll('.unlocked').forEach(el => {
    el.classList.remove('unlocked');
    el.classList.add('hidden-until-unlocked');
  });

  // Re-hide pricing panel sub-elements (use 'hidden' class, not 'hidden-until-unlocked')
  for (const id of ['token-pricing-controls', 'autopricer-controls', 'supply-divider', 'unit-econ-header', 'price-per-m-row', 'cost-per-m-row', 'margin-per-m-row', 'market-demand-row', 'market-price-row', 'market-edge-row', 'elasticity-row']) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  // Re-hide admin sub-tab (unlocked when seed round is raised)
  const adminSubTab = document.getElementById('admin-sub-tab');
  if (adminSubTab) adminSubTab.classList.add('hidden');

  // Re-hide AI sub-tab (unlocked in Arc 2)
  const aiSubTab = document.getElementById('ai-sub-tab');
  if (aiSubTab) aiSubTab.classList.add('hidden');

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
  updatePauseButton();             // EVERY_TICK — cheap, keeps button in sync with all pause sources

  if (fullUpdate || tickCount % SLOW === 0) {
    checkUIUnlocks();
  }
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
    // Hide competitor until Series A is raised (or 5× series_a revenue on private path)
    if (!isFundraiseGatePassed('series_a')) {
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
  // Block manual pause toggle while any tutorial card is showing
  // (the tutorial controls pause/unpause timing for all steps)
  if (isCardVisible()) return;

  // Block unpause while an ending modal is open
  if (gameState.paused && gameState.endingTriggered) return;

  if (gameState.paused) {
    // Block unpause when a decision is required
    if (!canUnpause()) {
      const blockingId = gameState.pauseMessageId || gameState.pauseMessageIds?.[0];
      const blockingMsg = blockingId ? getMessageById(blockingId) : null;
      showDecisionToast(
        blockingMsg ? blockingMsg.subject : 'You have messages requiring your attention.',
        () => import('./ui/tab-navigation.js').then(({ navigateToMessage, switchTab }) => {
          if (blockingMsg) navigateToMessage(blockingMsg.id);
          else switchTab('messages');
        })
      );
      return;
    }
    gameState.paused = false;
    gameState.pauseStartTime = null;
  } else {
    // Pausing - record when we paused
    gameState.paused = true;
    gameState.pauseStartTime = Date.now();
    saveGame();
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
      // Goalpost detail moved to data tooltip
      if (goalEl) goalEl.textContent = '';
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

/**
 * Create a notification element with standard structure and dismiss behavior.
 * @param {object} opts
 * @param {string} opts.title - Bold title line
 * @param {string} opts.message - Body text
 * @param {string} opts.type - Notification type (success, info, warning, milestone)
 * @param {string} [opts.id] - Optional DOM id (for dedup/programmatic access)
 * @param {Function} [opts.onClick] - Click handler (notification body, not close button)
 * @param {Function} [opts.onDismiss] - Fires exactly once when dismissed
 * @returns {{ el: HTMLElement, dismiss: Function } | null}
 */
function createNotification({ title, message, type, id, onClick, onDismiss }) {
  const container = document.getElementById('notification-container');
  if (!container) return null;

  const notification = document.createElement('div');
  if (id) notification.id = id;
  notification.className = `notification notification-${type}`;
  if (onClick) notification.classList.add('clickable');

  const content = document.createElement('div');
  content.className = 'notification-content';
  content.innerHTML = `<strong>${title}</strong><br><span class="notification-message">${message}</span>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'notification-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');

  notification.appendChild(content);
  notification.appendChild(closeBtn);

  // Add to container with fade-in
  notification.classList.add('notification-enter');
  container.appendChild(notification);
  setTimeout(() => notification.classList.remove('notification-enter'), 300);

  // Idempotent dismiss — onDismiss fires exactly once
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    if (onDismiss) onDismiss();
    notification.classList.add('notification-exit');
    setTimeout(() => notification.remove(), 300);
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dismiss();
  });

  if (onClick) {
    notification.addEventListener('click', () => {
      onClick();
      dismiss();
    });
  }

  return { el: notification, dismiss };
}

// Show notification with optional type
// Types: 'success' (default), 'info', 'warning'
// Options: { onClick, duration, onDismiss }
export function notify(title, message, type = 'success', { onClick, duration, onDismiss } = {}) {
  if (gameState._fastForwarding) return;
  let autoDismissTimer;
  const result = createNotification({
    title, message, type, onClick,
    onDismiss: () => { clearTimeout(autoDismissTimer); if (onDismiss) onDismiss(); },
  });
  if (!result) return;
  autoDismissTimer = setTimeout(result.dismiss, duration || BALANCE.NOTIFICATION_DURATION);
}

// === Persistent decision-required toast ===
// Keyed by a fixed DOM id so it can be found and flashed by togglePause.

const DECISION_TOAST_ID = 'decision-required-toast';

/**
 * Show the persistent decision-required toast, or flash it if already visible.
 * @param {string} subject - The blocking message subject line
 * @param {Function} onClickFn - Called (and toast dismissed) when the user clicks it
 */
export function showDecisionToast(subject, onClickFn) {
  if (document.getElementById(DECISION_TOAST_ID)) {
    flashDecisionToast();
    return;
  }

  createNotification({
    title: '\u26A0 Decision Required',
    message: subject,
    type: 'warning',
    id: DECISION_TOAST_ID,
    onClick: onClickFn,
  });
  // No auto-dismiss — persists until dismissed
}

/** Flash the existing decision toast (e.g. when the player tries to unpause). */
export function flashDecisionToast() {
  const el = document.getElementById(DECISION_TOAST_ID);
  if (!el) return;
  el.classList.remove('notification-flash');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('notification-flash');
}

/** Programmatically dismiss the decision toast (e.g. after decision is made). */
export function dismissDecisionToast() {
  const el = document.getElementById(DECISION_TOAST_ID);
  if (!el) return;
  el.classList.add('notification-exit');
  setTimeout(() => el.remove(), 300);
}

// showEventModal, hideEventModal — removed (legacy event system deleted, see #833)

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

  // Arc/mode switch button
  const arcModeSwitchBtn = document.getElementById('arc-mode-switch-button');
  if (arcModeSwitchBtn) {
    arcModeSwitchBtn.addEventListener('click', () => {
      showArcModeModal();
    });
  }

  // Soft reset button (restart run, keep prestige upgrades)
  const softResetBtn = document.getElementById('soft-reset-button');
  if (softResetBtn) {
    softResetBtn.addEventListener('click', () => {
      if (confirm('Restart this run? You keep prestige upgrades and lifetime stats, but all current progress resets.')) {
        resetForPrestige();
        resetQueueIdCounter();
        resetTriggeredMessages();
        initializeNewsFeed();
        resetUI();
        requestFullUpdate();
        updateUI();
        renderMessagesPanel();
        updateTabBadge();
        if (_onHardReset) _onHardReset();
        hideSettingsModal();
      }
    });
  }

  // Hard reset button (in settings modal)
  const hardResetBtn = document.getElementById('hard-reset-button');
  if (hardResetBtn) {
    hardResetBtn.addEventListener('click', () => {
      const msg = isDebugMode()
        ? 'Reset game?'
        : 'HARD RESET: This permanently deletes ALL progress, including lifetime stats, prestige bonuses, and unlocks. There is no undo. Are you sure?';
      if (confirm(msg)) {
        resetGame();
        if (isDebugMode()) debugCommands.resetDebug();
        // applyDebugSettings returns true if ?arc2 triggered a transition.
        // transitionToArc2() saves state but expects a page reload for full
        // re-init (news feed, messages, etc.), so reload instead of in-page reset.
        const arc2Fired = applyDebugSettings();
        if (arc2Fired) {
          window.location.reload();
          return;
        }
        resetQueueIdCounter();
        resetTriggeredMessages();
        resetUI();
        requestFullUpdate();
        updateUI();
        renderMessagesPanel();  // Clear stale message DOM
        updateTabBadge();       // Reset badge to 0
        if (_onHardReset) _onHardReset();  // Adds onboarding messages → callback prepends + updates badge
      }
    });
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
    if (e.code === 'Space' && !e.target.matches('input[type="text"], input[type="number"], input[type="search"], input[type="email"], input[type="password"], input[type="url"], textarea')) {
      e.preventDefault();
      togglePause();
    }
  });

  // Sync --val CSS variable for range input fill (WebKit needs this)
  document.addEventListener('input', (e) => {
    if (e.target.matches('input[type="range"]')) {
      e.target.style.setProperty('--val', `${e.target.value}%`);
    }
  });

  // Prevent scroll wheel from changing slider values
  document.addEventListener('wheel', (e) => {
    if (e.target.matches('input[type="range"]')) {
      e.preventDefault();
    }
  }, { passive: false });

  // Backdrop click to dismiss settings
  wireBackdropDismiss('settings-modal', hideSettingsModal);
  wireBackdropDismiss('arc-mode-modal', hideArcModeModal);

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

  // Compute + data tooltips now initialized in initStatsTooltips()

  // Initialize CEO Focus panel
  initCEOFocusPanel();

  // Initialize ledger summary click handler (left column → Finance sub-tab)
  initLedgerSummary();

  // Initialize infrastructure tabs
  initInfraTabs();

  // Initialize responsive column layout (Operations/Research toggle at narrow viewports)
  initColumnLayout();

  // Initialize AI tab (autonomy decisions)
  initAITab();

  // Clear queue button
  document.getElementById('clear-queue-btn')?.addEventListener('click', () => {
    clearQueue();
    signalUserClear();
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
