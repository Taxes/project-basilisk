// Modal UI — stats, changelog, events, endings, prestige

import { gameState, resetGame } from '../game-state.js';
import { tracks } from '../capabilities.js';
import { applyChoiceEffects } from '../events.js';
import { getEndingById, getEndingStats, triggerEnding, getEndingNarrative, getPersonalityEpilogue } from '../endings.js';
import { calculatePrestigeGain, applyPrestigeGains, resetForPrestige } from '../prestige.js';
import { resetQueueIdCounter } from '../focus-queue.js';
import { resetTriggeredMessages } from '../messages.js';
import { triggerExtinctionSequence } from '../extinction-sequence.js';
import { formatNumber, formatFunding, formatPercent, formatTime, getRateUnit } from '../utils/format.js';
import { changelog } from '../changelog.js';
import { VERSION } from '../version.js';
import { showNarrativeModal } from '../narrative-modal.js';
import { $ } from '../utils/dom-cache.js';
import { requestFullUpdate } from './signals.js';
import { applyDebugSettings } from '../debug-commands.js';

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
// Stats modal
// ---------------------------------------------------------------------------

export function showStatsModal() {
  const modal = $('stats-modal');
  const statsGrid = $('stats-grid');

  if (!modal || !statsGrid) return;

  // Count capabilities from tracks
  let unlockedCount = 0;
  let totalCaps = 0;
  for (const trackId of ['capabilities', 'applications', 'alignment']) {
    unlockedCount += gameState.tracks[trackId]?.unlockedCapabilities?.length || 0;
    const track = tracks[trackId];
    if (track) totalCaps += track.capabilities.length;
  }

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
        <span class="stats-item-label">Capabilities</span>
        <span class="stats-item-value">${unlockedCount} / ${totalCaps}</span>
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

  html += `</div>`;

  // All-time section (only show if there's meaningful data beyond current run)
  if ((at.prestigeResets || 0) > 0 || (at.totalPlaytime || 0) > gameState.timeElapsed + 60) {
    html += `
    <div class="stats-section">
      <div class="stats-section-header">ALL TIME</div>
      <div class="stats-item">
        <span class="stats-item-label">Total Playtime</span>
        <span class="stats-item-value">${formatTime(at.totalPlaytime || 0)}</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-label">Total Funding Earned</span>
        <span class="stats-item-value">${formatFunding(at.totalFundingEarned || 0)}</span>
      </div>
      <div class="stats-item">
        <span class="stats-item-label">Prestige Resets</span>
        <span class="stats-item-value">${at.prestigeResets || 0}</span>
      </div>
    </div>`;
  }

  statsGrid.innerHTML = html;
  modal.classList.remove('hidden');
}

