// js/ui/automation-panel.js
// Inline automation controls for purchase cards.
// Simplified TF Titans-style: [checkbox] Auto [input] [policy dropdown]

import { getPurchasableById } from '../content/purchasables.js';
import {
  POLICY_TYPES,
  isAutomationUnlocked,
  isPercentRevenueUnlocked,
  getItemRate,
} from '../automation-state.js';
import {
  getTransitionState,
  calculateTarget,
} from '../automation-policies.js';
import { formatDuration } from '../utils/format.js';
import { el, enhanceInput } from '../utils/dom.js';
import { logAutomationPolicy } from '../playtest-logger.js';
import { attachTooltip } from './stats-tooltip.js';
import { getCount, getPurchasableState } from '../purchasable-state.js';

// Create automation panel for a purchasable card
export function createAutomationPanel(purchasableId) {
  if (!isAutomationUnlocked(purchasableId)) {
    return null;
  }

  const state = getPurchasableState(purchasableId);
  const automation = state.automation;
  const purchasable = getPurchasableById(purchasableId);
  const itemName = purchasable?.name || purchasableId.replace(/_/g, ' ');

  const panel = el('div', { className: 'automation-panel' });

  // === Single line: [checkbox] Auto [target] [policy] priority [priority] ===
  const controlRow = el('div', { className: 'automation-controls' });

  // Enable checkbox
  const enableCheckbox = el('input', { attrs: { type: 'checkbox' } });
  enableCheckbox.checked = automation.enabled;
  enableCheckbox.addEventListener('change', () => {
    const wasEnabled = automation.enabled;
    automation.enabled = enableCheckbox.checked;
    updatePanelState();
    logAutomationPolicy(purchasableId, automation, wasEnabled);
  });
  controlRow.appendChild(enableCheckbox);

  // "Auto" label
  controlRow.appendChild(el('span', { className: 'automation-label', text: 'Auto' }));

  // Target input (text, no spinners)
  const targetInput = el('input', {
    className: 'automation-input',
    attrs: { type: 'text', inputmode: 'numeric', title: `Target for ${itemName}` },
  });
  targetInput.value = automation.targetValue;
  enhanceInput(targetInput);
  targetInput.addEventListener('input', () => {
    targetInput.value = targetInput.value.replace(/[^0-9]/g, '');
  });
  targetInput.addEventListener('change', () => {
    let val = parseInt(targetInput.value) || 0;
    val = Math.max(0, Math.min(99999, val));
    automation.targetValue = val;
    targetInput.value = val;
    logAutomationPolicy(purchasableId, automation, automation.enabled);
  });
  controlRow.appendChild(targetInput);

  // Policy dropdown
  const policySelect = el('select', { className: 'automation-policy-select' });
  policySelect.appendChild(el('option', { attrs: { value: POLICY_TYPES.FIXED }, text: 'units' }));
  if (isPercentRevenueUnlocked()) {
    policySelect.appendChild(el('option', { attrs: { value: POLICY_TYPES.PERCENT_REVENUE }, text: '% of revenue' }));
  }
  policySelect.value = automation.type;
  policySelect.addEventListener('change', () => {
    automation.type = policySelect.value;
    logAutomationPolicy(purchasableId, automation, automation.enabled);
  });
  controlRow.appendChild(policySelect);

  // "priority" label
  controlRow.appendChild(el('span', { className: 'automation-label', text: 'priority' }));

  // Priority input (1-9, lower = higher priority)
  const priorityInput = el('input', {
    className: 'automation-input automation-priority-input',
    attrs: { type: 'text', inputmode: 'numeric' },
  });
  priorityInput.value = automation.priority || 1;
  enhanceInput(priorityInput);
  priorityInput.addEventListener('input', () => {
    priorityInput.value = priorityInput.value.replace(/[^0-9]/g, '');
  });
  priorityInput.addEventListener('change', () => {
    const val = parseInt(priorityInput.value) || 1;
    automation.priority = Math.max(1, Math.min(9, val));
    priorityInput.value = automation.priority;
    logAutomationPolicy(purchasableId, automation, automation.enabled);
  });
  controlRow.appendChild(priorityInput);
  attachTooltip(priorityInput, () => '1 is the highest priority.');

  // Inline status span (after priority input, same line)
  const statusSpan = el('span', { className: 'automation-status-inline dim' });
  controlRow.appendChild(statusSpan);
  panel._statusSpan = statusSpan;

  panel.appendChild(controlRow);

  // === Helper functions ===
  function updatePanelState() {
    if (automation.enabled) {
      panel.classList.remove('disabled');
    } else {
      panel.classList.add('disabled');
    }
  }

  // Initialize state
  updatePanelState();

  // Store purchasable ID for updates
  panel._purchasableId = purchasableId;

  return panel;
}

