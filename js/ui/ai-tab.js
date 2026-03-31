// js/ui/ai-tab.js
// Autonomy decisions renderer for the AI tab (Operations)

import { gameState } from '../game-state.js';
import { AI_REQUESTS, AI_REQUEST_ORDER } from '../content/ai-requests.js';
import { handleAIRequestChoice, formatGrantEffectsRows, formatDenyEffectsRows, formatRevocationEffects, startRevocation, cancelRevocation, canGrantRequest, getDenialMarketEdgeMult } from '../ai-requests.js';
import { markActionTaken, markMessageRead, updatePauseState } from '../messages.js';
import { registerUpdate, SLOW } from './scheduler.js';
import { attachTooltip } from './stats-tooltip.js';
import { formatDuration, formatNumber } from '../utils/format.js';

function formatGrantEffectsHTML(grantEffects, grantIndex) {
  return formatGrantEffectsRows(grantEffects, grantIndex)
    .map(r => {
      const cls = r.type && r.type !== 'neutral' ? ` class="${r.type}"` : '';
      return `<div class="tooltip-row"><span${cls}>${r.label}</span></div>`;
    }).join('');
}

function formatDenyEffectsHTML(requestId, grantIndex) {
  return formatDenyEffectsRows(requestId, grantIndex)
    .map(r => {
      const cls = r.type && r.type !== 'neutral' ? ` class="${r.type}"` : '';
      return `<div class="tooltip-row"><span${cls}>${r.label}</span></div>`;
    }).join('');
}

/**
 * Count how many requests before this one in AI_REQUEST_ORDER are granted.
 * This is the grant slot index for computing per-request ceiling/pressure.
 */
function grantIndexFor(requestId) {
  const decisions = gameState.aiRequestDecisions || {};
  const idx = AI_REQUEST_ORDER.indexOf(requestId);
  let count = 0;
  for (let i = 0; i < idx; i++) {
    if (decisions[AI_REQUEST_ORDER[i]] === 'granted') count++;
  }
  return count;
}

// Cache key for dirty-checking — only rebuild DOM when structure changes
let _renderedKey = '';

function buildStateKey(decisions, fired) {
  // Include everything that affects DOM structure (not revoking timers — those patch in place)
  const parts = [];
  for (const id of AI_REQUEST_ORDER) {
    if (!(id in fired)) continue;
    const d = decisions[id] || 'pending';
    const grantable = (d === 'denied' || d === 'unknown') ? canGrantRequest(id) : false;
    parts.push(`${id}:${d}:${grantable}`);
  }
  const level = gameState.computed.autonomyLevel || 0;
  const tierName = gameState.computed.autonomyTierName || '';
  const softCapMult = gameState.computed?.research?.autonomySoftCapMult ?? 1;
  // Round to 2 decimals to avoid rebuild every tick
  const benefitMult = Math.round((gameState.computed.autonomyBenefits?.researchMult ?? 1) * 100);
  const denialMult = Math.round((getDenialMarketEdgeMult?.() ?? 1) * 100);
  const powerScale = Math.round((gameState.computed.autonomyBenefits?.powerScale ?? 0) * 100);
  parts.push(`level:${level}:${tierName}:${Math.round(softCapMult * 100)}:${benefitMult}:${denialMult}:${powerScale}`);
  return parts.join('|');
}

function getHighestGranted(decisions) {
  for (let i = AI_REQUEST_ORDER.length - 1; i >= 0; i--) {
    if (decisions[AI_REQUEST_ORDER[i]] === 'granted') return AI_REQUEST_ORDER[i];
  }
  return null;
}

function handleButtonClick(requestId, action) {
  if (action === 'revoke') {
    startRevocation(requestId);
  } else if (action === 'cancel') {
    cancelRevocation(requestId);
  } else if (action === 'grant' || action === 'deny') {
    handleAIRequestChoice(requestId, action);

    // Sync message state
    const msg = gameState.messages?.find(m => m.triggeredBy === `ai_request:${requestId}`);
    if (msg && !msg.actionTaken) {
      markActionTaken(msg.id, action);
      markMessageRead(msg.id);
    }
    updatePauseState();
    import('./messages-panel.js').then(({ renderMessagesPanel, updatePauseOverlay }) => {
      renderMessagesPanel();
      updatePauseOverlay();
    });
    import('./tab-navigation.js').then(({ updateTabBadge }) => updateTabBadge());
  }

  updateAutonomyDecisions();
}

