// Player-facing text: see docs/message-registry.json
// Focus Queue - Core queue data structure, operations, and processing engine

import { gameState } from './game-state.js';
import { BALANCE, FUNDRAISE_ROUNDS } from '../data/balance.js';
import { executeSinglePurchase, canQueuePurchase, purchasables, getPurchasableById, getPurchaseCost, PERSONNEL_IDS } from './content/purchasables.js';
import { canAfford, spendResources } from './resources.js';
import { addNewsItem } from './news-feed.js';
import { getStaffingSpeedMultiplier, getFundraiseSpeedMultiplier } from './automation.js';
import { formatFunding } from './utils/format.js';
import { getCount, incrementCount, getPurchasableState, getActiveCount } from './purchasable-state.js';
import { processCEOFocus, onFundraiseCompleted } from './ceo-focus.js';

/** Culture drift speed multiplier based on org size. Small orgs pivot fast. */
export function getCultureSpeedMultiplier() {
  let researchers = 1; // founder
  for (const id of PERSONNEL_IDS) {
    researchers += getCount(id);
  }
  const ref = BALANCE.CULTURE_DRIFT_REF_SIZE;
  const exp = BALANCE.CULTURE_DRIFT_EXPONENT;
  return Math.pow(ref / Math.max(researchers, 1), exp);
}

// --- Queue ID counter ---
let nextQueueId = 1;

// Restore queue ID counter after loading a save.
// Ensures new items get IDs higher than any existing queue item.
export function restoreQueueIdCounter(queue) {
  const items = queue || gameState.focusQueue;
  if (items && items.length > 0) {
    const maxId = Math.max(...items.map(i => i.id || 0));
    nextQueueId = maxId + 1;
  }
}

// Reset queue ID counter (used on game reset)
export function resetQueueIdCounter() {
  nextQueueId = 1;
}

// --- Queue Item Creation ---
export function createPurchaseItem(purchasableId, quantity = 1, duration) {
  const state = getPurchasableState(purchasableId);

  // Consume saved progress if any (percentage only, not dollars)
  const savedProgress = state.savedProgress || 0;
  state.savedProgress = 0;

  return {
    id: nextQueueId++,
    type: 'purchase',
    target: purchasableId,
    quantity,
    completed: 0,
    progress: savedProgress,
    duration,
    paused: false,
    // Progressive cost tracking - costs deducted over time, not at completion
    unitCost: null,      // Will re-lock at current price on next tick
    paidForUnit: 0,      // Fresh - remaining cost paid at current price
  };
}

export function createFundraiseItem(roundId, duration, lockedMultiplier, lockedRevenue) {
  return {
    id: nextQueueId++,
    type: 'fundraise',
    target: roundId,
    quantity: 1,
    completed: 0,
    progress: 0,
    duration,
    lockedMultiplier,
    lockedRevenue,
  };
}

export function createCultureItem(targetAllocation) {
  return {
    id: nextQueueId++,
    type: 'culture',
    target: null,
    quantity: 1,
    completed: 0,
    progress: 0,
    duration: Infinity,
    targetAllocation,
  };
}

export function createPurgeItem() {
  return {
    id: nextQueueId++,
    type: 'purge_synthetic',
    target: null,
    quantity: 1,
    completed: 0,
    progress: 0,
    duration: Infinity,
  };
}

export function createFurloughItem(purchasableId, duration, quantity = 1) {
  return {
    id: nextQueueId++,
    type: 'furlough',
    target: purchasableId,
    quantity,
    completed: 0,
    progress: 0,
    duration,
    paused: false,
  };
}

// --- Queue Management ---
export function addToQueue(item, priority = false) {
  if (priority) {
    gameState.focusQueue.unshift(item);
  } else {
    gameState.focusQueue.push(item);
  }
  return item.id;
}

// After removing an item, merge newly-adjacent items with same type+target
function mergeAdjacentItems(index) {
  const q = gameState.focusQueue;
  if (index <= 0 || index >= q.length) return;
  const prev = q[index - 1];
  const next = q[index];
  if (prev.type === next.type && prev.target === next.target
      && (prev.type === 'purchase' || prev.type === 'furlough')) {
    prev.quantity += next.quantity - next.completed;
    q.splice(index, 1);
  }
}

export function removeFromQueue(index) {
  if (index < 0 || index >= gameState.focusQueue.length) return false;
  gameState.focusQueue.splice(index, 1);
  mergeAdjacentItems(index);
  return true;
}

