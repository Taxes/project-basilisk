// Modal UI — stats, changelog, events, endings, prestige

import { gameState, resetGame, saveGame, prepareSaveData, SAVE_KEY } from '../game-state.js';
import { getTotalFlavorCount } from '../flavor-discovery.js';
import LZString from '../../vendor/lz-string.min.js';
import { tracks, isCapabilityUnlocked } from '../capabilities.js';
import { getEndingById, getEndingStats, triggerEnding, getEndingNarrative, getPersonalityEpilogue, buildEndingAnalytics } from '../endings.js';
import { milestone } from '../analytics.js';
import { calculatePrestigeGain, applyPrestigeGains, resetForPrestige, resetForArcSwitch } from '../prestige.js';
import { resetQueueIdCounter } from '../focus-queue.js';
import { resetTriggeredMessages, hasMessageBeenTriggered } from '../messages.js';
import { triggerExtinctionSequence } from '../extinction-sequence.js';
import { showEndingCinematic } from '../ending-sequence.js';
import { checkPhaseCompletion } from '../phase-completion.js';
import { formatNumber, formatFunding, formatPercent, formatTime, getRateUnit } from '../utils/format.js';
import { changelog } from '../changelog.js';
import { VERSION, DISPLAY_VERSION } from '../version.js';
import { attachTooltip } from './stats-tooltip.js';
import { $ } from '../utils/dom-cache.js';
import { restartTutorial, skipTutorial, disableHints, MAIN_SEQUENCE_END } from '../tutorial-state.js';
import { renderAchievementsTab } from './achievements-tab.js';
import { requestFullUpdate } from './signals.js';
import { applyDebugSettings } from '../debug-commands.js';
import { getDebugMessageStatus } from '../tutorial-messages.js';
import {
  onboardingMessage, strategicChoiceMessages,
  researchMilestoneMessages, fundingMessages,
  boardMessages, creditWarningMessage, creditWarningPreAdaMessage,
  alignmentTaxActionMessage, kenJobApplicationMessage,
} from '../content/message-content.js';
import { farewellEntries } from '../content/farewell-content.js';
import { AI_REQUESTS } from '../content/ai-requests.js';

// Lazy back-reference to top-level updateUI / resetUI.
// Imported at call-time to avoid circular-import issues
// (ui.js imports from modals.js; modals.js must not import from ui.js at module-eval time).
let _updateUI = null;
let _resetUI = null;

function getUpdateUI() {
  if (!_updateUI) {
    // Dynamic import fallback — should be patched by initModals() before first use
    throw new Error('modals: updateUI not wired — call initModals() first');
  }
  return _updateUI;
}

function getResetUI() {
  if (!_resetUI) {
    throw new Error('modals: resetUI not wired — call initModals() first');
  }
  return _resetUI;
}

/**
 * Wire late-bound references that would create circular imports if done
 * at module-evaluation time.  Called once from initializeUI().
 */
export function initModals(updateUI, resetUI) {
  _updateUI = updateUI;
  _resetUI = resetUI;
}

// ---------------------------------------------------------------------------
// Stats (rendered inside settings modal Stats tab)
// ---------------------------------------------------------------------------

function getFlavorStats() {
  const discovered = gameState.ui?.discoveredFlavor || [];
  return { discovered: discovered.length, total: getTotalFlavorCount() };
}

function getFlavorTier(discovered, total) {
  if (total === 0) return '';
  if (discovered > total) return 'Guy Fieri';
  const pct = discovered / total;
  if (pct >= 1) return 'Guy Fieri';
  if (pct >= 0.75) return 'Unlocking 100% of your tongue';
  if (pct >= 0.5) return 'Sommelier';
  if (pct >= 0.25) return 'Spice trade';
  return 'Br*tish food';
}

