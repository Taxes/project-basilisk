// js/ui/infrastructure.js
// Purchase cards and Operations column subtabs (Finance/Personnel/Compute/Admin/Data).
//
// Caching strategy:
//   _renderedPurchaseFingerprint — "activeTab:id1,id2,id3" string built from
//   the currently visible tab and the set of purchasable IDs in that tab.
//   When the fingerprint matches the previous render we skip the full DOM
//   rebuild (rebuildPurchaseList) and only run the fast affordability path
//   (updatePurchaseAffordability) which patches cost text, affordable class,
//   and button disabled state via stashed child refs (card._ownedEl,
//   card._costInfoEl, card._btn) — no querySelector needed.
//
//   resetPurchaseCache() clears the fingerprint so the next SLOW tick does
//   a full rebuild. It is registered with the scheduler as a reset callback
//   and also exported as reset() for resetUI().

import { gameState } from '../game-state.js';
import {
  getAllPurchasables,
  isPurchasableVisible,
  areRequirementsMet,
  canPurchase,
  getPurchaseCost,
  canQueuePurchase,
} from '../content/purchasables.js';
import { getEffectivePool, getPoolUsage, getPoolScalingMultiplier, getEffectiveScaling, POOL_IDS } from '../talent-pool.js';
import { enqueuePurchase, enqueueFurlough } from '../focus-queue.js';
import {
  getOutputMultiplier,
  getCostReduction,
} from '../content/upgrades.js';

import { attachFlavorTooltip } from '../flavor-discovery.js';
import { getPersonnelCostMultiplier } from '../strategic-choices.js';
import { BALANCE, FUNDRAISE_ROUNDS } from '../../data/balance.js';
import { formatFunding, formatNumber, getRateUnit, formatDuration } from '../utils/format.js';
import { $ } from '../utils/dom-cache.js';
import { registerUpdate, FAST, SLOW } from './scheduler.js';
import { requestFullUpdate } from './signals.js';
import { showTooltipFor, scheduleHide, attachTooltip } from './stats-tooltip.js';
import { renderDataTab, reset as resetDataTab } from './data-tab.js';
import {
  createAutomationPanel,
  updateAutomationPanel,
} from './automation-panel.js';
import {
  isAutomationUnlocked,
  getActiveCount,
  getHRSpeedMultiplier,
  getItemPointCost,
  AUTOMATABLE_PERSONNEL,
  AUTOMATABLE_COMPUTE,
  FURLOUGHABLE_ADMIN,
} from '../automation-state.js';
import { getCount } from '../purchasable-state.js';
import { getAmplificationBonusText, getAmplificationTooltipBuilder } from '../resources.js';
import { initTabNotifications } from './tab-notifications.js';
import { isCapabilityUnlocked, isFundraiseGatePassed } from '../capabilities.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build hint text parts for all unmet requirements on a purchasable. */
function buildRequirementHintParts(purchasable) {
  const req = purchasable.requires;
  if (!req) return [];
  const parts = [];
  if (req.capability && !isCapabilityUnlocked(req.capability)) {
    parts.push(req.capability.replace(/_/g, ' '));
  }
  if (req.purchasable && getCount(req.purchasable) === 0) {
    parts.push(req.purchasable.replace(/_/g, ' '));
  }
  if (req.fundraise && !isFundraiseGatePassed(req.fundraise)) {
    const roundName = FUNDRAISE_ROUNDS[req.fundraise]?.name || req.fundraise;
    parts.push(`${roundName} round`);
  }
  return parts;
}

/** Create a lightweight hint element for a gated (not-yet-unlocked) purchasable.
 *  Shows just the item name and its requirement — no card, cost, or stats. */
function createGateHint(purchasable) {
  const el = document.createElement('div');
  el.className = 'purchase-gate-hint dim';
  el.dataset.gateId = purchasable.id;
  const parts = buildRequirementHintParts(purchasable);
  el.textContent = `${purchasable.name} [requires: ${parts.join(', ')}]`;
  return el;
}

// ---------------------------------------------------------------------------
// Tier-based progressive disclosure for personnel/compute
// ---------------------------------------------------------------------------
// Each tier becomes visible (with requirement hint) when the previous tier is unlocked.
const PERSONNEL_TIERS = ['grad_student', 'junior_researcher', 'team_lead', 'elite_researcher'];
const COMPUTE_TIERS = ['gpu_consumer', 'gpu_datacenter', 'cloud_compute', 'build_datacenter'];

/** Is a tiered personnel/compute item visible based on progressive disclosure?
 *  Returns true/false for tiered items, null for non-tiered items. */
function getTierVisibility(purchasableId) {
  for (const tiers of [PERSONNEL_TIERS, COMPUTE_TIERS]) {
    const idx = tiers.indexOf(purchasableId);
    if (idx === -1) continue;
    if (idx === 0) return true; // T1 always visible
    // Visible if previous tier's requirements are all met
    const prevPurchasable = getAllPurchasables().find(p => p.id === tiers[idx - 1]);
    return prevPurchasable ? areRequirementsMet(prevPurchasable.id) : true;
  }
  return null; // Not in tier system
}

// ---------------------------------------------------------------------------
// Click throttles
// ---------------------------------------------------------------------------
let _lastPriorityClickTime = 0;
let _lastFurloughClickTime = 0;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------
let _renderedPurchaseFingerprint = '';