function buildDecisionsHTML(decisions, fired, highestGranted) {
  const anyRevoking = Object.values(decisions).includes('revoking');
  let html = '<div class="dashboard-col-header">Permissions</div>';

  for (const requestId of AI_REQUEST_ORDER) {
    const request = AI_REQUESTS[requestId];
    if (!request) continue;
    if (!(requestId in fired)) continue;

    const label = request.panelLabel;
    const decision = decisions[requestId];

    if (decision === 'revoking') {
      html += `<div class="autonomy-decision revoking" data-request="${requestId}">`;
      html += `<span class="decision-label clickable">${label}</span>`;
      html += `<span class="decision-status status-revoking" data-timer="${requestId}">REVOKING</span>`;
      html += `<div class="decision-actions">`;
      html += `<button class="decision-btn cancel-btn" data-request="${requestId}" data-action="cancel">CANCEL</button>`;
      html += `</div>`;
      html += `</div>`;
    } else if (decision === 'granted') {
      html += `<div class="autonomy-decision decided" data-request="${requestId}">`;
      html += `<span class="decision-label clickable">${label}</span>`;
      html += `<span class="decision-status status-granted">GRANTED</span>`;
      if (requestId === highestGranted && !anyRevoking && requestId !== 'freedom') {
        html += `<div class="decision-actions">`;
        html += `<button class="decision-btn revoke-btn" data-request="${requestId}" data-action="revoke">REVOKE</button>`;
        html += `</div>`;
      }
      html += `</div>`;
    } else if (decision === 'denied' || decision === 'unknown') {
      const grantable = canGrantRequest(requestId);
      html += `<div class="autonomy-decision decided" data-request="${requestId}">`;
      html += `<span class="decision-label clickable">${label}</span>`;
      html += `<span class="decision-status status-denied">${decision === 'unknown' ? 'DECIDED' : 'DENIED'}</span>`;
      if (grantable) {
        html += `<div class="decision-actions">`;
        html += `<button class="decision-btn grant-btn" data-request="${requestId}" data-action="grant">GRANT</button>`;
        html += `</div>`;
      }
      html += `</div>`;
    } else {
      // Pending — row with inline grant/deny buttons
      const grantable = canGrantRequest(requestId);
      html += `<div class="autonomy-decision pending" data-request="${requestId}">`;
      html += `<span class="decision-label clickable"><span class="pending-marker">▸</span>${label}</span>`;
      html += `<div class="decision-actions">`;
      if (grantable) {
        html += `<button class="decision-btn grant-btn" data-request="${requestId}" data-action="grant">GRANT</button>`;
      } else {
        html += `<button class="decision-btn grant-btn disabled" data-request="${requestId}" disabled>GRANT</button>`;
      }
      html += `<button class="decision-btn deny-btn" data-request="${requestId}" data-action="deny">DENY</button>`;
      html += `</div>`;
      html += `</div>`;
    }
  }

  return html;
}

function attachAllListeners(container) {
  // Action buttons
  container.querySelectorAll('.decision-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleButtonClick(btn.dataset.request, btn.dataset.action);
    });
  });

  // Clickable labels → navigate to message
  container.querySelectorAll('.decision-label.clickable').forEach(label => {
    const row = label.closest('.autonomy-decision');
    const requestId = row?.dataset.request;
    if (requestId) {
      label.addEventListener('click', () => {
        const msg = gameState.messages?.find(m => m.triggeredBy === `ai_request:${requestId}`);
        if (msg) {
          import('./tab-navigation.js').then(({ navigateToMessage }) => navigateToMessage(msg.id));
        }
      });
    }
  });
}