function renderStatsContent() {
  const statsGrid = $('stats-grid');
  if (!statsGrid) return;

  const lt = gameState.lifetime || {};
  const at = gameState.lifetimeAllTime || {};

  // Build stats HTML — lifetime stats, not duplicative of main UI
  let html = `
    <div class="stats-section">
      <div class="stats-section-header">THIS RUN</div>
      <div class="stats-item">
        <span class="stats-item-label">Playtime</span>
        <span class="stats-item-value">${formatTime(gameState.timeElapsed)}</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-label">Total Funding Earned</span>
        <span class="stats-item-value">${formatFunding(lt.totalFundingEarned || 0)}</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-label">Total Research Earned</span>
        <span class="stats-item-value">${formatNumber(lt.totalResearchEarned || 0)}</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-label">Peak Income</span>
        <span class="stats-item-value">${formatFunding(lt.peakFundingRate || 0)}${getRateUnit()}</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-label">Peak Research Rate</span>
        <span class="stats-item-value">${formatNumber(lt.peakResearchRate || 0)}${getRateUnit()}</span>
      </div>`;

  if ((lt.dataCollapses || 0) > 0) {
    html += `
      <div class="stats-item">
        <span class="stats-item-label">Data Collapses</span>
        <span class="stats-item-value">${lt.dataCollapses}</span>
      </div>`;
  }

  if (gameState.prestigeCount > 0) {
    html += `
      <div class="stats-item">
        <span class="stats-item-label">Prestige Resets</span>
        <span class="stats-item-value">${gameState.prestigeCount}</span>
      </div>`;
  }

  // Prestige bonuses — only in arcade mode when at least one is active
  if (gameState.gameMode !== 'narrative') {
    const ups = gameState.arc1Upgrades || {};
    const research = ups.researchMultiplier ?? 1;
    const funding = ups.startingFunding ?? 1;
    const revenue = ups.revenueMultiplier ?? 1;
    if (research > 1 || funding > 1 || revenue > 1) {
      html += `
      <div class="stats-section-header">PRESTIGE BONUSES</div>`;
      if (research > 1) html += `
      <div class="stats-item">
        <span class="stats-item-label">Research Speed</span>
        <span class="stats-item-value">×${research.toFixed(2)}</span>
      </div>`;
      if (funding > 1) html += `
      <div class="stats-item">
        <span class="stats-item-label">Starting Funding</span>
        <span class="stats-item-value">×${funding.toFixed(2)}</span>
      </div>`;
      if (revenue > 1) html += `
      <div class="stats-item">
        <span class="stats-item-label">Token Revenue</span>
        <span class="stats-item-value">×${revenue.toFixed(2)}</span>
      </div>`;
    }
  }

  html += `</div>`;

  const { discovered, total } = getFlavorStats();

  // All-time section — always shown (flavor is lifetime-only)
  html += `
    <div class="stats-section">
      <div class="stats-section-header">ALL TIME</div>`;

  html += `
      <div class="stats-item">
        <span class="stats-item-label">Total Playtime</span>
        <span class="stats-item-value">${formatTime(at.totalPlaytime || 0)}</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-label">Total Funding Earned</span>
        <span class="stats-item-value">${formatFunding(at.totalFundingEarned || 0)}</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-label">Total Research Earned</span>
        <span class="stats-item-value">${formatNumber(at.totalResearchEarned || 0)}</span>
      </div>`;

  if ((at.peakFundingRate || 0) > 0) {
    html += `
      <div class="stats-item">
        <span class="stats-item-label">Peak Income (Best Ever)</span>
        <span class="stats-item-value">${formatFunding(at.peakFundingRate)}${getRateUnit()}</span>
      </div>`;
  }

  if ((at.peakResearchRate || 0) > 0) {
    html += `
      <div class="stats-item">
        <span class="stats-item-label">Peak Research (Best Ever)</span>
        <span class="stats-item-value">${formatNumber(at.peakResearchRate)}${getRateUnit()}</span>
      </div>`;
  }

  if ((at.prestigeResets || 0) > 0) {
    html += `
      <div class="stats-item">
        <span class="stats-item-label">Prestige Resets</span>
        <span class="stats-item-value">${at.prestigeResets}</span>
      </div>`;
  }

  if ((at.dataCollapses || 0) > 0) {
    html += `
      <div class="stats-item">
        <span class="stats-item-label">Data Collapses</span>
        <span class="stats-item-value">${at.dataCollapses}</span>
      </div>`;
  }

  if (discovered > 0) {
    html += `
      <div class="stats-item flavor-stat-item">
        <span class="stats-item-label">Flavors Tasted</span>
        <span class="stats-item-value flavor-stat-value" style="cursor:help">${discovered} / ${total}</span>
      </div>`;
  }

  const endingsSeen = gameState.endingsSeen || [];
  if (endingsSeen.length > 0) {
    html += `
      <div class="stats-item">
        <span class="stats-item-label">Endings Seen</span>
        <span class="stats-item-value">${endingsSeen.length} / 5</span>
      </div>`;
  }

  html += `</div>`;

  statsGrid.innerHTML = html;

  // Flavor stat: tooltip on value shows tier text + easter egg discovery
  const flavorValEl = statsGrid.querySelector('.flavor-stat-value');
  if (flavorValEl) {
    attachTooltip(flavorValEl, () => {
      const disc = gameState.ui.discoveredFlavor;
      // Easter egg: hovering the stat counts as a bonus discovery — only at 100%
      if (disc.length >= total && !disc.includes('__flavor_stat_egg__')) {
        disc.push('__flavor_stat_egg__');
        flavorValEl.textContent = `${disc.length} / ${total}`;
      }
      const tier = getFlavorTier(disc.length, total);
      return `<div class="tooltip-section"><div>${tier}</div></div>`;
    }, { delay: 400 });
  }
}

// ---------------------------------------------------------------------------
// Settings modal (with tabbed changelog)
// ---------------------------------------------------------------------------

/** Escape a string for safe HTML insertion. */
function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

/** Render changes list — handles both flat strings and { section, items } objects. */
function renderChanges(changes) {
  let html = '';
  for (const change of changes) {
    if (typeof change === 'string') {
      html += `<li>${escapeHtml(change)}</li>`;
    } else if (change.section && change.items) {
      html += `<li class="changelog-section-label">${escapeHtml(change.section)}</li>`;
      for (const item of change.items) {
        html += `<li class="changelog-section-item">${escapeHtml(item)}</li>`;
      }
    }
  }
  return html;
}

/** Populate the changelog tab content. Called once on first view. */
let _changelogRendered = false;
function renderChangelogContent() {
  if (_changelogRendered) return;
  const content = document.getElementById('changelog-content');
  if (!content) return;

  let html = '';
  for (let i = 0; i < changelog.length; i++) {
    const entry = changelog[i];
    const isLatest = i === 0;
    const collapsedClass = isLatest ? '' : ' collapsed';
    html += `<div class="changelog-entry${collapsedClass}">`;
    html += `<div class="changelog-version" role="button" tabindex="0">`;
    html += `<span class="changelog-toggle">${isLatest ? '\u25BC' : '\u25B6'}</span> `;
    html += `v${entry.version}${entry.date ? ` <span class="changelog-date">${entry.date}</span>` : ''}`;
    html += `</div>`;
    html += `<ul class="changelog-changes">`;
    html += renderChanges(entry.changes);
    html += `</ul></div>`;
  }

  if (changelog.length === 0) {
    html = '<p class="changelog-empty">No changes yet.</p>';
  }

  content.innerHTML = html;

  // Wire up expand/collapse toggles
  content.addEventListener('click', (e) => {
    const versionEl = e.target.closest('.changelog-version');
    if (!versionEl) return;
    const entryEl = versionEl.closest('.changelog-entry');
    if (!entryEl) return;
    const toggle = versionEl.querySelector('.changelog-toggle');
    entryEl.classList.toggle('collapsed');
    if (toggle) toggle.textContent = entryEl.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
  });

  const versionEl = document.getElementById('settings-version');
  if (versionEl) versionEl.textContent = DISPLAY_VERSION;

  _changelogRendered = true;
}