function resetPurchaseCache() {
  _renderedPurchaseFingerprint = '';
}

export function reset() {
  resetPurchaseCache();
  resetDataTab();
}

// ---------------------------------------------------------------------------
// Structural rebuild (SLOW) — new items, tab switch
// ---------------------------------------------------------------------------

/**
 * Rebuild the purchase list DOM when the set of visible items changes.
 * Gated behind a fingerprint check so it only runs when the active tab
 * switches or the available purchasable set changes.
 */
/** Get the active sub-tab category. */
function getActiveSubTab() {
  return document.querySelector('.sub-tab.active')?.dataset.category || 'finance';
}

/** Map sub-tab category to its purchase container ID. */
function getPurchaseContainer(category) {
  const containerMap = {
    personnel: 'purchases-list-personnel',
    compute: 'purchases-list-compute',
    admin: 'purchases-list-admin',
    data: 'purchases-list-data',
  };
  const id = containerMap[category];
  return id ? $(id) : null;
}

function rebuildPurchaseList() {
  const activeTab = getActiveSubTab();

  // Finance tab has no purchase cards
  if (activeTab === 'finance') return;

  const purchasesList = getPurchaseContainer(activeTab);
  if (!purchasesList) return;

  // Data tab has its own renderer
  if (activeTab === 'data') {
    renderDataTab(purchasesList);
    _renderedPurchaseFingerprint = 'data:custom';
    return;
  }
  const allPurchasables = getAllPurchasables();

  // Filter and sort visible items (admin tab sorted by cost ascending)
  let visibleItems = allPurchasables.filter(p => (p.uiCategory || p.category) === activeTab);

  // Hide items whose requirements aren't met yet (progressive disclosure)
  visibleItems = visibleItems.filter(p => {
    const displayCategory = p.uiCategory || p.category;

    // Personnel/compute: tier-based progressive disclosure
    // Each tier becomes visible when the previous tier is unlocked.
    if (displayCategory === 'personnel' || displayCategory === 'compute') {
      const tierVis = getTierVisibility(p.id);
      if (tierVis !== null) return tierVis;
      // Falls through for non-tiered items in these categories (shouldn't happen)
    }

    // Admin override: Series A admin items visible after Chief of Staff is purchased,
    // even before the round is raised. Bypass fundraise gate, keep all other checks.
    if (displayCategory === 'admin' && p.requires?.fundraise === 'series_a'
        && !isFundraiseGatePassed('series_a')
        && getCount('chief_of_staff') > 0) {
      return isPurchasableVisible(p, { skipFundraise: true });
    }

    return isPurchasableVisible(p);
  });

  if (activeTab === 'admin') {
    visibleItems = visibleItems.slice().sort((a, b) => (a.baseCost.funding || 0) - (b.baseCost.funding || 0));
  }

  // Split completed one-time admin purchases into a collapsible section
  let completedAdminItems = [];
  if (activeTab === 'admin') {
    completedAdminItems = visibleItems.filter(p =>
      p.maxPurchases && getCount(p.id) >= p.maxPurchases && !(p.salary > 0)
    );
    visibleItems = visibleItems.filter(p =>
      !p.maxPurchases || getCount(p.id) < p.maxPurchases || p.salary > 0
    );
  }

  const completedIds = completedAdminItems.map(p => p.id);
  const visibleIds = visibleItems.map(p => p.id);
  const gatedIds = visibleItems.filter(p => !areRequirementsMet(p.id)).map(p => p.id);
  const autoIds = visibleItems.filter(p => isAutomationUnlocked(p.id)).map(p => p.id);
  const fingerprint = `${activeTab}:${visibleIds.join(',')};gated:${gatedIds.join(',')};done:${completedIds.join(',')};auto:${autoIds.join(',')}`;

  if (fingerprint === _renderedPurchaseFingerprint) return;

  // Structural change — full rebuild into fragment, then atomic swap
  const frag = document.createDocumentFragment();

  if (activeTab === 'admin') {
    // Split into UPGRADES (one-time) and TEAMS (repeatable with salary)
    const upgrades = visibleItems.filter(p => p.maxPurchases);
    const teams = visibleItems.filter(p => !p.maxPurchases);

    // Sort upgrades: unpurchased first, then by cost
    upgrades.sort((a, b) => {
      const aPurchased = getCount(a.id) > 0 ? 1 : 0;
      const bPurchased = getCount(b.id) > 0 ? 1 : 0;
      if (aPurchased !== bPurchased) return aPurchased - bPurchased;
      return (a.baseCost.funding || 0) - (b.baseCost.funding || 0);
    });

    // Teams first
    if (teams.length > 0) {
      const teamHeader = document.createElement('div');
      teamHeader.className = 'admin-section-header';
      teamHeader.textContent = 'TEAMS';
      frag.appendChild(teamHeader);
      for (const p of teams) {
        frag.appendChild(areRequirementsMet(p.id) ? createPurchaseCard(p) : createGateHint(p));
      }
    }

    if (upgrades.length > 0 || completedAdminItems.length > 0) {
      const upgradeHeader = document.createElement('div');
      upgradeHeader.className = 'admin-section-header';
      upgradeHeader.textContent = 'UPGRADES';
      frag.appendChild(upgradeHeader);
      for (const p of upgrades) {
        frag.appendChild(areRequirementsMet(p.id) ? createPurchaseCard(p) : createGateHint(p));
      }
    }

    // Completed admin section (collapsible, default collapsed)
    if (completedAdminItems.length > 0) {
      const completedSection = document.createElement('div');
      completedSection.className = 'admin-completed-section';

      const header = document.createElement('div');
      header.className = 'completed-header collapsed';
      header.innerHTML = `<h3>COMPLETED (${completedAdminItems.length})</h3><span class="toggle-icon">▼</span>`;
      header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
        list.classList.toggle('collapsed');
      });

      const list = document.createElement('div');
      list.className = 'completed-list collapsed';
      for (const p of completedAdminItems) {
        const item = document.createElement('div');
        item.className = 'compact-completed-card';

        const nameEl = document.createElement('div');
        nameEl.className = 'completed-card-name';
        nameEl.textContent = p.name;
        item.appendChild(nameEl);

        if (p.description) {
          const descEl = document.createElement('div');
          descEl.className = 'completed-card-desc';
          descEl.textContent = p.description;
          item.appendChild(descEl);

          if (p.flavor) {
            attachFlavorTooltip(descEl, p.id, p.flavor);
          }
        }

        list.appendChild(item);
      }

      completedSection.appendChild(header);
      completedSection.appendChild(list);
      frag.appendChild(completedSection);
    }

    if (upgrades.length === 0 && teams.length === 0 && completedAdminItems.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'dim';
      emptyMsg.textContent = gameState.fundraiseRounds?.seed?.raised
        ? 'Nothing available yet — research to unlock.'
        : 'Raise seed funding to unlock.';
      frag.appendChild(emptyMsg);
    }
  } else {
    for (const p of visibleItems) {
      frag.appendChild(areRequirementsMet(p.id) ? createPurchaseCard(p) : createGateHint(p));
    }

    if (visibleItems.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'dim';
      emptyMsg.textContent = 'Nothing available yet — research to unlock.';
      frag.appendChild(emptyMsg);
    }
  }

  purchasesList.replaceChildren(frag);

  _renderedPurchaseFingerprint = fingerprint;
}

