// js/flavor-discovery.js
// Shared flavor-text discovery tracking + analytics milestone.

import { gameState } from './game-state.js';
import { getAllPurchasables } from './content/purchasables.js';
import { ALIGNMENT_PROGRAMS } from './content/alignment-programs.js';
import { tracks } from './capabilities.js';
import { milestone } from './analytics.js';
import { attachTooltip } from './ui/stats-tooltip.js';

/**
 * Count all discoverable flavor texts: purchasable flavor + milestone flavor.
 * Excludes the __flavor_stat_egg__ easter egg (bonus, not a real flavor item).
 */
export function getTotalFlavorCount() {
  const purchasable = getAllPurchasables().filter(p => p.flavor).length;
  let research = 0;
  for (const track of Object.values(tracks)) {
    for (const m of track.capabilities) {
      if (m.flavor) research++;
    }
  }
  const alignment = ALIGNMENT_PROGRAMS.filter(p => p.flavor).length;
  return purchasable + research + alignment;
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

/**
 * Attach a flavor-text tooltip to an element with the full discovery pattern:
 * adds `has-flavor` class, records discovery on hover, wraps in tooltip-section,
 * and uses a 400ms delay.
 */
export function attachFlavorTooltip(el, id, text) {
  el.classList.add('has-flavor');
  attachTooltip(el, () => {
    recordFlavorDiscovery(id);
    return `<div class="tooltip-section"><div>${text}</div></div>`;
  }, { delay: 400 });
}
