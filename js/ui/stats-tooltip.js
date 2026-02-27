// js/ui/stats-tooltip.js
// Terraforming Titans-style resource breakdown tooltips for the stats bar.

import { gameState } from '../game-state.js';
import { PERSONNEL_IDS, COMPUTE_IDS, ADMIN_IDS, getPurchasableById } from '../content/purchasables.js';
import { formatFunding, formatNumber, formatTime, getRateUnit } from '../utils/format.js';
import { getGovernmentFundingBonus } from '../strategic-choices.js';
import { getGrantStatus } from '../economics.js';
import { registerUpdate, EVERY_TICK } from './scheduler.js';

// Default hover delay before showing tooltip (ms)
const TOOLTIP_HOVER_DELAY = 150;

// Tooltip element (created once, reused)
let tooltipEl = null;

// Active tooltip state — tracks what's currently shown so tick can refresh it
let activeBuilder = null;   // function that returns HTML
let activeTarget = null;    // element the tooltip is anchored to
let activeTargetRect = null; // anchor position when tooltip was shown (shift detection)
let hideTimeout = null;     // delay before hiding (for sticky hover bridge)
let isOverTooltip = false;  // mouse is on the tooltip itself

/** Create the tooltip element if it doesn't exist. */
function ensureTooltip() {
  if (tooltipEl) return tooltipEl;

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'stats-tooltip hidden';
  document.body.appendChild(tooltipEl);

  // Sticky hover: keep tooltip open when mouse moves onto it
  tooltipEl.addEventListener('mouseenter', () => {
    isOverTooltip = true;
    if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
  });
  tooltipEl.addEventListener('mouseleave', () => {
    isOverTooltip = false;
    scheduleHide();
  });

  return tooltipEl;
}

