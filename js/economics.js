// Player-facing text: see docs/message-registry.json
// Economics - Grant processing, line of credit, bankruptcy

import { gameState } from './game-state.js';
import { GRANTS, LINE_OF_CREDIT } from '../data/balance.js';
import { addActionMessage, addNewsMessage, hasMessageBeenTriggered, markMessageTriggered } from './messages.js';
import { addNewsItem } from './news-feed.js';
import { formatFunding } from './utils/format.js';
import { creditWarningMessage, creditWarningPreAdaMessage } from './content/message-content.js';
import {
  AUTOMATABLE_PERSONNEL,
  AUTOMATABLE_COMPUTE,
  AUTOMATABLE_DATA,
} from './automation-state.js';
import { getPurchasableState } from './purchasable-state.js';

// --- Grant Income (display-only) ---

/**
 * Compute grant income rate without side effects.
 * Sums grantDef.rate for active, non-exhausted grants.
 * Called from updateForecasts() (during pause) and processGrants() (during ticks).
 */
export function computeGrantIncome() {
  let grantIncome = 0;
  for (const [grantId, grantDef] of Object.entries(GRANTS)) {
    const grantState = gameState.grants[grantId];
    if (!grantState) continue;
    if (grantState.active && !grantState.exhausted) {
      grantIncome += grantDef.rate;
      // Include initial disbursement rate if still being paid out
      if (grantState.initialRemaining > 0) {
        grantIncome += grantDef.initial; // disbursed at initial/s (over 1s)
      }
    }
  }
  if (!gameState.computed.grants) {
    gameState.computed.grants = {};
  }
  gameState.computed.grants.income = grantIncome;
  return grantIncome;
}

// --- Grant Processing ---

/**
 * Process grants each tick:
 * - Check for newly triggered grants (capability unlocked)
 * - Pay initial amount when grant activates
 * - Pay rate per second while active
 * - Mark exhausted when duration reached
 */
export function processGrants(deltaTime) {
  const caps = gameState.tracks.capabilities.unlockedCapabilities;

  for (const [grantId, grantDef] of Object.entries(GRANTS)) {
    const grantState = gameState.grants[grantId];
    if (!grantState) continue;

    // Check for trigger activation
    if (!grantState.active && !grantState.exhausted) {
      if (grantDef.trigger === null || caps.includes(grantDef.trigger)) {
        activateGrant(grantId, grantDef, grantState);
      }
    }

    // Process active grant
    if (grantState.active && !grantState.exhausted) {
      // Disburse initial over 1s if any remains
      if (grantState.initialRemaining > 0) {
        const initialPayment = Math.min(grantState.initialRemaining, grantDef.initial * deltaTime);
        gameState.resources.funding += initialPayment;
        grantState.totalPaid += initialPayment;
        grantState.initialRemaining -= initialPayment;
      }

      // Pay rate
      const payment = grantDef.rate * deltaTime;
      gameState.resources.funding += payment;
      grantState.totalPaid += payment;

      // Track elapsed time
      grantState.elapsed += deltaTime;

      // Check for exhaustion
      if (grantState.elapsed >= grantDef.duration) {
        grantState.active = false;
        grantState.exhausted = true;
        addNewsItem(`Finance: ${grantDef.name} period concluded, ${formatFunding(grantState.totalPaid)} disbursed`, 'info');
      }
    }
  }

  // Update computed grant income (shared with updateForecasts)
  computeGrantIncome();
}

function activateGrant(grantId, grantDef, grantState) {
  grantState.active = true;

  // Queue initial amount for disbursement through the rate loop
  if (grantDef.initial > 0 && grantState.initialRemaining === 0) {
    grantState.initialRemaining = grantDef.initial;
  }

  // Send news
  const totalGrant = grantDef.initial + grantDef.rate * grantDef.duration;
  if (grantId === 'seed' && grantDef.rate > 0) {
    addNewsItem(`Campus Wire: "CS department spinoff secures ${formatFunding(totalGrant)} research funding"`, 'success');
  } else if (grantId === 'research') {
    addNewsItem(`Reuters: "National Innovation Foundation awards ${formatFunding(totalGrant)} AI research grant"`, 'success');
  }
}

/**
 * Get grant status for UI display
 * @returns {Array} Array of grant display objects
 */
export function getGrantStatus() {
  const result = [];

  for (const [grantId, grantDef] of Object.entries(GRANTS)) {
    const grantState = gameState.grants[grantId];
    if (!grantState) continue;

    const remaining = Math.max(0, grantDef.duration - grantState.elapsed);

    result.push({
      id: grantId,
      name: grantDef.name,
      rate: grantDef.rate,
      remaining,
      totalPaid: grantState.totalPaid,
      active: grantState.active,
      exhausted: grantState.exhausted,
      trigger: grantDef.trigger,
      pending: !grantState.active && !grantState.exhausted && grantDef.trigger !== null,
    });
  }

  return result;
}

// --- Line of Credit Processing ---

/**
 * Process line of credit each tick:
 * - Calculate current credit limit
 * - Apply interest on negative balance
 * - Send CFO warning on first use
 * - Check for bankruptcy
 */
