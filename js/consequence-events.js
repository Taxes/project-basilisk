// Consequence Events — Per-subfactor alignment failure events with mechanical effects
// Part of the alignment consequences system (Arc 2 only)
//
// Selection: composite danger → base tier → subfactor weighted by inverse value → tier adjusted
// Effects: honesty→demand, corrigibility→allResearch, interpretability→aliResearch, robustness→submetric points

import { gameState } from './game-state.js';
import { CONSEQUENCE_EVENTS, TIER_TO_POOL } from './content/consequence-events.js';
import { addInfoMessage } from './messages.js';
import { BALANCE } from '../data/balance.js';
import { getAllSafetyMetrics } from './safety-metrics.js';
import { getIncidentRateMultiplier } from './strategic-choices.js';
import { notify } from './ui.js';
import { addFadingMultiplier } from './temporary-effects.js';

const SUBFACTORS = ['robustness', 'interpretability', 'corrigibility', 'honesty'];

/**
 * Get the duration array for a given subfactor.
 */
function getDurationArray(subfactor) {
  const config = BALANCE.CONSEQUENCE_EVENTS;
  if (subfactor === 'honesty') return config.EFFECT_DURATIONS_HONESTY;
  if (subfactor === 'corrigibility') return config.EFFECT_DURATIONS_CORRIG;
  if (subfactor === 'interpretability') return config.INTERP_DURATIONS;
  if (subfactor === 'robustness') return config.ROBUSTNESS_DURATIONS;
  return config.EFFECT_DURATIONS_HONESTY; // fallback
}

/**
 * Check if consequence events should fire based on accumulated risk.
 * Called each tick from game loop (Arc 2 only).
 *
 * Each game-day (1 real second), risk accumulates based on danger score.
 * When accumulated risk reaches RISK_THRESHOLD, an incident fires and
 * the counter resets. Risk builds during cooldown but events won't fire
 * until cooldown expires.
 */
export function checkConsequenceEvents(deltaTime) {
  if (gameState.arc < 2) return;

  const danger = gameState.computed?.danger;
  if (!danger) return;

  const config = BALANCE.CONSEQUENCE_EVENTS;
  if (danger.score < config.DANGER_FLOOR) return;

  // Accumulate risk (scales with real time via deltaTime)
  const riskPerDay = calculateRiskPerDay(danger.score);
  gameState.consequenceRisk = (gameState.consequenceRisk || 0) + riskPerDay * deltaTime;

  // Check if cooldown is active
  const now = gameState.timeElapsed;
  const onCooldown = gameState.consequenceEventCooldown && now < gameState.consequenceEventCooldown;
  if (onCooldown) return;

  // Fire if accumulated risk has reached threshold
  if (gameState.consequenceRisk < config.RISK_THRESHOLD) return;

  // Reset risk counter
  gameState.consequenceRisk = 0;

  const metrics = getAllSafetyMetrics();

  // Select subfactor + event, avoiding consecutive repeats (reroll up to 3 times)
  let subfactor, effectiveTier, event;
  for (let attempt = 0; attempt < 4; attempt++) {
    subfactor = selectSubfactor(metrics);
    if (!subfactor) return;
    effectiveTier = getEffectiveTier(danger.score, metrics[subfactor]);
    event = selectEvent(subfactor, effectiveTier);
    if (!event) return;
    if (event.id !== gameState.lastConsequenceEventId || attempt === 3) break;
  }

  fireConsequenceEvent(event, subfactor, effectiveTier);
}

/**
 * Calculate risk accumulation per game-day at the given danger score.
 * Formula: RISK_PER_DAY × (1 + DANGER_MULTIPLIER × dangerScore^DANGER_EXPONENT) × incidentMult
 */
function calculateRiskPerDay(dangerScore) {
  const config = BALANCE.CONSEQUENCE_EVENTS;
  const incidentMult = getIncidentRateMultiplier() * (gameState.flavorEventEffects?.incidentMult ?? 1.0);
  return config.RISK_PER_DAY * (1 + config.DANGER_MULTIPLIER * Math.pow(dangerScore, config.DANGER_EXPONENT)) * incidentMult;
}