export function cancelFromQueue(index, quantity = 1) {
  const item = gameState.focusQueue[index];
  if (!item) return false;

  // Non-purchase items: just remove entirely
  if (item.type !== 'purchase') {
    gameState.focusQueue.splice(index, 1);
    mergeAdjacentItems(index);
    return true;
  }

  // Cap quantity to what's actually queued
  const actualQty = Math.min(quantity, item.quantity);

  // Reduce quantity or remove entirely
  if (item.quantity <= actualQty) {
    // Removing item entirely — save progress so resuming later restores it
    if (item.progress > 0) {
      const state = getPurchasableState(item.target);
      state.savedProgress = item.progress;
    }
    gameState.focusQueue.splice(index, 1);
    mergeAdjacentItems(index);
  } else {
    item.quantity -= actualQty;
  }

  return true;
}

export function moveInQueue(fromIndex, direction) {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= gameState.focusQueue.length) return false;
  const items = gameState.focusQueue;
  [items[fromIndex], items[toIndex]] = [items[toIndex], items[fromIndex]];
  return true;
}

export function clearQueue() {
  for (const item of gameState.focusQueue) {
    if (item.type === 'purchase' && item.progress > 0) {
      const state = getPurchasableState(item.target);
      state.savedProgress = item.progress;
    }
  }
  gameState.focusQueue.length = 0;
}

// --- Queue Processing (called each tick) ---
export function processQueue(deltaTime) {
  // Reset CapEx tracking for this tick
  if (!gameState.computed) gameState.computed = {};
  gameState.computed.capex = { hiring: 0, infrastructure: 0 };

  const slots = gameState.focusSlots;
  let activeCount = Math.min(slots, gameState.focusQueue.length);
  const perSlotEfficiency = activeCount > 0
    ? gameState.totalEfficiency / activeCount
    : gameState.totalEfficiency;
  let activeSlotsUsed = 0;

  for (let i = 0; i < activeCount && i < gameState.focusQueue.length; i++) {
    const item = gameState.focusQueue[i];
    const effectiveDelta = deltaTime * perSlotEfficiency;

    const completed = processQueueItem(item, effectiveDelta, deltaTime, perSlotEfficiency);
    if (completed) {
      gameState.focusQueue.splice(i, 1);
      mergeAdjacentItems(i);
      i--;
      activeCount = Math.min(activeCount, gameState.focusQueue.length);
    } else {
      activeSlotsUsed++;
    }
  }

  processCEOFocus(deltaTime);
}

function processQueueItem(item, effectiveDelta, deltaTime, perSlotEfficiency) {
  switch (item.type) {
    case 'purchase':        return processPurchaseItem(item, effectiveDelta, deltaTime, perSlotEfficiency);
    case 'fundraise':       return processFundraiseItem(item, effectiveDelta, perSlotEfficiency);
    case 'culture':         return processCultureItem(item, effectiveDelta);
    case 'purge_synthetic': return processPurgeItem(item, effectiveDelta);
    case 'furlough':        return processFurloughItem(item, effectiveDelta, perSlotEfficiency);
    default:                return true;
  }
}