/** Position tooltip near target element. Default: below. 'right': to the right. */
function positionTooltip(targetEl, position) {
  const tooltip = ensureTooltip();
  const rect = targetEl.getBoundingClientRect();

  if (position === 'above') {
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.top}px`; // temporary; adjusted in rAF

    requestAnimationFrame(() => {
      const tooltipRect = tooltip.getBoundingClientRect();
      tooltip.style.top = `${rect.top - tooltipRect.height - 8}px`;

      // Flip below if clipping top edge
      if (rect.top - tooltipRect.height - 8 < 10) {
        tooltip.style.top = `${rect.bottom + 8}px`;
      }

      // Clamp to right edge
      if (tooltipRect.right > window.innerWidth - 10) {
        tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
      }
    });
    return;
  }

  if (position === 'right') {
    // Position to the right of the target
    tooltip.style.top = `${rect.top}px`;
    tooltip.style.left = `${rect.right + 8}px`;

    requestAnimationFrame(() => {
      const tooltipRect = tooltip.getBoundingClientRect();

      // Flip to left if clipping right edge
      if (tooltipRect.right > window.innerWidth - 10) {
        tooltip.style.left = `${rect.left - tooltipRect.width - 8}px`;
      }

      // Clamp to bottom edge
      if (tooltipRect.bottom > window.innerHeight - 10) {
        tooltip.style.top = `${window.innerHeight - tooltipRect.height - 10}px`;
      }
    });
    return;
  }

  // Default: below, flip above if clipping
  tooltip.style.top = `${rect.bottom + 8}px`;
  tooltip.style.left = `${rect.left}px`;

  requestAnimationFrame(() => {
    const tooltipRect = tooltip.getBoundingClientRect();

    if (tooltipRect.bottom > window.innerHeight - 10) {
      tooltip.style.top = `${rect.top - tooltipRect.height - 8}px`;
    }

    if (tooltipRect.right > window.innerWidth - 10) {
      tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
    }
  });
}

/** Build funding breakdown HTML. */
function buildFundingTooltip() {
  const state = gameState;
  const costs = state.computed?.costs || {};
  const revenue = state.computed?.revenue || {};

  // Income sources
  const _tokenRevenue = revenue.gross || 0;
  const equityShare = state.totalEquitySold || 0;
  const netRevenue = revenue.net || 0;

  let disbursementRate = 0;
  const disbursements = state.disbursements || [];
  for (const d of disbursements) {
    disbursementRate += d.rate;
  }

  const govBonus = getGovernmentFundingBonus();
  const grantIncome = state.computed?.grants?.income || 0;
  const ceoGrantRate = state.computed?.ceoFocus?.grantRate || 0;
  const totalIncome = netRevenue + disbursementRate + govBonus + grantIncome + ceoGrantRate;

  // Expense sources (from computed state)
  const personnelTotal = (costs.personnel?.total || 0) * (costs.opsDiscount ?? 1);
  const computeTotal = (costs.compute?.total || 0) * (costs.opsDiscount ?? 1);
  const adminTotal = (costs.admin?.total || 0) * (costs.opsDiscount ?? 1);
  const dataTotal = (costs.data?.total || 0) * (costs.opsDiscount ?? 1);
  const totalExpenses = personnelTotal + computeTotal + adminTotal + dataTotal;

  // Net change
  const netChange = totalIncome - totalExpenses;
  const funding = state.resources.funding;

  // Build HTML
  let html = '<div class="tooltip-header">';
  html += `<span class="tooltip-value">${formatFunding(funding)}</span>`;
  html += `<span class="tooltip-rate ${netChange >= 0 ? 'positive' : 'negative'}">${netChange >= 0 ? '+' : ''}${formatFunding(netChange)}${getRateUnit()}</span>`;
  html += '</div>';

  // Time to empty (runway) or time to milestone
  const runway = state.computed?.revenue?.runway;
  if (runway != null && runway !== Infinity) {
    html += `<div class="tooltip-time">Empty in: ${formatTime(runway)}</div>`;
  }

  // Income section
  html += '<div class="tooltip-section">';
  html += '<div class="tooltip-section-header">Income:</div>';

  if (netRevenue > 0) {
    let revenueLabel = 'Token Revenue';
    if (equityShare > 0) {
      revenueLabel += ` (${Math.round((1 - equityShare) * 100)}% yours)`;
    }
    html += `<div class="tooltip-row"><span>${revenueLabel}</span><span class="positive">+${formatFunding(netRevenue)}${getRateUnit()}</span></div>`;
  }

  if (disbursementRate > 0) {
    const roundNames = disbursements.map(d => d.roundId.replace('series_', '').toUpperCase()).join(', ');
    html += `<div class="tooltip-row"><span>Investment (${roundNames})</span><span class="positive">+${formatFunding(disbursementRate)}${getRateUnit()}</span></div>`;
  }

  if (govBonus > 0) {
    html += `<div class="tooltip-row"><span>Government Grants</span><span class="positive">+${formatFunding(govBonus)}${getRateUnit()}</span></div>`;
  }

  if (grantIncome > 0) {
    const grants = getGrantStatus();
    const activeGrants = grants.filter(g => g.active);
    const grantNames = activeGrants.map(g => g.name).join(', ');
    html += `<div class="tooltip-row"><span>Grants (${grantNames})</span><span class="positive">+${formatFunding(grantIncome)}${getRateUnit()}</span></div>`;
  }

  if (ceoGrantRate > 0) {
    html += `<div class="tooltip-row"><span>Discretionary Grants</span><span class="positive">+${formatFunding(ceoGrantRate)}${getRateUnit()}</span></div>`;
  }

  if (totalIncome === 0) {
    html += '<div class="tooltip-row dim"><span>No income</span><span>-</span></div>';
  }

  html += '</div>';

  // Expenses section
  html += '<div class="tooltip-section">';
  html += '<div class="tooltip-section-header">Expenses:</div>';

  // Personnel breakdown
  const personnelBreakdown = costs.personnel?.breakdown || {};
  const personnelItems = PERSONNEL_IDS
    .filter(id => personnelBreakdown[id]?.count > 0)
    .map(id => ({ id, ...personnelBreakdown[id] }))
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
  for (const item of personnelItems) {
    const purchasable = getPurchasableById(item.id);
    const cost = item.cost * (costs.opsDiscount ?? 1);
    html += `<div class="tooltip-row"><span>${item.count}× ${purchasable?.name || item.id}</span><span class="negative">-${formatFunding(cost)}${getRateUnit()}</span></div>`;
  }

  // Compute breakdown
  const computeBreakdown = costs.compute?.breakdown || {};
  const computeItems = COMPUTE_IDS
    .filter(id => computeBreakdown[id]?.count > 0)
    .map(id => ({ id, ...computeBreakdown[id] }))
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
  for (const item of computeItems) {
    const purchasable = getPurchasableById(item.id);
    const cost = item.cost * (costs.opsDiscount ?? 1);
    html += `<div class="tooltip-row"><span>${item.count}× ${purchasable?.name || item.id}</span><span class="negative">-${formatFunding(cost)}${getRateUnit()}</span></div>`;
  }

  // Admin breakdown
  const adminBreakdown = costs.admin?.breakdown || {};
  const adminItems = ADMIN_IDS
    .filter(id => adminBreakdown[id]?.count > 0)
    .map(id => ({ id, ...adminBreakdown[id] }))
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
  for (const item of adminItems) {
    const purchasable = getPurchasableById(item.id);
    const cost = item.cost * (costs.opsDiscount ?? 1);
    html += `<div class="tooltip-row"><span>${item.count}× ${purchasable?.name || item.id}</span><span class="negative">-${formatFunding(cost)}${getRateUnit()}</span></div>`;
  }

  // Data costs
  if (dataTotal > 0) {
    html += `<div class="tooltip-row"><span>Data Sources</span><span class="negative">-${formatFunding(dataTotal)}${getRateUnit()}</span></div>`;
  }

  if (totalExpenses === 0) {
    html += '<div class="tooltip-row dim"><span>No expenses</span><span>-</span></div>';
  }

  // Ops bonus
  const opsBonus = costs.opsBonus || 0;
  if (opsBonus > 0) {
    html += `<div class="tooltip-row dim"><span>Ops Bonus</span><span>-${Math.round(opsBonus * 100)}% costs</span></div>`;
  }

  html += '</div>';

  return html;
}


/**
 * Show a tooltip anchored to targetEl, built by builderFn.
 * The tooltip will auto-refresh on each game tick while visible.
 * If builderFn returns empty/falsy, the tooltip is hidden instead.
 */
function showTooltipFor(targetEl, builderFn, position) {
  if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
  const html = builderFn();
  if (!html) { hideTooltip(); return; }
  const tooltip = ensureTooltip();
  activeBuilder = builderFn;
  activeTarget = targetEl;
  const r = targetEl.getBoundingClientRect();
  activeTargetRect = { top: r.top, left: r.left };
  tooltip.innerHTML = html;
  tooltip.classList.remove('hidden');
  positionTooltip(targetEl, position);
}

/** Schedule hiding with a short delay (bridges gap between trigger and tooltip). */
function scheduleHide() {
  if (hideTimeout) return;
  hideTimeout = setTimeout(() => {
    hideTimeout = null;
    if (!isOverTooltip) {
      hideTooltip();
    }
  }, 100);
}

/** Hide tooltip immediately. */
function hideTooltip() {
  if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
  isOverTooltip = false;
  activeBuilder = null;
  activeTarget = null;
  activeTargetRect = null;
  if (tooltipEl) {
    tooltipEl.classList.add('hidden');
  }
}

/** Tick-driven refresh: re-render content if tooltip is visible. */
function updateTooltip() {
  if (!tooltipEl || tooltipEl.classList.contains('hidden')) return;
  if (!activeBuilder || !activeTarget) return;
  // Hide if anchor was removed from DOM or shifted position (card rebuild/reflow)
  if (!activeTarget.isConnected) { hideTooltip(); return; }
  if (activeTargetRect) {
    const r = activeTarget.getBoundingClientRect();
    if (Math.abs(r.top - activeTargetRect.top) > 2 || Math.abs(r.left - activeTargetRect.left) > 2) {
      hideTooltip(); return;
    }
  }
  const html = activeBuilder();
  if (!html) { hideTooltip(); return; }
  tooltipEl.innerHTML = html;
}

registerUpdate(updateTooltip, EVERY_TICK);

export { hideTooltip, showTooltipFor, scheduleHide };

/**
 * Attach a custom tooltip to an element.
 * Replaces the repeated mouseenter/mouseleave + timeout boilerplate.
 * @param {HTMLElement} el - Target element to attach hover listeners to
 * @param {Function} builderFn - Returns tooltip HTML (falsy = no tooltip shown)
 * @param {object} [opts] - Options
 * @param {number} [opts.delay] - Hover delay in ms (default: TOOLTIP_HOVER_DELAY)
 */
export function attachTooltip(el, builderFn, opts) {
  if (!el) return;
  const delay = opts?.delay ?? TOOLTIP_HOVER_DELAY;
  const position = opts?.position;
  let hoverTimeout = null;
  el.addEventListener('mouseenter', () => {
    hoverTimeout = setTimeout(() => {
      showTooltipFor(el, builderFn, position);
    }, delay);
  });
  el.addEventListener('mouseleave', () => {
    if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
    scheduleHide();
  });
}

/** Build AGI progress tooltip HTML. */
function buildAGITooltip() {
  const progress = gameState.agiProgress || 0;
  const cp = gameState.competitor?.progressToAGI || 0;
  const seriesARaised = gameState.fundraiseRounds?.series_a?.raised === true;

  let html = '<div class="tooltip-header"><span>AGI Progress</span>';
  if (gameState.debug) {
    html += `<span class="tooltip-value">${progress.toFixed(1)}%</span>`;
  }
  html += '</div>';
  html += '<div class="tooltip-section">';
  html += '<div>Your lab\'s progress toward artificial general intelligence. Driven by research breakthroughs — each capability you unlock pushes the needle forward.</div>';
  html += '</div>';

  if (seriesARaised) {
    html += '<div class="tooltip-section">';
    html += '<div class="tooltip-section-header">Rival Lab</div>';
    if (gameState.debug) {
      html += `<div class="tooltip-row"><span>Their progress</span><span>${cp.toFixed(1)}%</span></div>`;
    }
    html += '<div class="dim" style="margin-top:4px">A competing lab racing to AGI independently. If they get there first, you lose control of the outcome.</div>';
    html += '</div>';
  }

  return html;
}

/** Build compute breakdown tooltip HTML. */
function buildComputeTooltip() {
  const base = gameState.computed.baseCompute || 0;
  const mult = gameState.computed.computeMultiplier || 1;
  const comp = gameState.computed.compute || {};

  // Nothing useful to show yet
  if (!base && !comp.total) return '';

  let html = '';

  // Base × multiplier breakdown (only when multiplier is meaningful)
  if (mult > 1.01 && base > 0) {
    html += `<div class="tooltip-row"><span>${formatNumber(base)} base × ${mult.toFixed(1)}x</span></div>`;
  }

  // Allocation split (only after compute allocation is unlocked)
  if (comp.allocation != null && comp.allocation < 1.0 && comp.total > 0) {
    html += `<div class="tooltip-row"><span>Research</span><span>${formatNumber(comp.internal)} TFLOPS</span></div>`;
    html += `<div class="tooltip-row"><span>Revenue</span><span>${formatNumber(comp.external)} TFLOPS</span></div>`;
  }

  return html || '';
}

/** Title-case a snake_case id: "data_curation" → "Data Curation". */
function titleCase(id) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Build data effectiveness tooltip HTML. */
function buildDataTooltip() {
  const data = gameState.data;
  if (!data || !data.dataTabRevealed) return '';

  const eff = data.effectiveness;
  let html = '<div class="tooltip-section">';
  html += '<div class="dim">Multiplier on capabilities research speed</div>';
  html += '</div>';

  // Progress toward next tier
  const score = data.dataScore;
  const required = data.dataRequired;
  const tierName = data.nextTierName;
  if (eff >= 1.0) {
    html += `<div class="tooltip-row"><span>Data score</span><span>${Math.floor(score)} — exceeds requirements</span></div>`;
  } else if (tierName) {
    html += `<div class="tooltip-row"><span>Next milestone</span><span>${titleCase(tierName)}</span></div>`;
    html += `<div class="tooltip-row"><span>Progress</span><span>${Math.floor(score)} / ${Math.floor(required)}</span></div>`;
  }

  return html;
}

/** Initialize stats bar tooltips. */
export function initStatsTooltips() {
  const fundingGroup = document.querySelector('#stats-bar .stats-group:first-child');
  attachTooltip(fundingGroup, buildFundingTooltip);

  // AGI progress group — find by the agi-progress-label element
  const agiLabel = document.getElementById('agi-progress-label');
  const agiGroup = agiLabel?.closest('.stats-group');
  if (agiGroup) attachTooltip(agiGroup, buildAGITooltip);

  // Compute group
  const computeTotal = document.getElementById('compute-total');
  const computeGroup = computeTotal?.closest('.stats-group');
  if (computeGroup) attachTooltip(computeGroup, buildComputeTooltip);

  // Data effectiveness group
  const dataGroup = document.getElementById('data-effectiveness-group');
  if (dataGroup) attachTooltip(dataGroup, buildDataTooltip);
}
