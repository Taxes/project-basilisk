// js/ui/economics.js
// Funding display, token economics, fundraise rounds, ops bonus bar.
//
// Caching strategy:
//   _renderedFundraiseFingerprint — a "roundId:status" string per visible
//   fundraise round. When the fingerprint matches the previous render we
//   skip the full DOM rebuild and only patch the multiplier/valuation text
//   via stashed child refs on each card element (cardEl._infoSpan).
//   reset() clears the fingerprint so the next render does a full rebuild.

import { gameState } from '../game-state.js';
import { BALANCE, FUNDING, FUNDRAISE_ROUNDS } from '../../data/balance.js';
import { getPurchasableById, PERSONNEL_IDS, COMPUTE_IDS, ADMIN_IDS } from '../content/purchasables.js';
import { getFundraiseMultiplier, calculateFundraisePreview } from '../focus-queue.js';
import { getGrantStatus, getCreditStatus } from '../economics.js';
import { computeCostState } from '../resources.js';
import { getPurchasableState } from '../purchasable-state.js';
import { formatFunding, formatFundingParts, formatNumber, formatPercent, formatDuration, formatTime, getRateUnit } from '../utils/format.js';
import { $ } from '../utils/dom-cache.js';
import { el } from '../utils/dom.js';
import { registerUpdate, EVERY_TICK, FAST } from './scheduler.js';
import { attachTooltip } from './stats-tooltip.js';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------
let _renderedFundraiseFingerprint = '';

// Smart unit formatting: all ledger values use the same scale
// Based on token revenue magnitude with hysteresis to prevent flickering
let _ledgerDivisor = 1;   // 1 = $, 1000 = K, 1e6 = M
let _ledgerSuffix = '';   // '', 'K', 'M'

// ---------------------------------------------------------------------------
// Ledger row grace period — delay hiding rows for 5s to prevent jitter
// ---------------------------------------------------------------------------
const LEDGER_HIDE_DELAY = 5000; // ms
const _rowZeroSince = new Map(); // rowId → timestamp when value first hit 0

/** Show or hide a ledger row with a 5s grace period + fade. */
function setLedgerRowVisible(rowEl, visible) {
  if (!rowEl) return;
  const id = rowEl.id;
  if (visible) {
    _rowZeroSince.delete(id);
    rowEl.classList.remove('hidden', 'ledger-row-fading');
  } else {
    if (!_rowZeroSince.has(id)) {
      _rowZeroSince.set(id, Date.now());
    }
    if (Date.now() - _rowZeroSince.get(id) >= LEDGER_HIDE_DELAY) {
      rowEl.classList.add('hidden');
      rowEl.classList.remove('ledger-row-fading');
    } else {
      rowEl.classList.add('ledger-row-fading');
    }
  }
}

function updateLedgerScale() {
  const rev = gameState.computed?.revenue;
  if (!rev) return;
  const magnitude = Math.abs(rev.gross || 0);

  // Hysteresis: switch UP when displayed value >10K, DOWN when <2 of current unit
  if (_ledgerDivisor === 1 && magnitude >= 10000) {
    _ledgerDivisor = 1000;
    _ledgerSuffix = 'K';
  } else if (_ledgerDivisor === 1000 && magnitude < 2000) {
    _ledgerDivisor = 1;
    _ledgerSuffix = '';
  } else if (_ledgerDivisor === 1000 && magnitude >= 10000000) {
    _ledgerDivisor = 1e6;
    _ledgerSuffix = 'M';
  } else if (_ledgerDivisor === 1e6 && magnitude < 2000000) {
    _ledgerDivisor = 1000;
    _ledgerSuffix = 'K';
  }
}

function formatLedgerValue(value) {
  const scaled = value / _ledgerDivisor;
  const sign = scaled >= 0 ? '+' : '';
  // Use 1 decimal for K/M, 0 for raw $
  const precision = _ledgerDivisor > 1 ? 1 : 0;
  const formatted = Math.abs(scaled).toFixed(precision).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + (scaled < 0 ? '-' : '') + formatted;
}

/** Format a dollar amount using the current ledger scale (e.g. "$1.2K", "$3.5M"). */
function formatLedgerDollar(value) {
  const scaled = value / _ledgerDivisor;
  const precision = _ledgerDivisor > 1 ? 1 : 0;
  const formatted = Math.abs(scaled).toFixed(precision).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + formatted + _ledgerSuffix;
}