function processPurchaseItem(item, effectiveDelta, deltaTime, perSlotEfficiency) {
  const purchasable = getPurchasableById(item.target);
  if (!purchasable) return true; // Invalid item, remove it

  // Apply staffing speed multiplier for personnel and compute (procurement) items
  let duration = item.duration;

  // Use reactivateTime for unfurlough (reactivating a furloughed unit)
  const state = getPurchasableState(item.target);
  if (state.furloughed > 0) {
    duration = purchasable.reactivateTime || purchasable.focusDuration * 0.5;
  }

  if (purchasable.category === 'personnel' || purchasable.category === 'compute') {
    duration = item.duration / getStaffingSpeedMultiplier();
  } else if (purchasable.category === 'data') {
    duration = item.duration * getFundraiseSpeedMultiplier();
  }

  // Lock in unit cost at start of each new unit
  if (item.unitCost === null) {
    // Check for unfurlough first (free, no cost to lock)
    const state = getPurchasableState(item.target);
    if (state.furloughed > 0) {
      item.unitCost = { funding: 0 }; // Free unfurlough
    } else {
      item.unitCost = getPurchaseCost(purchasable);
    }
    item.paidForUnit = 0;
  }

  // Calculate progress increment and corresponding cost
  const progressDelta = effectiveDelta / duration;
  const totalUnitCost = item.unitCost.funding || 0;

  // Cap cost at remaining amount for this unit (avoid overpaying on completion)
  const remainingProgress = 1.0 - item.progress;
  const effectiveProgressDelta = Math.min(progressDelta, remainingProgress + 0.001);
  const costThisTick = totalUnitCost * effectiveProgressDelta;

  // Check if we can afford this tick's portion
  if (costThisTick > 0 && !canAfford({ funding: costThisTick })) {
    item.paused = true;
    item.fundingStableSince = null;
    return false;
  }

  // Resume check with hysteresis — require stable funding before unpausing
  if (item.paused) {
    if (!item.fundingStableSince) {
      item.fundingStableSince = gameState.timeElapsed;
    }
    const stableFor = gameState.timeElapsed - item.fundingStableSince;
    if (stableFor < BALANCE.FOCUS_RESUME_DELAY) {
      return false; // Stay paused, wait for stable funding
    }
  }

  // Deduct cost and track payment
  if (costThisTick > 0) {
    spendResources({ funding: costThisTick });
    item.paidForUnit += costThisTick;

    // Track CapEx for funding display (#263)
    const costPerSecond = costThisTick / deltaTime;
    item.costPerSecond = costPerSecond;
    if (purchasable.category === 'compute') {
      gameState.computed.capex.infrastructure += costPerSecond;
    } else {
      gameState.computed.capex.hiring += costPerSecond;
    }
  }
  item.progress += progressDelta;
  item.paused = false;
  item.fundingStableSince = null;
  item.effectiveRemaining = duration * (1 - item.progress) / perSlotEfficiency;

  // Check for unit completion
  while (item.progress >= 1.0 && item.completed < item.quantity) {
    const success = executeProgressivePurchaseUnit(item.target, item.unitCost);
    if (success) {
      item.completed++;
      item.progress -= 1.0;
      // Reset for next unit
      item.unitCost = null;
      item.paidForUnit = 0;
    } else {
      item.paused = true;
      return false;
    }
  }

  return item.completed >= item.quantity;
}

function processFundraiseItem(item, effectiveDelta, perSlotEfficiency) {
  // Apply fundraise speed multiplier (legal team + AI legal assistant)
  const duration = item.duration * getFundraiseSpeedMultiplier();
  item.progress += effectiveDelta / duration;
  item.effectiveRemaining = duration * (1 - item.progress) / perSlotEfficiency;
  if (item.progress >= 1.0) {
    completeFundraise(item);
    return true;
  }
  return false;
}

function processPurgeItem(item, effectiveDelta) {
  const decayRate = BALANCE.DATA_PURGE_DECAY_RATE;
  const decay = gameState.data.syntheticScore * decayRate * effectiveDelta;
  gameState.data.syntheticScore = Math.max(0, gameState.data.syntheticScore - decay);
  return false;
}

function processFurloughItem(item, effectiveDelta, perSlotEfficiency) {
  // Apply same speed as hiring/procurement
  const purchasable = getPurchasableById(item.target);
  let duration = item.duration;
  if (purchasable && (purchasable.category === 'personnel' || purchasable.category === 'compute')) {
    duration = item.duration / getStaffingSpeedMultiplier();
  }
  item.progress += effectiveDelta / duration;
  item.effectiveRemaining = duration * (1 - item.progress) / perSlotEfficiency;

  // Handle unit completion (loop for quantity > 1, matching purchase behavior)
  while (item.progress >= 1.0 && item.completed < item.quantity) {
    const active = getActiveCount(item.target);
    if (active <= 0) {
      // No more active units to furlough — finish early
      return true;
    }
    const state = getPurchasableState(item.target);
    state.furloughed++;
    item.completed++;
    item.progress -= 1.0;

    // Reverse focus effects while furloughed (e.g. chief_of_staff, executive_team)
    if (purchasable) {
      const effects = purchasable.effects || {};
      if (effects.focusSlots) {
        gameState.focusSlots = Math.max(1, gameState.focusSlots - effects.focusSlots);
      }
      if (effects.focusEfficiencyMultiplier) {
        gameState.totalEfficiency /= effects.focusEfficiencyMultiplier;
      }
    }
  }

  return item.completed >= item.quantity;
}

