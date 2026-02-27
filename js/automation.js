// js/automation.js
// Point-based automation system execution.
// HR teams generate HR points/s, Procurement teams generate Procurement points/s.
// Points drive builds directly — no accumulation gate.

import { gameState } from './game-state.js';
import {
  AUTOMATABLE_PERSONNEL,
  AUTOMATABLE_COMPUTE,
  AUTOMATABLE_DATA,
  getHRPointsPerSecond,
  getProcurementPointsPerSecond,
  getItemPointCost,
  canHRHire,
  canProcurementBuy,
} from './automation-state.js';
import { getPurchaseCost, getPurchasableById } from './content/purchasables.js';
import { canAfford, spendResources, getTeamCostMultiplier } from './resources.js';
import { getPurchasableState, getActiveCount, incrementCount } from './purchasable-state.js';
import { calculateTarget } from './automation-policies.js';
import { getEffectiveScaling } from './talent-pool.js';
import { BALANCE } from '../data/balance.js';
import { addNewsMessage } from './messages.js';

const WARNING_COOLDOWN = 30; // seconds between repeated per-item throttle warnings

export function processAutomation(deltaTime) {
  // Process HR automation (personnel + admin items)
  processHRAutomation(deltaTime);

  // Process Procurement automation (compute items)
  processProcurementAutomation(deltaTime);
}

// Compute raw running cost (before ops discount) for an item at a given count.
function getRunningCostForCount(itemId, purchasable, count) {
  if (count <= 0) return 0;
  const rawBaseCost = purchasable.salary || purchasable.runningCost || 0;
  if (rawBaseCost <= 0) return 0;
  const baseCost = rawBaseCost * getTeamCostMultiplier(itemId);

  if (purchasable.runningCostFormula === 'superlinear') {
    const alpha = BALANCE.DATA_RENEWABLE_COST_ALPHA;
    return baseCost * Math.pow(count, 1 + alpha);
  }
  const factor = getEffectiveScaling(itemId);
  return baseCost * count * (1 + factor * count);
}

function processHRAutomation(deltaTime) {
  const hrPoints = getHRPointsPerSecond() * deltaTime;
  if (hrPoints <= 0) return;

  // Items HR can automate: personnel + hr_team + procurement_team_unit
  const hrItems = [
    ...AUTOMATABLE_PERSONNEL.map(p => p.id),
    'hr_team',
    'procurement_team_unit',
  ];

  distributePoints(hrPoints, hrItems, canHRHire, deltaTime);
}

function processProcurementAutomation(deltaTime) {
  const procPoints = getProcurementPointsPerSecond() * deltaTime;
  if (procPoints <= 0) return;

  // Items Procurement can automate: compute + data items
  const procItems = [
    ...AUTOMATABLE_COMPUTE.map(p => p.id),
    ...AUTOMATABLE_DATA.map(d => d.id),
  ];

  distributePoints(procPoints, procItems, canProcurementBuy, deltaTime);
}

function distributePoints(totalPoints, itemIds, canAutomate, deltaTime) {
  // Get enabled items with their priorities
  const enabledItems = [];
  for (const itemId of itemIds) {
    if (!canAutomate(itemId)) continue;

    const state = getPurchasableState(itemId);
    if (!state.automation.enabled) continue;

    const active = getActiveCount(itemId);
    const target = calculateTarget(itemId, state.automation);

    // Skip items at target — clear any stale throttle flag
    if (active === target) {
      state.automation.throttled = false;
      continue;
    }

    enabledItems.push({
      itemId,
      state,
      active,
      target,
      priority: state.automation.priority || 1,
      needsMore: target > active,
    });
  }

  if (enabledItems.length === 0) return;

  // Sort by priority (lower = higher priority)
  enabledItems.sort((a, b) => a.priority - b.priority);

  // Group by priority level
  const priorityGroups = new Map();
  for (const item of enabledItems) {
    if (!priorityGroups.has(item.priority)) {
      priorityGroups.set(item.priority, []);
    }
    priorityGroups.get(item.priority).push(item);
  }

  // Distribute points to each priority level in order
  let remainingPoints = totalPoints;

  for (const [_priority, items] of [...priorityGroups.entries()].sort((a, b) => a[0] - b[0])) {
    if (remainingPoints <= 0) break;

    // Split points evenly among items at same priority
    const pointsPerItem = remainingPoints / items.length;
    let pointsUsed = 0;

    for (const item of items) {
      const used = processItemPoints(item, pointsPerItem, deltaTime);
      pointsUsed += used;
    }

    // If any items at this priority still need points, don't overflow to next priority yet
    const anyStillNeedPoints = items.some(item => {
      const active = getActiveCount(item.itemId);
      const target = calculateTarget(item.itemId, item.state.automation);
      return active !== target;
    });

    if (anyStillNeedPoints) {
      remainingPoints = 0; // Stop at this priority level
    } else {
      remainingPoints -= pointsUsed;
    }
  }
}