// ---------------------------------------------------------------------------
// Incremental affordability update (FAST)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cost breakdown tooltip
// ---------------------------------------------------------------------------

/**
 * Build a tooltip builder for a purchasable's upfront cost.
 * Shows base cost, scaling, upgrade discount, strategic choice, PP mastery.
 * Section 2: HR/proc automation point cost (if automatable).
 */
function buildCostTooltipBuilder(purchasable) {
  const pid = purchasable.id;
  return () => {
    const count = getCount(pid);
    const baseFunding = purchasable.baseCost.funding || 0;
    const scalingFactor = getEffectiveScaling(pid);
    let scaling;
    if (purchasable.costScalingMode === 'exponential') {
      scaling = Math.pow(scalingFactor, count);
    } else {
      scaling = 1 + scalingFactor * count;
    }
    const costReduction = getCostReduction(pid);
    const strategicCostMult = purchasable.category === 'personnel' ? getPersonnelCostMultiplier() : 1.0;
    const masteryDiscount = gameState.computed?.ceoFocus?.purchaseCostDiscount ?? 1;
    // Use getPurchaseCost for the authoritative final cost (includes all factors
    // like eventChainCostMult) so the tooltip can never diverge from the actual price.
    const finalCost = getPurchaseCost(purchasable).funding || 0;

    let html = '<div class="tooltip-header"><span>Cost Breakdown</span></div>';
    html += `<div class="tooltip-row"><span>Base cost</span><span>${formatFunding(baseFunding)}</span></div>`;
    if (scaling > 1.001) {
      html += `<div class="tooltip-row"><span>Scaling (${count} owned)</span><span>×${fmtMult(scaling)}</span></div>`;
    }
    if (costReduction < 0.999) {
      html += `<div class="tooltip-row"><span>Upgrade discount</span><span>×${fmtMult(costReduction)}</span></div>`;
    }
    if (strategicCostMult !== 1.0) {
      html += `<div class="tooltip-row"><span>Strategic choice</span><span>×${fmtMult(strategicCostMult)}</span></div>`;
    }
    if (masteryDiscount < 0.999) {
      html += `<div class="tooltip-row" style="color: #9b59b6"><span>PP mastery</span><span>×${fmtMult(masteryDiscount)}</span></div>`;
    }
    if (finalCost !== baseFunding) {
      html += `<div class="tooltip-row"><span>Final cost</span><span>${formatFunding(finalCost)}</span></div>`;
    }

    // Section 2: automation point cost
    const isAutoPersonnel = AUTOMATABLE_PERSONNEL.some(p => p.id === pid);
    const isAutoCompute = AUTOMATABLE_COMPUTE.some(c => c.id === pid);
    if (isAutoPersonnel || isAutoCompute) {
      const pointCost = getItemPointCost(pid);
      const label = isAutoPersonnel ? 'HR' : 'Proc';
      html += '<div class="tooltip-section-header">Automation</div>';
      html += `<div class="tooltip-row"><span>${label} points</span><span>${pointCost}</span></div>`;
    }

    return html;
  };
}