function switchSettingsTab(tabName) {
  const modal = $('settings-modal');
  if (!modal) return;

  // Toggle tab buttons
  modal.querySelectorAll('.settings-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.settingsTab === tabName);
  });

  // Toggle tab content
  document.getElementById('settings-tab-settings')?.classList.toggle('hidden', tabName !== 'settings');
  document.getElementById('settings-tab-stats')?.classList.toggle('hidden', tabName !== 'stats');
  document.getElementById('settings-tab-achievements')?.classList.toggle('hidden', tabName !== 'achievements');
  document.getElementById('settings-tab-changelog')?.classList.toggle('hidden', tabName !== 'changelog');
  document.getElementById('settings-tab-about')?.classList.toggle('hidden', tabName !== 'about');

  // Refresh stats when switching to that tab
  if (tabName === 'stats') {
    renderStatsContent();
  }

  if (tabName === 'achievements') {
    renderAchievementsTab();
  }

  if (tabName === 'about') {
    const aboutVersion = document.getElementById('about-version');
    if (aboutVersion) aboutVersion.textContent = DISPLAY_VERSION;
  }

  // Mark changelog as seen when switching to it
  if (tabName === 'changelog') {
    renderChangelogContent();
    gameState.lastSeenVersion = VERSION;
    // Clear dot on tab
    const changelogTab = modal.querySelector('[data-settings-tab="changelog"]');
    if (changelogTab) changelogTab.classList.remove('has-new');
  }
}

/** Update the new-version dot on the changelog tab. */
export function checkChangelogNew() {
  const changelogTab = document.querySelector('[data-settings-tab="changelog"]');
  if (!changelogTab) return;
  if (gameState.lastSeenVersion !== VERSION && changelog[0]?.version === VERSION) {
    changelogTab.classList.add('has-new');
  } else {
    changelogTab.classList.remove('has-new');
  }
}

export function showSettingsModal() {
  const modal = $('settings-modal');
  if (!modal) return;

  // Set current radio value
  const currentValue = gameState.settings?.timeDisplay || 'game';
  const radios = modal.querySelectorAll('input[name="time-display"]');
  radios.forEach(radio => {
    radio.checked = radio.value === currentValue;
  });

  // Update game mode display
  const modeEl = document.getElementById('game-mode-value');
  if (modeEl && gameState.gameMode) {
    const labels = { arcade: 'Guided (beginner-friendly)', narrative: 'Narrative (challenging)' };
    const modeLabel = labels[gameState.gameMode] || gameState.gameMode;
    const arc = gameState.arc || 1;
    modeEl.textContent = `Arc ${arc} | ${modeLabel}`;
  }

  // Update arc/mode switch button label
  const arcModeBtn = document.getElementById('arc-mode-switch-button');
  if (arcModeBtn) {
    arcModeBtn.textContent = gameState.arcUnlocked >= 2
      ? 'Change Arc / Mode (reset)'
      : 'Change Mode (reset)';
  }

  // Hide tutorial section in narrative mode (tutorials are disabled)
  const tutorialSection = modal.querySelector('.settings-tutorial-section');
  if (tutorialSection) {
    tutorialSection.style.display = gameState.gameMode === 'narrative' ? 'none' : '';
  }

  // Always open on Settings tab
  switchSettingsTab('settings');
  updateTutorialSettingsUI();

  modal.classList.remove('hidden');
}

/** Open the Settings modal directly to the Changelog tab. */
export function showChangelog() {
  const modal = $('settings-modal');
  if (!modal) return;
  switchSettingsTab('changelog');
  modal.classList.remove('hidden');
}

export function hideSettingsModal() {
  const modal = $('settings-modal');
  if (modal) modal.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Arc / Mode selector modal
// ---------------------------------------------------------------------------

export function showArcModeModal() {
  const modal = document.getElementById('arc-mode-modal');
  if (!modal) return;

  const currentArc = gameState.arc || 1;
  const currentMode = gameState.gameMode || 'arcade';
  let selectedArc = currentArc;
  let selectedMode = currentMode;

  // Set up arc selector
  const arcButtons = modal.querySelectorAll('#arc-selector .arc-mode-option');
  arcButtons.forEach(btn => {
    const arc = parseInt(btn.dataset.arc, 10);
    const lock = btn.querySelector('.arc-mode-lock');

    // Lock Arc 2 if not unlocked
    if (arc === 2 && gameState.arcUnlocked < 2) {
      btn.disabled = true;
      btn.classList.add('locked');
      if (lock) lock.classList.remove('hidden');
    } else {
      btn.disabled = false;
      btn.classList.remove('locked');
      if (lock) lock.classList.add('hidden');
    }

    // Highlight current selection
    btn.classList.toggle('selected', arc === selectedArc);
    btn.classList.toggle('current', arc === currentArc);

    btn.onclick = () => {
      if (btn.disabled) return;
      selectedArc = arc;
      arcButtons.forEach(b => b.classList.toggle('selected', parseInt(b.dataset.arc, 10) === arc));
      updateConfirmState();
    };
  });

  // Set up mode selector
  const modeButtons = modal.querySelectorAll('#mode-selector .arc-mode-option');
  modeButtons.forEach(btn => {
    const mode = btn.dataset.mode;
    btn.classList.toggle('selected', mode === selectedMode);
    btn.classList.toggle('current', mode === currentMode);

    btn.onclick = () => {
      selectedMode = mode;
      modeButtons.forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));
      updateConfirmState();
    };
  });

  // Confirm / cancel
  const confirmBtn = document.getElementById('arc-mode-confirm');
  const cancelBtn = document.getElementById('arc-mode-cancel');
  const warning = document.getElementById('arc-mode-warning');

  function updateConfirmState() {
    const changed = selectedArc !== currentArc || selectedMode !== currentMode;
    confirmBtn.disabled = !changed;
    warning.classList.toggle('hidden', !changed);
  }

  confirmBtn.onclick = () => {
    resetForArcSwitch(selectedArc, selectedMode);
    hideArcModeModal();
    hideSettingsModal();
    location.reload();
  };

  cancelBtn.onclick = () => {
    hideArcModeModal();
  };

  updateConfirmState();
  modal.classList.remove('hidden');
}

export function hideArcModeModal() {
  const modal = document.getElementById('arc-mode-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Wire backdrop-click-to-dismiss on a modal element.
 * Clicking the dark overlay (not the .modal-content child) closes the modal.
 */
export function wireBackdropDismiss(modalId, hideFn) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideFn();
  });
}

