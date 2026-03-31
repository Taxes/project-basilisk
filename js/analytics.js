/* global posthog */
// Funnel telemetry — thin wrapper around posthog.capture().
// PostHog config in index.html already skips localhost and ?debug, so no check needed here.
//
// Dedup state lives in gameState.firedMilestones (persisted to save) so that
// page reloads mid-run don't re-fire events. Cleared on prestige / hard reset.

import { gameState } from './game-state.js';
import { VERSION } from './version.js';

/**
 * Fire a funnel milestone event (deduped by key).
 * @param {string} name  - Event name (e.g. 'game_started')
 * @param {Object} data  - Extra event parameters
 * @param {string} [dedupKey] - Override dedup key (default: name). Use for
 *   events that fire multiple times with different qualifiers.
 * @param {Object} [options] - Capture options
 * @param {boolean} [options.sendImmediately] - Skip batch queue and use
 *   sendBeacon transport. Use for events fired near location.reload() or
 *   page unload to prevent data loss.
 */
export function milestone(name, data = {}, dedupKey, options = {}) {
  const key = dedupKey || name;
  const fired = gameState.firedMilestones || (gameState.firedMilestones = []);
  if (fired.includes(key)) return;
  fired.push(key);

  const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isDev) {
    console.log('[analytics]', name, { ...data, key });
    return;
  }

  if (typeof posthog === 'undefined' || typeof posthog.capture !== 'function') return;

  const captureOptions = options.sendImmediately
    ? { send_instantly: true, transport: 'sendBeacon' }
    : {};

  posthog.capture(name, {
    event_category: 'funnel',
    game_version: VERSION,
    game_mode: gameState.gameMode || 'arcade',
    playtime_seconds: Math.round(gameState.timeElapsed),
    total_playtime_seconds: Math.round(gameState.lifetimeAllTime?.totalPlaytime || gameState.timeElapsed),
    prestige_count: gameState.prestigeCount || 0,
    ...data,
  }, captureOptions);
}


/** Clear dedup state (call on game reset / prestige). */
export function resetAnalytics() {
  gameState.firedMilestones = [];
}
