// Player-facing text: see docs/message-registry.json
// Focus Queue - Core queue data structure, operations, and processing engine

import { gameState } from './game-state.js';
import { BALANCE, FUNDRAISE_ROUNDS } from '../data/balance.js';
import { canQueuePurchase, purchasables, getPurchasableById, getPurchaseCost, PERSONNEL_IDS } from './content/purchasables.js';
import { canAfford, spendResources } from './resources.js';
import { triggerFundingMilestone } from './news-feed.js';
import { getStaffingSpeedMultiplier, getFundraiseSpeedMultiplier } from './automation.js';
import { getCount, incrementCount, getPurchasableState, getActiveCount } from './purchasable-state.js';
import { milestone } from './analytics.js';
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

/** HR-driven culture drift rate (drift/s) as a function of r = hrTeams / researchers. */
export function getHRCultureDrift(r) {
  if (r <= 0) return 0;
  const R_MIN = BALANCE.HR_CULTURE_R_MIN;
  const R_MAX = BALANCE.HR_CULTURE_R_MAX;
  const RATE_MIN = BALANCE.HR_CULTURE_RATE_MIN;
  const RATE_MAX = BALANCE.HR_CULTURE_RATE_MAX;
  if (r < R_MIN) return RATE_MIN * r / R_MIN;           // dead zone: linear blend
  if (r <= R_MAX) {                                       // active zone: linear interp
    const t = (r - R_MIN) / (R_MAX - R_MIN);
    return RATE_MIN + t * (RATE_MAX - RATE_MIN);
  }
  return RATE_MAX;                                        // clamp
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

/** Find the queue index of a purge_synthetic item, or -1 if none. */
export function findPurgeIndex() {
  return gameState.focusQueue.findIndex(item => item.type === 'purge_synthetic');
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
  scheduleDeferredMerge();
  return true;
}

// --- Deferred merge after reorder ---
let _mergeTimeout = null;

function scheduleDeferredMerge() {
  if (_mergeTimeout) clearTimeout(_mergeTimeout);
  _mergeTimeout = setTimeout(() => {
    _mergeTimeout = null;
    // Don't merge while the player is hovering over the queue panel
    const queuePanel = document.getElementById('queue-panel');
    if (queuePanel?.matches(':hover')) {
      // Re-schedule — check again after another 2s
      scheduleDeferredMerge();
      return;
    }
    mergeAllAdjacent();
  }, 5000);
}

function mergeAllAdjacent() {
  const q = gameState.focusQueue;
  for (let i = q.length - 1; i > 0; i--) {
    const prev = q[i - 1];
    const curr = q[i];
    if (prev.type === curr.type && prev.target === curr.target
        && (prev.type === 'purchase' || prev.type === 'furlough')) {
      prev.quantity += curr.quantity - curr.completed;
      q.splice(i, 1);
    }
  }
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

  // Reconcile stale queue entries (e.g. paused purchases where count dropped)
  reconcilePausedPurchases();

  const speed = gameState.focusSpeed;

  if (gameState.focusQueue.length > 0) {
    const item = gameState.focusQueue[0];
    const effectiveDelta = deltaTime * speed;

    const completed = processQueueItem(item, effectiveDelta, deltaTime, speed);
    if (completed) {
      gameState.focusQueue.splice(0, 1);
      mergeAdjacentItems(0);
    }
  }

  processCEOFocus(deltaTime);
}

// When purchases are paused (funding < 0), a player can reduce their owned
// count below what a queue item has already completed, leaving a nonsensical
// state (e.g. "3/5 completed" but only 2 owned). Clamp completed and remove
// items that have nothing left to do.
function reconcilePausedPurchases() {
  if (gameState.resources.funding >= 0) return; // only while credit-blocked

  const q = gameState.focusQueue;
  for (let i = q.length - 1; i >= 0; i--) {
    const item = q[i];
    if (item.type !== 'purchase' || !item.paused) continue;

    const owned = getCount(item.target);
    if (item.completed <= owned) continue;

    // Clamp completed to current owned count
    item.completed = owned;

    // If nothing left to do, remove the item
    if (item.completed >= item.quantity) {
      q.splice(i, 1);
    }
  }
}

function processQueueItem(item, effectiveDelta, deltaTime, speed) {
  switch (item.type) {
    case 'purchase':        return processPurchaseItem(item, effectiveDelta, deltaTime, speed);
    case 'fundraise':       return processFundraiseItem(item, effectiveDelta, speed);
    case 'culture':         return processCultureItem(item, effectiveDelta);
    case 'purge_synthetic': return processPurgeItem(item, effectiveDelta);
    case 'furlough':        return processFurloughItem(item, effectiveDelta, speed);
    default:                return true;
  }
}

function processPurchaseItem(item, effectiveDelta, deltaTime, speed) {
  const purchasable = getPurchasableById(item.target);
  if (!purchasable) return true; // Invalid item, remove it

  // Apply staffing speed multiplier for personnel and compute (procurement) items
  let duration = item.duration;

  // Use reactivateTime for unfurlough (reactivating a furloughed unit)
  const state = getPurchasableState(item.target);
  if (state.furloughed > 0) {
    duration = purchasable.reactivateTime ?? purchasable.focusDuration * 0.5;
  }

  if (purchasable.category === 'personnel' || purchasable.category === 'compute') {
    duration = duration / getStaffingSpeedMultiplier();
  } else if (purchasable.category === 'data') {
    duration = duration * getFundraiseSpeedMultiplier();
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
  item.effectiveRemaining = duration * (1 - item.progress) / speed;

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

function processFundraiseItem(item, effectiveDelta, speed) {
  // Apply fundraise speed multiplier (legal team + AI legal assistant)
  const duration = item.duration * getFundraiseSpeedMultiplier();
  item.progress += effectiveDelta / duration;
  item.effectiveRemaining = duration * (1 - item.progress) / speed;
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

function processFurloughItem(item, effectiveDelta, speed) {
  // Apply same speed as hiring/procurement
  const purchasable = getPurchasableById(item.target);
  let duration = item.duration;
  if (purchasable && (purchasable.category === 'personnel' || purchasable.category === 'compute')) {
    duration = item.duration / getStaffingSpeedMultiplier();
  }
  item.progress += effectiveDelta / duration;
  item.effectiveRemaining = duration * (1 - item.progress) / speed;

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
      if (effects.focusSpeedMultiplier) {
        gameState.focusSpeed /= effects.focusSpeedMultiplier;
      }
    }
  }

  return item.completed >= item.quantity;
}

function processCultureItem(item, effectiveDelta) {
  const hrDriftRate = gameState.computed?.hrCultureDriftRate || 0;
  const focusedHrDrift = hrDriftRate * BALANCE.CULTURE_FOCUS_MULTIPLIER * effectiveDelta;
  const legacyDrift = BALANCE.CULTURE_FOCUSED_DRIFT_RATE * effectiveDelta * getCultureSpeedMultiplier();
  const driftAmount = Math.max(focusedHrDrift, legacyDrift);
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
    const effectiveRate = driftAmount / effectiveDelta;
    const passiveHrDrift = hrDriftRate;
    const passiveRate = Math.max(passiveHrDrift, BALANCE.CULTURE_PASSIVE_DRIFT_RATE * getCultureSpeedMultiplier());
    item.effectiveRemaining = maxTrackDiff / effectiveRate;
    item.passiveRemaining = maxTrackDiff / passiveRate;
  } else {
    item.effectiveRemaining = 0;
    item.passiveRemaining = 0;
  }

  return done;
}

// --- Purchase execution (progressive cost model - cost already paid) ---
function executeProgressivePurchaseUnit(purchasableId, _lockedCost) {
  // Unfurlough first (free) before purchasing new
  const state = getPurchasableState(purchasableId);
  if (state.furloughed > 0) {
    state.furloughed--;
    // Re-apply focus effects that were reversed on furlough
    const purchasable = getPurchasableById(purchasableId);
    if (purchasable) {
      const effects = purchasable.effects || {};
      if (effects.focusSpeedMultiplier) {
        gameState.focusSpeed *= effects.focusSpeedMultiplier;
      }
    }
    return true;  // Success, no cost (already handled)
  }

  // Cost was already paid progressively - just increment the purchase count
  const purchasable = getPurchasableById(purchasableId);
  if (!purchasable) return false;

  incrementCount(purchasableId);

  // Funnel telemetry: track when player reaches 10 total purchasables
  const totalCount = Object.values(gameState.purchasables)
    .reduce((sum, p) => sum + (p.count || 0), 0);
  if (totalCount >= 10) {
    milestone('ten_purchasables');
  }

  // Focus effects from purchasable data
  const effects = purchasable.effects || {};
  if (effects.focusSpeedMultiplier) {
    gameState.focusSpeed *= effects.focusSpeedMultiplier;
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
 *  irExtraBase is the fixed IR bonus that pushes the raise above the normal maxRaise cap.
 *  irMultFraction is the IR multiplier fraction (e.g. 0.20 = 20% of base multiplier) — its
 *  revenue contribution also pushes above the cap. */
export function calculateFundraisePreview(round, annualRevenue, multiplier, baseOverride, irExtraBase = 0, irMultFraction = 0, irCapMultiplier = 1) {
  const effectiveBase = baseOverride !== undefined ? baseOverride : (round.base || 0);
  const revenueComponent = annualRevenue * multiplier * round.equityPercent;
  const uncappedAmount = effectiveBase + revenueComponent;
  const cappedAmount = round.maxRaise ? Math.min(round.maxRaise, uncappedAmount) : uncappedAmount;
  // IR multiplier bonus: extra revenue from IR fraction of base multiplier, bypasses cap
  const irMultRevenue = annualRevenue * (irMultFraction * multiplier) * round.equityPercent;
  // Both IR components stack above the normal cap, total capped at maxRaise × (1 + overshoot)
  const totalIrExtra = irExtraBase + irMultRevenue;
  const irMaxRaise = round.maxRaise ? round.maxRaise * (1 + BALANCE.IR_MAX_OVERSHOOT * irCapMultiplier) : Infinity;
  const raiseAmount = Math.min(irMaxRaise, cappedAmount + totalIrExtra);
  // Effective equity = what fraction of total theoretical demand was captured.
  // See docs/design-docs/economics/fundraising.md for scenario table.
  const totalTheoretical = uncappedAmount + totalIrExtra;
  let effectiveEquity = round.equityPercent;
  if (totalTheoretical > 0 && raiseAmount < totalTheoretical) {
    effectiveEquity = round.equityPercent * (raiseAmount / totalTheoretical);
  }
  return { raiseAmount, effectiveEquity, irMultRevenue };
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
  const liveMultiplier = getFundraiseMultiplier(item.target);
  const liveRevenue = gameState.computed?.revenue?.gross || 0;
  const irBaseBonus = gameState.computed?.ceoFocus?.irFundraiseBonus || 0;
  const irMultFraction = gameState.computed?.ceoFocus?.irMultFraction || 0;
  const irCapMult = gameState.computed?.ceoFocus?.irCapMultiplier || 1;

  const annualRevenue = liveRevenue * 365;
  // Both IR components push above maxRaise cap (#564, #724)
  const { raiseAmount, effectiveEquity } = calculateFundraisePreview(round, annualRevenue, liveMultiplier, undefined, irBaseBonus, irMultFraction, irCapMult);

  // Tranche disbursement: money arrives over time instead of instantly
  const disbursementDuration = round.disbursementDuration ?? 1; // fallback to instant
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

  milestone('funding_milestone', {
    round_id: item.target,
    amount_raised: raiseAmount,
    valuation: state.valuation,
    equity_percent: effectiveEquity,
    multiplier: liveMultiplier,
  }, `funding_milestone_${item.target}`);

  triggerFundingMilestone(item.target, raiseAmount, effectiveEquity, liveMultiplier);

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
  const hrDriftRate = gameState.computed?.hrCultureDriftRate || 0;
  const hrDrift = hrDriftRate * deltaTime;
  const passiveDrift = BALANCE.CULTURE_PASSIVE_DRIFT_RATE * deltaTime * getCultureSpeedMultiplier();
  applyAllocationDrift(target, Math.max(hrDrift, passiveDrift));
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

  const item = createFundraiseItem(roundId, round.duration, lockedMultiplier, lockedRevenue);
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

  const duration = purchasable.furloughTime ?? purchasable.focusDuration * 0.5;
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
  window.getHRCultureDrift = getHRCultureDrift;
}