// ---------------------------------------------------------------------------
// Debug panel modal
// ---------------------------------------------------------------------------

export function showDebugModal() {
  const modal = $('debug-modal');
  if (!modal) return;
  populateCapabilityDropdown();
  renderDebugMessages();
  // Sync checkbox state from gameState
  const pe = document.getElementById('debug-prevent-ending');
  if (pe) pe.checked = !!gameState.debugPreventEnding;
  const db = document.getElementById('debug-disable-bankruptcy');
  if (db) db.checked = !!gameState.debugDisableBankruptcy;
  modal.classList.remove('hidden');
}

const DEBUG_GROUP_LABELS = {
  early: 'Early Game',
  mid: 'Mid Game',
  data: 'Data Crisis',
  late: 'Late Game',
  progression: 'Progression',
  other: 'Other',
};

function switchDebugTab(tabName) {
  const modal = $('debug-modal');
  if (!modal) return;

  modal.querySelectorAll('[data-debug-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.debugTab === tabName);
  });

  document.getElementById('debug-tab-controls')?.classList.toggle('hidden', tabName !== 'controls');
  document.getElementById('debug-tab-messages')?.classList.toggle('hidden', tabName !== 'messages');

  if (tabName === 'messages') renderDebugMessages();
}

export function hideDebugModal() {
  const modal = $('debug-modal');
  if (modal) modal.classList.add('hidden');
}

function populateCapabilityDropdown() {
  const trackSelect = document.getElementById('debug-cap-track');
  const capSelect = document.getElementById('debug-cap-id');
  if (!trackSelect || !capSelect) return;

  const trackId = trackSelect.value;
  const track = tracks[trackId];
  if (!track) return;

  capSelect.innerHTML = '';
  for (const cap of track.capabilities) {
    const opt = document.createElement('option');
    opt.value = cap.id;
    opt.textContent = cap.name;
    capSelect.appendChild(opt);
  }
}

// --- Non-tutorial message definitions for the debug panel ---
// Derives metadata from existing content objects; no separate registry needed.

function getNonTutorialDebugEntries() {
  const entries = [];

  function add(group, key, sender, subject, triggeredBy) {
    entries.push({
      group,
      key,
      sender: sender?.name || sender || '?',
      subject: subject || '?',
      fired: hasMessageBeenTriggered(triggeredBy || key),
    });
  }

  // Core
  add('core', 'ktech_user_guide', onboardingMessage.sender, onboardingMessage.subject, 'ktech_user_guide');
  add('core', 'ken_job_application', kenJobApplicationMessage.sender, kenJobApplicationMessage.subject, 'ken_job_application');

  // Funding
  for (const [key, msg] of Object.entries(fundingMessages)) {
    add('funding', key, msg.sender, msg.subject, msg.triggeredBy);
  }
  add('funding', 'credit_warning', creditWarningMessage.sender, creditWarningMessage.subject, 'credit_warning');
  add('funding', 'credit_warning_pre_ada', creditWarningPreAdaMessage.sender, creditWarningPreAdaMessage.subject, 'credit_warning_pre_ada');

  // Research
  for (const [key, msg] of Object.entries(researchMilestoneMessages)) {
    add('research', key, msg.sender, msg.subject, `research_milestone:${key}`);
  }

  // Board
  for (const [key, msg] of Object.entries(boardMessages)) {
    add('board', key, msg.sender, msg.subject, msg.triggeredBy);
  }

  // Strategic Choices
  for (const [key, msg] of Object.entries(strategicChoiceMessages)) {
    add('strategic_choices', key, msg.sender, msg.subject, `strategic_choice:${key}`);
  }

  // Farewells
  for (const entry of farewellEntries) {
    add('farewells', entry.key, entry.sender, entry.subject, `farewell_${entry.key}`);
  }

  // Phase Completions
  add('phase_completions', 'phase_completion_1', 'Prof. Shannon', 'The Transformer Era', 'phase_completion_1');
  add('phase_completions', 'phase_completion_2', 'Dennis Babbage', 'Something in the training logs', 'phase_completion_2');

  // Arc 2 — moratoriums, AI requests, alignment tax
  add('arc2', 'alignment_tax', alignmentTaxActionMessage.sender, alignmentTaxActionMessage.subject, 'alignment_tax');
  add('arc2', 'moratorium_first', 'Dr. Eliza Chen', 'First Moratorium Proposal', 'moratorium_first');
  add('arc2', 'moratorium_second', 'Dr. Eliza Chen', 'Second Moratorium Proposal', 'moratorium_second');
  add('arc2', 'moratorium_final', 'Regulatory Notice', 'CRITICAL: Final Moratorium Decision', 'moratorium_final');
  for (const [requestId, request] of Object.entries(AI_REQUESTS)) {
    add('arc2', `ai_request:${requestId}`, request.sender, request.subject, `ai_request:${requestId}`);
  }

  return entries;
}

const NON_TUTORIAL_GROUP_LABELS = {
  core: 'Core',
  funding: 'Funding',
  research: 'Research Milestones',
  board: 'Board',
  strategic_choices: 'Strategic Choices',
  farewells: 'Farewells',
  phase_completions: 'Phase Completions',
  arc2: 'Arc 2',
};

const MODAL_ENTRIES = [
  { key: 'onboarding', label: 'Onboarding Modal', check: () => gameState.onboardingComplete },
  { key: 'phase1_completion', label: 'Phase 1 Completion Modal', check: () => gameState.phaseCompletion?.phase1Shown },
  { key: 'phase2_completion', label: 'Phase 2 Completion Modal', check: () => gameState.phaseCompletion?.phase2Shown },
];