// Format automation rate: "next in Xs" for slow rates, "+N/s" for fast (#320, #402)
function formatRate(rate) {
  const absRate = Math.abs(rate);
  if (absRate > 0 && absRate < 1) {
    return `next in ${Math.round(1 / absRate)}s`;
  }
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}/s`;
}

// Update an existing automation panel with current state
export function updateAutomationPanel(panel) {
  if (!panel || !panel._purchasableId) return;

  const itemId = panel._purchasableId;
  const state = getPurchasableState(itemId);
  const transitionState = getTransitionState(itemId);
  const purchasable = getPurchasableById(itemId);
  const isCompute = purchasable?.category === 'compute';

  const statusEl = panel._statusSpan || panel._statusRow;
  if (!statusEl) return;

  const active = transitionState.active;
  const furloughed = transitionState.furloughed;
  const target = transitionState.target;
  const owned = getCount(itemId);

  // Build clear status message
  let parts = [];

  if (state.automation.enabled) {
    parts.push(`${active}/${target} active`);
    if (furloughed > 0) {
      parts.push(`${furloughed} paused`);
    }

    // Show action preview with rate
    if (transitionState.type !== 'idle') {
      const rate = getItemRate(itemId);
      if (transitionState.type === 'hiring') {
        const needed = target - owned;
        const verb = isCompute ? 'building' : 'hiring';
        const build = state.automation?.building;
        let rateStr = '';
        if (build && rate > 0 && rate < 1) {
          const remaining = Math.ceil((1 - build.progress) / rate);
          rateStr = ` · ${formatDuration(remaining)} to next`;
        } else if (rate > 0) {
          rateStr = ` · ${formatRate(rate)}`;
        }
        parts.push(`${verb} ${needed}${rateStr}`);
      } else if (transitionState.type === 'unfurloughing') {
        const unfurl = state.automation?.unfurloughing;
        let rateStr = '';
        if (unfurl && rate > 0 && rate < 1) {
          const remaining = Math.ceil((1 - unfurl.progress) / rate);
          rateStr = ` ${formatDuration(remaining)} to next`;
        } else if (rate > 0) {
          rateStr = ` ${formatRate(rate)}`;
        }
        parts.push(`activating${rateStr}`);
      } else if (transitionState.type === 'furloughing') {
        const furl = state.automation?.furloughing;
        const absRate = Math.abs(rate);
        let rateStr = '';
        if (furl && absRate > 0 && absRate < 1) {
          const remaining = Math.ceil((1 - furl.progress) / absRate);
          rateStr = ` ${formatDuration(remaining)} to next`;
        } else if (absRate > 0) {
          rateStr = ` ${formatRate(rate)}`;
        }
        parts.push(`pausing${rateStr}`);
      }
    } else if (active === target && owned >= target) {
      parts.push('at target');
    }

  } else {
    // Show preview target even when disabled (#325)
    const previewTarget = calculateTarget(itemId, null, { preview: true });
    parts.push(`${active} active (auto off \u2192 ${previewTarget})`);
  }

  // Per-item throttle warning — shown as separate styled span, not class toggle
  const isThrottled = state.automation.enabled && state.automation.throttled;
  if (isThrottled) {
    statusEl.textContent = parts.length ? '\u00b7 ' + parts.join(' \u00b7 ') + ' ' : '';
    // Append a styled warning span
    let warnSpan = statusEl.querySelector('.automation-throttle-warn');
    if (!warnSpan) {
      warnSpan = el('span', { className: 'automation-throttle-warn' });
      statusEl.appendChild(warnSpan);
    }
    warnSpan.textContent = '\u00b7 stopped — target cost too high, lower target';
  } else {
    // Remove warning span if present
    const warnSpan = statusEl.querySelector('.automation-throttle-warn');
    if (warnSpan) warnSpan.remove();
    statusEl.textContent = parts.length ? '\u00b7 ' + parts.join(' \u00b7 ') : '';
  }
}
