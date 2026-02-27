// Narrative Modal — reusable phase-completion / data-wall modal with inbox copy
// Populates the phase-completion modal DOM and creates an inbox message.

import { gameState } from './game-state.js';
import { addInfoMessage } from './messages.js';

let _onDismissCallback = null;

export function getNarrativeOnDismiss() {
  return _onDismissCallback;
}

export function clearNarrativeOnDismiss() {
  _onDismissCallback = null;
}

/**
 * Show a narrative modal with optional inbox copy.
 *
 * @param {object} config
 * @param {string} config.title              - Modal title
 * @param {string} config.narrative          - HTML for narrative section
 * @param {Array<{label, value, className?}>} [config.stats]  - Stats grid items
 * @param {Array<{label, value, positive}>}   [config.choices] - Choices summary
 * @param {string} [config.choicesHeader]    - Header above choices (e.g. "Your Choices")
 * @param {object} [config.inbox]            - Inbox message config
 * @param {object} config.inbox.sender       - Character sender ({id, name, role})
 * @param {string} config.inbox.subject      - Subject line
 * @param {string} config.inbox.body         - Plain text body
 * @param {string[]} config.inbox.tags       - Tags array
 * @param {string}  [config.buttonText]     - Custom continue button text (default: "Continue")
 * @param {string}  [config.phaseClass]     - Extra class on .phase-completion-content (e.g. 'phase-forward', 'phase-ominous')
 */
export function showNarrativeModal(config) {
  // Skip everything during fast-forward
  if (gameState._fastForwarding) {
    return;
  }

  // Create inbox copy first (before any DOM work, so tests without DOM still work)
  if (config.inbox) {
    const { sender, subject, body, tags, triggeredBy } = config.inbox;
    addInfoMessage(sender, subject, body, null, tags || [], triggeredBy || null);
  }

  // Populate DOM — only pause if modal exists (avoids stuck pause state)
  const modal = document.getElementById('phase-completion-modal');
  if (!modal) {
    console.error('Phase completion modal not found');
    return;
  }

  gameState.paused = true;
  gameState.pauseReason = 'phase_completion';

  const content = modal.querySelector('.phase-completion-content');
  const titleEl = document.getElementById('phase-completion-title');
  const narrativeEl = document.getElementById('phase-completion-narrative');
  const statsEl = document.getElementById('phase-completion-stats');
  const choicesEl = document.getElementById('phase-completion-choices');

  // Apply phase-specific class for CSS targeting
  if (content && config.phaseClass) {
    content.classList.remove('phase-forward', 'phase-ominous', 'phase-onboarding');
    content.classList.add(config.phaseClass);
  }

  // Set phase badge
  const badgeEl = document.getElementById('phase-completion-badge');
  if (badgeEl) {
    if (config.phaseClass === 'phase-forward') {
      badgeEl.textContent = 'Phase 1 Complete';
      badgeEl.classList.remove('hidden');
    } else if (config.phaseClass === 'phase-ominous') {
      badgeEl.textContent = 'Phase 2 Complete';
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.textContent = '';
      badgeEl.classList.add('hidden');
    }
  }

  // Sender attribution
  const senderNameEl = document.getElementById('phase-sender-name');
  const senderRoleEl = document.getElementById('phase-sender-role');
  if (senderNameEl && senderRoleEl && config.inbox?.sender) {
    senderNameEl.textContent = config.inbox.sender.name;
    senderRoleEl.textContent = config.inbox.sender.role || '';
  }

  if (titleEl) {
    titleEl.textContent = config.title;
  }

  if (narrativeEl) {
    narrativeEl.innerHTML = config.narrative;
  }

  // Stats grid
  if (statsEl) {
    if (config.stats && config.stats.length > 0) {
      statsEl.innerHTML = config.stats.map(stat => `
        <div class="stat-item${stat.className ? ' ' + stat.className : ''}">
          <span class="stat-label">${stat.label}</span>
          <span class="stat-value">${stat.value}</span>
        </div>
      `).join('');
    } else {
      statsEl.innerHTML = '';
    }
  }

  // Choices summary
  if (choicesEl) {
    if (config.choices && config.choices.length > 0) {
      const header = config.choicesHeader || 'Your Choices';
      choicesEl.innerHTML = `<h4>${header}</h4>` + config.choices.map(choice => `
        <div class="choice-item ${choice.positive ? 'positive' : 'negative'}">
          <span class="choice-label">${choice.label}</span>
          <span class="choice-value">${choice.value}</span>
        </div>
      `).join('');
    } else {
      choicesEl.innerHTML = '';
    }
  }

  // Update continue button text
  const continueBtn = document.getElementById('phase-completion-continue');
  if (continueBtn) {
    continueBtn.textContent = config.buttonText || 'Continue';
  }

  // Store onDismiss callback for phase-completion continue button
  _onDismissCallback = config.onDismiss || null;

  // Handle backdrop click dismissal
  if (config.noDismissOnBackdrop) {
    modal.dataset.noDismiss = 'true';
  } else {
    delete modal.dataset.noDismiss;
  }

  // Show modal
  modal.classList.remove('hidden');
}