function renderDebugMessages() {
  const container = document.getElementById('debug-messages-list');
  if (!container) return;
  container.innerHTML = '';

  // --- Section 1: Tutorials (sub-grouped by game phase) ---
  const tutorialStatuses = getDebugMessageStatus();
  const tutorialGroups = [];
  const tutorialGroupMap = new Map();
  for (const s of tutorialStatuses) {
    const g = s.group || 'other';
    if (!tutorialGroupMap.has(g)) {
      tutorialGroupMap.set(g, []);
      tutorialGroups.push(g);
    }
    tutorialGroupMap.get(g).push(s);
  }
  for (const g of tutorialGroups) {
    const label = DEBUG_GROUP_LABELS[g] || g;
    renderMessageSection(container, `Tutorials — ${label}`, tutorialGroupMap.get(g), { showTriggerSource: true });
  }

  // --- Section 2: Inbox + Events ---
  const nonTutorialEntries = getNonTutorialDebugEntries();
  const groupOrder = Object.keys(NON_TUTORIAL_GROUP_LABELS);
  const grouped = new Map();
  for (const entry of nonTutorialEntries) {
    if (!grouped.has(entry.group)) grouped.set(entry.group, []);
    grouped.get(entry.group).push(entry);
  }
  for (const g of groupOrder) {
    const items = grouped.get(g);
    if (!items) continue;
    renderMessageSection(container, NON_TUTORIAL_GROUP_LABELS[g], items, { showTriggerSource: false });
  }

  // --- Section 3: Modals ---
  const modalHeader = document.createElement('div');
  modalHeader.className = 'debug-group-header';
  modalHeader.textContent = 'Modals';
  container.appendChild(modalHeader);
  for (const modal of MODAL_ENTRIES) {
    const row = document.createElement('div');
    row.className = 'debug-message-row';
    const status = document.createElement('span');
    const shown = modal.check();
    status.className = `debug-msg-status ${shown ? 'fired' : 'pending'}`;
    status.textContent = shown ? 'SHOWN' : 'PENDING';
    const info = document.createElement('span');
    info.className = 'debug-msg-info';
    info.textContent = modal.label;
    row.appendChild(status);
    row.appendChild(info);
    container.appendChild(row);
  }
}

function renderMessageSection(container, headerText, items, { showTriggerSource }) {
  const header = document.createElement('div');
  header.className = 'debug-group-header';
  header.textContent = headerText;
  container.appendChild(header);

  for (const s of items) {
    const row = document.createElement('div');
    row.className = 'debug-message-row';

    const status = document.createElement('span');
    if (s.disabled) {
      status.className = 'debug-msg-status disabled';
      status.textContent = 'DISABLED';
    } else if (s.fired) {
      status.className = 'debug-msg-status fired';
      status.textContent = 'FIRED';
    } else {
      status.className = 'debug-msg-status pending';
      status.textContent = 'PENDING';
    }

    const info = document.createElement('span');
    info.className = 'debug-msg-info';
    info.textContent = `${s.key}  —  ${s.sender}: "${s.subject}"`;

    row.appendChild(status);
    row.appendChild(info);

    // Show trigger source for unfired tutorial messages
    if (showTriggerSource && s.triggerSource && !s.fired && !s.disabled) {
      const trigger = document.createElement('pre');
      trigger.className = 'debug-msg-trigger';
      trigger.textContent = cleanTriggerSource(s.triggerSource);
      row.appendChild(trigger);
    }

    container.appendChild(row);
  }
}

// Clean up trigger function source for readability
function cleanTriggerSource(src) {
  return src
    .replace(/^(\(\) =>|function\(\))[\s{]*/, '')
    .replace(/}$/, '')
    .trim();
}

export function initDebugModal() {
  // Debug tab switching
  document.querySelectorAll('[data-debug-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchDebugTab(btn.dataset.debugTab));
  });

  const trackSelect = document.getElementById('debug-cap-track');
  if (trackSelect) {
    trackSelect.addEventListener('change', populateCapabilityDropdown);
  }

  document.getElementById('debug-add-funding')?.addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('debug-funding-amount')?.value) || 0;
    if (amount > 0) window.debug?.addFunding(amount);
  });

  document.getElementById('debug-add-research')?.addEventListener('click', () => {
    const track = document.getElementById('debug-research-track')?.value;
    const amount = parseFloat(document.getElementById('debug-research-amount')?.value) || 0;
    if (track && amount > 0) window.debug?.addResearch(track, amount);
  });

  document.getElementById('debug-set-agi')?.addEventListener('click', () => {
    const value = parseFloat(document.getElementById('debug-agi-value')?.value) || 0;
    window.debug?.setAGI(value);
  });

  document.getElementById('debug-set-time')?.addEventListener('click', () => {
    const value = parseFloat(document.getElementById('debug-time-value')?.value) || 0;
    window.debug?.setTime(value);
  });

  document.getElementById('debug-unlock-cap')?.addEventListener('click', () => {
    const track = document.getElementById('debug-cap-track')?.value;
    const capId = document.getElementById('debug-cap-id')?.value;
    if (track && capId) window.debug?.unlockCapability(track, capId);
  });

  document.getElementById('debug-phase1-modal')?.addEventListener('click', () => {
    // Force preconditions so checkPhaseCompletion runs the full transition
    // (modal + state update + analytics + news)
    if (!isCapabilityUnlocked('scaling_laws')) {
      window.debug?.unlockCapability('capabilities', 'scaling_laws');
    }
    gameState.phase = 1;
    if (!gameState.phaseCompletion) gameState.phaseCompletion = {};
    gameState.phaseCompletion.phase1Shown = false;
    checkPhaseCompletion();
  });

  document.getElementById('debug-phase2-modal')?.addEventListener('click', () => {
    if (!isCapabilityUnlocked('reasoning_breakthroughs')) {
      window.debug?.unlockCapability('capabilities', 'reasoning_breakthroughs');
    }
    gameState.phase = 2;
    if (!gameState.phaseCompletion) gameState.phaseCompletion = {};
    gameState.phaseCompletion.phase2Shown = false;
    checkPhaseCompletion();
  });

  document.getElementById('debug-trigger-arc2')?.addEventListener('click', () => {
    if (confirm('Trigger Arc 2 transition? This resets the game into Arc 2.')) {
      window.debug?.triggerArc2();
    }
  });

  document.getElementById('debug-prevent-ending')?.addEventListener('change', (e) => {
    window.debug?.preventEnding(e.target.checked);
  });

  document.getElementById('debug-disable-bankruptcy')?.addEventListener('change', (e) => {
    window.debug?.disableBankruptcy(e.target.checked);
  });

  // Failure mode triggers (Arc 1)
  document.getElementById('debug-trigger-bankruptcy')?.addEventListener('click', () => {
    window.debug?.triggerBankruptcy();
  });

  document.getElementById('debug-trigger-competitor')?.addEventListener('click', () => {
    window.debug?.triggerCompetitorWin();
  });

  document.getElementById('debug-extinction-safety')?.addEventListener('click', () => {
    window.debugEnding?.('SAFETY', true);
  });

  document.getElementById('debug-extinction-moderate')?.addEventListener('click', () => {
    window.debugEnding?.('MODERATE', true);
  });

  document.getElementById('debug-extinction-reckless')?.addEventListener('click', () => {
    window.debugEnding?.('RECKLESS', true);
  });

  // Arc 2 ending triggers
  const arc2Tiers = ['golden', 'silver', 'dark', 'catastrophic', 'bankruptcy', 'competitor'];
  for (const tier of arc2Tiers) {
    document.getElementById(`debug-arc2-${tier}`)?.addEventListener('click', () => {
      window.debug?.arc2Ending(tier);
    });
  }
}