function processCultureItem(item, effectiveDelta) {
  const speedMult = getCultureSpeedMultiplier();
  const driftAmount = BALANCE.CULTURE_FOCUSED_DRIFT_RATE * effectiveDelta * speedMult;
  const done = applyAllocationDrift(item.targetAllocation, driftAmount);
  item.progress = calculateCultureProgress(item.targetAllocation);

  // Estimate remaining time for UI display
  const tracks = gameState.tracks;
  let maxTrackDiff = 0;
  for (const trackId of ['capabilities', 'applications', 'alignment']) {
    const diff = Math.abs(item.targetAllocation[trackId] - tracks[trackId].researcherAllocation);
    if (diff > maxTrackDiff) maxTrackDiff = diff;
  }
  if (maxTrackDiff > BALANCE.CULTURE_COMPLETION_THRESHOLD) {
    const focusedRate = BALANCE.CULTURE_FOCUSED_DRIFT_RATE * speedMult;
    const passiveRate = BALANCE.CULTURE_PASSIVE_DRIFT_RATE * speedMult;
    item.effectiveRemaining = maxTrackDiff / focusedRate;
    item.passiveRemaining = maxTrackDiff / passiveRate;
  } else {
    item.effectiveRemaining = 0;
    item.passiveRemaining = 0;
  }

  return done;
}

// --- Purchase execution (progressive cost model - cost already paid) ---
function executeProgressivePurchaseUnit(purchasableId, lockedCost) {
  // Unfurlough first (free) before purchasing new
  const state = getPurchasableState(purchasableId);
  if (state.furloughed > 0) {
    state.furloughed--;
    // Re-apply focus effects that were reversed on furlough
    const purchasable = getPurchasableById(purchasableId);
    if (purchasable) {
      const effects = purchasable.effects || {};
      if (effects.focusSlots) {
        gameState.focusSlots += effects.focusSlots;
      }
      if (effects.focusEfficiencyMultiplier) {
        gameState.totalEfficiency *= effects.focusEfficiencyMultiplier;
      }
    }
    return true;  // Success, no cost (already handled)
  }

  // Cost was already paid progressively - just increment the purchase count
  const purchasable = getPurchasableById(purchasableId);
  if (!purchasable) return false;

  incrementCount(purchasableId);

  // Focus effects from purchasable data
  const effects = purchasable.effects || {};
  if (effects.focusSlots) {
    gameState.focusSlots += effects.focusSlots;
  }
  if (effects.focusEfficiencyMultiplier) {
    gameState.totalEfficiency *= effects.focusEfficiencyMultiplier;
  }

  return true;
}

// Get the current valuation multiplier for a fundraise round.
// Decayed incrementally each tick in processCEOFocus; frozen while IR is active.
export function getFundraiseMultiplier(roundId) {
  const round = FUNDRAISE_ROUNDS[roundId];
  if (!round) return 0;
  const state = gameState.fundraiseRounds[roundId];
  if (!state || !state.available) return round.startingMultiplier;
  return state.currentMultiplier !== undefined ? state.currentMultiplier : round.startingMultiplier;
}

/** Calculate raise amount and effective equity for a fundraise round.
 *  irExtraBase is the IR bonus that pushes the raise above the normal maxRaise cap. */
export function calculateFundraisePreview(round, annualRevenue, multiplier, baseOverride, irExtraBase = 0) {
  const effectiveBase = baseOverride !== undefined ? baseOverride : (round.base || 0);
  const revenueComponent = annualRevenue * multiplier * round.equityPercent;
  const uncappedAmount = effectiveBase + revenueComponent;
  const cappedAmount = round.maxRaise ? Math.min(round.maxRaise, uncappedAmount) : uncappedAmount;
  // IR bonus stacks above the normal cap
  const raiseAmount = cappedAmount + irExtraBase;
  let effectiveEquity = round.equityPercent;
  const totalUncapped = uncappedAmount + irExtraBase;
  if (round.maxRaise && totalUncapped > round.maxRaise) {
    effectiveEquity = round.equityPercent * (round.maxRaise / totalUncapped);
  }
  return { raiseAmount, effectiveEquity };
}

// --- Tranche Disbursement Processing ---
export function processDisbursements(deltaTime) {
  const disbursements = gameState.disbursements;
  if (!disbursements || disbursements.length === 0) return;

  for (let i = disbursements.length - 1; i >= 0; i--) {
    const d = disbursements[i];
    const amount = Math.min(d.rate * deltaTime, d.remaining);
    gameState.resources.funding += amount;
    d.remaining -= amount;
    if (d.remaining <= 0) {
      disbursements.splice(i, 1);
    }
  }
}