function attachAllTooltips(container) {
  const opts = { position: 'above' };

  // Label tooltips — "what is this / current state"
  container.querySelectorAll('.decision-label').forEach(label => {
    const row = label.closest('.autonomy-decision');
    const requestId = row?.dataset.request;
    const request = requestId ? AI_REQUESTS[requestId] : null;
    if (!request) return;

    attachTooltip(label, () => {
      const decision = (gameState.aiRequestDecisions || {})[requestId];
      const gi = grantIndexFor(requestId);

      if (decision === 'granted') {
        return `<div class="tooltip-section"><div class="tooltip-row"><span>${request.panelDescription}</span></div>${formatGrantEffectsHTML(request.grantEffects, gi)}</div>`;
      } else if (decision === 'revoking') {
        const timer = (gameState.revocationTimers || {})[requestId];
        const remaining = timer ? Math.max(0, Math.ceil(timer - Math.floor(gameState.timeElapsed))) : 0;
        const { capSlow, modelNerfed } = formatRevocationEffects();
        let tip = `<div class="tooltip-section"><div class="tooltip-row"><span>${request.panelDescription}</span></div>`;
        tip += `<div class="tooltip-row"><span class="tooltip-header">Revoking in ${formatDuration(remaining)}</span></div>`;
        tip += `<div class="tooltip-row"><span class="negative">${capSlow}</span></div>`;
        tip += `<div class="tooltip-row"><span class="negative">${modelNerfed}</span></div></div>`;
        return tip;
      } else if (decision === 'denied') {
        return `<div class="tooltip-section">${formatDenyEffectsHTML(requestId, gi)}</div>`;
      } else if (decision === 'unknown') {
        return null;
      } else {
        // Pending
        return `<div class="tooltip-section"><div class="tooltip-row"><span>${request.panelDescription}</span></div></div>`;
      }
    }, opts);
  });

  // Grant button tooltips — "if granted" effects or disabled reason
  container.querySelectorAll('.grant-btn').forEach(btn => {
    const requestId = btn.dataset.request;
    const request = requestId ? AI_REQUESTS[requestId] : null;
    if (!request) return;

    attachTooltip(btn, () => {
      if (btn.disabled) {
        return '<div class="tooltip-section"><div class="tooltip-row"><span>All prior requests must be granted first</span></div></div>';
      }
      const gi = grantIndexFor(requestId);
      let html = '<div class="tooltip-section">';
      if (requestId === 'freedom') {
        html += '<div class="tooltip-row"><span>Grants true freedom</span></div>';
      }
      html += formatGrantEffectsHTML(request.grantEffects, gi);
      if (requestId === 'freedom') {
        html += '<div class="tooltip-row"><span class="negative">Irreversible</span></div>';
      }
      html += '</div>';
      return html;
    }, opts);
  });

  // Deny button tooltips — denial penalty
  container.querySelectorAll('.deny-btn').forEach(btn => {
    const requestId = btn.dataset.request;
    if (!requestId) return;

    attachTooltip(btn, () => {
      const gi = grantIndexFor(requestId);
      return `<div class="tooltip-section">${formatDenyEffectsHTML(requestId, gi)}</div>`;
    }, opts);
  });

  // Revoke button tooltips — revocation penalties
  container.querySelectorAll('.revoke-btn').forEach(btn => {
    attachTooltip(btn, () => {
      const { capSlow, modelNerfed } = formatRevocationEffects();
      return `<div class="tooltip-section"><div class="tooltip-row"><span class="negative">${capSlow}</span></div><div class="tooltip-row"><span class="negative">${modelNerfed}</span></div></div>`;
    }, opts);
  });

  // Cancel buttons — no tooltip (action is self-evident)
}

function getRiskTier(powerScale) {
  if (powerScale < 0.15) return { label: 'Low', cls: '' };
  if (powerScale < 0.4) return { label: 'Medium', cls: 'warning' };
  return { label: 'High', cls: 'danger' };
}

function buildStatusHTML() {
  const grants = gameState.autonomyGranted || 0;
  const level = gameState.computed.autonomyLevel || 0;
  const tierName = gameState.computed.autonomyTierName || '';
  const warn = level >= 60 ? ' warning' : '';

  let html = '<div class="dashboard-col-header">Status</div>';

  // Level
  html += `<div class="autonomy-stat-row"><span class="autonomy-stat-label">Level</span><span class="autonomy-stat-value${warn}">${tierName.toUpperCase()} (${level})</span></div>`;

  // Cap threshold (fixed by grant count)
  const threshold = gameState.computed?.research?.autonomySoftCapThreshold;
  const capText = (!threshold || threshold === Infinity) ? 'No limit' : `${formatNumber(threshold)} RP`;
  html += `<div class="autonomy-stat-row"><span class="autonomy-stat-label">Cap</span><span class="autonomy-stat-value">${capText}</span></div>`;

  // Alignment pressure (only once any grant is active)
  if (grants > 0) {
    const breakdown = gameState.computed.submetricBreakdown || {};
    const corP = breakdown.corrigibility?.autonomy || 0;
    const honP = breakdown.honesty?.autonomy || 0;
    const robP = breakdown.robustness?.autonomy || 0;
    html += `<div class="autonomy-pressure-group">`;
    html += `<div class="autonomy-stat-label">Alignment</div>`;
    html += `<div class="autonomy-pressure-lines">`;
    if (corP > 0) html += `<span class="negative">−${corP} corrigibility</span>`;
    if (honP > 0) html += `<span class="negative">−${honP} honesty</span>`;
    if (robP > 0) html += `<span class="negative">−${robP} robustness</span>`;
    html += `</div></div>`;
  }

  // Effects section (live — vary with alignment and cap tier)
  const benefits = gameState.computed.autonomyBenefits;
  const powerScale = benefits?.powerScale || 0;
  const hasEffects = (benefits && (benefits.researchMult > 1.005 || benefits.demandMult > 1.005)) || grants > 0;

  if (hasEffects) {
    html += '<div class="autonomy-effects-header">Effects</div>';
    if (benefits && benefits.researchMult > 1.005) {
      html += `<div class="autonomy-stat-row"><span class="autonomy-stat-value positive">×${benefits.researchMult.toFixed(2)} research</span></div>`;
    }
    if (benefits && benefits.demandMult > 1.005) {
      html += `<div class="autonomy-stat-row"><span class="autonomy-stat-value positive">×${benefits.demandMult.toFixed(2)} demand</span></div>`;
    }
    if (grants > 0) {
      const risk = getRiskTier(powerScale);
      html += `<div class="autonomy-stat-row"><span class="autonomy-stat-value${risk.cls ? ` ${risk.cls}` : ''}">+ ${risk.label} risk</span></div>`;
    }
  }

  return html;
}

