// js/utils/dom-cache.js
const cache = {};

/**
 * Cached getElementById. Returns null if element doesn't exist.
 * Automatically re-queries if cached element was removed from DOM
 * (e.g., by innerHTML = '' during full rebuilds).
 */
export function $(id) {
  let el = cache[id];
  if (!el || !el.isConnected) {
    el = document.getElementById(id);
    cache[id] = el;
  }
  return el;
}

/** Clear entire cache. Call on game reset. */
export function invalidateCache() {
  for (const key in cache) delete cache[key];
}
