// Seeded PRNG for deterministic per-game jitter
// Uses mulberry32 — simple, fast, good distribution for game use

/** mulberry32: seeded 32-bit PRNG returning float in [0, 1) */
function mulberry32(seed) {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Simple string → 32-bit hash for use as salt */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h;
}

/**
 * Get a deterministic jittered delay for a named event.
 * Same seed + key always produces the same value within a playthrough.
 * Caller must pass gameState so this module has no import dependencies.
 * @param {object} state - gameState (seed is lazily generated and stored on it)
 * @param {string} key - unique identifier (e.g. message key)
 * @param {number} baseDelay - center delay in seconds
 * @param {number} [jitterFrac=0.1] - fraction of baseDelay for ± range
 * @returns {number} jittered delay in seconds
 */
export function jitteredDelay(state, key, baseDelay, jitterFrac = 0.1) {
  if (state.gameRngSeed == null) {
    state.gameRngSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
  }
  const rng = mulberry32(state.gameRngSeed ^ hashString(key));
  // rng is in [0,1) → map to [-jitterFrac, +jitterFrac]
  return baseDelay * (1 - jitterFrac + rng * 2 * jitterFrac);
}
