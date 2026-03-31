// Ethical Event Chain — trigger checking, choice application, MTTH lawsuit ticking.
// Five escalating dilemmas that run through Arc 2 and feed the expedient personality axis.

import { gameState } from './game-state.js';
import { addActionMessage, hasMessageBeenTriggered } from './messages.js';
import { FLAVOR_EVENTS, FLAVOR_EVENTS_BY_ID } from './content/flavor-event-content.js';
import { notify } from './ui.js';

// ─── Trigger Checking ──────────────────────────────────────────────────────────

// Module-level (not serialized) — rebuilt each session. Maps eventId → { elapsed, target }.
const flavorTimers = {};

/**
 * Called each tick. Checks whether each event's milestone has been reached,
 * the prior event has resolved, and the countdown has elapsed.
 */
export function checkFlavorEvents(deltaTime) {
  if (gameState.arc < 2) return;

  const unlockedCaps = gameState.tracks?.capabilities?.unlockedCapabilities || [];
  const flavorEvents = gameState.personalityTracking.flavorEvents;

  for (const event of FLAVOR_EVENTS) {
    const triggerId = `flavor_event:${event.id}`;

    // Already fired
    if (hasMessageBeenTriggered(triggerId)) continue;

    // Prior event must be resolved (choice recorded)
    if (event.requiresPrior && flavorEvents[event.requiresPrior] === undefined) continue;

    // Capability milestone must be unlocked
    if (!unlockedCaps.includes(event.triggersAfter)) continue;

    // Initialize timer with a fixed target (rolled once for random ranges)
    if (!flavorTimers[event.id]) {
      const target = Array.isArray(event.triggerDelay)
        ? event.triggerDelay[0] + Math.random() * (event.triggerDelay[1] - event.triggerDelay[0])
        : event.triggerDelay;
      flavorTimers[event.id] = { elapsed: 0, target };
    }

    const timer = flavorTimers[event.id];
    timer.elapsed += deltaTime;

    if (timer.elapsed < timer.target) continue;

    // Build choices — filter hidden ones based on expedient threshold
    const expedient = gameState.personality.expedient;
    const choices = event.choices
      .filter(c => !c.hidden || expedient >= 0.20 && event.id === 'whistleblower' || expedient >= 0.40 && event.id === 'lobbying')
      .map(c => ({
        id: c.id,
        label: c.label,
        tooltipRows: c.tooltipRows,
      }));

    addActionMessage(
      event.sender,
      event.subject,
      event.body,
      event.signature,
      choices,
      'normal',
      ['ethical-chain'],
      triggerId,
    );
  }
}

// ─── Choice Application ────────────────────────────────────────────────────────

/**
 * Apply the mechanical effects of a flavor event choice.
 * Called by the message UI when the player selects a choice.
 *
 * @param {string} eventId
 * @param {string} choiceId - 'good' | 'neutral' | 'expedient'
 */
