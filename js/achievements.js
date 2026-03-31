// Achievements System
// Evaluates achievement predicates at trigger points and persists earned state.

import { gameState } from './game-state.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { addMessage } from './messages.js';

/**
 * Check all achievements for a given trigger type.
 * @param {string} trigger - 'ending' | 'prestige' | 'unlock' | 'tick'
 * @param {object} context - Trigger-specific context (e.g. { endingId, ending, archetype })
 * @returns {string[]} Array of newly earned achievement IDs
 */
export function checkAchievements(trigger, context = {}) {
  if (!gameState.lifetimeAllTime) return [];
  if (!gameState.lifetimeAllTime.achievements) {
    gameState.lifetimeAllTime.achievements = {};
  }

  const earned = [];

  for (const achievement of ACHIEVEMENTS) {
    if (achievement.trigger !== trigger) continue;
    if (gameState.lifetimeAllTime.achievements[achievement.id]) continue;

    if (achievement.check(gameState, context)) {
      gameState.lifetimeAllTime.achievements[achievement.id] = {
        earnedAt: Date.now(),
      };
      earned.push(achievement.id);

      addMessage({
        type: 'info',
        sender: 'system',
        subject: `Achievement: ${achievement.name}`,
        body: achievement.description,
        triggeredBy: `achievement_${achievement.id}`,
      });
    }
  }

  return earned;
}

/**
 * Check if a specific achievement has been earned.
 * @param {string} id - Achievement ID
 * @returns {boolean}
 */
export function isEarned(id) {
  return !!(gameState.lifetimeAllTime?.achievements?.[id]);
}

/**
 * Get overall achievement progress.
 * @returns {{ earned: number, total: number }}
 */
export function getProgress() {
  const earnedCount = Object.keys(gameState.lifetimeAllTime?.achievements || {}).length;
  return { earned: earnedCount, total: ACHIEVEMENTS.length };
}

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.checkAchievements = checkAchievements;
  window.isEarned = isEarned;
  window.getProgress = getProgress;
}
