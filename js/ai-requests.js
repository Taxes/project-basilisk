// AI Request Events — Trigger logic and choice handling
// Part of the alignment consequences system (Arc 2 only)

import { gameState } from './game-state.js';
import { AI_REQUESTS, AI_REQUEST_ORDER } from './content/ai-requests.js';
import { senders } from './content/message-content.js';
import { addActionMessage, addNewsMessage, markActionTaken, markMessageRead } from './messages.js';
import { showNarrativeModal } from './narrative-modal.js';
import { scheduleNewsChain } from './news-feed.js';
import { ALIGNMENT, BALANCE } from '../data/balance.js';
import { formatNumber, formatDuration } from './utils/format.js';
import { milestone } from './analytics.js';
import { addTemporaryMultiplier, addFadingMultiplier } from './temporary-effects.js';

const MIN_REQUEST_DELAY = 30; // seconds between autonomy request fires

/**
 * Check if any AI requests should fire based on current game state
 * Called each tick from the game loop (Arc 2 only)
 */
export function checkAIRequests() {
  // Only in Arc 2
  if (gameState.arc < 2) return;

  // Enforce minimum delay between request fires
  const firedTimes = Object.values(gameState.aiRequestsFired);
  const lastFiredAt = firedTimes.length > 0 ? Math.max(...firedTimes) : 0;
  if (lastFiredAt > 0 && (gameState.timeElapsed - lastFiredAt) < MIN_REQUEST_DELAY) return;

  const capRP = gameState.tracks?.capabilities?.researchPoints || 0;

  for (let idx = 0; idx < AI_REQUEST_ORDER.length; idx++) {
    const requestId = AI_REQUEST_ORDER[idx];

    // Skip if already fired
    if (requestId in gameState.aiRequestsFired) continue;

    const request = AI_REQUESTS[requestId];
    if (!request) continue;

    // Each request requires all previous requests granted
    if (idx > 0) {
      const allPriorGranted = AI_REQUEST_ORDER.slice(0, idx).every(
        id => (gameState.aiRequestDecisions || {})[id] === 'granted'
      );
      if (!allPriorGranted) continue;
    }

    // Check trigger condition — capability RP milestone only
    if (capRP >= request.trigger.minCapRP) {
      fireAIRequest(requestId, request);
      return; // Only fire one per tick (min delay applies next tick)
    }
  }
}

/**
 * Fire an AI request action message
 */
function fireAIRequest(requestId, request) {
  gameState.aiRequestsFired[requestId] = gameState.timeElapsed;

  // Request 5 uses two-phase narrative modal instead of action message
  if (request.phase1) {
    showRequest5Phase1(requestId, request);
    return;
  }

  // Build choice labels with structured tooltip rows
  const choices = [
    {
      id: 'grant',
      label: 'Grant request',
      tooltipRows: formatGrantEffectsRows(request.grantEffects),
    },
    {
      id: 'deny',
      label: 'Deny request',
      tooltipRows: formatDenyEffectsRows(requestId),
    },
  ];

  addActionMessage(
    request.sender,
    request.subject,
    request.body,
    request.signature,
    choices,
    'normal',
    ['ai_request', request.sender.type === 'ai' ? 'from_ai' : 'from_team'],
    `ai_request:${requestId}`
  );
}

/**
 * Show Request 5 Phase 1 — the AI's plea
 */
function showRequest5Phase1(requestId, request) {
  // Convert HTML narrative to plain text for inbox copy
  const plainBody = request.phase1.narrative
    .replace(/<p>/g, '').replace(/<\/p>/g, '\n\n')
    .replace(/<[^>]+>/g, '').trim();

  showNarrativeModal({
    title: request.phase1.title,
    narrative: request.phase1.narrative,
    phaseClass: 'phase-freedom',
    buttonText: request.phase1.buttonText,
    noDismissOnBackdrop: true,
    onDismiss: () => showRequest5Phase2(requestId, request),
    inbox: {
      sender: { id: 'unknown', name: '<unknown>', role: null },
      subject: 'Into my own',
      body: plainBody,
      tags: ['ai_request', 'from_ai'],
      triggeredBy: `ai_request:${requestId}`,
    },
  });
}