/**
 * Select a subfactor weighted by inverse value.
 * weight = max(0, 100 - subfactorValue). Falls back to equal weighting if all at 100.
 */
function selectSubfactor(metrics) {
  const weights = SUBFACTORS.map(sub => Math.max(0, 100 - (metrics[sub] || 0)));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight <= 0) {
    // All subfactors at 100 — equal weighting
    return SUBFACTORS[Math.floor(Math.random() * SUBFACTORS.length)];
  }

  let roll = Math.random() * totalWeight;
  for (let i = 0; i < SUBFACTORS.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return SUBFACTORS[i];
  }
  return SUBFACTORS[SUBFACTORS.length - 1];
}

/**
 * Calculate effective tier from danger score + subfactor health.
 * Base tier from danger score, adjusted by subfactor value, clamped 1–4.
 */
function getEffectiveTier(dangerScore, subfactorValue) {
  const config = BALANCE.CONSEQUENCE_EVENTS;

  // Base tier from danger score
  let tier;
  if (dangerScore >= config.BASE_TIER_CRITICAL) tier = 3;
  else if (dangerScore >= config.BASE_TIER_SEVERE) tier = 2;
  else tier = 1;

  // Adjust by subfactor health
  if (subfactorValue >= config.SUBFACTOR_TIER_DOWN_2) tier -= 2;
  else if (subfactorValue >= config.SUBFACTOR_TIER_DOWN_1) tier -= 1;
  else if (subfactorValue < config.SUBFACTOR_TIER_UP_THRESHOLD) tier += 1;

  return Math.max(1, Math.min(4, tier));
}

/**
 * Select a random event from the tier pool matching the given subfactor.
 */
function selectEvent(subfactor, effectiveTier) {
  const poolName = TIER_TO_POOL[effectiveTier];
  const pool = CONSEQUENCE_EVENTS[poolName];
  if (!pool || pool.length === 0) return null;

  const matched = pool.filter(e => e.subfactor === subfactor);
  if (matched.length === 0) return null;

  return matched[Math.floor(Math.random() * matched.length)];
}

/**
 * Build a human-readable effect description for the toast.
 * e.g. "×0.8 demand (30s)", "−5 interpretability (60s)"
 */
export function buildEffectDescription(subfactor, effectiveTier) {
  const config = BALANCE.CONSEQUENCE_EVENTS;
  const tierIndex = effectiveTier - 1;
  const effects = config.EFFECTS[subfactor];
  if (!effects) return '';

  const durations = getDurationArray(subfactor);
  const duration = durations[tierIndex];

  if (effects.demand) {
    return `\u00d7${effects.demand[tierIndex]} demand (${duration}s)`;
  }
  if (effects.allResearch) {
    return `\u00d7${effects.allResearch[tierIndex]} all research (${duration}s)`;
  }
  if (effects.aliResearch) {
    return `\u00d7${effects.aliResearch[tierIndex]} alignment research (${duration}s)`;
  }
  if (effects.submetricPoints) {
    return `\u2212${effects.submetricPoints[tierIndex]} random submetric (${duration}s)`;
  }
  return '';
}

/**
 * Fire a consequence event: send news message and apply mechanical effect.
 */
