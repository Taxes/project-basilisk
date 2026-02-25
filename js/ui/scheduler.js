// js/ui/scheduler.js
// Tiered update scheduler for UI modules.
//
// Tiers are defined by tick interval — how many game ticks between
// invocations. At 30 ticks/sec:
//   EVERY_TICK (1)  = 30/sec — core "numbers go up" displays
//   FAST (8)        = ~4/sec — secondary displays, token economics
//   SLOW (30)       = ~1/sec — structural rebuilds, affordability
//
// Modules self-register via registerUpdate(). The scheduler runs
// registered functions based on a tick counter in runScheduledUpdates().

export const EVERY_TICK = 1;
export const FAST = 8;
export const SLOW = 30;

const updates = [];
const resets = [];

/**
 * Register a UI update function to run at a given interval.
 * @param {Function} fn - Update function (no args)
 * @param {number} [interval=EVERY_TICK] - Tick interval (1, 8, or 30)
 * @param {object} [opts]
 * @param {Function} [opts.reset] - Cache reset function, called on game reset
 */
export function registerUpdate(fn, interval = EVERY_TICK, { reset } = {}) {
  updates.push({ fn, interval });
  if (reset) resets.push(reset);
}

/**
 * Run all registered updates whose interval matches this tick.
 * @param {number} tickCount - Monotonically increasing tick counter
 */
export function runScheduledUpdates(tickCount) {
  for (const { fn, interval } of updates) {
    if (tickCount % interval === 0) fn();
  }
}

/** Force all registered updates to run (e.g., after tab resume). */
export function forceFullUpdate() {
  for (const { fn } of updates) {
    fn();
  }
}

/** Reset all registered caches. Called on game reset. */
export function resetAllCaches() {
  for (const reset of resets) reset();
}