export function processCredit(deltaTime) {
  // 1 real second = 1 game day, so annual = revenue * 365
  const annualRevenue = (gameState.computed?.revenue?.gross || 0) * 365;
  const rawLimit = LINE_OF_CREDIT.BASE_LIMIT + LINE_OF_CREDIT.REVENUE_SCALING * annualRevenue;
  const creditLimit = Math.max(20000, Math.min(1_000_000_000, rawLimit));  // Floor $20K, cap $1B
  gameState.credit.limit = creditLimit;

  const funding = gameState.resources.funding;

  // Check if using credit
  if (funding < 0) {
    // First time going negative - pause and send warning
    if (!gameState.credit.warningShown) {
      gameState.paused = true;
      gameState.pauseReason = 'credit_warning';
      const isPostSeriesA = gameState.fundraiseRounds?.series_a?.raised;
      sendCreditWarning(
        isPostSeriesA ? creditWarningMessage : creditWarningPreAdaMessage,
        isPostSeriesA ? 'post_ada' : 'pre_ada'
      );
      gameState.credit.warningShown = true;
    }

    gameState.credit.inUse = true;

    // Apply interest (20% APR, 1 real second = 1 game day)
    const interestPerSecond = LINE_OF_CREDIT.INTEREST_RATE / 365;
    const interest = Math.abs(funding) * interestPerSecond * deltaTime;
    gameState.resources.funding -= interest;

    // Check for bankruptcy
    if (gameState.resources.funding <= -creditLimit) {
      const fundingRate = gameState.computed?.revenue?.freeCashFlow || 0;
      if (fundingRate < 0 && !gameState.debugDisableBankruptcy) {
        triggerBankruptcy();
      }
    }
  } else {
    gameState.credit.inUse = false;
  }
}

function sendCreditWarning(msg, variant) {
  const triggerId = msg.triggeredBy;
  if (hasMessageBeenTriggered(triggerId)) return;

  addActionMessage(
    msg.sender,
    msg.subject,
    msg.body,
    msg.signature,
    msg.choices,
    msg.priority,
    msg.tags,
    triggerId,
    { variant }
  );

  markMessageTriggered(triggerId);
}

/**
 * Handle credit warning choice.
 * 'furlough_all' sets all automation targets to zero (emergency austerity).
 */
export function handleCreditWarningChoice(choiceId) {
  if (choiceId !== 'furlough_all') return; // 'acknowledge' has no effect

  const allItems = [
    ...AUTOMATABLE_PERSONNEL.map(p => p.id),
    ...AUTOMATABLE_COMPUTE.map(c => c.id),
    ...AUTOMATABLE_DATA.map(d => d.id),
    'hr_team',
    'procurement_team_unit',
  ];

  for (const itemId of allItems) {
    const state = getPurchasableState(itemId);
    if (state.count > 0) {
      state.automation.enabled = true;
      state.automation.type = 'fixed';
      state.automation.targetValue = 0;
    }
  }

  addNewsMessage(
    'EMERGENCY AUSTERITY: All automation targets set to zero. Staff and compute being furloughed.',
    ['economics', 'internal']
  );
}

function triggerBankruptcy() {
  // Set bankrupted flag — next tick checkEndings() detects it and showPrestigeModal
  // handles pausing. Don't pause here or the game loop won't tick to trigger the modal.
  gameState.bankrupted = true;

  addNewsItem('FT: "Promising AI venture folds amid cash crunch"', 'danger');
}

/**
 * Check if purchases are blocked due to credit usage
 * @returns {boolean} True if purchases should be blocked
 */
export function isPurchaseBlockedByCredit() {
  return gameState.resources.funding < 0;
}

/**
 * Get credit status for UI display
 */
export function getCreditStatus() {
  const funding = gameState.resources.funding;
  const limit = gameState.credit.limit;
  // 1 real second = 1 game day
  const annualRevenue = (gameState.computed?.revenue?.gross || 0) * 365;
  const interestPerSecond = funding < 0
    ? Math.abs(funding) * LINE_OF_CREDIT.INTEREST_RATE / 365
    : 0;

  return {
    inUse: gameState.credit.inUse,
    balance: funding,
    limit,
    baseLimit: LINE_OF_CREDIT.BASE_LIMIT,
    revenueBonus: LINE_OF_CREDIT.REVENUE_SCALING * annualRevenue,
    interestRate: LINE_OF_CREDIT.INTEREST_RATE,
    interestPerSecond,
    headroom: limit + funding, // How much left before bankruptcy
  };
}

// --- Initialization ---

/**
 * Initialize grants for a new game
 * Called after game state is created to set up initial grant state
 */
export function initializeGrants() {
  // Seed grant starts active, initial handled by FUNDING.SEED_AMOUNT
  // Research grant activates when basic_transformer is unlocked
}

// Exports for window (playtester access)
export function initEconomicsExports() {
  window.processGrants = processGrants;
  window.processCredit = processCredit;
  window.getGrantStatus = getGrantStatus;
  window.getCreditStatus = getCreditStatus;
  window.isPurchaseBlockedByCredit = isPurchaseBlockedByCredit;
}