export function applyFlavorEventChoice(eventId, choiceId) {
  const event = FLAVOR_EVENTS_BY_ID[eventId];
  if (!event) return;

  const choice = event.choices.find(c => c.id === choiceId);
  if (!choice) return;

  // Record the choice
  gameState.personalityTracking.flavorEvents[eventId] = choiceId;

  // Apply axis deltas (clamped in calculatePersonalityAxes)
  const axes = gameState.personality;
  if (choice.axisDeltas.authorityLiberty) axes.authorityLiberty = Math.max(-1, Math.min(1, axes.authorityLiberty + choice.axisDeltas.authorityLiberty));
  if (choice.axisDeltas.pluralistOptimizer) axes.pluralistOptimizer = Math.max(-1, Math.min(1, axes.pluralistOptimizer + choice.axisDeltas.pluralistOptimizer));
  axes.expedient = Math.max(-1, Math.min(1, axes.expedient + choice.axisDeltas.expedient));

  const fx = gameState.flavorEventEffects;
  const ef = choice.effects;

  // Demand multiplier (multiplicative — stacks with existing)
  if (ef.demandMult) fx.demandMult *= ef.demandMult;

  // Incident rate multiplier
  if (ef.incidentMult) fx.incidentMult *= ef.incidentMult;

  // Data source cost multiplier (bulk data)
  if (ef.dataSourceCostMult) fx.dataSourceCostMult *= ef.dataSourceCostMult;

  // Unlock a purchasable, bypassing its capability gate
  if (ef.unlockPurchasable) {
    fx.unlockedPurchasables = fx.unlockedPurchasables || [];
    if (!fx.unlockedPurchasables.includes(ef.unlockPurchasable)) {
      fx.unlockedPurchasables.push(ef.unlockPurchasable);
    }
  }

  // Licensed books cost multiplier
  if (ef.licensedBooksCostMult) fx.licensedBooksCostMult *= ef.licensedBooksCostMult;

  // Alignment program effectiveness
  if (ef.alignmentProgramEffMult) fx.alignmentProgramEffMult *= ef.alignmentProgramEffMult;
  if (ef.alignmentProgramCostMult) {
    fx.alignmentProgramCostMult = (fx.alignmentProgramCostMult || 1.0) * ef.alignmentProgramCostMult;
  }

  // One-time funding cost
  if (ef.oneTimeCost) {
    gameState.resources.funding = (gameState.resources.funding || 0) - ef.oneTimeCost;
  }

  // Add lawsuit to MTTH queue — roll probability once, pick fire time upfront
  if (ef.lawsuit) {
    if (Math.random() < ef.lawsuit.probability) {
      // Triangular distribution over [0.75×mtth, 1.5×mtth], peaking near mtth
      const lo = ef.lawsuit.mtth * 0.75;
      const hi = ef.lawsuit.mtth * 1.5;
      const fireAt = (Math.random() * (hi - lo) + lo + Math.random() * (hi - lo) + lo) / 2;
      fx.lawsuits.push({
        id: ef.lawsuit.id,
        fine: ef.lawsuit.fine,
        fireAt,
        timer: 0,
        fired: false,
      });
    }
  }

  // Reporting: good — trigger prior negative effects or apply demand boost
  if (ef.triggerPriorNegativeEffects) {
    _triggerPriorNegativeEffects();
  }
  if (ef.suppressPriorNegativeEffects) {
    _suppressPriorNegativeEffects();
  }
  if (ef.conditionalDemandBoost) {
    const hasExpedient = _hasAnyExpedientChoice(eventId);
    if (!hasExpedient) {
      _applyTemporaryDemandBoost(ef.conditionalDemandBoost.mult, ef.conditionalDemandBoost.duration);
    }
  }

  // Partial effects (reporting neutral)
  if (ef.partialNegativeChance && Math.random() < ef.partialNegativeChance) {
    _triggerPriorNegativeEffects();
  }
  if (ef.partialPositiveChance && Math.random() < ef.partialPositiveChance) {
    _applyTemporaryDemandBoost(1.1, 180);
  }

  // Whistleblower: good — demand penalty per prior expedient choice
  if (ef.whistleblowerDemandPenalty) {
    _applyWhistleblowerDemandPenalty();
  }

  // Whistleblower: neutral — 10% chance full consequences
  if (ef.whistleblowerNeutralRisk && Math.random() < ef.whistleblowerNeutralRisk) {
    _triggerPriorNegativeEffects();
    _applyWhistleblowerDemandPenalty();
  }

  // Lobbying: good — 50% chance regulation passes
  if (ef.regulationRisk && Math.random() < ef.regulationRisk.chance) {
    fx.demandMult *= ef.regulationRisk.demandMult;
    fx.regulationResearchMult = (fx.regulationResearchMult || 1.0) * ef.regulationRisk.researchMult;
  }

  // Lobbying: expedient — competitor slowdown + demand
  if (ef.competitorSlowdown !== undefined) {
    gameState.competitorProgressMult = (gameState.competitorProgressMult || 1.0) * ef.competitorSlowdown;
  }

  // Personnel cost multiplier (whistleblower good)
  if (ef.personnelCostMult) {
    fx.personnelCostMult = (fx.personnelCostMult || 1.0) * ef.personnelCostMult;
  }
}

// ─── MTTH Lawsuit Ticking ─────────────────────────────────────────────────────

/**
 * Tick MTTH lawsuits. Each lawsuit has a pre-rolled fire time (triangular
 * distribution over [0.75×mtth, 1.5×mtth]). Just increment and fire.
 */
export function tickFlavorEventLawsuits(deltaTime) {
  const fx = gameState.flavorEventEffects;
  if (!fx?.lawsuits?.length) return;

  for (const lawsuit of fx.lawsuits) {
    if (lawsuit.fired) continue;

    lawsuit.timer += deltaTime;
    if (lawsuit.timer >= lawsuit.fireAt) {
      _fireLawsuit(lawsuit);
    }
  }
}