/**
 * Build stats text for a purchasable (RP, TFLOPS, running costs).
 * Used by both card creation and fast affordability updates.
 */
/** Format a multiplier with 3 significant figures (e.g. 1.00, 1.20, 1.003). */
function fmtMult(n) { return n.toPrecision(3); }

function buildStatsParts(purchasable, count) {
  const parts = [];
  const opsDiscount = gameState.computed?.costs?.opsDiscount ?? 1;
  if (purchasable.effects.trackRP) {
    const outputMult = getOutputMultiplier(purchasable.id);
    const ampData = gameState.computed?.amplification;
    const ampMult = ampData?.ampBonuses?.[purchasable.id] || 1;
    const effectivePerUnit = purchasable.effects.trackRP * outputMult * ampMult;
    const active = getActiveCount(purchasable.id);

    let text;
    if (count > 0) {
      const total = effectivePerUnit * active;
      text = `+${formatNumber(effectivePerUnit)} RP${getRateUnit()} (${formatNumber(total)} total)`;
    } else {
      text = `+${purchasable.effects.trackRP} RP${getRateUnit()}`;
    }

    // Tooltip builder — called on each tick while visible, returns HTML
    const pid = purchasable.id;
    const baseRP = purchasable.effects.trackRP;
    const tooltipBuilder = () => {
      const om = getOutputMultiplier(pid);
      const ad = gameState.computed?.amplification;
      const am = ad?.ampBonuses?.[pid] || 1;
      const rows = [`<div class="tooltip-row"><span>Base</span><span>${baseRP} RP${getRateUnit()}</span></div>`];
      if (om !== 1) rows.push(`<div class="tooltip-row"><span>Output upgrade</span><span>×${fmtMult(om)}</span></div>`);
      if (am !== 1) rows.push(`<div class="tooltip-row"><span>Org bonus</span><span>×${fmtMult(am)}</span></div>`);
      return `<div class="tooltip-header"><span>Output Breakdown</span></div>${rows.join('')}`;
    };

    parts.push({ text, tooltipBuilder });
  }
  if (purchasable.effects.computeRate) {
    const compMult = getOutputMultiplier(purchasable.id);
    const effectiveTflops = purchasable.effects.computeRate * compMult;
    parts.push({ text: `+${effectiveTflops.toFixed(1)} TFLOPS`, tooltipBuilder: null });
  }
  // HR/Procurement team point generation rate (with speed multiplier)
  if (purchasable.id === 'hr_team' || purchasable.id === 'procurement_team_unit') {
    const baseRate = purchasable.id === 'hr_team'
      ? BALANCE.HR_POINTS_PER_TEAM
      : BALANCE.PROCUREMENT_POINTS_PER_TEAM;
    const speedMult = getHRSpeedMultiplier();
    const effectiveRate = baseRate * speedMult;
    const label = purchasable.id === 'hr_team' ? 'HR' : 'Proc';
    let text = `+${effectiveRate.toFixed(1)} ${label} pts/s`;
    if (count > 0) {
      const active = getActiveCount(purchasable.id);
      const totalRate = effectiveRate * active;
      text = `+${effectiveRate.toFixed(1)} ${label} pts/s (${totalRate.toFixed(1)} total)`;
    }
    const tooltipBuilder = speedMult > 1 ? () => {
      const sm = getHRSpeedMultiplier();
      return `<div class="tooltip-header"><span>${label} Rate</span></div>` +
        `<div class="tooltip-row"><span>Base</span><span>${baseRate} pts/s</span></div>` +
        `<div class="tooltip-row"><span>Speed upgrades</span><span>\u00d7${sm.toFixed(1)}</span></div>`;
    } : null;
    parts.push({ text, tooltipBuilder });
  }
  if (purchasable.salary || purchasable.runningCost) {
    const label = purchasable.salary ? 'Salary' : 'Running';
    const costs = gameState.computed?.costs;
    const entry = costs?.personnel?.breakdown?.[purchasable.id]
      || costs?.compute?.breakdown?.[purchasable.id]
      || costs?.admin?.breakdown?.[purchasable.id];
    const marginal = entry?.marginalCost ?? (purchasable.salary || purchasable.runningCost);
    let text = `${label}: ${formatFunding(marginal * opsDiscount)}${getRateUnit()}`;
    if (count > 0 && entry) {
      text += ` - Total: ${formatFunding(entry.cost * opsDiscount)}${getRateUnit()}`;
    }

    // Tooltip builder for cost breakdown
    const pid = purchasable.id;
    const baseCost = purchasable.salary || purchasable.runningCost;
    const scalingFactor = BALANCE.COST_SCALING[pid] || 0;
    const tooltipBuilder = () => {
      const od = gameState.computed?.costs?.opsDiscount ?? 1;
      const ct = getCount(pid);
      const rows = [`<div class="tooltip-row"><span>Base</span><span>${formatFunding(baseCost)}${getRateUnit()}</span></div>`];
      if (scalingFactor > 0 && ct > 0) rows.push(`<div class="tooltip-row"><span>Scaling</span><span>×${fmtMult(1 + scalingFactor * (ct + 1))}</span></div>`);
      if (BALANCE.TALENT_POOL_ENABLED && POOL_IDS.includes(pid)) {
        const poolMult = getPoolScalingMultiplier(getPoolUsage(pid));
        if (poolMult > 1 && poolMult !== Infinity) rows.push(`<div class="tooltip-row"><span>Talent pool</span><span>×${fmtMult(poolMult)}</span></div>`);
        else if (poolMult === Infinity) rows.push(`<div class="tooltip-row negative"><span>Talent pool</span><span>DEPLETED</span></div>`);
      }
      if (od !== 1) rows.push(`<div class="tooltip-row"><span>Ops bonus</span><span>×${fmtMult(od)}</span></div>`);
      return `<div class="tooltip-header"><span>Cost Breakdown</span></div>${rows.join('')}`;
    };

    parts.push({ text, tooltipBuilder });
  }
  // Show cost impact for automation upgrade purchasables that multiply team salary
  const HR_MULTIPLIER_UPGRADES = ['executive_recruiter', 'headhunter'];
  const PROC_MULTIPLIER_UPGRADES = ['cloud_partnerships', 'construction_division'];

  if (HR_MULTIPLIER_UPGRADES.includes(purchasable.id) || PROC_MULTIPLIER_UPGRADES.includes(purchasable.id)) {
    const teamId = HR_MULTIPLIER_UPGRADES.includes(purchasable.id) ? 'hr_team' : 'procurement_team_unit';
    const teamLabel = teamId === 'hr_team' ? 'HR' : 'Procurement';
    const costs = gameState.computed?.costs;
    const currentTotal = costs?.admin?.breakdown?.[teamId]?.cost ?? 0;
    if (currentTotal > 0) {
      const projectedTotal = currentTotal * 1.2;
      parts.push({ text: `×1.2 ${teamLabel} salaries (${formatFunding(currentTotal * opsDiscount)}${getRateUnit()} → ${formatFunding(projectedTotal * opsDiscount)}${getRateUnit()})`, tooltipBuilder: null });
    } else {
      parts.push({ text: `×1.2 ${teamLabel} team salaries`, tooltipBuilder: null });
    }
  }

  // Focus speed effects (Executive Team, Chief of Staff)
  if (purchasable.effects.focusSpeedMultiplier) {
    parts.push({ text: `×${purchasable.effects.focusSpeedMultiplier} focus speed`, tooltipBuilder: null });
  }

  // COO ops bonuses (hardcoded in ceo-focus.js, not in effects object)
  if (purchasable.id === 'coo') {
    parts.push({ text: '+5% operations focus baseline and maximum', tooltipBuilder: null });
  }

  // Efficiency: $/RP for personnel, $/TFLOPS for compute (uses running cost, not purchase cost)
  if (purchasable.salary || purchasable.runningCost) {
    const costs = gameState.computed?.costs;
    const effEntry = costs?.personnel?.breakdown?.[purchasable.id]
      || costs?.compute?.breakdown?.[purchasable.id]
      || costs?.admin?.breakdown?.[purchasable.id];
    const marginalRunning = (effEntry?.marginalCost ?? (purchasable.salary || purchasable.runningCost)) * opsDiscount;
    if (marginalRunning > 0) {
      if (purchasable.effects?.trackRP) {
        const outputMult = getOutputMultiplier(purchasable.id);
        const ampData = gameState.computed?.amplification;
        const ampMult = ampData?.ampBonuses?.[purchasable.id] || 1;
        const effectiveRP = purchasable.effects.trackRP * outputMult * ampMult;
        parts.push({ text: formatFunding(marginalRunning / effectiveRP) + '/RP', tooltipBuilder: null });
      }
      if (purchasable.effects?.computeRate) {
        const compMult = getOutputMultiplier(purchasable.id);
        const effectiveTflops = purchasable.effects.computeRate * compMult;
        parts.push({ text: formatFunding(marginalRunning / effectiveTflops) + '/TFLOPS', tooltipBuilder: null });
      }
    }
  }

  return parts;
}