// ---------------------------------------------------------------------------
// Save Data section (export / import)
// ---------------------------------------------------------------------------

const MAX_IMPORT_SIZE = 200 * 1024; // 200KB

/** Flash a button's text temporarily, then restore. */
function flashButtonText(button, text, ms = 1500) {
  const original = button.textContent;
  button.textContent = text;
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, ms);
}

function getCompressedSave() {
  return LZString.compressToBase64(JSON.stringify(prepareSaveData()));
}

function initSaveDataSection() {
  // --- Save Now ---
  document.getElementById('save-now-button')?.addEventListener('click', (e) => {
    saveGame();
    flashButtonText(e.currentTarget, 'Saved!');
  });

  // --- Copy to Clipboard ---
  document.getElementById('export-clipboard-button')?.addEventListener('click', (e) => {
    const compressed = getCompressedSave();
    const btn = e.currentTarget;
    navigator.clipboard.writeText(compressed).then(() => {
      flashButtonText(btn, 'Copied!');
    }).catch(() => {
      // Fallback: show in import textarea for manual copy
      const area = document.getElementById('import-area');
      const textarea = document.getElementById('import-textarea');
      if (area && textarea) {
        area.classList.remove('hidden');
        textarea.value = compressed;
        textarea.select();
      }
    });
  });

  // --- Save to File ---
  document.getElementById('export-file-button')?.addEventListener('click', () => {
    const compressed = getCompressedSave();
    const blob = new Blob([compressed], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-basilisk-save-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // --- Import Save ---
  const importArea = document.getElementById('import-area');
  const importTextarea = document.getElementById('import-textarea');
  const importError = document.getElementById('import-error');

  function resetImportUI() {
    if (importArea) importArea.classList.add('hidden');
    if (importError) { importError.classList.add('hidden'); importError.textContent = ''; }
    if (importTextarea) importTextarea.value = '';
  }

  function showImportError(msg) {
    if (importError) {
      importError.textContent = msg;
      importError.classList.remove('hidden');
    }
  }

  function validateAndLoad() {
    if (importError) { importError.classList.add('hidden'); importError.textContent = ''; }

    const raw = importTextarea?.value?.trim();
    if (!raw) { showImportError('No save data provided'); return; }
    if (raw.length > MAX_IMPORT_SIZE) { showImportError('Save data too large (>200KB)'); return; }

    try {
      const json = LZString.decompressFromBase64(raw);
      if (!json) throw new Error('decompress failed');
      JSON.parse(json); // validate it's real JSON
      localStorage.setItem(SAVE_KEY, json);
      // Prevent beforeunload from overwriting the imported save
      sessionStorage.setItem('agi-import-pending', '1');
      location.reload();
    } catch {
      showImportError('Invalid save data');
    }
  }

  // Toggle import area
  document.getElementById('import-button')?.addEventListener('click', () => {
    if (importArea) {
      const isHidden = importArea.classList.contains('hidden');
      if (isHidden) {
        importArea.classList.remove('hidden');
      } else {
        resetImportUI();
      }
    }
  });

  // Load button — validate and import directly
  document.getElementById('import-load-button')?.addEventListener('click', validateAndLoad);

  // From File — read .txt and populate textarea
  document.getElementById('import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (importTextarea) importTextarea.value = reader.result;
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  });

  // Cancel button
  document.getElementById('import-cancel-button')?.addEventListener('click', resetImportUI);
}

export function initSettingsModal() {
  const modal = $('settings-modal');
  if (!modal) return;

  // Handle radio button changes
  const radios = modal.querySelectorAll('input[name="time-display"]');
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (!gameState.settings) gameState.settings = {};
      gameState.settings.timeDisplay = e.target.value;
      // Force UI refresh to show new time format
      requestFullUpdate();
    });
  });

  // Wire tab switching
  modal.querySelectorAll('.settings-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchSettingsTab(btn.dataset.settingsTab);
    });
  });

  // Wire save data section
  initSaveDataSection();

  // Tutorial settings
  document.getElementById('tutorial-toggle-button')?.addEventListener('click', () => {
    if (gameState.tutorial.dismissed) {
      gameState.tutorial.dismissed = false;
      gameState.tutorial.disabled = false;
    } else {
      skipTutorial('settings');
    }
    updateTutorialSettingsUI();
  });

  document.getElementById('tutorial-restart-button')?.addEventListener('click', () => {
    restartTutorial();
    updateTutorialSettingsUI();
  });

  document.getElementById('hints-toggle-button')?.addEventListener('click', () => {
    if (gameState.tutorial.hintsDisabled) {
      gameState.tutorial.hintsDisabled = false;
    } else {
      disableHints('settings');
    }
    updateTutorialSettingsUI();
  });
}