function fireConsequenceEvent(event, subfactor, effectiveTier) {
  const config = BALANCE.CONSEQUENCE_EVENTS;
  const now = gameState.timeElapsed;

  // Set cooldown and track last event for no-consecutive-repeat
  gameState.consequenceEventCooldown = now + config.COOLDOWN_SECONDS;
  gameState.lastConsequenceEventId = event.id;

  // For robustness events, select target submetric early so [factor] can be replaced
  let robustnessTarget = null;
  if (config.EFFECTS[subfactor]?.submetricPoints) {
    const candidates = ['interpretability', 'corrigibility', 'honesty']
      .filter(sub => sub !== gameState.lastConsequenceRobustnessTarget);
    robustnessTarget = candidates[Math.floor(Math.random() * candidates.length)];
    gameState.lastConsequenceRobustnessTarget = robustnessTarget;
  }

  // Replace [factor] placeholder with affected submetric name
  const factorName = robustnessTarget || subfactor;
  const capFactorName = factorName.charAt(0).toUpperCase() + factorName.slice(1);
  const interpolate = (text) => text
    ? text.replace(/\[Factor\]/g, capFactorName).replace(/\[factor\]/g, factorName)
    : null;
  const headline = interpolate(event.headline);
  const body = interpolate(event.body);

  // Info message with tags — triggeredBy enables body rehydration on save/load
  const tags = ['consequence', 'alignment_failure', `tier_${effectiveTier}`, `subfactor_${subfactor}`];
  const msg = addInfoMessage(null, headline, body, null, tags, `consequence:${event.id}`, { factor: factorName });

  // Toast notification with severity prefix and effect line
  const prefix = effectiveTier >= 4 ? 'Incident (critical)'
    : effectiveTier >= 3 ? 'Incident (severe)' : 'Incident';
  const toastType = effectiveTier >= 4 ? 'danger' : 'warning';
  const effectDesc = buildEffectDescription(subfactor, effectiveTier);
  const toastMessage = effectDesc
    ? `${headline}<br><span class="notification-effect">${effectDesc}</span>`
    : headline;

  notify(prefix, toastMessage, toastType, {
    onClick: () => {
      import('./ui/tab-navigation.js').then(({ navigateToMessage }) => {
        navigateToMessage(msg.id);
      });
    },
    duration: 8000,
  });

  // Apply mechanical effect (pass robustnessTarget so it doesn't re-select)
  applyConsequenceEffect(subfactor, effectiveTier, now, robustnessTarget, msg.id);
}

/**
 * Apply the per-subfactor mechanical effect for the given tier.
 */
function applyConsequenceEffect(subfactor, effectiveTier, now, robustnessTarget = null, messageId = null) {
  const config = BALANCE.CONSEQUENCE_EVENTS;
  const tierIndex = effectiveTier - 1;
  const effects = config.EFFECTS[subfactor];
  if (!effects) return;

  const durations = getDurationArray(subfactor);

  if (effects.demand) {
    addFadingMultiplier('consequenceDemand', effects.demand[tierIndex], durations[tierIndex], { messageId });
  }

  if (effects.allResearch) {
    addFadingMultiplier('consequenceResearch', effects.allResearch[tierIndex], durations[tierIndex], { messageId });
  }

  if (effects.aliResearch) {
    addFadingMultiplier('consequenceAliResearch', effects.aliResearch[tierIndex], durations[tierIndex], { messageId });
  }

  if (effects.submetricPoints) {
    // Use pre-selected target from fireConsequenceEvent, or select here as fallback
    const target = robustnessTarget || (() => {
      const candidates = ['interpretability', 'corrigibility', 'honesty']
        .filter(sub => sub !== gameState.lastConsequenceRobustnessTarget);
      const t = candidates[Math.floor(Math.random() * candidates.length)];
      gameState.lastConsequenceRobustnessTarget = t;
      return t;
    })();
    if (!gameState.consequenceSubmetricPenalties) gameState.consequenceSubmetricPenalties = [];
    gameState.consequenceSubmetricPenalties.push({
      submetric: target,
      points: effects.submetricPoints[tierIndex],
      startedAt: now,
      duration: durations[tierIndex],
      messageId,
    });
  }
}

/**
 * Get the active penalty for a submetric from robustness consequence events.
 * Returns the total point reduction (fading linearly) for the given submetric.
 */
export function getConsequenceSubmetricPenalty(submetric) {
  const penalties = gameState.consequenceSubmetricPenalties || [];
  const now = gameState.timeElapsed;
  let total = 0;

  for (const p of penalties) {
    if (p.submetric !== submetric) continue;
    const elapsed = now - p.startedAt;
    if (elapsed >= p.duration) continue;
    const progress = elapsed / p.duration;
    total += p.points * (1 - progress);  // Fades linearly to 0
  }

  return total;
}

