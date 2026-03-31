// Achievements Tab Renderer
// Renders achievement grid in the settings modal achievements tab.

import { gameState } from '../game-state.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { getProgress } from '../achievements.js';
import { attachTooltip } from './stats-tooltip.js';

/**
 * Render the achievements tab content.
 * Called when the user switches to the achievements tab.
 */
export function renderAchievementsTab() {
  const container = document.getElementById('achievements-container');
  if (!container) return;

  const achievements = gameState.lifetimeAllTime?.achievements || {};
  const { earned, total } = getProgress();

  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'achievements-header';
  header.textContent = `${earned} / ${total}`;
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'achievements-grid';

  for (const a of ACHIEVEMENTS) {
    const isUnlocked = !!achievements[a.id];
    const tile = document.createElement('div');
    tile.className = isUnlocked ? 'achievement-tile earned' : 'achievement-tile locked';

    const name = document.createElement('div');
    name.className = 'achievement-name';

    if (isUnlocked) {
      name.textContent = a.name;
      attachTooltip(tile, () => `<div class="tooltip-header">${a.name}</div><div class="tooltip-section">${a.description}</div>`);
    } else {
      name.textContent = '???';
      if (a.id === 'arc1_complete') {
        attachTooltip(tile, () => `<div class="tooltip-section">${a.description}</div>`);
      }
    }

    tile.appendChild(name);
    grid.appendChild(tile);
  }

  container.appendChild(grid);
}