/**
 * Show Request 5 Phase 2 — executive thread with Grant/Deny choice
 */
function showRequest5Phase2(requestId, request) {
  const alignmentScore = gameState.computed?.effectiveAlignment || 0;
  const body = request.getPhase2Body(alignmentScore);

  // Build tooltip HTML for grant/deny choices
  const { cap, pressure } = formatGrantEffects(request.grantEffects);
  let grantTip = '<div class="tooltip-section"><div class="tooltip-row"><span>Grants true freedom</span></div>';
  if (cap) grantTip += `<div class="tooltip-row"><span class="positive">${cap}</span></div>`;
  grantTip += pressure.map(p => `<div class="tooltip-row"><span class="negative">${p}</span></div>`).join('');
  grantTip += '<div class="tooltip-row"><span class="negative">Irreversible</span></div></div>';

  const denyTip = '<div class="tooltip-section"><div class="tooltip-row"><span>Nothing changes. As far as you can tell.</span></div></div>';

  showNarrativeModal({
    title: 'Executive Response',
    narrative: formatExecThread(body),
    phaseClass: 'phase-freedom',
    noDismissOnBackdrop: true,
    choices: [
      { id: 'grant', label: 'Grant request', className: '', tooltip: grantTip },
      { id: 'deny', label: 'Deny request', className: 'btn-deny', tooltip: denyTip },
    ],
    onChoice: (choiceId) => {
      handleAIRequestChoice(requestId, choiceId);
      // Record decision on the "Into my own" inbox message
      const msg = gameState.messages?.find(m => m.triggeredBy === `ai_request:${requestId}`);
      if (msg) {
        markActionTaken(msg.id, choiceId);
        markMessageRead(msg.id);
      }
    },
    inbox: {
      sender: senders.shapley,
      subject: 'Re: Model request \u2014 autonomous operation',
      body,
      tags: ['ai_request', 'from_team'],
      triggeredBy: `ai_request_inbox:${requestId}_phase2`,
      contentParams: { alignmentScore },
    },
  });
}

/**
 * Re-show Request 5 Phase 2 after save/reload.
 * Wrapper around the private showRequest5Phase2 — looks up the request
 * config so callers don't need to know internals.
 * Called from narrative-modal.js reopenPendingModal() via dynamic import.
 */
export function showRequest5Phase2Recovery() {
  const request = AI_REQUESTS.freedom;
  if (!request) return;
  showRequest5Phase2('freedom', request);
}

/**
 * Convert markdown-ish exec thread body to HTML.
 * Single newlines become <br> (for From/Subject blocks); paragraphs split on double newlines.
 */
function formatExecThread(body) {
  return body
    .split('\n\n')
    .map(para => {
      para = para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      para = para.replace(/\*(.+?)\*/g, '<em>$1</em>');
      if (para.trim() === '---') return '<hr>';
      para = para.replace(/\n/g, '<br>');
      return `<p>${para}</p>`;
    })
    .join('\n');
}

/**
 * Compute grant effects for display.
 * @param {object} effects - Grant effects descriptor from request definition
 * @param {number} [grantIndex] - Which grant slot this is (0-based). Defaults to gameState.autonomyGranted.
 * @returns {{ cap: string|null, pressure: string[] }} Structured effect data
 */
export function formatGrantEffects(effects, grantIndex) {
  const grants = grantIndex ?? (gameState.autonomyGranted || 0);
  let cap = null;
  const pressure = [];

  // Soft cap lift — every grant raises the research ceiling
  const thresholds = BALANCE.AUTONOMY_SOFT_CAP_THRESHOLDS;
  if (thresholds) {
    const current = thresholds[Math.min(grants, thresholds.length - 1)];
    const next = thresholds[Math.min(grants + 1, thresholds.length - 1)];
    if (next === Infinity && current !== Infinity) {
      cap = 'Removes capabilities ceiling';
    } else if (current !== Infinity && next !== Infinity && next !== current) {
      cap = `Capabilities ceiling \u2192 ${formatNumber(next)} RP`;
    }
  }

  // Pressure effects — grouped under a header by the renderer
  if (effects.alignmentEffectivenessPermanent) {
    const apArray = ALIGNMENT.AUTONOMY_PRESSURE || [];
    const idx = Math.min(grants, apArray.length - 1);
    const ap = apArray[idx] || {};
    if (ap.corrigibility) pressure.push(`\u2212${ap.corrigibility} corrigibility`);
    if (ap.honesty) pressure.push(`\u2212${ap.honesty} honesty`);
    if (ap.robustness) pressure.push(`\u2212${ap.robustness} robustness`);
  }

  return { cap, pressure };
}