export function reset() {
  _renderedFundraiseFingerprint = '';
  _rowZeroSince.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get total salary cost per second from computed state */
export function calculateSalaryCost() {
  // Ensure computed namespace and costs exist (may be called before first tick)
  if (!gameState.computed) {
    gameState.computed = { research: null, costs: null, revenue: null, compute: null };
  }
  if (!gameState.computed.costs) {
    computeCostState();
  }
  return gameState.computed.costs?.personnel?.total || 0;
}

/** Get total compute running cost per second from computed state */
export function calculateComputeCost() {
  // Ensure computed namespace and costs exist (may be called before first tick)
  if (!gameState.computed) {
    gameState.computed = { research: null, costs: null, revenue: null, compute: null };
  }
  if (!gameState.computed.costs) {
    computeCostState();
  }
  return gameState.computed.costs?.compute?.total || 0;
}

/** Get total researcher count (including founder) */
export function getTotalResearcherCount() {
  const state = gameState;
  let count = 1; // Founder (you)

  for (const id of PERSONNEL_IDS) {
    count += state.purchases?.[id] || 0;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Funding Display
// ---------------------------------------------------------------------------

/** Format a subtotal value with sign and color class. */
function setSubtotal(elementId, value) {
  const el = $(elementId);
  if (!el) return;
  el.textContent = formatLedgerValue(value);
  const baseClass = el.classList.contains('ledger-value') ? 'ledger-value' : 'ledger-subtotal';
  el.className = baseClass + ' ' + (value >= 0 ? 'positive' : 'negative');
}

/** Format disbursement time remaining. */
function formatDisbursementTimeRemaining() {
  const disbursements = gameState.disbursements || [];
  if (disbursements.length === 0) return '';
  const totalRemaining = disbursements.reduce((sum, d) => sum + d.remaining, 0);
  const totalRate = disbursements.reduce((sum, d) => sum + d.rate, 0);
  if (totalRate <= 0) return '';
  const secondsLeft = totalRemaining / totalRate;
  return `(${formatDuration(secondsLeft)} left)`;
}

// ---------------------------------------------------------------------------
// Ledger Summary (left column at-a-glance)
// ---------------------------------------------------------------------------

/** Update the condensed ledger summary in the at-a-glance column. */
function updateLedgerSummary() {
  const rev = gameState.computed?.revenue;
  if (!rev) return;

  updateLedgerScale();
  const unitText = _ledgerSuffix
    ? `($${_ledgerSuffix}${getRateUnit()})`
    : `($${getRateUnit()})`;
  const unitEl = $('summary-ledger-unit');
  if (unitEl) unitEl.textContent = unitText;

  setSubtotal('summary-revenue', rev.gross || 0);
  setSubtotal('summary-opex', -(rev.opex?.total || 0));

  // Operating income = operating profit (revenue - opex)
  setSubtotal('summary-op-income', rev.operatingProfit || 0);

  // Other costs = investor share + interest + capex
  const otherCosts = (rev.investorShare || 0) + (rev.interestCost || 0) + (rev.capex?.total || 0);
  setSubtotal('summary-other-costs', -otherCosts);
  const otherCostsGroup = $('other-costs-summary-group');
  if (otherCostsGroup) otherCostsGroup.classList.toggle('hidden', otherCosts === 0);

  // Other income = grants + disbursements
  const otherIncome = rev.otherIncome?.total || 0;
  setSubtotal('summary-other-income', otherIncome);
  const otherIncomeGroup = $('other-income-summary-group');
  if (otherIncomeGroup) otherIncomeGroup.classList.toggle('hidden', otherIncome === 0);

  setSubtotal('summary-fcf', rev.freeCashFlow || 0);
}

// ---------------------------------------------------------------------------
// Full Funding Display (Finance sub-tab)
// ---------------------------------------------------------------------------

/** Update funding breakdown: income-statement layout with subtotals. */
export function updateFundingDisplay() {
  const state = gameState;
  const funding = state.resources.funding;
  // --- Header (always update, even before first tick) ---
  const fundingTotal = $('funding-total');
  if (fundingTotal) {
    // Update split spans for fixed-width display
    const parts = formatFundingParts(funding);
    const signEl = fundingTotal.querySelector('.funding-sign');
    const numEl = fundingTotal.querySelector('.funding-number');
    const sfxEl = fundingTotal.querySelector('.funding-suffix');
    if (signEl && numEl && sfxEl) {
      signEl.textContent = parts.sign;
      numEl.textContent = parts.number;
      sfxEl.textContent = parts.suffix;
    } else {
      fundingTotal.textContent = formatFunding(funding);
    }
    if (funding < 0 || funding < (FUNDING.LOW_FUNDING_WARNING || 100000)) {
      fundingTotal.classList.add('warning');
    } else {
      fundingTotal.classList.remove('warning');
    }
  }

  const rev = state.computed?.revenue;
  if (!rev) return;

  // --- Read all values from computed state (no calculations) ---
  const revenue = rev.gross || 0;
  const personnelCost = rev.opex?.personnel || 0;
  const computeCost = rev.opex?.compute || 0;
  const dataCost = rev.opex?.data || 0;
  const opexTotal = rev.opex?.total || 0;

  const operatingProfit = rev.operatingProfit || 0;
  const investorShare = rev.investorShare || 0;
  const interestCost = rev.interestCost || 0;
  const netIncome = rev.netIncome || 0;

  const disbursementRate = rev.otherIncome?.disbursements || 0;
  const _grantIncome = rev.otherIncome?.grants || 0;
  const otherIncome = rev.otherIncome?.total || 0;

  const capexHiring = rev.capex?.hiring || 0;
  const capexInfra = rev.capex?.infra || 0;
  const capexTotal = rev.capex?.total || 0;

  const freeCashFlow = rev.freeCashFlow || 0;

  const creditStatus = getCreditStatus();

  // Set column header unit
  updateLedgerScale();
  const unitText = _ledgerSuffix
    ? `($${_ledgerSuffix}${getRateUnit()})`
    : `($${getRateUnit()})`;
  const unitEl = $('ledger-unit');
  if (unitEl) unitEl.textContent = unitText;

  const netEl = $('funding-rate');
  if (netEl) {
    const rateUnit = getRateUnit();
    // Update split spans for fixed-width display
    const signSpan = netEl.querySelector('.funding-sign');
    const numSpan = netEl.querySelector('.funding-number');
    const sfxSpan = netEl.querySelector('.funding-suffix');
    const unitSpan = netEl.querySelector('.funding-unit');
    if (signSpan && numSpan && sfxSpan && unitSpan) {
      const scaled = freeCashFlow / _ledgerDivisor;
      const precision = _ledgerDivisor > 1 ? 1 : 0;
      const formatted = Math.abs(scaled).toFixed(precision).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      signSpan.textContent = scaled >= 0 ? '+' : '-';
      numSpan.textContent = formatted;
      sfxSpan.textContent = _ledgerSuffix;
      unitSpan.textContent = rateUnit;
    } else {
      const rateUnitFull = _ledgerSuffix
        ? `${_ledgerSuffix}${rateUnit}`
        : rateUnit;
      netEl.textContent = '(' + formatLedgerValue(freeCashFlow) + rateUnitFull + ')';
    }
    netEl.className = 'stat-rate funding-parts ' + (freeCashFlow >= 0 ? 'positive' : 'negative');
  }

  const runwayEl = $('funding-runway');
  if (runwayEl) {
    const funding = state.resources.funding;
    const runway = rev.runway;
    if (funding < 0 && freeCashFlow < 0 && creditStatus.inUse) {
      // On credit with negative cash flow — show time until credit exhaustion
      const headroom = creditStatus.headroom; // limit + funding (positive = room left)
      if (headroom > 0) {
        const daysLeft = Math.floor(headroom / -freeCashFlow);
        runwayEl.textContent = `bankrupt in ${formatDuration(daysLeft)}`;
        runwayEl.classList.remove('hidden');
        runwayEl.classList.add('warning');
      } else {
        runwayEl.textContent = 'bankrupt';
        runwayEl.classList.remove('hidden');
        runwayEl.classList.add('warning');
      }
    } else if (runway !== Infinity && runway > 0) {
      const runwayDays = Math.floor(runway);
      if (runwayDays > 3650) {
        runwayEl.textContent = '>10y runway';
      } else if (runwayDays > 365) {
        const years = Math.floor(runwayDays / 365);
        const days = runwayDays % 365;
        runwayEl.textContent = `${years}y ${days}d runway`;
      } else {
        runwayEl.textContent = `${runwayDays}d runway`;
      }
      runwayEl.classList.remove('hidden');
      runwayEl.classList.remove('warning');
    } else {
      runwayEl.classList.add('hidden');
      runwayEl.classList.remove('warning');
    }
  }

  // --- Revenue ---
  const revenueEl = $('revenue-rate');
  if (revenueEl) revenueEl.textContent = formatLedgerValue(revenue);
  setSubtotal('revenue-subtotal', revenue);

  // --- Operating Costs ---
  const salaryEl = $('salary-cost');
  if (salaryEl) salaryEl.textContent = formatLedgerValue(-personnelCost);

  const computeCostEl = $('compute-cost');
  if (computeCostEl) computeCostEl.textContent = formatLedgerValue(-computeCost);

  const dataRow = $('data-cost-row');
  const dataCostEl = $('data-running-cost');
  setLedgerRowVisible(dataRow, dataCost > 0);
  if (dataCostEl) dataCostEl.textContent = formatLedgerValue(-dataCost);
  setSubtotal('opex-subtotal', -opexTotal);

  // --- Operating Profit ---
  setSubtotal('operating-profit', operatingProfit);

  // Investor Share
  const investorRow = $('investor-share-row');
  const investorEl = $('investor-share');
  const equityPctEl = $('equity-pct');
  const equitySold = state.totalEquitySold || 0;
  setLedgerRowVisible(investorRow, equitySold > 0);
  if (equitySold > 0) {
    if (investorEl) investorEl.textContent = formatLedgerValue(-Math.abs(investorShare));
    if (equityPctEl) equityPctEl.textContent = `(${(equitySold * 100).toFixed(0)}%)`;
  }

  // Interest
  const interestRow = $('interest-row');
  const interestCostEl = $('interest-cost');
  setLedgerRowVisible(interestRow, interestCost > 0);
  if (interestCostEl) interestCostEl.textContent = formatLedgerValue(-interestCost);

  // --- Net Income ---
  setSubtotal('net-income', netIncome);

  // --- Other Income ---
  const otherIncomeGroup = $('other-income-group');
  setLedgerRowVisible(otherIncomeGroup, otherIncome > 0);

  const disbursementRow = $('disbursement-row');
  const disbursementEl = $('disbursement-rate');
  const disbursementTimeEl = $('disbursement-time');
  setLedgerRowVisible(disbursementRow, disbursementRate > 0);
  if (disbursementRate > 0) {
    if (disbursementEl) disbursementEl.textContent = formatLedgerValue(disbursementRate);
    if (disbursementTimeEl) disbursementTimeEl.textContent = formatDisbursementTimeRemaining();
  }

  // Individual grant rows
  const grants = getGrantStatus();
  for (const g of grants) {
    const rowId = g.id === 'seed' ? 'seed-grant-row' : 'research-grant-row';
    const row = $(rowId);
    if (!row) continue;
    const grantVisible = g.active && g.remaining > 0;
    setLedgerRowVisible(row, grantVisible);
    if (grantVisible) {
      const rateEl = $(g.id === 'seed' ? 'seed-grant-rate' : 'research-grant-rate');
      const timeEl = $(g.id === 'seed' ? 'seed-grant-time' : 'research-grant-time');
      if (rateEl) rateEl.textContent = formatLedgerValue(g.rate);
      if (timeEl) timeEl.textContent = `(${formatDuration(g.remaining)} left)`;
    }
  }
  // CEO discretionary grants — show row whenever grants activity is selected,
  // even when rate is 0 (CEO busy with queue items). Avoids fade/reappear on pause.
  const ceoGrantRow = $('ceo-grant-row');
  const ceoGrantRateEl = $('ceo-grant-rate');
  const ceoGrantRate = rev.otherIncome?.ceoGrants || 0;
  const ceoGrantsSelected = gameState.computed?.ceoFocus?.selected === 'grants';
  setLedgerRowVisible(ceoGrantRow, ceoGrantsSelected);
  if (ceoGrantRateEl) ceoGrantRateEl.textContent = ceoGrantsSelected ? formatLedgerValue(ceoGrantRate) : '';

  setSubtotal('other-income-subtotal', otherIncome);

  // --- CapEx ---
  const capexGroup = $('capex-group');
  setLedgerRowVisible(capexGroup, capexTotal > 0);

  const capexHiringRow = $('capex-hiring-row');
  const capexHiringEl = $('capex-hiring-cost');
  setLedgerRowVisible(capexHiringRow, capexHiring > 0);
  if (capexHiringEl) capexHiringEl.textContent = formatLedgerValue(-capexHiring);

  const capexInfraRow = $('capex-infra-row');
  const capexInfraEl = $('capex-infra-cost');
  setLedgerRowVisible(capexInfraRow, capexInfra > 0);
  if (capexInfraEl) capexInfraEl.textContent = formatLedgerValue(-capexInfra);
  setSubtotal('capex-subtotal', -capexTotal);

  // --- Free Cash Flow ---
  setSubtotal('free-cash-flow', freeCashFlow);

  // --- Credit Warning ---
  const creditWarning = $('credit-warning');
  const creditBalanceEl = $('credit-balance');
  const creditLimitEl = $('credit-limit');
  if (creditWarning) {
    if (creditStatus.inUse) {
      creditWarning.classList.remove('hidden');
      if (creditBalanceEl) creditBalanceEl.textContent = formatFunding(funding);
      if (creditLimitEl) creditLimitEl.textContent = formatFunding(creditStatus.limit);
    } else {
      creditWarning.classList.add('hidden');
    }
  }
}

/** Build tooltip HTML for a specific ledger row type. */
function buildLedgerRowTooltip(rowType) {
  const state = gameState;
  const opsDiscount = state.computed?.costs?.opsDiscount ?? 1;
  let html = '';

  if (rowType === 'revenue') {
    const price = state.resources.tokenPrice || 0;
    const tokens = Math.min(state.resources.tokensPerSecond || 0, state.resources.demand || 0);
    html = `<div class="tooltip-row"><span>Price \u00d7 Tokens</span><span>$${price.toFixed(2)}/M \u00d7 ${formatNumber(tokens)}${getRateUnit()}</span></div>`;
    const rev = state.computed?.revenue;
    const cultureBonus = rev?.cultureBonus || 0;
    const ppBonus = rev?.ppBonus || 0;
    const prestigeMult = rev?.prestigeMultiplier ?? 1;
    if (cultureBonus > 0.005) {
      html += `<div class="tooltip-row"><span>Culture Bonus</span><span>+${formatPercent(cultureBonus)}</span></div>`;
    }
    if (ppBonus > 0.005) {
      html += `<div class="tooltip-row"><span>Public Positioning</span><span>+${formatPercent(ppBonus)}</span></div>`;
    }
    if (Math.abs(prestigeMult - 1) > 0.005) {
      html += `<div class="tooltip-row"><span>Prestige Bonus</span><span>\u00d7${prestigeMult.toFixed(2)}</span></div>`;
    }
  } else if (rowType === 'disbursement') {
    const disbursements = state.disbursements || [];
    for (const d of disbursements) {
      const roundName = d.roundId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const raised = state.fundraiseRounds[d.roundId]?.raisedAmount || d.totalAmount;
      html += `<div class="tooltip-row"><span>${roundName}</span><span>${formatFunding(raised)} raised, ${formatFunding(d.remaining)} left</span></div>`;
    }
  } else if (rowType === 'grant') {
    const grants = getGrantStatus();
    for (const g of grants.filter(g => g.active)) {
      html += `<div class="tooltip-row"><span>${g.name}</span><span>+${formatLedgerDollar(g.rate)}${getRateUnit()} (${formatDuration(g.remaining)} left)</span></div>`;
    }
  } else if (rowType === 'salary') {
    const breakdown = state.computed?.costs?.personnel?.breakdown || {};
    const adminBreakdown = state.computed?.costs?.admin?.breakdown || {};
    const combined = { ...breakdown, ...adminBreakdown };
    const items = Object.keys(combined)
      .filter(id => combined[id]?.count > 0)
      .map(id => ({ id, ...combined[id] }))
      .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
    for (const item of items) {
      const p = getPurchasableById(item.id);
      html += `<div class="tooltip-row"><span>${item.count}\u00d7 ${p?.name || item.id}</span><span class="negative">-${formatLedgerDollar(item.cost * opsDiscount)}${getRateUnit()}</span></div>`;
    }
  } else if (rowType === 'compute') {
    const breakdown = state.computed?.costs?.compute?.breakdown || {};
    const items = COMPUTE_IDS
      .filter(id => breakdown[id]?.count > 0)
      .map(id => ({ id, ...breakdown[id] }))
      .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
    for (const item of items) {
      const p = getPurchasableById(item.id);
      html += `<div class="tooltip-row"><span>${item.count}\u00d7 ${p?.name || item.id}</span><span class="negative">-${formatLedgerDollar(item.cost * opsDiscount)}${getRateUnit()}</span></div>`;
    }
  } else if (rowType === 'data') {
    const dataBreakdown = state.computed?.costs?.data?.breakdown || {};
    const items = Object.keys(dataBreakdown)
      .filter(id => dataBreakdown[id]?.count > 0)
      .map(id => ({ id, ...dataBreakdown[id] }))
      .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
    for (const item of items) {
      const p = getPurchasableById(item.id);
      html += `<div class="tooltip-row"><span>${item.count}\u00d7 ${p?.name || item.id}</span><span class="negative">-${formatLedgerDollar(item.cost * opsDiscount)}${getRateUnit()}</span></div>`;
    }
  } else if (rowType === 'capex-hiring' || rowType === 'capex-infra') {
    const isHiring = rowType === 'capex-hiring';
    const queue = state.focusQueue || [];
    // Focus queue items in progress — read costPerSecond stored during tick
    for (const item of queue) {
      if (item.type !== 'purchase' || !item.unitCost) continue;
      const p = getPurchasableById(item.target);
      if (!p) continue;
      const isCompute = p.category === 'compute';
      if (isHiring === isCompute) continue; // Wrong category for this tooltip
      const costPerSec = item.costPerSecond || 0;
      if (costPerSec <= 0) continue;
      const remaining = (item.quantity || 1) - (item.completed || 0);
      html += `<div class="tooltip-row"><span>${remaining}\u00d7 ${p.name} (building)</span><span class="negative">-${formatLedgerDollar(costPerSec)}${getRateUnit()}</span></div>`;
    }
    // Automation builds in progress — read costPerSecond stored during tick
    const checkIds = isHiring
      ? [...PERSONNEL_IDS, ...ADMIN_IDS]
      : COMPUTE_IDS;
    for (const id of checkIds) {
      const ps = getPurchasableState(id);
      if (!ps?.automation?.building) continue;
      const p = getPurchasableById(id);
      const build = ps.automation.building;
      const costPerSec = build.costPerSecond || 0;
      if (costPerSec <= 0) continue;
      html += `<div class="tooltip-row"><span>1\u00d7 ${p?.name || id} (auto)</span><span class="negative">-${formatLedgerDollar(costPerSec)}${getRateUnit()}</span></div>`;
    }
  }

  return html || '<div class="tooltip-row dim"><span>No data</span></div>';
}

/** Initialize ledger summary click handler (left column → Finance sub-tab). */
export function initLedgerSummary() {
  const ledgerSummary = document.getElementById('ledger-summary');
  if (ledgerSummary && !ledgerSummary.dataset.initialized) {
    ledgerSummary.dataset.initialized = 'true';
    ledgerSummary.style.cursor = 'pointer';
    ledgerSummary.addEventListener('click', () => {
      // Dynamic import to avoid circular dependency
      import('./tab-navigation.js').then(({ switchTab }) => {
        switchTab('dashboard');
        const financeTab = document.querySelector('.sub-tab[data-category="finance"]');
        if (financeTab) financeTab.click();
      });
    });
  }
}

/** Initialize custom tooltips on ledger rows (replaces browser-native title attributes). */
export function initLedgerTooltips() {
  const rows = [
    { el: $('revenue-row'), type: 'revenue' },
    { el: $('disbursement-row'), type: 'disbursement' },
    { el: $('seed-grant-row'), type: 'grant' },
    { el: $('research-grant-row'), type: 'grant' },
    { el: $('salary-row'), type: 'salary' },
    { el: $('compute-row'), type: 'compute' },
    { el: $('data-cost-row'), type: 'data' },
    { el: $('capex-hiring-row'), type: 'capex-hiring' },
    { el: $('capex-infra-row'), type: 'capex-infra' },
  ];

  for (const row of rows) {
    if (!row.el) continue;
    attachTooltip(row.el, () => buildLedgerRowTooltip(row.type));
    row.el.removeAttribute('title');
  }
}

// ---------------------------------------------------------------------------
// Pricing Tooltips
// ---------------------------------------------------------------------------

/** Build tooltip HTML for a specific pricing row type. */
function buildPricingTooltip(rowType) {
  const state = gameState;
  if (rowType === 'max-demand') {
    return '<div class="tooltip-row">Demand at your current price. Pricing above the market price reduces demand; pricing below increases it. The further your price is from market price, the stronger the effect.</div>';
  } else if (rowType === 'acquired-demand') {
    return buildAcquiredDemandTooltip();
  } else if (rowType === 'market-demand') {
    return '<div class="tooltip-row">Total addressable market at the market price. Grows as you unlock capabilities and applications, and scales with your competitive position.</div>';
  } else if (rowType === 'market-edge') {
    const edge = state.resources.marketEdge || 1;
    const edgeMultiplier = Math.max(edge, 0.1).toFixed(1);
    return `<div class="tooltip-row">Market edge represents how advanced your technology is compared to the market. Decays over time as competitors develop — unlock new applications to refresh it. Currently contributes ${edgeMultiplier}\u00d7 to demand for your products.</div>`;
  } else if (rowType === 'elasticity') {
    const elast = state.resources.effectiveElasticity || 1;
    const pctImpact = Math.round(elast * 10);
    return `<div class="tooltip-row">Price sensitivity of demand. At ${elast.toFixed(1)}, a 10% price increase reduces demand by roughly ${pctImpact}%. Affected by competition and company culture.</div>`;
  } else if (rowType === 'market-expansion') {
    return '<div class="tooltip-row">Compounding demand multiplier from AI Market Expansion. Grows each tick, increasing total addressable demand.</div>';
  } else if (rowType === 'price-drift') {
    return '<div class="tooltip-row">Actual price drifts toward target at up to <span style="white-space:nowrap">1.5%/s.</span> Use +/\u2212 to set a new target.</div>';
  }
  return '';
}

/** Build dynamic tooltip for acquired demand showing growth factors. */
function buildAcquiredDemandTooltip() {
  const state = gameState;
  const acquired = state.resources.acquiredDemand || 0;
  const demandAtPrice = state.resources.demand || 0;
  const supply = state.resources.tokensPerSecond || 0;
  const delta = state.resources.acquiredDemandDelta || 0;

  // Use stored cap from game loop; fall back to recalculation for tooltip-only edge cases
  const unlockedApps = state.tracks?.applications?.unlockedCapabilities || [];
  const graceFactor = unlockedApps.includes('ai_market_expansion')
    ? BALANCE.LATE_GAME_GRACE_FACTOR
    : BALANCE.ACQUIRED_DEMAND_GRACE_FACTOR;
  const supplyCap = supply * graceFactor;
  const potentialDemand = state.resources.acquiredDemandCap ?? Math.min(demandAtPrice, supplyCap);
  const fillPct = potentialDemand > 0 ? Math.round(acquired / potentialDemand * 100) : 0;

  // Status
  let status, statusCls;
  if (Math.abs(delta) < 0.5) {
    status = `Stable (${fillPct}% filled)`;
    statusCls = '';
  } else if (delta > 0) {
    status = `Growing (${fillPct}% filled)`;
    statusCls = 'positive';
  } else {
    status = `Churning (${fillPct}% filled)`;
    statusCls = 'negative';
  }

  let html = '<div class="tooltip-row">Acquired demand grows towards max demand as your sales team signs customers. But if you can\'t meet demand or raise prices too quickly, customers may churn.</div>';
  html += '<div class="tooltip-section">';
  html += `<div class="tooltip-row"><span>Status</span><span class="${statusCls}">${status}</span></div>`;

  // Net rate
  const deltaSign = delta >= 0 ? '+' : '-';
  html += `<div class="tooltip-row"><span>Net rate</span><span class="${delta >= 0 ? 'positive' : 'negative'}">${deltaSign}${formatNumber(Math.abs(delta))}/s</span></div>`;

  // Current cap
  if (demandAtPrice <= supplyCap) {
    html += `<div class="tooltip-row"><span>Capped at max demand</span><span>${formatNumber(demandAtPrice)}</span></div>`;
  } else {
    html += `<div class="tooltip-row"><span>Capped at ${graceFactor}\u00d7 supply</span><span>${formatNumber(supplyCap)}</span></div>`;
  }

  // Active multipliers (only show when non-default)
  const ppMult = state.computed?.ceoFocus?.acquiredDemandGrowthMultiplier ?? 1;
  if (ppMult > 1.001) {
    html += `<div class="tooltip-row"><span>Public Positioning</span><span>\u00d7${ppMult.toFixed(2)} growth</span></div>`;
  }

  const isProprietary = state.strategicChoices?.openVsProprietary === 'proprietary';
  if (isProprietary) {
    html += '<div class="tooltip-row"><span>Proprietary</span><span>\u00d71.25 growth / \u00d70.75 churn</span></div>';
  }

  html += '</div>';
  return html;
}

/** Initialize custom tooltips on pricing panel rows. */
export function initPricingTooltips() {
  const rows = [
    { el: $('max-demand-row'), type: 'max-demand' },
    { el: $('acquired-demand-row'), type: 'acquired-demand' },
    { el: $('market-demand-row'), type: 'market-demand' },
    { el: $('market-edge-row'), type: 'market-edge' },
    { el: $('elasticity-row'), type: 'elasticity' },
    { el: $('market-expansion-row'), type: 'market-expansion' },
    { el: $('price-drift-indicator'), type: 'price-drift' },
  ];

  for (const row of rows) {
    attachTooltip(row.el, () => buildPricingTooltip(row.type));
  }
}

// ---------------------------------------------------------------------------
// Token Economics
// ---------------------------------------------------------------------------

/** Format market edge as "years ahead/behind" */
function formatMarketEdge(marketEdge) {
  if (marketEdge <= 0) return 'No market position';

  const logValue = Math.log10(marketEdge);

  if (Math.abs(logValue) < 0.05) {
    return 'Even with market';
  }

  const absYears = Math.abs(logValue).toFixed(1);

  if (logValue > 0) {
    return `${absYears} yrs ahead \u25BC`; // always decaying
  } else {
    return `${absYears} yrs behind \u25BC`;
  }
}

/** Get CSS class for market edge coloring */
function getMarketEdgeClass(marketEdge) {
  const logValue = Math.log10(Math.max(0.001, marketEdge));
  if (logValue > 1.0) return 'edge-strong';   // > 1 year ahead: green
  if (logValue > 0) return 'edge-moderate';    // 0-1 year ahead: yellow
  return 'edge-behind';                         // behind: red
}

/** Initialize token pricing controls */
export function initTokenPricing() {
  const priceDisplay = $('token-price-display');
  const priceDown = $('token-price-down');
  const priceUp = $('token-price-up');

  // Sync targetPrice with tokenPrice on init (for loaded saves)
  if (gameState.resources.targetPrice == null) {
    gameState.resources.targetPrice = gameState.resources.tokenPrice;
  }

  // Update display
  if (priceDisplay) {
    priceDisplay.textContent = '$' + gameState.resources.tokenPrice.toFixed(2);
  }

  // +/- buttons adjust target by 5% (multiplicative); actual price drifts via inertia
  // Throttle: ignore clicks within 100ms to prevent hardware double-click mice
  let _lastPriceClickTime = 0;

  attachTooltip(priceDown, () => 'Decrease price by 5%', { position: 'above' });
  attachTooltip(priceUp, () => 'Increase price by 5%', { position: 'above' });

  if (priceDown) {
    priceDown.addEventListener('click', () => {
      const now = Date.now();
      if (now - _lastPriceClickTime < 100) return;
      _lastPriceClickTime = now;
      const currentTarget = gameState.resources.targetPrice ?? gameState.resources.tokenPrice;
      gameState.resources.targetPrice = Math.max(0.01, Math.round(currentTarget * 0.95 * 100) / 100);
      updateTokenEconomicsDisplay();
    });
  }

  if (priceUp) {
    priceUp.addEventListener('click', () => {
      const now = Date.now();
      if (now - _lastPriceClickTime < 100) return;
      _lastPriceClickTime = now;
      const currentTarget = gameState.resources.targetPrice ?? gameState.resources.tokenPrice;
      gameState.resources.targetPrice = Math.min(1000, Math.round(currentTarget * 1.05 * 100) / 100);
      updateTokenEconomicsDisplay();
    });
  }
}

/** Initialize autopricer controls */
export function initAutopricer() {
  const toggle = $('autopricer-toggle');
  const modeSelect = $('autopricer-mode');

  if (!toggle || !modeSelect) return;

  // Sync UI to saved state on load
  toggle.checked = !!gameState.resources.autopricerEnabled;
  if (gameState.resources.autopricerMode) {
    modeSelect.value = gameState.resources.autopricerMode;
  }

  toggle.addEventListener('change', (e) => {
    gameState.resources.autopricerEnabled = e.target.checked;
    // Manual +/- buttons still work when autopricer is active (intentional override)
  });

  modeSelect.addEventListener('change', (e) => {
    gameState.resources.autopricerMode = e.target.value;
  });

  // Help tooltip
  attachTooltip($('autopricer-help'), () =>
    `<b>Growth</b> — Target 150% demand:supply ratio (build customer base)<br>` +
    `<b>Balanced</b> — Target 120% demand:supply ratio (slight excess demand)<br>` +
    `<b>Extraction</b> — Target 100% demand:supply ratio (maximize price)`
  );
}

/** Update token economics display: demand, generation, revenue, pricing */
export function updateTokenEconomicsDisplay() {
  const state = gameState;

  const demandDisplay = $('demand-display');
  const generatingDisplay = $('generating-display');
  const sellingDisplay = $('selling-display');
  const revenueDisplay = $('token-revenue-display');

  const revenue = state.computed?.revenue?.gross || 0;

  if (demandDisplay) {
    const demand = state.resources.demand;
    const supply = state.resources.tokensPerSecond;
    demandDisplay.textContent = formatNumber(demand);
    demandDisplay.className = 'pricing-stat-value ' + (demand >= supply ? 'positive' : 'negative');
  }

  // Demand at target price preview (read from computed state — uses correct elasticity at target)
  const demandAtTargetEl = $('demand-at-target');
  if (demandAtTargetEl) {
    const demandAtTarget = state.computed?.revenue?.demandAtTarget;
    if (demandAtTarget != null) {
      const target = state.resources.targetPrice ?? state.resources.tokenPrice;
      demandAtTargetEl.textContent = '(\u2192 ' + formatNumber(demandAtTarget) + ' @ $' + target.toFixed(2) + ')';
      demandAtTargetEl.className = 'dim ' + (demandAtTarget >= state.resources.tokensPerSecond ? 'positive' : 'negative');
      demandAtTargetEl.style.visibility = 'visible';
    } else {
      demandAtTargetEl.style.visibility = 'hidden';
    }
  }
  if (generatingDisplay) {
    generatingDisplay.textContent = formatNumber(state.resources.tokensPerSecond);
  }
  if (sellingDisplay) {
    sellingDisplay.textContent = formatNumber(state.resources.tokensSold || 0);
  }
  if (revenueDisplay) {
    revenueDisplay.textContent = formatFunding(revenue) + getRateUnit();
  }

  // Reference price indicator
  const refPriceDisplay = $('reference-price-display');
  if (refPriceDisplay) {
    const refPrice = state.resources.referencePrice || 0.50;
    refPriceDisplay.textContent = '$' + refPrice.toFixed(2) + '/M';
  }

  // Acquired demand display
  const acquiredDisplay = $('acquired-demand-display');
  if (acquiredDisplay) {
    const acquired = state.resources.acquiredDemand || 0;
    const cap = state.resources.acquiredDemandCap;
    const isCapped = cap != null && cap > 0 && acquired >= cap * 0.99;
    acquiredDisplay.innerHTML = formatNumber(acquired) +
      (isCapped ? ' <span class="dim" style="font-size:0.85em">(capped)</span>' : '');
  }

  // Unit economics (per M tokens)
  const pricePerMEl = $('price-per-m-display');
  if (pricePerMEl) {
    pricePerMEl.textContent = '$' + state.resources.tokenPrice.toFixed(2);
  }
  const costPerMEl = $('cost-per-m-display');
  if (costPerMEl) {
    const costPerM = state.computed?.revenue?.costPerMTokens || 0;
    costPerMEl.textContent = '$' + costPerM.toFixed(2);
  }
  const marginPerMEl = $('margin-per-m-display');
  if (marginPerMEl) {
    const marginPerM = state.computed?.revenue?.marginPerM || 0;
    marginPerMEl.textContent = '$' + marginPerM.toFixed(2);
    marginPerMEl.className = 'pricing-stat-value ' + (marginPerM >= 0 ? 'positive' : 'negative');
  }

  // Acquired demand delta
  const deltaEl = $('acquired-demand-delta');
  if (deltaEl) {
    const delta = state.resources.acquiredDemandDelta || 0;
    if (Math.abs(delta) > 0.5) {
      deltaEl.textContent = '(' + (delta >= 0 ? '+' : '-') + formatNumber(Math.abs(delta)) + '/s)';
    } else {
      deltaEl.textContent = '';
    }
  }

  // Market demand (separate from max demand which is already displayed via demand-display)
  const mktDemandEl = $('market-demand-display');
  if (mktDemandEl) {
    mktDemandEl.textContent = formatNumber(state.resources.marketSize || 0);
  }

  // Elasticity
  const elasticityEl = $('elasticity-display');
  if (elasticityEl) {
    const elast = state.resources.effectiveElasticity || 0;
    elasticityEl.textContent = elast.toFixed(1);
  }

  // Market expansion (ai_market_expansion compounding growth)
  const expansionRow = $('market-expansion-row');
  const expansionDisplay = $('market-expansion-display');
  if (expansionRow) {
    const lateGameMult = state.resources.lateGameDemandMultiplier || 1.0;
    const unlockedApps = state.tracks?.applications?.unlockedCapabilities || [];
    if (unlockedApps.includes('ai_market_expansion') && lateGameMult > 1.0) {
      expansionRow.classList.remove('hidden');
      if (expansionDisplay) {
        expansionDisplay.textContent = `\u00d7${lateGameMult.toFixed(2)} demand`;
      }
    } else {
      expansionRow.classList.add('hidden');
    }
  }

  const marketEdgeDisplay = $('market-edge-display');
  if (marketEdgeDisplay) {
    marketEdgeDisplay.textContent = formatMarketEdge(state.resources.marketEdge);
    marketEdgeDisplay.className = 'pricing-stat-value ' + getMarketEdgeClass(state.resources.marketEdge);
  }

  // Keep price display in sync (for autopricer changes)
  const priceDisplay = $('token-price-display');
  if (priceDisplay) {
    priceDisplay.textContent = state.resources.tokenPrice.toFixed(2);
  }

  // Price drift indicator: show arrow + target when price is drifting
  // Placed after +/- buttons so showing/hiding doesn't shift interactive controls
  const driftEl = $('price-drift-indicator');
  if (driftEl) {
    const target = state.resources.targetPrice ?? state.resources.tokenPrice;
    const actual = state.resources.tokenPrice;
    const ratio = target / actual;
    if (Math.abs(ratio - 1) > 0.005) { // >0.5% difference
      const arrow = ratio > 1 ? '\u2191' : '\u2193'; // ↑ or ↓
      driftEl.textContent = `${arrow}$${target.toFixed(2)}`;
      driftEl.classList.remove('hidden');
      driftEl.classList.toggle('positive', ratio > 1);
      driftEl.classList.toggle('negative', ratio < 1);
    } else {
      driftEl.classList.add('hidden');
    }
  }
}

// ---------------------------------------------------------------------------
// Fundraise Rounds
// ---------------------------------------------------------------------------

/** Compute fundraise preview including CEO Focus IR bonuses. */
function getIRInclusivePreview(round, roundId) {
  const currentMult = getFundraiseMultiplier(roundId);
  const annualRevenue = gameState.computed?.revenue?.annual || 0;
  const irMultFraction = gameState.computed?.ceoFocus?.irMultFraction || 0;
  const irBaseBonus = gameState.computed?.ceoFocus?.irFundraiseBonus || 0;
  const irCapMult = gameState.computed?.ceoFocus?.irCapMultiplier || 1;
  const { raiseAmount, effectiveEquity, irMultRevenue } = calculateFundraisePreview(round, annualRevenue, currentMult, undefined, irBaseBonus, irMultFraction, irCapMult);
  return { currentMult, annualRevenue, irMultFraction, irBaseBonus, irMultRevenue, raiseAmount, effectiveEquity };
}

/** Update fundraise rounds display (fingerprinted incremental DOM) */
export function updateFundraiseDisplay() {
  const container = $('fundraise-rounds');
  const section = $('fundraise-section');
  const equityEl = $('equity-display');
  if (!container || !section) return;

  // Show section once any round is available OR research grant has started
  // (so players can preview the first locked round as a goal)
  const anyAvailable = Object.values(gameState.fundraiseRounds).some(r => r.available);
  const researchGrantStarted = gameState.grants?.research?.active || gameState.grants?.research?.exhausted;
  if (!anyAvailable && !researchGrantStarted) {
    section.classList.add('hidden-until-unlocked');
    return;
  }
  section.classList.remove('hidden-until-unlocked');

  // Notification dot now handled by tab-notifications.js

  // Show equity sold
  if (equityEl) {
    equityEl.textContent = gameState.totalEquitySold > 0
      ? `Equity sold: ${formatPercent(gameState.totalEquitySold, 0)}`
      : '';
  }

  // Build fingerprint: "roundId:status" per visible round
  const fingerParts = [];
  for (const [roundId] of Object.entries(FUNDRAISE_ROUNDS)) {
    const state = gameState.fundraiseRounds[roundId];
    if (!state) continue;
    if (!state.available && !state.raised) {
      fingerParts.push(`${roundId}:hidden`);
      continue;
    }
    if (state.raised) {
      fingerParts.push(`${roundId}:raised`);
    } else {
      const inQueue = gameState.focusQueue.some(item => item.type === 'fundraise' && item.target === roundId);
      fingerParts.push(`${roundId}:${inQueue ? 'queued' : 'available'}`);
    }
  }
  // Include exhausted grants in fingerprint
  const grants = getGrantStatus();
  for (const g of grants) {
    if (g.exhausted) fingerParts.push(`grant_${g.id}:exhausted`);
  }
  const fingerprint = fingerParts.join(',');

  if (fingerprint !== _renderedFundraiseFingerprint) {
    // Structural change — full rebuild
    container.innerHTML = '';

    // First pass: render available (not raised) round
    let shownAvailableRound = false;

    for (const [roundId, round] of Object.entries(FUNDRAISE_ROUNDS)) {
      const state = gameState.fundraiseRounds[roundId];
      if (!state) continue;
      if (state.raised) continue;  // raised rounds handled in second pass
      if (!state.available) continue;

      // Skip additional available rounds - only show the first one
      if (shownAvailableRound) continue;
      shownAvailableRound = true;

      const cardEl = el('div', { className: 'fundraise-round', data: { round: roundId } });

      const preview = getIRInclusivePreview(round, roundId);

      const inQueue = gameState.focusQueue.some(item => item.type === 'fundraise' && item.target === roundId);

      const rid = roundId; // capture for closure

      const nameSpan = el('span', { className: 'fundraise-name', text: round.name });
      const valuation = preview.effectiveEquity > 0 ? preview.raiseAmount / preview.effectiveEquity : 0;
      const multText = `${preview.currentMult.toFixed(0)}x`;
      const infoSpan = el('span', {
        className: 'fundraise-info',
        text: `${multText} \u2014 ~${formatFunding(preview.raiseAmount)} for ${formatPercent(preview.effectiveEquity, 1)} (${formatFunding(valuation)} val)`
      });
      attachTooltip(infoSpan, () => {
        const rs = gameState.fundraiseRounds?.[rid];
        const startMult = rs?.startingMultiplier || round.startingMultiplier;
        const p = getIRInclusivePreview(round, rid);
        let html = `<div class="tooltip-row"><span>Base</span><span>${formatFunding(round.base || 0)}</span></div>`;
        const revComponent = p.annualRevenue * p.currentMult * round.equityPercent;
        html += `<div class="tooltip-row"><span>Revenue component</span><span>+${formatFunding(revComponent)}</span></div>`;
        const uncapped = (round.base || 0) + revComponent;
        if (round.maxRaise && uncapped > round.maxRaise) {
          html += `<div class="tooltip-row"><span>Cap</span><span>${formatFunding(round.maxRaise)}</span></div>`;
        }
        const totalIrExtra = p.irBaseBonus + (p.irMultRevenue || 0);
        if (totalIrExtra > 0) {
          if (p.irBaseBonus > 0) {
            html += `<div class="tooltip-row"><span>IR fixed bonus</span><span>+${formatFunding(p.irBaseBonus)}</span></div>`;
          }
          if (p.irMultRevenue > 0) {
            html += `<div class="tooltip-row"><span>IR revenue bonus (+${Math.round(p.irMultFraction * 100)}% mult)</span><span>+${formatFunding(p.irMultRevenue)}</span></div>`;
          }
          if (round.maxRaise) {
            const irCapMult = gameState.computed?.ceoFocus?.irCapMultiplier || 1;
            const overshootCap = round.maxRaise * (1 + BALANCE.IR_MAX_OVERSHOOT * irCapMult);
            const totalRaise = Math.min(overshootCap, (round.maxRaise < uncapped ? round.maxRaise : uncapped) + totalIrExtra);
            if (totalRaise >= overshootCap * 0.95) {
              html += `<div class="tooltip-row dim"><span>IR overshoot cap</span><span>${formatFunding(overshootCap)}</span></div>`;
            }
          }
        }
        if (round.floorMultiplier == null || round.floorMultiplier < round.startingMultiplier) {
          html += `<div class="tooltip-row dim"><span>Decays 50% every ${formatDuration(round.halfLife || 1800)}</span></div>`;
        }
        html += `<div class="tooltip-row dim"><span>Started at ${Math.round(startMult)}x</span></div>`;
        return html;
      });

      cardEl.appendChild(nameSpan);
      cardEl.appendChild(infoSpan);

      // Stash refs for incremental update path
      cardEl._infoSpan = infoSpan;

      if (inQueue) {
        const queuedSpan = el('span', { className: 'dim', text: ' [queued]' });
        cardEl.appendChild(queuedSpan);
      } else {
        const btn = el('button', { className: 'btn-small', text: 'Raise', data: { round: roundId } });
        cardEl.appendChild(btn);
      }

      container.appendChild(cardEl);
    }

    // Add next locked round preview
    renderNextLockedRound(container);

    // Second pass: render raised rounds in reverse order (most recent first)
    const raisedEntries = Object.entries(FUNDRAISE_ROUNDS).filter(
      ([roundId]) => gameState.fundraiseRounds[roundId]?.raised
    );

    if (raisedEntries.length > 0) {
      // Visual divider between active/locked and raised history
      container.appendChild(el('div', { className: 'fundraise-divider' }));

      for (let i = raisedEntries.length - 1; i >= 0; i--) {
        const [roundId, round] = raisedEntries[i];
        const state = gameState.fundraiseRounds[roundId];

        const cardEl = el('div', { className: 'fundraise-round raised', data: { round: roundId } });
        const raisedText = state.raisedAmount > 0
          ? `${formatFunding(state.raisedAmount)} raised`
          : 'RAISED';
        cardEl.innerHTML = `<span class="fundraise-name">${round.name}</span> <span class="dim">${raisedText}</span>`;

        // Second row: date under name, equity+val under raised amount
        // Uses a full-width wrapper to force flex-wrap onto new line
        const equityText = state.equitySold
          ? `${(state.equitySold * 100).toFixed(1)}% equity`
          : '\u2014';
        const valText = state.valuation
          ? `@ ${formatFunding(state.valuation)} val`
          : '';
        const timeText = state.raisedAt != null ? formatTime(state.raisedAt) : '';
        const detailEl = el('div', { className: 'fundraise-raised-row dim' });
        detailEl.appendChild(el('span', { className: 'fundraise-name', text: timeText }));
        detailEl.appendChild(el('span', { text: `${equityText}${valText ? ' ' + valText : ''}` }));
        cardEl.appendChild(detailEl);

        container.appendChild(cardEl);
      }
    }

    // Third pass: render exhausted grants as historical entries
    const exhaustedGrants = grants.filter(g => g.exhausted);
    if (exhaustedGrants.length > 0) {
      container.appendChild(el('div', { className: 'fundraise-divider' }));

      for (const g of exhaustedGrants) {
        const cardEl = el('div', { className: 'fundraise-round raised' });
        const paidText = g.totalPaid > 0 ? `${formatFunding(g.totalPaid)} received` : 'EXHAUSTED';
        cardEl.innerHTML = `<span class="fundraise-name">${g.name}</span> <span class="dim">${paidText}</span>`;
        container.appendChild(cardEl);
      }
    }

    _renderedFundraiseFingerprint = fingerprint;
  } else {
    // Incremental update — patch multiplier/valuation text via stashed refs
    for (const [roundId, round] of Object.entries(FUNDRAISE_ROUNDS)) {
      const state = gameState.fundraiseRounds[roundId];
      if (!state || !state.available || state.raised) continue;

      const cardEl = container.querySelector(`[data-round="${roundId}"]`);
      if (!cardEl) continue;

      // Use stashed ref if available, fall back to querySelector
      const infoSpan = cardEl._infoSpan || cardEl.querySelector('.fundraise-info');
      if (infoSpan) {
        const preview = getIRInclusivePreview(round, roundId);
        const valuation = preview.effectiveEquity > 0 ? preview.raiseAmount / preview.effectiveEquity : 0;
        const multText = `${preview.currentMult.toFixed(0)}x`;
        infoSpan.textContent = `${multText} \u2014 ~${formatFunding(preview.raiseAmount)} for ${formatPercent(preview.effectiveEquity, 1)} (${formatFunding(valuation)} val)`;
      }
    }

    // Update locked round progress
    updateLockedRoundProgress(container);
  }
}

/** Find and render the next locked fundraise round with requirements. */
function renderNextLockedRound(container) {
  const currentRevenue = gameState.computed?.revenue?.gross || 0;
  const roundIds = Object.keys(FUNDRAISE_ROUNDS);

  for (let i = 0; i < roundIds.length; i++) {
    const roundId = roundIds[i];
    const round = FUNDRAISE_ROUNDS[roundId];
    const state = gameState.fundraiseRounds[roundId];
    if (!state || state.available || state.raised) continue;

    // Only show if previous round has been raised (or this is the first round)
    if (i > 0) {
      const prevState = gameState.fundraiseRounds[roundIds[i - 1]];
      if (!prevState?.raised) continue;
    }

    // This is a locked round — show requirements
    const cardEl = el('div', { className: 'fundraise-round locked', data: { round: roundId, locked: 'true' } });

    const nameSpan = el('span', { className: 'fundraise-name dim', text: round.name });
    cardEl.appendChild(nameSpan);

    // Check gate conditions
    const gate = round.gate;
    const hasCapability = gate.capability
      ? gameState.tracks?.capabilities?.unlockedCapabilities?.includes(gate.capability)
      : true;
    const capName = gate.capability ? gate.capability.replace(/_/g, ' ') : null;
    const revenueProgress = gate.minRevenue ? Math.min(100, (currentRevenue / gate.minRevenue) * 100) : 100;

    // Build requirements text
    const reqParts = [];
    if (gate.capability && !hasCapability) {
      reqParts.push(`${capName}`);
    }
    if (gate.minRevenue && currentRevenue < gate.minRevenue) {
      reqParts.push(`${formatFunding(gate.minRevenue)}/s revenue (${revenueProgress.toFixed(0)}%)`);
    }

    const reqText = reqParts.length > 0 ? `Requires: ${reqParts.join(' + ')}` : 'Ready to unlock';
    const reqSpan = el('span', { className: 'fundraise-locked-req dim', text: reqText });
    cardEl.appendChild(reqSpan);

    container.appendChild(cardEl);
    break;  // Only show one locked round at a time
  }
}

/** Update progress on the locked fundraise round. */
function updateLockedRoundProgress(container) {
  const lockedCard = container.querySelector('[data-locked="true"]');
  if (!lockedCard) return;

  const roundId = lockedCard.dataset.round;
  const round = FUNDRAISE_ROUNDS[roundId];
  if (!round) return;

  const currentRevenue = gameState.computed?.revenue?.gross || 0;
  const gate = round.gate;

  const hasCapability = gate.capability
    ? gameState.tracks?.capabilities?.unlockedCapabilities?.includes(gate.capability)
    : true;
  const capName = gate.capability ? gate.capability.replace(/_/g, ' ') : null;
  const revenueProgress = gate.minRevenue ? Math.min(100, (currentRevenue / gate.minRevenue) * 100) : 100;

  const reqParts = [];
  if (gate.capability && !hasCapability) {
    reqParts.push(`${capName}`);
  }
  if (gate.minRevenue && currentRevenue < gate.minRevenue) {
    reqParts.push(`${formatFunding(gate.minRevenue)}/s revenue (${revenueProgress.toFixed(0)}%)`);
  }

  const reqSpan = lockedCard.querySelector('.fundraise-locked-req');
  if (reqSpan) {
    reqSpan.textContent = reqParts.length > 0 ? `Requires: ${reqParts.join(' + ')}` : 'Ready to unlock';
  }
}

// ---------------------------------------------------------------------------
// Scheduler registration
// ---------------------------------------------------------------------------
registerUpdate(updateFundingDisplay, EVERY_TICK);       // core dopamine (Finance sub-tab)
registerUpdate(updateLedgerSummary, EVERY_TICK);         // left column summary
registerUpdate(updateTokenEconomicsDisplay, FAST);
registerUpdate(updateFundraiseDisplay, FAST);