function completeFundraise(item) {
  const round = FUNDRAISE_ROUNDS[item.target];
  if (!round) return;
  const state = gameState.fundraiseRounds[item.target];

  // Use live values at completion time (#565)
  const liveMultiplier = getFundraiseMultiplier(item.target)
    + (gameState.computed?.ceoFocus?.irMultipleBonus || 0);
  const liveRevenue = gameState.computed?.revenue?.gross || 0;
  const irBaseBonus = gameState.computed?.ceoFocus?.irFundraiseBonus || 0;

  const annualRevenue = liveRevenue * 365;
  // IR base bonus passed separately so it can push above maxRaise cap (#564)
  const { raiseAmount, effectiveEquity } = calculateFundraisePreview(round, annualRevenue, liveMultiplier, undefined, irBaseBonus);

  // Tranche disbursement: money arrives over time instead of instantly
  const disbursementDuration = round.disbursementDuration || 1; // fallback to instant
  const rate = raiseAmount / disbursementDuration;
  if (!gameState.disbursements) gameState.disbursements = [];
  gameState.disbursements.push({
    roundId: item.target,
    totalAmount: raiseAmount,
    remaining: raiseAmount,
    rate: rate,
    lockedMultiplier: liveMultiplier,
  });

  gameState.totalEquitySold += effectiveEquity;
  state.raised = true;
  state.raisedAmount = raiseAmount;
  state.raisedAt = gameState.timeElapsed;
  state.equitySold = effectiveEquity;
  state.valuation = effectiveEquity > 0 ? raiseAmount / effectiveEquity : 0;

  const equityPct = (effectiveEquity * 100).toFixed(1);
  addNewsItem(
    `FUNDING: ${round.name} \u2014 ${formatFunding(raiseAmount, { precision: 1 })} raised for ${equityPct}% equity at ${liveMultiplier.toFixed(0)}x valuation. Disbursing over ${Math.round(disbursementDuration / 60)} min.`,
    'success'
  );

  // Update CEO Focus fundraise tracking
  onFundraiseCompleted();

  // CEO Focus unlock messages are now handled by tutorial-messages.js
  // (triggered by fundraiseRounds.seed/series_a/series_b.raised)
}

function applyAllocationDrift(target, maxDriftPerTrack) {
  const tracks = gameState.tracks;
  let allDone = true;

  for (const trackId of ['capabilities', 'applications', 'alignment']) {
    const current = tracks[trackId].researcherAllocation;
    const goal = target[trackId];
    const diff = goal - current;

    if (Math.abs(diff) <= BALANCE.CULTURE_COMPLETION_THRESHOLD) {
      // Snap to target — don't leave a ~1% residual
      tracks[trackId].researcherAllocation = goal;
      continue;
    }

    allDone = false;
    const drift = Math.sign(diff) * Math.min(Math.abs(diff), maxDriftPerTrack);
    tracks[trackId].researcherAllocation += drift;
  }

  // Normalize to sum to 1.0
  const sum = Object.values(tracks).reduce((s, t) => s + t.researcherAllocation, 0);
  if (sum > 0) {
    for (const trackId of Object.keys(tracks)) {
      tracks[trackId].researcherAllocation /= sum;
    }
  }

  return allDone;
}

function calculateCultureProgress(target) {
  const tracks = gameState.tracks;
  let totalDiff = 0;
  for (const trackId of ['capabilities', 'applications', 'alignment']) {
    totalDiff += Math.abs(target[trackId] - tracks[trackId].researcherAllocation);
  }
  return 1 - (totalDiff / 3.0);
}

// Called every tick regardless of queue state
export function applyPassiveDrift(deltaTime) {
  const target = gameState.targetAllocation;
  if (!target) return;
  applyAllocationDrift(target, BALANCE.CULTURE_PASSIVE_DRIFT_RATE * deltaTime * getCultureSpeedMultiplier());
}