/** Render stats parts into a container element, with styled tooltips where available.
 *  Reuses existing span elements to avoid DOM churn. */
function renderStatsParts(container, parts) {
  const existing = container._statSpans || [];
  // Rebuild DOM only if part count changed
  if (existing.length !== parts.length) {
    container.textContent = '';
    const spans = [];
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) container.appendChild(document.createTextNode(' \u00b7 '));
      const span = document.createElement('span');
      container.appendChild(span);
      spans.push(span);
    }
    container._statSpans = spans;
  }
  const spans = container._statSpans;
  for (let i = 0; i < parts.length; i++) {
    const span = spans[i];
    if (span.textContent !== parts[i].text) span.textContent = parts[i].text;
    const builder = parts[i].tooltipBuilder;
    // Attach hover handlers once; update the stored builder each tick
    if (builder) {
      span._tooltipBuilder = builder;
      span.style.cursor = 'help';
      if (!span._hasTooltipEvents) {
        let hoverTimeout = null;
        span.addEventListener('mouseenter', () => {
          hoverTimeout = setTimeout(() => {
            if (span._tooltipBuilder) showTooltipFor(span, span._tooltipBuilder);
          }, 150);
        });
        span.addEventListener('mouseleave', () => {
          if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
          scheduleHide();
        });
        span._hasTooltipEvents = true;
      }
    } else {
      span._tooltipBuilder = null;
      span.style.cursor = '';
    }
  }
}