function processItemPoints(item, points, deltaTime) {
  const { itemId, state, needsMore } = item;
  const pointCost = getItemPointCost(itemId);
  const purchasable = getPurchasableById(itemId);

  let pointsConsumed = 0;
  let remaining = points;

  if (!needsMore) {
    state.automation.throttled = false;
  }

  if (needsMore) {
    // Unfurlough first — accumulate progress across ticks (no funding cost)
    if (state.furloughed > 0) {
      if (!state.automation.unfurloughing) {
        state.automation.unfurloughing = { progress: 0 };
      }
      const unfurl = state.automation.unfurloughing;

      while (remaining > 0 && state.furloughed > 0) {
        const active = getActiveCount(itemId);
        const target = calculateTarget(itemId, state.automation);
        if (active >= target) break;

        const progressNeeded = 1.0 - unfurl.progress;
        const pointsForFull = progressNeeded * pointCost;
        const pointsToUse = Math.min(remaining, pointsForFull);
        const progressDelta = pointsToUse / pointCost;

        unfurl.progress += progressDelta;
        remaining -= pointsToUse;
        pointsConsumed += pointsToUse;

        if (unfurl.progress >= 1.0) {
          state.furloughed--;
          unfurl.progress = 0;
        }
      }

      if (state.furloughed <= 0 || getActiveCount(itemId) >= calculateTarget(itemId, state.automation)) {
        state.automation.unfurloughing = null;
      }
    }

    // Per-item safety guardrail: would the next unit push THIS ITEM's total
    // running cost above 2× revenue? Catches fat-finger targets like 5000 datacenters.
    // Only check when no build is in progress (mid-build units should finish).
    {
      const active = getActiveCount(itemId);
      const target = calculateTarget(itemId, state.automation);
      if (active >= target) {
        state.automation.throttled = false;
      } else if (!state.automation.building) {
        const grossRevenue = gameState.computed?.revenue?.gross || 0;
        const opsDiscount = gameState.computed?.costs?.opsDiscount ?? 1;
        if (grossRevenue > 0) {
          const costNext = getRunningCostForCount(itemId, purchasable, active + 1) * opsDiscount;
          const wasThrottled = state.automation.throttled;
          state.automation.throttled = (costNext > grossRevenue * 2);
          if (state.automation.throttled && !wasThrottled) {
            const lastWarning = state.automation.throttleWarningTime || 0;
            if (gameState.timeElapsed - lastWarning >= WARNING_COOLDOWN) {
              state.automation.throttleWarningTime = gameState.timeElapsed;
              const name = purchasable?.name || itemId;
              addNewsMessage(
                `AUTOMATION: ${name} throttled — running cost would exceed 2× revenue.`,
                ['automation', 'warning'],
              );
            }
          }
        } else {
          state.automation.throttled = false;
        }
      }
      if (state.automation.throttled) {
        return pointsConsumed;
      }
    }

    // Feed remaining points into builds
    while (remaining > 0) {
      const active = getActiveCount(itemId);
      const target = calculateTarget(itemId, state.automation);
      if (active >= target) break;

      // Start a new build if none in progress
      if (!state.automation.building) {
        const cost = getPurchaseCost(purchasable);
        if (!canAfford({ funding: 0 })) break; // Bankrupt — can't start
        state.automation.building = {
          unitCost: cost,
          paidSoFar: 0,
          progress: 0,
        };
      }

      const build = state.automation.building;
      const progressNeeded = 1.0 - build.progress;
      const pointsForFull = progressNeeded * pointCost;
      const pointsToUse = Math.min(remaining, pointsForFull);
      const progressDelta = pointsToUse / pointCost;

      // Pay proportional funding cost
      const costThisChunk = (build.unitCost.funding || 0) * progressDelta;
      if (costThisChunk > 0 && !canAfford({ funding: costThisChunk })) break;
      if (costThisChunk > 0) {
        spendResources({ funding: costThisChunk });
        build.paidSoFar += costThisChunk;

        // Track CapEx for funding display
        const costPerSecond = costThisChunk / deltaTime;
        build.costPerSecond = costPerSecond;
        if (purchasable.category === 'compute' || purchasable.category === 'data') {
          gameState.computed.capex.infrastructure += costPerSecond;
        } else {
          gameState.computed.capex.hiring += costPerSecond;
        }
      }

      build.progress += progressDelta;
      remaining -= pointsToUse;
      pointsConsumed += pointsToUse;

      // Complete build if done
      if (build.progress >= 1.0) {
        incrementCount(itemId);
        state.automation.building = null;
        // Loop continues — may start another build with leftover points
      }
    }
  } else {
    // Furloughing — accumulate progress across ticks (mirrors building path)
    // No funding cost; furloughing is just pausing work
    if (!state.automation.furloughing) {
      state.automation.furloughing = { progress: 0 };
    }

    const furl = state.automation.furloughing;

    while (remaining > 0) {
      const active = getActiveCount(itemId);
      const target = calculateTarget(itemId, state.automation);
      if (active <= target) {
        state.automation.furloughing = null;
        break;
      }

      const progressNeeded = 1.0 - furl.progress;
      const pointsForFull = progressNeeded * pointCost;
      const pointsToUse = Math.min(remaining, pointsForFull);
      const progressDelta = pointsToUse / pointCost;

      furl.progress += progressDelta;
      remaining -= pointsToUse;
      pointsConsumed += pointsToUse;

      if (furl.progress >= 1.0) {
        state.furloughed++;
        furl.progress = 0;
      }
    }

    if (getActiveCount(itemId) <= calculateTarget(itemId, state.automation)) {
      state.automation.furloughing = null;
    }
  }

  return pointsConsumed;
}


// Legacy function stubs for compatibility
export function getStaffingSpeedMultiplier() {
  return gameState.staffingSpeedMultiplier || 1.0;
}

export function getFundraiseSpeedMultiplier() {
  let mult = 1.0;
  if (getActiveCount('legal_team') > 0) mult *= 0.5;
  if (gameState.tracks?.applications?.unlockedCapabilities?.includes('process_optimization')) {
    mult *= 0.5;
  }
  return mult;
}