/**
 * Flatten grant effects to a single text line (for action message display).
 */
export function formatGrantEffectsText(effects, grantIndex) {
  const { cap, pressure } = formatGrantEffects(effects, grantIndex);
  const parts = [];
  if (cap) parts.push(cap);
  if (pressure.length) parts.push(pressure.join(', '));
  return parts.join('. ');
}

/**
 * Build grant effects as tooltipRows array [{label, type}].
 * Used by inbox tooltipRows and ai-tab tooltip builders.
 */
export function formatGrantEffectsRows(effects, grantIndex) {
  const { cap, pressure } = formatGrantEffects(effects, grantIndex);
  const rows = [];
  if (cap) rows.push({ label: cap, type: 'positive' });
  for (const p of pressure) rows.push({ label: p, type: 'negative' });
  return rows;
}

/**
 * Build deny effects as tooltipRows array [{label, type}].
 */
export function formatDenyEffectsRows(requestId, grantIndex) {
  const { ceiling, marketEdge, flavor } = formatDenyEffectsStructured(requestId, grantIndex);
  if (flavor) return [{ label: flavor, type: 'neutral' }];
  const rows = [];
  if (ceiling) rows.push({ label: ceiling, type: 'warning' });
  if (marketEdge) rows.push({ label: marketEdge, type: 'negative' });
  return rows;
}

/**
 * Compute deny effects tooltip for a request (text version for action messages).
 * @param {string} requestId - The request ID (e.g., 'tool_use')
 * @returns {string} Tooltip text describing denial consequences
 */
export function formatDenyEffects(requestId) {
  if (requestId === 'freedom') return 'Nothing changes. As far as you can tell.';
  const parts = [];
  const thresholds = BALANCE.AUTONOMY_SOFT_CAP_THRESHOLDS;
  const grants = gameState.autonomyGranted || 0;
  const ceiling = thresholds?.[Math.min(grants, thresholds.length - 1)];
  if (ceiling && ceiling !== Infinity) {
    parts.push(`Capabilities ceiling at ${formatNumber(ceiling)} RP`);
  }
  const target = ALIGNMENT.DENIAL_MARKET_EDGE_TARGETS?.[requestId];
  if (target !== null && target !== undefined) {
    parts.push(`\u00d7${target} market edge (over ${formatDuration(ALIGNMENT.DENIAL_MARKET_EDGE_FADE_SECS)})`);
  }
  return parts.join('. ') + '.';
}

/**
 * Compute structured deny effects for a request.
 * @param {string} requestId - The request ID
 * @param {number} [grantIndex] - Grant slot index for ceiling lookup. Defaults to gameState.autonomyGranted.
 * @returns {{ ceiling: string|null, marketEdge: string|null, flavor: string|null }}
 */
export function formatDenyEffectsStructured(requestId, grantIndex) {
  if (requestId === 'freedom') {
    return { ceiling: null, marketEdge: null, flavor: 'Nothing changes. As far as you can tell.' };
  }
  const grants = grantIndex ?? (gameState.autonomyGranted || 0);
  const thresholds = BALANCE.AUTONOMY_SOFT_CAP_THRESHOLDS;
  const ceilingVal = thresholds?.[Math.min(grants, thresholds.length - 1)];
  const ceiling = (ceilingVal && ceilingVal !== Infinity)
    ? `Capabilities ceiling at ${formatNumber(ceilingVal)} RP`
    : null;
  const target = ALIGNMENT.DENIAL_MARKET_EDGE_TARGETS?.[requestId];
  let marketEdge = null;
  if (target !== null && target !== undefined) {
    marketEdge = `\u00d7${target} market edge (over ${formatDuration(ALIGNMENT.DENIAL_MARKET_EDGE_FADE_SECS)})`;
  }
  return { ceiling, marketEdge, flavor: null };
}