/**
 * Patch cost text, affordability class, and button disabled state on
 * existing purchase cards without touching the DOM structure.
 * Uses stashed refs (card._ownedEl, card._costInfoEl, card._btn) to avoid
 * querySelector calls on the hot path.
 */
function updatePurchaseAffordability() {
  const activeTab = getActiveSubTab();

  // Finance tab has no purchase cards
  if (activeTab === 'finance') return;

  const purchasesList = getPurchaseContainer(activeTab);
  if (!purchasesList) return;

  // Data tab uses its own renderer; rebuild on FAST ticks for live updates
  if (activeTab === 'data') {
    renderDataTab(purchasesList);
    return;
  }

  const allPurchasables = getAllPurchasables();

  for (const p of allPurchasables) {
    const displayCategory = p.uiCategory || p.category;
    if (displayCategory !== activeTab) continue;

    const card = purchasesList.querySelector(`[data-purchase-id="${p.id}"]`);
    if (!card) continue;

    const count = getCount(p.id);
    const cost = getPurchaseCost(p);
    const affordable = canPurchase(p);
    const queueable = canQueuePurchase(p.id);

    const isFurloughable = card._isFurloughable;
    const active = isFurloughable ? getActiveCount(p.id) : count;

    // Use stashed refs, fall back to querySelector
    const ownedEl = card._ownedEl || card.querySelector('.purchase-name');
    if (ownedEl) {
      const purchasableName = card._purchasableName || p.name;
      // Talent pool display: (active/owned/pool) when pool warning shown
      let countText;
      if (BALANCE.TALENT_POOL_ENABLED && gameState.talentPools?.warningShown && POOL_IDS.includes(p.id)) {
        const pool = Math.floor(getEffectivePool(p.id));
        const usage = getPoolUsage(p.id);
        countText = `(${active}/${count}/${pool})`;
        if (usage >= 1.0) {
          ownedEl.classList.add('negative');
          ownedEl.classList.remove('warning');
        } else if (usage >= 0.75) {
          ownedEl.classList.add('warning');
          ownedEl.classList.remove('negative');
        } else {
          ownedEl.classList.remove('negative', 'warning');
        }
      } else {
        countText = isFurloughable && count > 0 ? `(${active}/${count})` : `(${count})`;
      }
      ownedEl.textContent = purchasableName + ' ' + countText;

      if (isFurloughable && count > 0) {
        ownedEl._tooltipBuilder = () => {
          const a = getActiveCount(p.id), c = getCount(p.id);
          const rows = [`<div class="tooltip-row"><span>${a} active / ${c} owned</span></div>`];
          if (BALANCE.TALENT_POOL_ENABLED && gameState.talentPools?.warningShown && POOL_IDS.includes(p.id)) {
            const pool = Math.floor(getEffectivePool(p.id));
            rows.push(`<div class="tooltip-row"><span>${pool} in talent pool</span></div>`);
          }
          return rows.join('');
        };
        ownedEl.style.cursor = 'help';
        if (!ownedEl._hasTooltipEvents) {
          let ht = null;
          ownedEl.addEventListener('mouseenter', () => {
            ht = setTimeout(() => { if (ownedEl._tooltipBuilder) showTooltipFor(ownedEl, ownedEl._tooltipBuilder); }, 150);
          });
          ownedEl.addEventListener('mouseleave', () => { if (ht) { clearTimeout(ht); ht = null; } scheduleHide(); });
          ownedEl._hasTooltipEvents = true;
        }
      } else {
        ownedEl._tooltipBuilder = null;
        ownedEl.style.cursor = '';
      }
    }

    // Update furlough button disabled state
    if (card._furloughBtn) {
      card._furloughBtn.disabled = active <= 0;
    }

    const costInfoEl = card._costInfoEl || card.querySelector('.purchase-cost-info');
    if (costInfoEl) {
      const costText = formatFunding(cost.funding || 0);
      const durationText = p.focusDuration ? formatDuration(p.focusDuration) : '';
      costInfoEl.textContent = durationText ? `${costText} \u00b7 ${durationText}` : costText;
      costInfoEl.classList.toggle('affordable', affordable);
    }

    const btn = card._btn || card.querySelector('.purchase-header-actions button');
    if (btn) {
      const isMaxed = p.maxPurchases && count >= p.maxPurchases;
      btn.textContent = isMaxed ? 'Purchased' : 'Queue';
      btn.disabled = !queueable;
    }

    // Update stats line (running costs change with count)
    const statsEl = card._statsEl || card.querySelector('.purchase-stats');
    if (statsEl) {
      renderStatsParts(statsEl, buildStatsParts(p, count));
    }

    const ampText = getAmplificationBonusText(p.id);
    if (card._ampEl) {
      if (ampText) {
        card._ampEl.textContent = ampText;
        card._ampEl.style.display = '';
      } else {
        card._ampEl.style.display = 'none';
      }
    } else if (ampText) {
      // Create _ampEl dynamically if amp data is now available
      const statsEl = card._statsEl || card.querySelector('.purchase-stats');
      if (statsEl) {
        const ampLine = document.createElement('div');
        ampLine.className = 'purchase-org-bonus dim';
        ampLine.textContent = ampText;
        const ampTooltipBuilder = getAmplificationTooltipBuilder(p.id);
        if (ampTooltipBuilder) {
          ampLine.style.cursor = 'help';
          attachTooltip(ampLine, ampTooltipBuilder);
        }
        statsEl.after(ampLine);
        card._ampEl = ampLine;
      }
    }

    // Update automation panel if present
    if (card._autoPanel) {
      updateAutomationPanel(card._autoPanel);
    }
  }
}

