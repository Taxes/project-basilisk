import { BALANCE } from '../data/balance.js';
import { gameState } from './game-state.js';
import { getActiveCount, getCount } from './purchasable-state.js';

const POOL_IDS = ['grad_student', 'junior_researcher', 'team_lead', 'elite_researcher'];

/**
 * Get the effective pool size for a personnel tier (base + accumulated growth).
 */
export function getEffectivePool(itemId) {
  const config = BALANCE.TALENT_POOL[itemId];
  if (!config) return Infinity;
  const growth = gameState.talentPools?.[itemId]?.growthAccumulated || 0;
  return config.base + growth;
}

/**
 * Get current pool usage ratio (hired / effectivePool).
 */
export function getPoolUsage(itemId) {
  const pool = getEffectivePool(itemId);
  if (pool <= 0 || pool === Infinity) return 0;
  const active = getActiveCount(itemId);
  return active / pool;
}

/**
 * Get cost scaling multiplier based on pool usage.
 */
export function getPoolScalingMultiplier(usage) {
  const t = BALANCE.TALENT_POOL_THRESHOLDS;
  const m = BALANCE.TALENT_POOL_SCALING_MULT;
  if (usage < t.WARNING) return m.NORMAL;
  if (usage < t.DEPLETED) return m.WARNING;
  if (usage < t.HARD_WALL) return m.DEPLETED;
  return Infinity;
}

/**
 * Get pool growth rate (per minute) based on current usage.
 */
export function getPoolGrowthRate(usage) {
  const t = BALANCE.TALENT_POOL_THRESHOLDS;
  const g = BALANCE.TALENT_POOL_GROWTH;
  if (getCount('dedicated_upskilling') > 0) return g.UPSKILLING;
  if (usage < t.WARNING) return g.LOW;
  if (usage < t.DEPLETED) return g.MEDIUM;
  return g.HIGH;
}

/**
 * Get the effective cost scaling factor for a personnel item,
 * incorporating talent pool multiplier.
 */
export function getEffectiveScaling(itemId) {
  const baseScaling = BALANCE.COST_SCALING[itemId] || 0;
  if (!BALANCE.TALENT_POOL_ENABLED) return baseScaling;
  const config = BALANCE.TALENT_POOL[itemId];
  if (!config) return baseScaling;
  const usage = getPoolUsage(itemId);
  const mult = getPoolScalingMultiplier(usage);
  return baseScaling * mult;
}

/**
 * Process talent pool growth for one tick.
 */
export function processPoolGrowth(deltaTime) {
  if (!BALANCE.TALENT_POOL_ENABLED) return;
  if (!gameState.talentPools) return;
  for (const itemId of POOL_IDS) {
    const poolState = gameState.talentPools[itemId];
    if (!poolState) continue;
    const config = BALANCE.TALENT_POOL[itemId];
    if (!config) continue;
    const usage = getPoolUsage(itemId);
    const ratePerMin = getPoolGrowthRate(usage);
    const growth = config.base * ratePerMin * deltaTime / 60;
    poolState.growthAccumulated += growth;
  }
}

/**
 * Check if the 75% talent pool warning should fire.
 */
export function shouldShowPoolWarning() {
  if (!BALANCE.TALENT_POOL_ENABLED) return false;
  if (!gameState.talentPools || gameState.talentPools.warningShown) return false;
  for (const itemId of POOL_IDS) {
    if (getPoolUsage(itemId) >= BALANCE.TALENT_POOL_THRESHOLDS.WARNING) {
      return true;
    }
  }
  return false;
}

/**
 * Mark the pool warning as shown.
 */
export function markPoolWarningShown() {
  if (gameState.talentPools) {
    gameState.talentPools.warningShown = true;
  }
}

export { POOL_IDS };