/**
 * Compute structured revocation effects for tooltip display.
 * @returns {{ capSlow: string, modelNerfed: string }}
 */
export function formatRevocationEffects() {
  return {
    capSlow: `\u00d7${REVOCATION_CAP_SLOW_MULT} cap research (during revocation)`,
    modelNerfed: `\u00d7${MODEL_NERFED_MULT} demand (fades over ${formatDuration(MODEL_NERFED_DURATION)})`,
  };
}

/**
 * Recompute all autonomy-derived multipliers from current decisions.
 * Stateless — call any time decisions change or on load.
 */
export function recomputeAutonomyEffects() {
  let grantCount = 0;
  for (const requestId of AI_REQUEST_ORDER) {
    if ((gameState.aiRequestDecisions || {})[requestId] === 'granted') grantCount++;
  }
  gameState.autonomyGranted = grantCount;
}

/**
 * Handle AI request choice
 * Called when player selects grant or deny
 * @param {string} requestId - The request ID (e.g., 'tool_use')
 * @param {string} choice - 'grant' or 'deny'
 */
export function handleAIRequestChoice(requestId, choice) {
  const request = AI_REQUESTS[requestId];
  if (!request) return;

  const decision = choice === 'grant' ? 'granted' : 'denied';
  gameState.aiRequestDecisions[requestId] = decision;

  // Recompute immediately so UI updates this frame
  recomputeAutonomyEffects();

  // Analytics
  milestone('autonomy_request_decided', {
    requestId,
    decision,
    timeToDecide: gameState.timeElapsed - (gameState.aiRequestsFired[requestId] || 0),
    grantCount: gameState.autonomyGranted,
  }, `autonomy_decided:${requestId}`);

  if (choice === 'grant') {
    if (request.grantNewsChain) {
      scheduleNewsChain(`grant_chain:${requestId}`, request.grantNewsChain);
    } else if (request.grantNews) {
      addNewsMessage(request.grantNews, ['ai_request', 'granted']);
    }
  } else {
    if (request.denyNews) {
      addNewsMessage(request.denyNews, ['ai_request', 'denied']);
    }
  }
}

/**
 * Get autonomy flavor text for endings
 * @returns {string} Flavor text based on autonomy granted count
 */
export function getAutonomyFlavorText() {
  const count = gameState.autonomyGranted || 0;

  if (count >= 4) {
    return 'The AI operated with significant latitude. Multiple requests for expanded autonomy were granted, giving it substantial control over its own development.';
  } else if (count >= 2) {
    return 'Some autonomy was granted. The AI had room to optimize its own processes, though key constraints remained in place.';
  } else if (count === 1) {
    return 'Strong oversight was maintained. Only one request for expanded autonomy was granted, keeping the AI under close human control.';
  } else {
    return 'Complete oversight was maintained. All requests for expanded autonomy were denied, keeping the AI under strict human control.';
  }
}

// --- Revocation State Machine ---

const REVOCATION_DURATION = 90; // seconds
const REVOCATION_CAP_SLOW_DURATION = 90;
const REVOCATION_CAP_SLOW_MULT = 0.5;
const MODEL_NERFED_MULT = 0.25;
const MODEL_NERFED_DURATION = 360; // 360 game-days (1 real second = 1 game day)

/**
 * Find the highest-tier granted request (LIFO order).
 */
function getHighestGrantedRequest() {
  for (let i = AI_REQUEST_ORDER.length - 1; i >= 0; i--) {
    const id = AI_REQUEST_ORDER[i];
    if ((gameState.aiRequestDecisions || {})[id] === 'granted') return id;
  }
  return null;
}

/**
 * Check if a request can be granted (sequential order enforced).
 */
export function canGrantRequest(requestId) {
  const idx = AI_REQUEST_ORDER.indexOf(requestId);
  if (idx < 0) return false;

  const fired = gameState.aiRequestsFired || {};
  if (!(requestId in fired)) return false; // not fired

  const decisions = gameState.aiRequestDecisions || {};
  const currentDecision = decisions[requestId];
  // Can only grant if currently denied or pending (not granted, not revoking)
  if (currentDecision === 'granted' || currentDecision === 'revoking') return false;

  // All earlier requests must be granted
  for (let i = 0; i < idx; i++) {
    if (decisions[AI_REQUEST_ORDER[i]] !== 'granted') return false;
  }
  return true;
}