// ---------------------------------------------------------------------------
// Purchase card creation
// ---------------------------------------------------------------------------

/**
 * Create a purchase card element.
 * Stashes ._ownedEl, ._costInfoEl, ._btn on the card so the fast
 * affordability path can update them without querySelector.
 */
function createPurchaseCard(purchasable) {
  const card = document.createElement('div');
  card.className = 'compact-purchase-card';
  card.dataset.purchaseId = purchasable.id;

  // First-unlock highlight: show if card hasn't been seen before
  const seenCards = gameState.ui.seenCards;
  if (!seenCards.includes(purchasable.id)) {
    card.classList.add('new-card-highlight');
    card.addEventListener('mouseenter', () => {
      if (!seenCards.includes(purchasable.id)) {
        seenCards.push(purchasable.id);
      }
      card.classList.add('new-card-highlight-fade');
      card.addEventListener('transitionend', () => {
        card.classList.remove('new-card-highlight', 'new-card-highlight-fade');
      }, { once: true });
    }, { once: true });
  }

  const count = getCount(purchasable.id);
  const cost = getPurchaseCost(purchasable);
  const affordable = canPurchase(purchasable);
  const queueable = canQueuePurchase(purchasable.id);

  // Check if this item can be furloughed (personnel or compute in automatable lists)
  const isFurloughable = AUTOMATABLE_PERSONNEL.some(p => p.id === purchasable.id) ||
                         AUTOMATABLE_COMPUTE.some(c => c.id === purchasable.id) ||
                         FURLOUGHABLE_ADMIN.includes(purchasable.id);

  const active = isFurloughable ? getActiveCount(purchasable.id) : count;

  // === Row 1: Header — Name (count) + [Furlough] [Queue] ===
  const header = document.createElement('div');
  header.className = 'purchase-header';

  const nameEl = document.createElement('span');
  nameEl.className = 'purchase-name';
  // Talent pool display: (active/owned/pool) when pool warning shown
  let countText;
  if (BALANCE.TALENT_POOL_ENABLED && gameState.talentPools?.warningShown && POOL_IDS.includes(purchasable.id)) {
    const pool = Math.floor(getEffectivePool(purchasable.id));
    const usage = getPoolUsage(purchasable.id);
    countText = `(${active}/${count}/${pool})`;
    if (usage >= 1.0) {
      nameEl.classList.add('negative');
    } else if (usage >= 0.75) {
      nameEl.classList.add('warning');
    }
  } else {
    countText = isFurloughable && count > 0 ? `(${active}/${count})` : `(${count})`;
  }
  nameEl.textContent = purchasable.name + ' ' + countText;

  if (isFurloughable) {
    const pid = purchasable.id;
    nameEl.style.cursor = 'help';
    attachTooltip(nameEl, () => {
      const a = getActiveCount(pid), c = getCount(pid);
      const rows = [`<div class="tooltip-row"><span>${a} active / ${c} owned</span></div>`];
      if (BALANCE.TALENT_POOL_ENABLED && gameState.talentPools?.warningShown && POOL_IDS.includes(pid)) {
        const pool = Math.floor(getEffectivePool(pid));
        rows.push(`<div class="tooltip-row"><span>${pool} in talent pool</span></div>`);
      }
      return rows.join('');
    });
  }

  const headerActions = document.createElement('div');
  headerActions.className = 'purchase-header-actions';

  // Furlough button (for automatable items only)
  let furloughBtn = null;
  if (isFurloughable) {
    furloughBtn = document.createElement('button');
    furloughBtn.textContent = 'Furlough';
    furloughBtn.className = 'furlough-btn';
    furloughBtn.disabled = active <= 0;

    furloughBtn.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - _lastFurloughClickTime < 100) return;
      _lastFurloughClickTime = now;
      let qty = 1;
      if (e.ctrlKey && e.shiftKey) qty = 50;
      else if (e.shiftKey) qty = 10;
      else if (e.ctrlKey) qty = 5;

      enqueueFurlough(purchasable.id, qty, false);
      requestFullUpdate();
      updatePurchaseAffordability();
    });

    furloughBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - _lastFurloughClickTime < 100) return;
      _lastFurloughClickTime = now;
      let qty = 1;
      if (e.ctrlKey && e.shiftKey) qty = 50;
      else if (e.shiftKey) qty = 10;
      else if (e.ctrlKey) qty = 5;

      enqueueFurlough(purchasable.id, qty, true);
      requestFullUpdate();
      updatePurchaseAffordability();
    });

    headerActions.appendChild(furloughBtn);
  }

  // Queue button (or "Purchased" label for maxed-out items)
  const isMaxed = purchasable.maxPurchases && count >= purchasable.maxPurchases;
  const btn = document.createElement('button');
  btn.textContent = isMaxed ? 'Purchased' : 'Queue';
  btn.disabled = !queueable;

  btn.addEventListener('click', (e) => {
    let qty = 1;
    if (e.ctrlKey && e.shiftKey) qty = 50;
    else if (e.shiftKey) qty = 10;
    else if (e.ctrlKey) qty = 5;

    enqueuePurchase(purchasable.id, qty, false);
    requestFullUpdate();
    updatePurchaseAffordability();
  });

  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - _lastPriorityClickTime < 100) return;
    _lastPriorityClickTime = now;
    let qty = 1;
    if (e.ctrlKey && e.shiftKey) qty = 50;
    else if (e.shiftKey) qty = 10;
    else if (e.ctrlKey) qty = 5;

    enqueuePurchase(purchasable.id, qty, true);
    requestFullUpdate();
    updatePurchaseAffordability();
  });

  headerActions.appendChild(btn);

  header.appendChild(nameEl);
  header.appendChild(headerActions);
  card.appendChild(header);

  // === Row 2: Description + Cost/Duration ===
  const descRow = document.createElement('div');
  descRow.className = 'purchase-desc-row';

  const desc = document.createElement('div');
  desc.className = 'purchase-description';
  desc.textContent = purchasable.description || '';

  const costInfo = document.createElement('span');
  costInfo.className = 'purchase-cost-info';
  const costText = formatFunding(cost.funding || 0);
  const durationText = purchasable.focusDuration ? formatDuration(purchasable.focusDuration) : '';
  costInfo.textContent = durationText ? `${costText} \u00b7 ${durationText}` : costText;
  costInfo.classList.toggle('affordable', affordable);
  costInfo.style.cursor = 'help';
  attachTooltip(costInfo, buildCostTooltipBuilder(purchasable));

  descRow.appendChild(desc);
  descRow.appendChild(costInfo);
  card.appendChild(descRow);

  // === Row 3: Stats ===
  const stats = document.createElement('div');
  stats.className = 'purchase-stats';
  renderStatsParts(stats, buildStatsParts(purchasable, count));
  card.appendChild(stats);

  // === Row 4: Org bonus (conditional) ===
  const ampText = getAmplificationBonusText(purchasable.id);
  if (ampText) {
    const ampLine = document.createElement('div');
    ampLine.className = 'purchase-org-bonus dim';
    ampLine.textContent = ampText;
    const ampTooltipBuilder = getAmplificationTooltipBuilder(purchasable.id);
    if (ampTooltipBuilder) {
      ampLine.style.cursor = 'help';
      attachTooltip(ampLine, ampTooltipBuilder);
    }
    card.appendChild(ampLine);
    card._ampEl = ampLine;
  }

  // === Flavor text (tooltip on description hover) ===
  if (purchasable.flavor) {
    attachFlavorTooltip(desc, purchasable.id, purchasable.flavor);
  }

  // === Row 5: Automation panel (if unlocked) ===
  if (isAutomationUnlocked(purchasable.id)) {
    const autoPanel = createAutomationPanel(purchasable.id);
    if (autoPanel) {
      card.appendChild(autoPanel);
      card._autoPanel = autoPanel;
    }
  }

  // Stash refs for fast incremental affordability updates
  card._ownedEl = nameEl;
  card._costInfoEl = costInfo;
  card._btn = btn;
  card._statsEl = stats;
  card._furloughBtn = furloughBtn;
  card._isFurloughable = isFurloughable;
  card._purchasableName = purchasable.name;

  return card;
}