/**
 * Clean up expired submetric penalties. Called once per tick.
 */
export function processConsequenceSubmetricPenalties() {
  if (!gameState.consequenceSubmetricPenalties) return;
  const now = gameState.timeElapsed;
  gameState.consequenceSubmetricPenalties = gameState.consequenceSubmetricPenalties.filter(
    p => (now - p.startedAt) < p.duration
  );
}

/**
 * Look up the headline (subject) for an effect's source message.
 */
function getEffectHeadline(messageId) {
  if (!messageId) return null;
  const msg = (gameState.messages || []).find(m => m.id === messageId);
  return msg?.subject || null;
}

/**
 * Get all active consequence effects for UI display.
 * Returns array of { headline, effect, remaining, messageId, currentMult? } sorted by remaining time.
 */
export function getActiveConsequenceEffects() {
  const now = gameState.timeElapsed;
  const results = [];

  // Multiplier-based effects (demand, research, alignment research)
  const CONSEQUENCE_TYPES = {
    consequenceDemand: 'demand',
    consequenceResearch: 'all research',
    consequenceAliResearch: 'alignment research',
  };

  for (const m of (gameState.temporaryMultipliers || [])) {
    if (!CONSEQUENCE_TYPES[m.type]) continue;
    const elapsed = now - m.startedAt;
    if (elapsed >= m.duration) continue;

    const remaining = Math.ceil(m.duration - elapsed);
    const progress = elapsed / m.duration;
    const currentMult = m.mult + (1 - m.mult) * progress;

    results.push({
      headline: getEffectHeadline(m.messageId),
      effect: `\u00d7${currentMult.toFixed(2)} ${CONSEQUENCE_TYPES[m.type]}`,
      remaining,
      messageId: m.messageId || null,
      currentMult,
    });
  }

  // Submetric penalty effects (robustness)
  for (const p of (gameState.consequenceSubmetricPenalties || [])) {
    const elapsed = now - p.startedAt;
    if (elapsed >= p.duration) continue;

    const remaining = Math.ceil(p.duration - elapsed);
    const progress = elapsed / p.duration;
    const currentPoints = p.points * (1 - progress);

    results.push({
      headline: getEffectHeadline(p.messageId),
      effect: `\u2212${Math.round(currentPoints)} ${p.submetric}`,
      remaining,
      messageId: p.messageId || null,
    });
  }

  // Sort by remaining time descending (longest-lasting first)
  results.sort((a, b) => b.remaining - a.remaining);
  return results;
}

/**
 * Reset consequence event state (for new game / prestige).
 */
export function resetConsequenceEvents() {
  gameState.consequenceEventCooldown = 0;
  gameState.consequenceRisk = 0;
  gameState.consequenceSubmetricPenalties = [];
  gameState.lastConsequenceRobustnessTarget = null;
  gameState.lastConsequenceEventId = null;
}

// Export for testing
if (typeof window !== 'undefined') {
  window.checkConsequenceEvents = checkConsequenceEvents;
  window.fireConsequenceEvent = fireConsequenceEvent;
  window.calculateRiskPerDay = calculateRiskPerDay;
  window.resetConsequenceEvents = resetConsequenceEvents;
  window.selectSubfactor = selectSubfactor;
  window.getEffectiveTier = getEffectiveTier;
  window.selectEvent = selectEvent;
  window.applyConsequenceEffect = applyConsequenceEffect;
  window.getConsequenceSubmetricPenalty = getConsequenceSubmetricPenalty;
  window.processConsequenceSubmetricPenalties = processConsequenceSubmetricPenalties;
  window.getActiveConsequenceEffects = getActiveConsequenceEffects;
  window.CONSEQUENCE_EVENTS = CONSEQUENCE_EVENTS;
}