export function hideStatsModal() {
  const modal = $('stats-modal');
  if (modal) modal.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Settings modal (with tabbed changelog)
// ---------------------------------------------------------------------------

/** Populate the changelog tab content. Called once on first view. */
let _changelogRendered = false;
function renderChangelogContent() {
  if (_changelogRendered) return;
  const content = document.getElementById('changelog-content');
  if (!content) return;

  let html = '';
  for (const entry of changelog) {
    html += `<div class="changelog-entry">`;
    html += `<div class="changelog-version">v${entry.version} <span class="changelog-date">${entry.date}</span></div>`;
    html += `<ul class="changelog-changes">`;
    for (const change of entry.changes) {
      const li = document.createElement('li');
      li.textContent = change;
      html += `<li>${li.textContent}</li>`;
    }
    html += `</ul></div>`;
  }

  if (changelog.length === 0) {
    html = '<p class="changelog-empty">No changes yet.</p>';
  }

  content.innerHTML = html;

  const versionEl = document.getElementById('settings-version');
  if (versionEl) versionEl.textContent = `v${VERSION}`;

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
  document.getElementById('settings-tab-changelog')?.classList.toggle('hidden', tabName !== 'changelog');

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
  if (gameState.lastSeenVersion !== VERSION) {
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

  // Always open on Settings tab
  switchSettingsTab('settings');

  modal.classList.remove('hidden');
}

export function hideSettingsModal() {
  const modal = $('settings-modal');
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
  modal.classList.remove('hidden');
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

export function initDebugModal() {
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
    showNarrativeModal({
      title: 'The Transformer Era',
      narrative: `
        <p>You've proven that attention is all you need. Scaling laws hold. Your models grow smarter with every parameter, every dataset, every GPU-hour. The industry is watching.</p>
        <p>But scaling has a direction, and you haven't chosen yours yet. The foundation model era begins now — and the models are getting big enough to surprise you.</p>
      `,
      phaseClass: 'phase-forward',
      buttonText: 'Enter the Foundation Model Era',
    });
  });

  document.getElementById('debug-phase2-modal')?.addEventListener('click', () => {
    showNarrativeModal({
      title: 'The Foundation Model Era',
      narrative: `
        <p>Your systems reason at levels that rival human experts. Tool use, agency, world models — each breakthrough built on the last. You built the ladder. Something is climbing it.</p>
        <p>Self-improvement is no longer theoretical. The decisions you make now are the last ones you'll make with a clear advantage.</p>
      `,
      phaseClass: 'phase-ominous',
      buttonText: 'Begin the Road to Superintelligence',
    });
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
}

// ---------------------------------------------------------------------------
// Event modal
// ---------------------------------------------------------------------------

export function showEventModal(event) {
  const modal = $('event-modal');
  const title = $('event-title');
  const text = $('event-text');
  const choices = $('event-choices');

  if (!modal || !title || !text || !choices) return;

  title.textContent = event.name;
  text.textContent = event.text;

  choices.innerHTML = '';

  for (let choice of event.choices) {
    const button = document.createElement('button');
    button.className = 'choice-button';
    button.textContent = choice.text;

    button.addEventListener('click', () => {
      applyChoiceEffects(choice.effects);
      hideEventModal();
      requestFullUpdate();
      getUpdateUI()();
    });

    choices.appendChild(button);
  }

  modal.classList.remove('hidden');
}

export function hideEventModal() {
  const modal = $('event-modal');
  if (modal) modal.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Ending modal
// ---------------------------------------------------------------------------

export function showEndingModal(endingId) {
  const ending = getEndingById(endingId);
  if (!ending) return;

  // Handle prestige endings (Arc 1 resets)
  if (ending.triggersPrestige) {
    showPrestigeModal(ending);
    return;
  }

  // Handle extinction ending (Arc 1 → ending screen via extinction sequence)
  if (ending.triggersExtinctionEnding) {
    triggerExtinctionSequence();
    return;
  }

  // Regular ending display (Arc 2 endings)
  triggerEnding(endingId);

  const modal = $('ending-modal');
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
    if (confirm('Start a new game? All progress will be lost.')) {
      resetGame();
      applyDebugSettings();
      resetQueueIdCounter();
      resetTriggeredMessages();
      getResetUI()();
      hideEndingModal();
      requestFullUpdate();
      getUpdateUI()();
    }
  };

  continueBtn.onclick = () => {
    hideEndingModal();
  };
}

// ---------------------------------------------------------------------------
// Prestige modal
// ---------------------------------------------------------------------------

export function showPrestigeModal(ending) {
  // Calculate prestige gains
  const gains = calculatePrestigeGain();

  const modal = $('ending-modal');
  const tierBadge = $('ending-tier-badge');
  const title = $('ending-title');
  const narrative = $('ending-narrative');
  const stats = $('ending-stats');
  const epilogue = $('ending-epilogue');
  const content = modal.querySelector('.ending-content');

  // Set tier badge for prestige
  tierBadge.textContent = 'Prestige Reset';
  tierBadge.className = 'ending-tier prestige';

  // Set content class for prestige-specific styling
  content.className = 'modal-content ending-content prestige-ending';

  // Set title
  title.textContent = ending.name;

  // Set narrative paragraphs safely (avoid HTML injection)
  // Add staggered animation delays for dramatic effect
  narrative.innerHTML = '';
  const narrativeLines = ending.narrative || [];
  narrativeLines.forEach((line, index) => {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.animationDelay = `${index * 0.5}s`;
    narrative.appendChild(p);
  });

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

  // Add prestige bonus preview
  if (gains.researchMultiplier > 0 || gains.startingFunding > 0 || gains.computeEfficiency > 0) {
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
    if (gains.computeEfficiency > 0) {
      const item = document.createElement('div');
      item.className = 'prestige-gain-item';
      item.textContent = `+${formatPercent(gains.computeEfficiency)} Compute Efficiency`;
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

  // Update button text for prestige context
  newGameBtn.textContent = 'Prestige Reset';
  continueBtn.textContent = 'Keep Playing';

  newGameBtn.addEventListener('click', () => {
    // Apply prestige gains and reset
    applyPrestigeGains(gains);
    resetForPrestige();
    applyDebugSettings();
    hideEndingModal();
    resetEndingModalButtons();
    requestFullUpdate();
    getUpdateUI()();
  });

  continueBtn.addEventListener('click', () => {
    hideEndingModal();
    resetEndingModalButtons();
  });
}

// Reset ending modal buttons to default state
export function resetEndingModalButtons() {
  const newGameBtn = $('ending-new-game');
  const continueBtn = $('ending-continue');

  if (newGameBtn) newGameBtn.textContent = 'Start New Game';
  if (continueBtn) continueBtn.textContent = 'Continue Playing';
}

export function hideEndingModal() {
  const modal = $('ending-modal');
  if (modal) modal.classList.add('hidden');
}