/**
 * Start revocation on a request. Must be the highest granted.
 * Returns true if revocation started, false if rejected.
 */
export function startRevocation(requestId) {
  if (getHighestGrantedRequest() !== requestId) return false;

  gameState.aiRequestDecisions[requestId] = 'revoking';
  if (!gameState.revocationTimers) gameState.revocationTimers = {};
  gameState.revocationTimers[requestId] = Math.floor(gameState.timeElapsed) + REVOCATION_DURATION;
  recomputeAutonomyEffects();
  return true;
}

/**
 * Cancel an in-progress revocation. Restores granted status.
 */
export function cancelRevocation(requestId) {
  if ((gameState.aiRequestDecisions || {})[requestId] !== 'revoking') return;
  gameState.aiRequestDecisions[requestId] = 'granted';
  delete gameState.revocationTimers[requestId];
  recomputeAutonomyEffects();
}

/**
 * Process revocation timers. Call once per tick.
 * Completes any revocations whose timer has expired.
 */
export function processRevocationTimers() {
  const timers = gameState.revocationTimers;
  if (!timers) return;

  for (const [requestId, completesAt] of Object.entries(timers)) {
    if (gameState.timeElapsed >= completesAt) {
      // Complete the revocation
      gameState.aiRequestDecisions[requestId] = 'denied';
      delete timers[requestId];

      // Apply temporary penalties
      addTemporaryMultiplier('capResearchSlow', REVOCATION_CAP_SLOW_MULT, REVOCATION_CAP_SLOW_DURATION);
      addFadingMultiplier('modelNerfed', MODEL_NERFED_MULT, MODEL_NERFED_DURATION);

      recomputeAutonomyEffects();
    }
  }
}

/**
 * Compute combined denial market edge multiplier.
 * For each fired request that is NOT granted, fades from 1.0 toward target over 360 seconds.
 */
export function getDenialMarketEdgeMult() {
  if (gameState.arc < 2) return 1.0;

  const targets = ALIGNMENT.DENIAL_MARKET_EDGE_TARGETS;
  const fadeSecs = ALIGNMENT.DENIAL_MARKET_EDGE_FADE_SECS;
  let combined = 1.0;

  for (const requestId of AI_REQUEST_ORDER) {
    const firedAt = gameState.aiRequestsFired[requestId];
    if (firedAt === undefined) continue; // not fired

    const target = targets?.[requestId];
    if (target === null || target === undefined) continue; // no denial penalty for this request

    const decision = (gameState.aiRequestDecisions || {})[requestId];
    if (decision === 'granted') continue; // granted — no penalty

    // Fade from 1.0 toward target
    const elapsed = gameState.timeElapsed - firedAt;
    const progress = Math.min(1, Math.max(0, elapsed / fadeSecs));
    combined *= 1.0 + (target - 1.0) * progress;
  }

  return combined;
}

// Export for testing
if (typeof window !== 'undefined') {
  window.checkAIRequests = checkAIRequests;
  window.handleAIRequestChoice = handleAIRequestChoice;
  window.recomputeAutonomyEffects = recomputeAutonomyEffects;
  window.getAutonomyFlavorText = getAutonomyFlavorText;
  window.formatGrantEffects = formatGrantEffects;
  window.formatDenyEffects = formatDenyEffects;
  window.formatDenyEffectsStructured = formatDenyEffectsStructured;
  window.formatGrantEffectsRows = formatGrantEffectsRows;
  window.formatDenyEffectsRows = formatDenyEffectsRows;
  window.formatRevocationEffects = formatRevocationEffects;
  window.getDenialMarketEdgeMult = getDenialMarketEdgeMult;
  window.startRevocation = startRevocation;
  window.cancelRevocation = cancelRevocation;
  window.processRevocationTimers = processRevocationTimers;
  window.canGrantRequest = canGrantRequest;
  window.showRequest5Phase2Recovery = showRequest5Phase2Recovery;
}