// ---------------------------------------------------------------------------
// Infrastructure tabs
// ---------------------------------------------------------------------------

/** Content map: sub-tab category → content div ID */
const SUBTAB_CONTENT = {
  finance: 'finance-tab-content',
  personnel: 'personnel-tab-content',
  compute: 'compute-tab-content',
  admin: 'admin-tab-content',
  data: 'data-tab-content',
  ai: 'ai-tab-content',
};

/** Initialize sub-tab switching for Operations column. */
/** Programmatically switch to a subtab by category name. */
export function switchSubTab(category) {
  const opsColumn = document.getElementById('col-operations');
  if (!opsColumn) return;

  const btn = opsColumn.querySelector(`.sub-tab[data-category="${category}"]`);
  if (!btn || btn.classList.contains('active')) return;

  opsColumn.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  for (const [cat, contentId] of Object.entries(SUBTAB_CONTENT)) {
    const contentEl = document.getElementById(contentId);
    if (contentEl) {
      contentEl.classList.toggle('hidden', cat !== category);
    }
  }

  requestFullUpdate();
  _renderedPurchaseFingerprint = '';
  resetDataTab();
  rebuildPurchaseList();
}

export function initInfraTabs() {
  const opsColumn = document.getElementById('col-operations');
  if (!opsColumn) return;
  initTabNotifications();
  // Sub-tab switching: toggle .subtab-content visibility
  opsColumn.querySelectorAll('.sub-tab').forEach(btn => {
    btn.addEventListener('click', () => switchSubTab(btn.dataset.category));
  });
}

// (Old upgrades tab visibility / upgrades list code removed — Build/Upgrades tabs are gone)

// (Old upgrade card creation code removed — Build/Upgrades tabs are gone)

// ---------------------------------------------------------------------------
// Scheduler registration
// ---------------------------------------------------------------------------
registerUpdate(updatePurchaseAffordability, FAST);
registerUpdate(rebuildPurchaseList, SLOW, { reset: resetPurchaseCache });