// --- Enqueue helpers ---
export function enqueuePurchase(purchasableId, quantity = 1, priority = false) {
  // Block purchases while using line of credit (funding < 0)
  if (gameState.resources.funding < 0) return null;

  if (!canQueuePurchase(purchasableId)) return null;
  const purchasable = purchasables.find(p => p.id === purchasableId);
  if (!purchasable) return null;

  // Clamp quantity for one-time items (maxPurchases)
  // Use active count so furloughed units can be unfurloughed via purchase queue
  if (purchasable.maxPurchases) {
    const active = getActiveCount(purchasableId);
    const queued = (gameState.focusQueue || [])
      .filter(item => item.type === 'purchase' && item.target === purchasableId)
      .reduce((sum, item) => sum + (item.quantity - item.completed), 0);
    quantity = Math.min(quantity, purchasable.maxPurchases - active - queued);
    if (quantity <= 0) return null;
  }

  // Merge only with adjacent item at insertion point
  const adjacent = priority ? gameState.focusQueue[0] : gameState.focusQueue[gameState.focusQueue.length - 1];
  if (adjacent && adjacent.type === 'purchase' && adjacent.target === purchasableId) {
    adjacent.quantity += quantity;
    return adjacent.id;
  }

  const item = createPurchaseItem(purchasableId, quantity, purchasable.focusDuration);
  addToQueue(item, priority);
  return item.id;
}

export function enqueueFundraise(roundId, priority = false) {
  const round = FUNDRAISE_ROUNDS[roundId];
  const state = gameState.fundraiseRounds[roundId];
  if (!round || !state?.available || state.raised) return null;

  // Already in queue?
  if (gameState.focusQueue.some(item => item.type === 'fundraise' && item.target === roundId)) return null;

  const lockedMultiplier = getFundraiseMultiplier(roundId);
  const lockedRevenue = gameState.computed?.revenue?.gross || 0;

  // Apply CEO Focus IR bonuses at lock time
  const irMultipleBonus = gameState.computed?.ceoFocus?.irMultipleBonus || 0;

  const item = createFundraiseItem(roundId, round.duration, lockedMultiplier + irMultipleBonus, lockedRevenue);
  // Store IR base bonus on the item so completeFundraise can use it
  item.irBaseBonus = gameState.computed?.ceoFocus?.irFundraiseBonus || 0;
  addToQueue(item, priority);
  return item.id;
}

export function enqueueCulture(targetAllocation, priority = false) {
  const sum = targetAllocation.capabilities + targetAllocation.applications + targetAllocation.alignment;
  if (Math.abs(sum - 1.0) > 0.02) return null;

  gameState.targetAllocation = { ...targetAllocation };

  const item = createCultureItem(targetAllocation);
  addToQueue(item, priority);
  return item.id;
}

// Check if purchases are blocked due to credit usage
export function arePurchasesBlocked() {
  return gameState.resources.funding < 0;
}

// Enqueue a furlough action
export function enqueueFurlough(purchasableId, quantity = 1, priority = false) {
  const active = getActiveCount(purchasableId);
  if (active <= 0) return null;

  const purchasable = getPurchasableById(purchasableId);
  if (!purchasable) return null;

  // Account for furloughs already queued to avoid over-queuing
  const queuedFurloughs = (gameState.focusQueue || [])
    .filter(item => item.type === 'furlough' && item.target === purchasableId)
    .reduce((sum, item) => sum + (item.quantity - item.completed), 0);

  const duration = purchasable.furloughTime || purchasable.focusDuration * 0.5;
  const toFurlough = Math.min(quantity, active - queuedFurloughs);
  if (toFurlough <= 0) return null;

  // Merge only with adjacent item at insertion point
  const adjacent = priority ? gameState.focusQueue[0] : gameState.focusQueue[gameState.focusQueue.length - 1];
  if (adjacent && adjacent.type === 'furlough' && adjacent.target === purchasableId) {
    adjacent.quantity += toFurlough;
    return adjacent.id;
  }

  const item = createFurloughItem(purchasableId, duration, toFurlough);
  addToQueue(item, priority);
  return item.id;
}

// Exports for window (playtester access)
export function initFocusQueueExports() {
  window.addToQueue = addToQueue;
  window.removeFromQueue = removeFromQueue;
  window.cancelFromQueue = cancelFromQueue;
  window.moveInQueue = moveInQueue;
  window.clearQueue = clearQueue;
  window.processQueue = processQueue;
  window.enqueuePurchase = enqueuePurchase;
  window.enqueueFundraise = enqueueFundraise;
  window.getFundraiseMultiplier = getFundraiseMultiplier;
  window.enqueueCulture = enqueueCulture;
  window.enqueueFurlough = enqueueFurlough;
  window.restoreQueueIdCounter = restoreQueueIdCounter;
  window.resetQueueIdCounter = resetQueueIdCounter;
  window.processDisbursements = processDisbursements;
  window.arePurchasesBlocked = arePurchasesBlocked;
}
