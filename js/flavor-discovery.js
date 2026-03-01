// js/flavor-discovery.js
// Shared flavor-text discovery tracking + analytics milestone.

import { gameState } from './game-state.js';
import { getAllPurchasables } from './content/purchasables.js';
import { tracks } from './capabilities.js';
import { milestone } from './analytics.js';

/**
 * Count all discoverable flavor texts: purchasable flavorText + milestone flavorQuote.
 * Excludes the __flavor_stat_egg__ easter egg (bonus, not a real flavor item).
 */
export function getTotalFlavorCount() {
  const purchasable = getAllPurchasables().filter(p => p.flavorText).length;
  let research = 0;
  for (const track of Object.values(tracks)) {
    for (const m of track.capabilities) {
      if (m.flavorQuote) research++;
    }
  }
  return purchasable + research;
}

/**
 * Record that a player hovered a flavor text item.
 * Fires a one-time analytics milestone when all flavors are found.
 */
export function recordFlavorDiscovery(id) {
  const discovered = gameState.ui.discoveredFlavor;
  if (discovered.includes(id)) return;
  discovered.push(id);

  const total = getTotalFlavorCount();
  if (discovered.length >= total) {
    milestone('flavor_100_percent', {
      flavor_count: discovered.length,
      flavor_total: total,
    });
  }
}