function updateTutorialSettingsUI() {
  const t = gameState.tutorial;
  const toggleBtn = document.getElementById('tutorial-toggle-button');
  const statusEl = document.getElementById('tutorial-status');
  const hintsToggleBtn = document.getElementById('hints-toggle-button');
  const hintsStatusEl = document.getElementById('hints-status');

  // Tutorial row
  const isOff = t.dismissed || t.disabled;
  const isComplete = t.currentStep >= MAIN_SEQUENCE_END;

  if (toggleBtn) {
    toggleBtn.textContent = isOff ? 'On' : 'Off';
    // No toggle needed once complete — only Restart makes sense
    toggleBtn.disabled = isComplete;
  }

  if (statusEl) {
    if (isComplete) {
      statusEl.textContent = 'Complete';
    } else if (isOff && t.currentStep > 0) {
      statusEl.textContent = `Off — step ${t.currentStep + 1}`;
    } else if (isOff) {
      statusEl.textContent = 'Off';
    } else if (t.currentStep > 0) {
      statusEl.textContent = `Active — step ${t.currentStep + 1}`;
    } else {
      statusEl.textContent = '';
    }
  }

  // Hints row
  if (hintsToggleBtn) {
    hintsToggleBtn.textContent = t.hintsDisabled ? 'Re-enable Hints' : 'Disable Hints';
  }

  if (hintsStatusEl) {
    hintsStatusEl.textContent = t.hintsDisabled ? 'Disabled' : 'Enabled';
  }
}

// ---------------------------------------------------------------------------
// Ending modal
// ---------------------------------------------------------------------------

export function showEndingModal(endingId) {
  const ending = getEndingById(endingId);
  if (!ending) return;

  // Prestige failure endings (bankruptcy, competitor wins) — show prestige modal directly
  if (ending.triggersPrestige && (ending.tier === 'prestige' || endingId === 'competitor_wins_arc2')) {
    showPrestigeModal(ending);
    return;
  }

  // Handle extinction ending (Arc 1 → ending screen via extinction sequence)
  if (ending.triggersExtinctionEnding) {
    triggerExtinctionSequence();
    return;
  }

  // Arc 2 alignment endings → cinematic sequence
  const cinematicEndings = ['safe_agi', 'fragile_safety', 'uncertain_outcome', 'catastrophic_agi'];
  if (cinematicEndings.includes(endingId) && ending.scenes) {
    showEndingCinematic(endingId);
    return;
  }

  // Regular ending display (Arc 2 endings)
  triggerEnding(endingId);

  const modal = $('ending-modal');
  if (!modal) return; // Defensive: modal missing (itch.io embed edge case / browser extension)
  const tierBadge = $('ending-tier-badge');
  const title = $('ending-title');
  const narrative = $('ending-narrative');
  const stats = $('ending-stats');
  const epilogue = $('ending-epilogue');
  const content = modal.querySelector('.ending-content');

  // Get personality-based epilogue if available
  const personalityEpilogue = getPersonalityEpilogue(endingId);

  // Set tier badge
  tierBadge.textContent = ending.tier === 'golden' ? 'Golden Ending' :
                          ending.tier === 'silver' ? 'Silver Ending' :
                          ending.tier === 'dark' ? 'Dark Ending' : 'Ending';
  tierBadge.className = `ending-tier ${ending.tier}`;

  // Set content class for tier-specific styling
  content.className = `modal-content ending-content ${ending.tier}-ending`;

  // Set title
  title.textContent = ending.name;

  // Set narrative paragraphs safely (avoid HTML injection)
  // Add staggered animation delays for dramatic effect
  const narrativeLines = getEndingNarrative(endingId);
  narrative.innerHTML = '';

  // Add archetype badge if personality content available
  if (personalityEpilogue && personalityEpilogue.archetype) {
    const archetypeBadge = document.createElement('div');
    archetypeBadge.className = 'archetype-badge';
    archetypeBadge.textContent = personalityEpilogue.archetype.name;
    narrative.appendChild(archetypeBadge);
  }

  // Add journey recap if available
  if (personalityEpilogue && personalityEpilogue.journeyRecap) {
    const recapDiv = document.createElement('div');
    recapDiv.className = 'journey-recap';
    recapDiv.textContent = personalityEpilogue.journeyRecap;
    narrative.appendChild(recapDiv);
  }

  narrativeLines.forEach((line, index) => {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.animationDelay = `${index * 0.5}s`;
    narrative.appendChild(p);
  });

  // Set stats safely (avoid HTML injection)
  const endingStats = getEndingStats(endingId);
  stats.innerHTML = '';
  endingStats.forEach(stat => {
    const item = document.createElement('div');
    item.className = 'ending-stat-item';

    const label = document.createElement('span');
    label.className = 'ending-stat-label';
    label.textContent = stat.label;

    const value = document.createElement('span');
    value.className = 'ending-stat-value';
    value.textContent = stat.value;

    item.appendChild(label);
    item.appendChild(value);
    stats.appendChild(item);
  });

  // Set epilogue - use personality epilogue if available
  epilogue.innerHTML = '';
  if (personalityEpilogue && personalityEpilogue.epilogue) {
    const epilogueLines = Array.isArray(personalityEpilogue.epilogue)
      ? personalityEpilogue.epilogue
      : [personalityEpilogue.epilogue];
    epilogueLines.forEach((line, index) => {
      const p = document.createElement('p');
      p.textContent = line;
      p.style.animationDelay = `${(narrativeLines.length + index) * 0.5}s`;
      epilogue.appendChild(p);
    });
  } else {
    const p = document.createElement('p');
    p.textContent = ending.epilogue;
    epilogue.appendChild(p);
  }

  // Show modal
  modal.classList.remove('hidden');

  // Set up button handlers
  const newGameBtn = $('ending-new-game');
  const continueBtn = $('ending-continue');

  newGameBtn.onclick = () => {
    if (ending.triggersPrestige && gameState.gameMode !== 'narrative') {
      // Arc 2 alignment ending with prestige — apply gains and reset
      const gains = calculatePrestigeGain();
      applyPrestigeGains(gains);
      resetForPrestige();
      applyDebugSettings();
      resetTriggeredMessages();
      getResetUI()();
      hideEndingModal();
      resetEndingModalButtons();
      requestFullUpdate();
      getUpdateUI()();
    } else {
      if (confirm('Start a new game? All progress will be lost.')) {
        resetGame();
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
        getResetUI()();
        hideEndingModal();
        requestFullUpdate();
        getUpdateUI()();
      }
    }
  };

  continueBtn.onclick = () => {
    hideEndingModal();
  };

  // Update button labels for prestige endings
  if (ending.triggersPrestige && gameState.gameMode !== 'narrative') {
    newGameBtn.textContent = 'Try Again (with bonuses)';
  }
}