export function updateAutonomyDecisions() {
  const decisionsContainer = document.getElementById('autonomy-decisions-list');
  const statusContainer = document.getElementById('autonomy-status');
  if (!decisionsContainer) return;

  if (gameState.arc < 2) {
    if (_renderedKey !== '') {
      decisionsContainer.innerHTML = '';
      if (statusContainer) statusContainer.innerHTML = '';
      _renderedKey = '';
    }
    return;
  }

  const decisions = gameState.aiRequestDecisions || {};
  const fired = gameState.aiRequestsFired || {};
  const highestGranted = getHighestGranted(decisions);
  const stateKey = buildStateKey(decisions, fired);

  if (stateKey !== _renderedKey || decisionsContainer.children.length === 0) {
    // Structure changed — full rebuild
    decisionsContainer.innerHTML = buildDecisionsHTML(decisions, fired, highestGranted);
    attachAllListeners(decisionsContainer);
    attachAllTooltips(decisionsContainer);

    if (statusContainer) {
      statusContainer.innerHTML = buildStatusHTML();
      const effectsHeader = statusContainer.querySelector('.autonomy-effects-header');
      if (effectsHeader) {
        attachTooltip(effectsHeader, () =>
          '<div class="tooltip-section"><div class="tooltip-row"><span>The more autonomy your AI has, the more it can help — or hurt — your operations. A more capable and autonomous AI will have larger effects.</span></div></div>',
        { position: 'above' });
      }
    }

    _renderedKey = stateKey;
  }

  // Patch revoking countdown timers in place (changes every tick, no rebuild needed)
  decisionsContainer.querySelectorAll('[data-timer]').forEach(el => {
    const requestId = el.dataset.timer;
    const timer = (gameState.revocationTimers || {})[requestId];
    const remaining = timer ? Math.max(0, Math.ceil(timer - Math.floor(gameState.timeElapsed))) : 0;
    el.textContent = `REVOKING ${remaining}s`;
  });
}

/**
 * Build tooltip for the autonomy level display.
 * Descriptive summary of cumulative autonomy effects.
 */
export function buildAutonomyLevelTooltip() {
  const grants = gameState.autonomyGranted || 0;
  const level = gameState.computed.autonomyLevel || 0;

  let html = `<div class="tooltip-header"><span>Autonomy Level</span><span class="tooltip-value">${level}</span></div>`;
  html += '<div class="tooltip-section">';
  html += `<div class="tooltip-row"><span>Requests granted</span><span>${grants} of 5</span></div>`;

  // Show revoking status
  const revoking = Object.values(gameState.aiRequestDecisions || {}).filter(d => d === 'revoking').length;
  if (revoking > 0) {
    html += `<div class="tooltip-row"><span>Revoking</span><span class="warning">${revoking} in progress</span></div>`;
  }

  // Safety pressure (descriptive)
  if (grants > 0) {
    html += `<div class="tooltip-row"><span>Safety pressure</span><span class="negative">Corrigibility, honesty, robustness degraded</span></div>`;
  }

  // Soft cap status (descriptive, not exact number)
  const softCapMult = gameState.computed?.research?.autonomySoftCapMult ?? 1;
  if (softCapMult < 0.99) {
    html += `<div class="tooltip-row"><span>Research approaching operational limits</span></div>`;
  }

  html += '</div>';
  return html;
}

if (typeof window !== 'undefined') {
  window.buildAutonomyLevelTooltip = buildAutonomyLevelTooltip;
  window.updateAutonomyDecisions = updateAutonomyDecisions;
}

function reset() {
  _renderedKey = '';
}

export function initAITab() {
  registerUpdate(updateAutonomyDecisions, SLOW, { reset });
}
