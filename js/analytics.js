/* global gtag */
// Funnel telemetry — thin wrapper around gtag().
// GA config in index.html already skips localhost and ?debug, so no check needed here.

import { gameState } from './game-state.js';

const firedEvents = new Set();

/**
 * Fire a funnel milestone event (deduped by key).
 * @param {string} name  - GA event name (e.g. 'game_started')
 * @param {Object} data  - Extra event parameters
 * @param {string} [dedupKey] - Override dedup key (default: name). Use for
 *   events that fire multiple times with different qualifiers.
 */
export function milestone(name, data = {}, dedupKey) {
  const key = dedupKey || name;
  if (firedEvents.has(key)) return;
  firedEvents.add(key);

  if (typeof gtag === 'undefined') return;

  gtag('event', name, {
    event_category: 'funnel',
    playtime_seconds: Math.round(gameState.timeElapsed),
    ...data,
  });
}

/** Clear dedup state (call on game reset / prestige). */
export function resetAnalytics() {
  firedEvents.clear();
}
