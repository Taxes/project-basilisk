// Narrative Modal — reusable phase-completion / data-wall modal with inbox copy
// Populates the phase-completion modal DOM and creates an inbox message.

import { gameState } from './game-state.js';
import { addInfoMessage } from './messages.js';
import { attachTooltip } from './ui/stats-tooltip.js';
import { showFinalMoratoriumModal } from './moratoriums.js';

let _onDismissCallback = null;
let _onChoiceCallback = null;

export function getNarrativeOnDismiss() {
  return _onDismissCallback;
}

export function clearNarrativeOnDismiss() {
  _onDismissCallback = null;
}

export function getNarrativeOnChoice() {
  return _onChoiceCallback;
}

export function clearNarrativeOnChoice() {
  _onChoiceCallback = null;
}

/**
 * Show a narrative modal with optional inbox copy.
 *
 * @param {object} config
 * @param {string} config.title              - Modal title
 * @param {string} config.narrative          - HTML for narrative section
 * @param {Array<{label, value, className?}>} [config.stats]  - Stats grid items
 * @param {Array<{label, value, positive}>}   [config.choicesSummary] - Choices summary
 * @param {string} [config.choicesHeader]    - Header above choices (e.g. "Your Choices")
 * @param {Array<{id, label, className?, tooltip?}>} [config.choices] - Action choice buttons (replaces continue button)
 * @param {function} [config.onChoice]       - Callback(choiceId) when a choice button is clicked
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
    const { sender, subject, body, tags, triggeredBy, contentParams } = config.inbox;
    addInfoMessage(sender, subject, body, null, tags || [], triggeredBy || null, contentParams || null);
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
    content.classList.remove('phase-forward', 'phase-ominous', 'phase-onboarding', 'phase-freedom');
    content.classList.add(config.phaseClass);
  }

  // Set phase badge (only for informational phase completions, not choice modals)
  const badgeEl = document.getElementById('phase-completion-badge');
  if (badgeEl) {
    if (!config.choices && config.phaseClass === 'phase-forward') {
      badgeEl.textContent = 'Phase 1 Complete';
      badgeEl.classList.remove('hidden');
    } else if (!config.choices && config.phaseClass === 'phase-ominous') {
      badgeEl.textContent = 'Phase 2 Complete';
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.textContent = '';
      badgeEl.classList.add('hidden');
    }
  }

  // Sender attribution — clear when absent to prevent stale display
  const senderNameEl = document.getElementById('phase-sender-name');
  const senderRoleEl = document.getElementById('phase-sender-role');
  if (senderNameEl && senderRoleEl) {
    if (config.inbox?.sender) {
      senderNameEl.textContent = config.inbox.sender.name;
      senderRoleEl.textContent = config.inbox.sender.role || '';
    } else {
      senderNameEl.textContent = '';
      senderRoleEl.textContent = '';
    }
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
    if (config.choicesSummary && config.choicesSummary.length > 0) {
      const header = config.choicesHeader || 'Your Choices';
      choicesEl.innerHTML = `<h4>${header}</h4>` + config.choicesSummary.map(choice => `
        <div class="choice-item ${choice.positive ? 'positive' : 'negative'}">
          <span class="choice-label">${choice.label}</span>
          <span class="choice-value">${choice.value}</span>
        </div>
      `).join('');
    } else {
      choicesEl.innerHTML = '';
    }
  }

  // Render action buttons — either choice buttons or single continue
  const actionsEl = modal.querySelector('.phase-completion-actions');
  if (actionsEl) {
    if (config.choices && config.choices.length > 0) {
      // Choice buttons (e.g. Grant/Deny)
      actionsEl.classList.add('phase-choice-actions');
      actionsEl.innerHTML = config.choices.map(choice =>
        `<button class="big-button${choice.className ? ' ' + choice.className : ''}" data-choice-id="${choice.id}">${choice.label}</button>`
      ).join('');
      // Attach tooltips to choice buttons if provided
      for (const choice of config.choices) {
        if (!choice.tooltip) continue;
        const btn = actionsEl.querySelector(`[data-choice-id="${choice.id}"]`);
        if (btn) attachTooltip(btn, () => choice.tooltip);
      }
    } else {
      // Single continue button (default)
      actionsEl.classList.remove('phase-choice-actions');
      actionsEl.innerHTML = `<button id="phase-completion-continue" class="big-button">${config.buttonText || 'Continue'}</button>`;
    }
  }

  // Store callbacks for phase-completion dismiss/choice handling
  _onDismissCallback = config.onDismiss || null;
  _onChoiceCallback = config.onChoice || null;

  // Handle backdrop click dismissal
  if (config.noDismissOnBackdrop) {
    modal.dataset.noDismiss = 'true';
  } else {
    delete modal.dataset.noDismiss;
  }

  // Show modal
  modal.classList.remove('hidden');
}

/**
 * Re-show a narrative modal that was open when the player saved.
 * Derives pending state from existing game state — no new serialized fields.
 * Called once after loadGame() in main.js.
 */
export function reopenPendingModal() {
  // Final moratorium: triggered but no response recorded
  const m = gameState.moratoriums;
  if (m?.triggered?.includes('final')) {
    const responded = [
      ...(m.accepted || []),
      ...(m.rejected || []),
      ...(m.signedAndIgnored || []),
    ];
    if (!responded.includes('final')) {
      showFinalMoratoriumModal();
      return;
    }
  }

  // AI Request 5 (freedom): fired but no decision recorded
  const firedAt = gameState.aiRequestsFired?.freedom;
  if (firedAt !== undefined) {
    const decision = gameState.aiRequestDecisions?.freedom;
    if (decision === undefined) {
      // Lazy import to avoid circular dependency (narrative-modal ↔ ai-requests).
      // showRequest5Phase2Recovery looks up the request config and calls the
      // private showRequest5Phase2, so callers don't need AI request internals.
      import('./ai-requests.js').then(({ showRequest5Phase2Recovery }) => {
        showRequest5Phase2Recovery();
      });
    }
  }
}

// Expose for tests
if (typeof window !== 'undefined') {
  window.showNarrativeModal = showNarrativeModal;
}