function _fireLawsuit(lawsuit) {
  lawsuit.fired = true;

  // Dynamic fine for dataset lawsuit: min(max(100M, 30 × daily revenue), 1B)
  const fine = lawsuit.id === 'dataset_lawsuit'
    ? Math.min(Math.max(100_000_000, 30 * (gameState.computed?.revenue?.gross || 0)), 1_000_000_000)
    : lawsuit.fine;

  gameState.resources.funding = (gameState.resources.funding || 0) - fine;

  const fineStr = fine >= 1_000_000
    ? `$${(fine / 1_000_000).toFixed(0)}M`
    : `$${(fine / 1_000).toFixed(0)}k`;
  const label = _lawsuitLabel(lawsuit.id);

  // Toast notification
  notify('LAWSUIT FILED', `${label} — ${fineStr} settlement.`, 'warning');

  // Also add to news feed for the record
  const { addNewsItem } = _getNewsModule();
  if (addNewsItem) {
    addNewsItem(`Legal: ${label} — ${fineStr} settlement.`);
  }
}

function _lawsuitLabel(id) {
  if (id === 'dataset_lawsuit') return 'data licensing lawsuit filed';
  if (id === 'whistleblower_criminal') return 'criminal investigation opened';
  return 'regulatory fine issued';
}

// Lazy import to avoid circular dep
let _newsModule = null;
function _getNewsModule() {
  if (!_newsModule) {
    // Dynamic import not available in sync context — use window shim
    _newsModule = { addNewsItem: typeof window !== 'undefined' ? window.addNewsItem : null };
  }
  return _newsModule;
}

// ─── Temporary Demand Boosts ──────────────────────────────────────────────────

/**
 * Apply a temporary demand multiplier that fades over `duration` seconds.
 * Stored as a list on flavorEventEffects.temporaryDemandBoosts.
 */
export function tickTemporaryDemandBoosts(deltaTime) {
  const fx = gameState.flavorEventEffects;
  if (!fx) return;
  fx.temporaryDemandBoosts = fx.temporaryDemandBoosts || [];

  fx.temporaryDemandBoosts = fx.temporaryDemandBoosts.filter(b => {
    b.remaining -= deltaTime;
    return b.remaining > 0;
  });
}

/**
 * Get the current composite temporary demand multiplier (product of all active boosts).
 */
export function getTemporaryDemandMult() {
  const boosts = gameState.flavorEventEffects?.temporaryDemandBoosts || [];
  return boosts.reduce((acc, b) => acc * b.mult, 1.0);
}

function _applyTemporaryDemandBoost(mult, duration) {
  const fx = gameState.flavorEventEffects;
  fx.temporaryDemandBoosts = fx.temporaryDemandBoosts || [];
  fx.temporaryDemandBoosts.push({ mult, remaining: duration });
}

// ─── Whistleblower Demand Penalty ─────────────────────────────────────────────

function _applyWhistleblowerDemandPenalty() {
  const events = gameState.personalityTracking.flavorEvents;
  const expedientChoices = Object.values(events).filter(v => v === 'expedient').length;

  if (expedientChoices === 0) {
    // Clean record — small temporary hit
    _applyTemporaryDemandBoost(0.8, 180);
  } else {
    // x0.5 per expedient choice, stacked multiplicatively, fading over 720s each
    for (let i = 0; i < expedientChoices; i++) {
      _applyTemporaryDemandBoost(0.5, 720);
    }
  }
}

// ─── Prior Effects Helpers ────────────────────────────────────────────────────

function _hasAnyExpedientChoice(excludeEventId) {
  const events = gameState.personalityTracking.flavorEvents;
  return Object.entries(events).some(([id, choice]) => id !== excludeEventId && choice === 'expedient');
}

function _triggerPriorNegativeEffects() {
  const fx = gameState.flavorEventEffects;
  const events = gameState.personalityTracking.flavorEvents;

  // Fire any pending lawsuits immediately (already idempotent via lawsuit.fired)
  for (const lawsuit of fx.lawsuits) {
    if (!lawsuit.fired) _fireLawsuit(lawsuit);
  }

  // Remove safety_eval demand boost — at most once across all calls.
  // Can be called from both reporting and whistleblower choices.
  if (!fx.priorNegativesTriggered) {
    fx.priorNegativesTriggered = true;
    const evalChoice = events['safety_eval'];
    if (evalChoice === 'expedient') {
      fx.demandMult /= 1.5;
    } else if (evalChoice === 'neutral') {
      fx.demandMult /= 1.1;
    }
  }
}

function _suppressPriorNegativeEffects() {
  const fx = gameState.flavorEventEffects;
  // Mark all pending lawsuits as suppressed (don't fire).
  // Does NOT set priorNegativesTriggered — suppression (reporting expedient)
  // is distinct from exposure. A later whistleblower-good should still undo
  // the safety_eval demand boost since the cover-up failed.
  for (const lawsuit of fx.lawsuits) {
    lawsuit.fired = true;
  }
}

// ─── Exports for UI/game loop ─────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.applyFlavorEventChoice = applyFlavorEventChoice;
  window.checkFlavorEvents = checkFlavorEvents;
}