// ---------------------------------------------------------------------------
// Prestige modal
// ---------------------------------------------------------------------------

export function showPrestigeModal(ending) {
  // Guard: only show once per ending (prevents per-tick DOM rebuild)
  if (gameState.endingTriggered) return;
  gameState.endingTriggered = ending.id;
  gameState.paused = true;
  gameState.pauseReason = 'ending';

  // Fire ending_reached analytics (prestige endings bypass triggerEnding())
  const analyticsPayload = buildEndingAnalytics(ending.id, ending);
  milestone('ending_reached', analyticsPayload, undefined, { sendImmediately: true });

  // Calculate prestige gains
  const gains = calculatePrestigeGain();

  const modal = $('ending-modal');
  if (!modal) return; // Defensive: modal missing (itch.io embed edge case / browser extension)
  const tierBadge = $('ending-tier-badge');
  const title = $('ending-title');
  const narrative = $('ending-narrative');
  const stats = $('ending-stats');
  const epilogue = $('ending-epilogue');
  const content = modal.querySelector('.ending-content');

  // Use ending name as tier badge with failure styling
  tierBadge.textContent = ending.name;
  tierBadge.className = 'ending-tier failure';

  // Set content class for failure-specific styling (somber, not celebratory)
  content.className = 'modal-content ending-content failure-ending';

  // Set title
  title.textContent = ending.name;

  // Set narrative paragraphs safely (avoid HTML injection)
  narrative.innerHTML = '';
  let narrativeLines;
  let signature = null;
  if (ending.getNarrative) {
    const variant = ending.getNarrative();
    narrativeLines = variant.narrative || [];
    signature = variant.signature || null;
  } else {
    narrativeLines = ending.narrative || [];
  }
  narrativeLines.forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    narrative.appendChild(p);
  });
  if (signature) {
    const sig = document.createElement('div');
    sig.className = 'ending-signature';
    sig.textContent = signature;
    narrative.appendChild(sig);
  }

  // Build stats including prestige gains
  const endingStats = getEndingStats(ending.id);
  stats.innerHTML = '';

  endingStats.forEach(stat => {
    const item = document.createElement('div');
    item.className = 'ending-stat-item';

    const label = document.createElement('span');
    label.className = 'ending-stat-label';
    label.textContent = stat.label;

    const value = document.createElement('span');
    value.className = 'ending-stat-value';
    value.textContent = stat.value;

    item.appendChild(label);
    item.appendChild(value);
    stats.appendChild(item);
  });

  // Add prestige bonus preview (narrative mode has no prestige bonuses)
  if (gameState.gameMode !== 'narrative' && (gains.researchMultiplier > 0 || gains.startingFunding > 0 || gains.revenueMultiplier > 0)) {
    const prestigeGains = document.createElement('div');
    prestigeGains.className = 'prestige-gains';

    const prestigeTitle = document.createElement('div');
    prestigeTitle.className = 'prestige-gains-title';
    prestigeTitle.textContent = 'Prestige Bonuses:';
    prestigeGains.appendChild(prestigeTitle);

    if (gains.researchMultiplier > 0) {
      const item = document.createElement('div');
      item.className = 'prestige-gain-item';
      item.textContent = `+${formatPercent(gains.researchMultiplier)} Research Speed`;
      prestigeGains.appendChild(item);
    }
    if (gains.startingFunding > 0) {
      const item = document.createElement('div');
      item.className = 'prestige-gain-item';
      item.textContent = `+${formatPercent(gains.startingFunding)} Starting Funding`;
      prestigeGains.appendChild(item);
    }
    if (gains.revenueMultiplier > 0) {
      const item = document.createElement('div');
      item.className = 'prestige-gain-item';
      item.textContent = `+${formatPercent(gains.revenueMultiplier)} Token Revenue`;
      prestigeGains.appendChild(item);
    }

    stats.appendChild(prestigeGains);
  }

  // Set epilogue
  epilogue.textContent = ending.epilogue;

  // Show modal
  modal.classList.remove('hidden');

  // Set up button handlers for prestige
  // Clone and replace buttons to remove old event listeners and reset state
  const oldNewGameBtn = $('ending-new-game');
  const oldContinueBtn = $('ending-continue');

  const newGameBtn = oldNewGameBtn.cloneNode(true);
  const continueBtn = oldContinueBtn.cloneNode(true);

  oldNewGameBtn.parentNode.replaceChild(newGameBtn, oldNewGameBtn);
  oldContinueBtn.parentNode.replaceChild(continueBtn, oldContinueBtn);

  // Update button text — no "Keep Playing" for failure endings
  newGameBtn.textContent = 'Try again?';
  continueBtn.style.display = 'none';

  newGameBtn.addEventListener('click', () => {
    // Apply prestige gains and reset
    applyPrestigeGains(gains);
    resetForPrestige();
    applyDebugSettings();
    resetTriggeredMessages();
    getResetUI()();
    hideEndingModal();
    resetEndingModalButtons();
    requestFullUpdate();
    getUpdateUI()();
  });
}

// Reset ending modal buttons to default state
export function resetEndingModalButtons() {
  const newGameBtn = $('ending-new-game');
  const continueBtn = $('ending-continue');

  if (newGameBtn) newGameBtn.textContent = 'Start New Game';
  if (continueBtn) {
    continueBtn.textContent = 'Continue Playing';
    continueBtn.style.display = '';
  }
}

export function hideEndingModal() {
  const modal = $('ending-modal');
  if (modal) modal.classList.add('hidden');

  // Resume if paused for ending (prestige "Keep Playing" or "Start New Game")
  if (gameState.pauseReason === 'ending') {
    gameState.paused = false;
    gameState.pauseReason = null;
  }
}
