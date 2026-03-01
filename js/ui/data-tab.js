import { gameState } from '../game-state.js';
import { BALANCE } from '../../data/balance.js';
import { getCapForCopies } from '../data-quality.js';
import { getRateUnit, formatFunding, formatDuration, formatNumber, formatPercent } from '../utils/format.js';
import { getPurchasableById, getPurchaseCost, canQueuePurchase } from '../content/purchasables.js';
import { getCount, getActiveCount } from '../purchasable-state.js';
import { createPurgeItem, findPurgeIndex, addToQueue, removeFromQueue, enqueuePurchase, enqueueFurlough } from '../focus-queue.js';
import { requestFullUpdate } from './signals.js';
import { attachTooltip } from './stats-tooltip.js';
import { capabilitiesTrack } from '../content/capabilities-track.js';
import { createAutomationPanel, updateAutomationPanel } from './automation-panel.js';
import { isAutomationUnlocked } from '../automation-state.js';

import { recordFlavorDiscovery } from '../flavor-discovery.js';

/** Apply first-unlock highlight to a card if not yet seen by the player. */
function applyNewCardHighlight(card, purchasableId) {
  const seenCards = gameState.ui.seenCards;
  if (seenCards.includes(purchasableId)) return;
  card.classList.add('new-card-highlight');
  card.addEventListener('mouseenter', () => {
    if (!seenCards.includes(purchasableId)) {
      seenCards.push(purchasableId);
    }
    card.classList.add('new-card-highlight-fade');
    card.addEventListener('transitionend', () => {
      card.classList.remove('new-card-highlight', 'new-card-highlight-fade');
    }, { once: true });
  }, { once: true });
}

// Debounce timestamps for button handlers
let _lastPriorityClickTime = 0;
let _lastFurloughClickTime = 0;

/** Get batch quantity from modifier keys: default=1, Ctrl=5, Shift=10, Ctrl+Shift=50 */
function getModifierQty(e) {
  if (e.ctrlKey && e.shiftKey) return 50;
  if (e.shiftKey) return 10;
  if (e.ctrlKey) return 5;
  return 1;
}

// ---------------------------------------------------------------------------
// Event Delegation
// ---------------------------------------------------------------------------
let _delegationInit = false;

function initDataTabDelegation(container) {
  if (_delegationInit) return;
  _delegationInit = true;

  container.addEventListener('click', (e) => {
    // Purge toggle (kept as delegation — appears/disappears dynamically)
    const purgeBtn = e.target.closest('[data-synth-purge]');
    if (purgeBtn) {
      const idx = findPurgeIndex();
      if (idx >= 0) {
        removeFromQueue(idx);
      } else {
        addToQueue(createPurgeItem());
      }
      _dataTabFingerprint = '';
      requestFullUpdate();
      return;
    }

    // Collapsible section headers
    const sectionHeader = e.target.closest('.data-section-header');
    if (sectionHeader) {
      const section = sectionHeader.closest('.data-section');
      if (section) section.classList.toggle('collapsed');
    }
  });

  // Right-click purge: add with priority (don't toggle off)
  container.addEventListener('contextmenu', (e) => {
    const purgeBtn = e.target.closest('[data-synth-purge]');
    if (!purgeBtn) return;
    e.preventDefault();
    if (findPurgeIndex() >= 0) return;
    addToQueue(createPurgeItem(), true);
    _dataTabFingerprint = '';
    requestFullUpdate();
  });
}

// ---------------------------------------------------------------------------
// Purge button helper (single source of truth for both render paths)
// ---------------------------------------------------------------------------
function createPurgeButton() {
  const active = findPurgeIndex() >= 0;
  const btn = document.createElement('button');
  btn.className = 'purchase-btn purge-btn' + (active ? ' active' : '');
  btn.dataset.synthPurge = '';
  btn.textContent = active ? 'Cancel Purge' : 'Purge Synthetic Data';
  attachTooltip(btn, () =>
    'Gradually removes synthetic training data.<br>Runs until cancelled or score reaches zero.');
  return btn;
}

// ---------------------------------------------------------------------------
// Fingerprint for incremental updates
// ---------------------------------------------------------------------------
let _dataTabFingerprint = '';

function buildDataFingerprint() {
  const parts = [];

  // Bulk sources — visibility + owned/not (structural: card appearance changes on first buy)
  const bulkParts = [];
  for (const src of BALANCE.DATA_BULK_SOURCES || []) {
    if (!isDataSourceVisible(src.id)) continue;
    bulkParts.push(src.id + ':' + (getCount('data_' + src.id) > 0 ? '1' : '0'));
  }
  parts.push('bulk:' + bulkParts.join(','));

  // Renewable sources — only visibility + owned-or-not (0 vs >0).
  // Count/active changes are handled incrementally by updateRenewableDynamic
  // and updateAffordability, avoiding full rebuild flicker (#776).
  const renewParts = [];
  for (const src of BALANCE.DATA_RENEWABLE_SOURCES || []) {
    if (!isDataSourceVisible(src.id)) continue;
    renewParts.push(src.id + ':' + (getCount('data_' + src.id) > 0 ? '1' : '0'));
  }
  parts.push('renew:' + renewParts.join(','));

  // Generators — owned-or-not + upgrade level (structural: card set changes).
  // Count/active value changes handled incrementally by updateSyntheticDynamic (#776).
  const genOwned = getCount('synthetic_generator') > 0 ? 1 : 0;
  const upgradeLevel = getCount('generator_upgrade_autonomous') > 0 ? 2
    : getCount('generator_upgrade_verified') > 0 ? 1 : 0;
  parts.push('gen:' + genOwned + '/' + upgradeLevel);

  // Purge button visibility + toggle state
  const purgeQueued = findPurgeIndex() >= 0;
  parts.push('purge:' + (gameState.data.syntheticScore > 0 ? '1' : '0') + (purgeQueued ? 'q' : ''));

  // Quality revealed state
  parts.push('qrev:' + (gameState.data.qualityRevealed ? '1' : '0'));

  // Capability unlock state for gated items (triggers rebuild when caps unlock)
  const capBits = [];
  for (const capId of ['synthetic_data', 'synthetic_verification', 'autonomous_research',
    'data_curation', 'chain_of_thought', 'dataset_licensing', 'massive_scaling']) {
    if (isCapUnlocked(capId)) capBits.push(capId);
  }
  parts.push('caps:' + capBits.join(','));

  return parts.join('|');
}

// ---------------------------------------------------------------------------
// Main Render
// ---------------------------------------------------------------------------
export function renderDataTab(container) {
  const fp = buildDataFingerprint();
  if (fp === _dataTabFingerprint) {
    updateDataTabDynamicValues();
    return;
  }
  _dataTabFingerprint = fp;

  // Full rebuild — preserve collapse state
  const collapseState = {};
  container.querySelectorAll('.data-section').forEach(s => {
    const title = s.querySelector('.data-section-title');
    if (title) collapseState[title.textContent] = s.classList.contains('collapsed');
  });

  initDataTabDelegation(container);
  container.innerHTML = '';

  // Stats overview panel
  container.appendChild(createStatsPanel());

  const cd = gameState.computed?.data;

  // --- Section order: Synthetic → Renewable → Bulk ---

  // Synthetic section (hidden until unlocked, no teaser)
  if (isCapUnlocked('synthetic_data')) {
    const synthSummary = buildSyntheticSummary(cd);
    const synthDefaultCollapsed = collapseState['SYNTHETIC DATA'] !== undefined ? collapseState['SYNTHETIC DATA'] : false;
    container.appendChild(createCollapsibleSection('SYNTHETIC DATA', synthSummary, synthDefaultCollapsed, [createSyntheticSection()]));
  }

  // Renewable section (always visible — hint when no/some sources locked)
  const visibleRenewable = (BALANCE.DATA_RENEWABLE_SOURCES || []).filter(s => isDataSourceVisible(s.id));
  const hiddenRenewableCount = (BALANCE.DATA_RENEWABLE_SOURCES || []).length - visibleRenewable.length;
  const renewableCards = visibleRenewable.map(src => createRenewableCard(src));
  if (hiddenRenewableCount > 0) {
    renewableCards.push(createResearchHint('renewable', hiddenRenewableCount, visibleRenewable.length > 0));
  }
  if (visibleRenewable.length > 0) {
    const renewSummary = buildRenewableSummary(cd, visibleRenewable);
    const renewDefaultCollapsed = collapseState['RENEWABLE DATA'] !== undefined ? collapseState['RENEWABLE DATA'] : false;
    container.appendChild(createCollapsibleSection('RENEWABLE DATA', renewSummary, renewDefaultCollapsed, renewableCards));
  } else if (hiddenRenewableCount > 0) {
    container.appendChild(createResearchHint('renewable', hiddenRenewableCount, false));
  }

  // Bulk section
  const visibleBulk = (BALANCE.DATA_BULK_SOURCES || []).filter(s => isDataSourceVisible(s.id));
  const hiddenBulkCount = (BALANCE.DATA_BULK_SOURCES || []).length - visibleBulk.length;
  const purchasedCount = visibleBulk.filter(s => getCount('data_' + s.id) > 0).length;
  const allBulkPurchased = purchasedCount === visibleBulk.length && visibleBulk.length > 0;
  const bulkCards = visibleBulk.map(src => createBulkCard(src));
  if (hiddenBulkCount > 0) {
    bulkCards.push(createResearchHint('bulk', hiddenBulkCount, true));
  }
  const catQ = cd?.categoryQuality || {};
  const bulkEffVal = cd?.scores?.bulkEff ?? (cd?.scores?.bulk || 0) * (catQ.bulk || 1);
  const bulkSummary = `${formatNumber(Math.round(bulkEffVal))} effective`;
  const bulkDefaultCollapsed = collapseState['BULK DATA'] !== undefined ? collapseState['BULK DATA'] : allBulkPurchased;
  container.appendChild(createCollapsibleSection('BULK DATA', bulkSummary, bulkDefaultCollapsed, bulkCards));
}

// ---------------------------------------------------------------------------
// Stats Overview Panel
// ---------------------------------------------------------------------------
function createStatsPanel() {
  const cd = gameState.computed?.data;
  const scores = cd?.scores || { bulk: 0, renewable: 0, synthetic: 0, total: 0 };
  const effectiveness = cd?.effectiveness ?? gameState.data.effectiveness ?? 1.0;
  const quality = cd?.quality ?? 1.0;
  const qualityRevealed = gameState.data.qualityRevealed;
  const required = gameState.data.dataRequired || 1;
  const effectiveScore = scores.effective ?? scores.total;

  const effClass = effectiveness >= 1.5 ? 'positive' : effectiveness >= 0.8 ? 'warning' : 'negative';
  const effMultiplier = effectiveness <= 1.0
    ? (effectiveness * effectiveness).toFixed(2)
    : (1.0 + Math.log(1 + (effectiveness - 1.0))).toFixed(2);

  // Trend arrow from 5s snapshot comparison
  const trend = cd?.trend || 'stable';
  const trendArrow = trend === 'rising' ? '\u25B2' : trend === 'falling' ? '\u25BC' : '\u2550';
  const trendClass = trend === 'rising' ? 'positive' : trend === 'falling' ? 'negative' : 'dim';

  // Surplus/deficit
  const surplus = effectiveScore - required;
  const surplusText = surplus >= 0
    ? `(+${formatNumber(Math.round(surplus))} surplus)`
    : `(${formatNumber(Math.round(surplus))} deficit)`;
  const surplusClass = surplus >= 0 ? 'positive' : 'negative';

  const renewableRate = Object.values(cd?.renewables || {}).reduce((sum, r) => sum + (r.growthRate || 0), 0);
  const synthRate = cd?.synthetic?.generationRate ?? 0;

  // Running costs from computed state
  const dataBreakdown = gameState.computed?.costs?.data?.breakdown || {};
  let renewableCost = 0;
  for (const src of BALANCE.DATA_RENEWABLE_SOURCES) {
    const entry = dataBreakdown['data_' + src.id];
    if (entry) renewableCost += entry.cost;
  }
  const synthCostEntry = dataBreakdown.synthetic_generator;
  const synthCost = synthCostEntry?.cost || 0;

  const panel = document.createElement('div');
  panel.className = 'data-stats-panel';
  panel.id = 'data-stats-panel';

  const qClass = quality >= 0.7 ? 'positive' : quality >= 0.4 ? 'warning' : 'negative';
  const qualityPct = Math.round(quality * 100);

  const hasSynthetic = isCapUnlocked('synthetic_data');
  const catQ = cd?.categoryQuality || { bulk: 0, renewable: 0, synthetic: 0 };

  // Per-category effective scores and percentages
  const bulkEff = scores.bulkEff ?? scores.bulk * (catQ.bulk || 1);
  const renewableEff = scores.renewableEff ?? scores.renewable * (catQ.renewable || 1);
  const syntheticEff = scores.syntheticEff ?? scores.synthetic * (catQ.synthetic || 1);
  const totalEff = effectiveScore || 1;
  const bulkPct = totalEff > 0 ? Math.round(bulkEff / totalEff * 100) : 0;
  const renewablePct = totalEff > 0 ? Math.round(renewableEff / totalEff * 100) : 0;
  const syntheticPct = totalEff > 0 ? Math.round(syntheticEff / totalEff * 100) : 0;

  panel.innerHTML = `
    <h2>DATA OVERVIEW</h2>
    <div class="data-effectiveness-row" id="data-eff-row">
      <span class="stat-label">Effectiveness</span>
      <span class="stat-value ${effClass}" id="data-eff-value">${effMultiplier}x</span>
      <span class="stat-value ${trendClass}" id="data-eff-trend">${trendArrow}</span>
      <span class="dim" id="data-eff-label">research speed</span>
    </div>
    <div class="data-effectiveness-detail" id="data-eff-detail">
      <span id="data-eff-score">${formatNumber(Math.round(effectiveScore))} effective / ${formatNumber(Math.round(required))} needed</span>
      <span class="${surplusClass}" id="data-eff-surplus">${surplusText}</span>
    </div>
    <div class="data-effectiveness-row" id="data-quality-row">
      <span class="stat-label">Quality</span>
      <span class="stat-value ${qClass}" id="data-quality-value">${quality.toFixed(2)}</span>
      <span class="dim" id="data-quality-effect">\u2192 ${qualityPct}% of raw data effective</span>
      ${qualityRevealed ? `<span class="dim" id="data-synth-pct">\u00b7 Synthetic ratio: ${formatPercent(cd?.synthetic?.synthProportion ?? 0)}</span>` : ''}
    </div>
    <div class="data-category-breakdown" id="data-cat-breakdown">
      <div class="data-category-stat">
        <span class="cat-label">Bulk</span>
        <span class="cat-score" id="data-cat-bulk">${formatNumber(Math.round(bulkEff))} <span class="cat-pct dim">(${bulkPct}%)</span></span>
      </div>
      <div class="data-category-stat">
        <span class="cat-label">Renewable</span>
        <span class="cat-score" id="data-cat-renewable">${formatNumber(Math.round(renewableEff))} <span class="cat-pct dim">(${renewablePct}%)</span></span>
        <span class="cat-rate positive" id="data-cat-renewable-rate">${renewableRate > 0 ? '+' + renewableRate.toFixed(1) + getRateUnit() : '\u2014'}</span>
        <span class="cat-cost" id="data-cat-renewable-cost">${renewableCost > 0 ? formatFunding(renewableCost) + getRateUnit() : ''}</span>
      </div>
      ${hasSynthetic ? `
      <div class="data-category-stat">
        <span class="cat-label">Synthetic</span>
        <span class="cat-score" id="data-cat-synth">${formatNumber(Math.round(syntheticEff))} <span class="cat-pct dim">(${syntheticPct}%)</span></span>
        <span class="cat-rate positive" id="data-cat-synth-rate">${synthRate > 0 ? '+' + synthRate.toFixed(1) + getRateUnit() : '\u2014'}</span>
        <span class="cat-cost" id="data-cat-synth-cost">${synthCost > 0 ? formatFunding(synthCost) + getRateUnit() : ''}</span>
      </div>` : ''}
    </div>
  `;

  // Attach custom tooltips for category scores (replaces native title attributes)
  attachDataCategoryTooltips(panel);

  return panel;
}

// Attach live tooltips to data category score elements
function attachDataCategoryTooltips(panel) {
  const ids = [
    { elId: 'data-cat-bulk', category: 'bulk' },
    { elId: 'data-cat-renewable', category: 'renewable' },
    { elId: 'data-cat-synth', category: 'synthetic' },
  ];
  for (const { elId, category } of ids) {
    const el = panel.querySelector(`#${elId}`);
    if (el) {
      attachTooltip(el, () => {
        const cd = gameState.computed?.data;
        const scores = cd?.scores || {};
        const catQ = cd?.categoryQuality || {};
        const raw = Math.round(scores[category] || 0);
        const q = catQ[category] || 0;
        const qStr = q > 0 ? q.toFixed(2) : '\u2014';
        return `<div class="tooltip-row"><span>Raw: ${raw} \u00b7 Avg Q: ${qStr}</span></div>`;
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Collapsible Section Builder
// ---------------------------------------------------------------------------
function createCollapsibleSection(title, summaryText, defaultCollapsed, children) {
  const section = document.createElement('div');
  section.className = 'data-section' + (defaultCollapsed ? ' collapsed' : '');

  const header = document.createElement('div');
  header.className = 'data-section-header';
  header.innerHTML = `
    <span class="section-toggle">\u25BC</span>
    <h3 class="data-section-title" style="margin:0">${title}</h3>
    <span class="section-summary" data-section-summary="${title}">${summaryText}</span>
  `;

  const items = document.createElement('div');
  items.className = 'data-section-items';
  for (const child of children) {
    items.appendChild(child);
  }

  section.appendChild(header);
  section.appendChild(items);
  return section;
}

// ---------------------------------------------------------------------------
// Card Builders
// ---------------------------------------------------------------------------
function createBulkCard(src) {
  const purchId = 'data_' + src.id;
  const purchasable = getPurchasableById(purchId);
  const count = getCount(purchId);
  const owned = count > 0;
  const cost = purchasable ? getPurchaseCost(purchasable) : {};
  const queueable = canQueuePurchase(purchId);

  const card = document.createElement('div');
  card.className = 'compact-purchase-card';
  card.dataset.purchaseId = purchId;
  if (owned) card.style.borderLeft = '3px solid var(--positive)';
  applyNewCardHighlight(card, purchId);

  // === Row 1: Header — Name (count) + [Queue] ===
  const header = document.createElement('div');
  header.className = 'purchase-header';

  const nameEl = document.createElement('span');
  nameEl.className = 'purchase-name';
  nameEl.textContent = src.name + ' ' + (owned ? '(1)' : '(0)');

  const headerActions = document.createElement('div');
  headerActions.className = 'purchase-header-actions';

  const btn = document.createElement('button');
  btn.textContent = 'Queue';
  btn.disabled = !queueable;

  btn.addEventListener('click', (e) => {
    enqueuePurchase(purchId, getModifierQty(e), false);
    _dataTabFingerprint = '';
    requestFullUpdate();
  });
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - _lastPriorityClickTime < 100) return;
    _lastPriorityClickTime = now;
    enqueuePurchase(purchId, getModifierQty(e), true);
    _dataTabFingerprint = '';
    requestFullUpdate();
  });

  headerActions.appendChild(btn);
  header.appendChild(nameEl);
  header.appendChild(headerActions);
  card.appendChild(header);

  // === Row 2: Description + Cost ===
  const descRow = document.createElement('div');
  descRow.className = 'purchase-desc-row';

  const desc = document.createElement('div');
  desc.className = 'purchase-description';
  desc.textContent = purchasable?.description || src.name;
  if (purchasable?.flavorText) {
    desc.classList.add('has-flavor');
    const flavorText = purchasable.flavorText;
    const pId = purchId;
    attachTooltip(desc, () => {
      recordFlavorDiscovery(pId);
      return `<div class="tooltip-section"><div>${flavorText}</div></div>`;
    }, { delay: 400 });
  }

  const costInfo = document.createElement('span');
  costInfo.className = 'purchase-cost-info';
  const costText = cost.funding === 0 || !cost.funding ? 'FREE' : formatFunding(cost.funding);
  const durationText = purchasable?.focusDuration ? formatDuration(purchasable.focusDuration) : '';
  costInfo.textContent = durationText ? `${costText} \u00b7 ${durationText}` : costText;
  costInfo.classList.toggle('affordable', queueable && gameState.resources.funding >= (cost.funding || 0));

  descRow.appendChild(desc);
  descRow.appendChild(costInfo);
  card.appendChild(descRow);

  // === Row 3: Stats ===
  const stats = document.createElement('div');
  stats.className = 'purchase-stats';
  const effectiveScore = src.score * src.quality;
  const effText = cost.funding > 0 && effectiveScore > 0 ? ` · ${formatFunding(cost.funding / effectiveScore)}/eff` : '';
  stats.textContent = `+${src.score} data · quality ${src.quality}${effText}`;
  card.appendChild(stats);

  // === Row 4: Requirements hint ===
  let reqEl = null;
  if (purchasable?.requires?.capability && !isCapUnlocked(purchasable.requires.capability)) {
    reqEl = document.createElement('div');
    reqEl.className = 'purchase-requires dim';
    reqEl.textContent = `[requires: ${purchasable.requires.capability.replace(/_/g, ' ')}]`;
    card.appendChild(reqEl);
  }

  // Stash refs
  card._ownedEl = nameEl;
  card._costInfoEl = costInfo;
  card._btn = btn;
  card._statsEl = stats;
  card._reqEl = reqEl;
  card._furloughBtn = null;
  card._isFurloughable = false;
  card._purchasableName = src.name;

  return card;
}

function createRenewableCard(src) {
  const purchId = 'data_' + src.id;
  const purchasable = getPurchasableById(purchId);
  const count = getCount(purchId);
  const active = getActiveCount(purchId);
  const isOwned = count > 0;
  const cd = gameState.computed?.data?.renewables?.[src.id];
  const curScore = cd?.score ?? 0;
  const maxScore = cd?.maxScore ?? 1;
  const growthRate = cd?.growthRate ?? 0;
  const cost = purchasable ? getPurchaseCost(purchasable) : {};
  const queueable = canQueuePurchase(purchId);

  const card = document.createElement('div');
  card.className = 'compact-purchase-card data-renewable-card';
  card.dataset.purchaseId = purchId;

  // Border: green when active, yellow when all furloughed, none when unowned
  if (isOwned) {
    card.style.borderLeft = `3px solid var(--${active > 0 ? 'positive' : 'warning'})`;
  }
  applyNewCardHighlight(card, purchId);

  // === Row 1: Header — Name (active/count) + [Furlough] [Queue] ===
  const header = document.createElement('div');
  header.className = 'purchase-header';

  const nameEl = document.createElement('span');
  nameEl.className = 'purchase-name';
  const countText = isOwned ? `(${active}/${count})` : '(0)';
  nameEl.textContent = src.name + ' ' + countText;

  if (isOwned) {
    nameEl.style.cursor = 'help';
    attachTooltip(nameEl, () => {
      const a = getActiveCount(purchId), c = getCount(purchId);
      return `<div class="tooltip-row"><span>${a} active / ${c} owned</span></div>`;
    });
  }

  const headerActions = document.createElement('div');
  headerActions.className = 'purchase-header-actions';

  // Furlough button (shown when owned)
  let furloughBtn = null;
  if (isOwned) {
    furloughBtn = document.createElement('button');
    furloughBtn.textContent = 'Furlough';
    furloughBtn.className = 'furlough-btn';
    furloughBtn.disabled = active <= 0;

    furloughBtn.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - _lastFurloughClickTime < 100) return;
      _lastFurloughClickTime = now;
      enqueueFurlough(purchId, getModifierQty(e), false);
      requestFullUpdate();
    });
    furloughBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - _lastFurloughClickTime < 100) return;
      _lastFurloughClickTime = now;
      enqueueFurlough(purchId, getModifierQty(e), true);
      requestFullUpdate();
    });

    headerActions.appendChild(furloughBtn);
  }

  // Queue button (buy next level or auto-unfurlough)
  const btn = document.createElement('button');
  btn.textContent = 'Queue';
  btn.disabled = !queueable;

  btn.addEventListener('click', (e) => {
    enqueuePurchase(purchId, getModifierQty(e), false);
    requestFullUpdate();
  });
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - _lastPriorityClickTime < 100) return;
    _lastPriorityClickTime = now;
    enqueuePurchase(purchId, getModifierQty(e), true);
    requestFullUpdate();
  });

  headerActions.appendChild(btn);
  header.appendChild(nameEl);
  header.appendChild(headerActions);
  card.appendChild(header);

  // === Row 2: Description + Cost info ===
  const descRow = document.createElement('div');
  descRow.className = 'purchase-desc-row';

  const desc = document.createElement('div');
  desc.className = 'purchase-description';
  desc.textContent = purchasable?.description || src.name;
  if (purchasable?.flavorText) {
    desc.classList.add('has-flavor');
    const flavorText = purchasable.flavorText;
    const pId = purchId;
    attachTooltip(desc, () => {
      recordFlavorDiscovery(pId);
      return `<div class="tooltip-section"><div>${flavorText}</div></div>`;
    }, { delay: 400 });
  }

  const costInfo = document.createElement('span');
  costInfo.className = 'purchase-cost-info';
  if (isOwned) {
    // Cost info: purchase cost + duration + marginal cap from next copy
    const marginalCap = Math.round(getCapForCopies(src, active + 1, gameState) - getCapForCopies(src, active, gameState));
    const costText = formatFunding(cost.funding || 0);
    const durationText = purchasable?.focusDuration ? formatDuration(purchasable.focusDuration) : '';
    costInfo.textContent = `${costText} \u00b7 ${durationText} \u00b7 +${marginalCap} cap`;
  } else {
    const costText = formatFunding(cost.funding || 0);
    const durationText = purchasable?.focusDuration ? formatDuration(purchasable.focusDuration) : '';
    costInfo.textContent = durationText ? `${costText} \u00b7 ${durationText}` : costText;
  }
  costInfo.classList.toggle('affordable', queueable && gameState.resources.funding >= (cost.funding || 0));

  descRow.appendChild(desc);
  descRow.appendChild(costInfo);
  card.appendChild(descRow);

  // === Row 3: Stats ===
  const stats = document.createElement('div');
  stats.className = 'purchase-stats';
  if (isOwned) {
    const pct = maxScore > 0 ? (curScore / maxScore * 100) : 0;
    let timeToCapText = '';
    if (active > 0 && growthRate > 0 && pct < 99) {
      const remaining = maxScore - curScore;
      const estSeconds = remaining / growthRate;
      timeToCapText = estSeconds < 3600
        ? `~${Math.ceil(estSeconds / 60)}m to cap`
        : `~${(estSeconds / 3600).toFixed(1)}h to cap`;
    }
    const rateText = active > 0
      ? `<span class="positive">+${growthRate.toFixed(1)}${getRateUnit()}</span>`
      : '<span class="dim">paused</span>';
    stats.innerHTML = `${rateText} \u00b7 ${curScore.toFixed(0)}/${maxScore.toFixed(0)} (${pct.toFixed(0)}%)${timeToCapText ? ' \u00b7 ' + timeToCapText : ''}`;
  } else {
    const potentialRate = src.growthCap / BALANCE.DATA_RENEWABLE_TAU;
    const effectiveCap = src.growthCap * src.quality;
    const effText = cost.funding > 0 && effectiveCap > 0 ? ` · ${formatFunding(cost.funding / effectiveCap)}/eff. cap` : '';
    stats.innerHTML = `<span class="dim">Peak +${potentialRate.toFixed(1)}${getRateUnit()} · cap ${src.growthCap}${effText}</span>`;
  }
  card.appendChild(stats);

  // === Row 3b: Stats line 2 — running cost (matches infrastructure pattern: marginal - Total) ===
  const stats2 = document.createElement('div');
  stats2.className = 'purchase-stats';
  if (isOwned && active > 0) {
    const dataBreakdown = gameState.computed?.costs?.data?.breakdown || {};
    const opsDiscount = gameState.computed?.costs?.opsDiscount ?? 1;
    const totalRunCost = (dataBreakdown[purchId]?.cost || 0) * opsDiscount;
    const _marginalRunCost = (dataBreakdown[purchId]?.marginalCost ?? purchasable.runningCost) * opsDiscount;
    let text = `Running: ${formatFunding(totalRunCost)}${getRateUnit()}`;
    if (active > 1) text += ` (${formatFunding(totalRunCost / active)}${getRateUnit()} ea)`;
    stats2.textContent = text;
  } else if (isOwned) {
    stats2.innerHTML = `<span class="dim">All copies furloughed</span>`;
  }
  card.appendChild(stats2);

  // === Row 4: Requirements hint (when unowned) ===
  let reqEl = null;
  if (!isOwned && purchasable?.requires?.capability && !isCapUnlocked(purchasable.requires.capability)) {
    reqEl = document.createElement('div');
    reqEl.className = 'purchase-requires dim';
    reqEl.textContent = `[requires: ${purchasable.requires.capability.replace(/_/g, ' ')}]`;
    card.appendChild(reqEl);
  }

  // === Row 5: Automation panel (if unlocked) ===
  const itemId = 'data_' + src.id;
  if (isAutomationUnlocked(itemId)) {
    const autoPanel = createAutomationPanel(itemId);
    if (autoPanel) {
      card.appendChild(autoPanel);
      card._autoPanel = autoPanel;
    }
  }

  // Stash refs
  card._ownedEl = nameEl;
  card._costInfoEl = costInfo;
  card._btn = btn;
  card._statsEl = stats;
  card._reqEl = reqEl;
  card._furloughBtn = furloughBtn;
  card._statsEl2 = stats2;
  card._isFurloughable = true;
  card._purchasableName = src.name;

  return card;
}

function createSyntheticSection() {
  const div = document.createElement('div');
  const cd = gameState.computed?.data;
  const owned = getCount('synthetic_generator');
  const running = getActiveCount('synthetic_generator');
  const genRate = cd?.synthetic?.generationRate ?? 0;
  const quality = cd?.quality ?? 1.0;

  const purchasable = getPurchasableById('synthetic_generator');
  const cost = purchasable ? getPurchaseCost(purchasable) : {};
  const queueable = canQueuePurchase('synthetic_generator');
  const dataBreakdown = gameState.computed?.costs?.data?.breakdown || {};
  const opsDiscount = gameState.computed?.costs?.opsDiscount ?? 1;
  const totalRunCost = (dataBreakdown.synthetic_generator?.cost || 0) * opsDiscount;

  const upgradeLevel = getCount('generator_upgrade_autonomous') > 0 ? 2
    : getCount('generator_upgrade_verified') > 0 ? 1 : 0;
  const upgradeConfig = BALANCE.DATA_GENERATOR_UPGRADES[upgradeLevel];
  const nextUpgrade = BALANCE.DATA_GENERATOR_UPGRADES[upgradeLevel + 1] || null;

  // === Generator Card (furloughable) ===
  const genCard = document.createElement('div');
  genCard.className = 'compact-purchase-card';
  genCard.dataset.purchaseId = 'synthetic_generator';
  if (owned > 0) {
    genCard.style.borderLeft = `3px solid var(--${running > 0 ? 'positive' : 'warning'})`;
  }
  applyNewCardHighlight(genCard, 'synthetic_generator');

  // Row 1: Header
  const genHeader = document.createElement('div');
  genHeader.className = 'purchase-header';

  const genNameEl = document.createElement('span');
  genNameEl.className = 'purchase-name';
  genNameEl.textContent = `Synthetic Generator ${owned > 0 ? `(${running}/${owned})` : '(0)'}`;
  if (owned > 0) {
    genNameEl.style.cursor = 'help';
    attachTooltip(genNameEl, () => {
      const a = getActiveCount('synthetic_generator'), c = getCount('synthetic_generator');
      return `<div class="tooltip-row"><span>${a} running / ${c} owned</span></div>`;
    });
  }

  const genHeaderActions = document.createElement('div');
  genHeaderActions.className = 'purchase-header-actions';

  // Furlough button
  let genFurloughBtn = null;
  if (owned > 0) {
    genFurloughBtn = document.createElement('button');
    genFurloughBtn.textContent = 'Furlough';
    genFurloughBtn.className = 'furlough-btn';
    genFurloughBtn.disabled = running <= 0;

    genFurloughBtn.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - _lastFurloughClickTime < 100) return;
      _lastFurloughClickTime = now;
      enqueueFurlough('synthetic_generator', getModifierQty(e), false);
      requestFullUpdate();
    });
    genFurloughBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - _lastFurloughClickTime < 100) return;
      _lastFurloughClickTime = now;
      enqueueFurlough('synthetic_generator', getModifierQty(e), true);
      requestFullUpdate();
    });

    genHeaderActions.appendChild(genFurloughBtn);
  }

  // Queue button
  const genBtn = document.createElement('button');
  genBtn.textContent = 'Queue';
  genBtn.disabled = !queueable;

  genBtn.addEventListener('click', (e) => {
    enqueuePurchase('synthetic_generator', getModifierQty(e), false);
    _dataTabFingerprint = '';
    requestFullUpdate();
  });
  genBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - _lastPriorityClickTime < 100) return;
    _lastPriorityClickTime = now;
    enqueuePurchase('synthetic_generator', getModifierQty(e), true);
    _dataTabFingerprint = '';
    requestFullUpdate();
  });

  genHeaderActions.appendChild(genBtn);
  genHeader.appendChild(genNameEl);
  genHeader.appendChild(genHeaderActions);
  genCard.appendChild(genHeader);

  // Row 2: Description + Cost
  const genDescRow = document.createElement('div');
  genDescRow.className = 'purchase-desc-row';

  const genDesc = document.createElement('div');
  genDesc.className = 'purchase-description';
  genDesc.textContent = purchasable?.description || 'Generates synthetic training data.';
  if (purchasable?.flavorText) {
    genDesc.classList.add('has-flavor');
    attachTooltip(genDesc, () => {
      recordFlavorDiscovery('synthetic_generator');
      return `<div class="tooltip-section"><div>${purchasable.flavorText}</div></div>`;
    }, { delay: 400 });
  }

  const genCostInfo = document.createElement('span');
  genCostInfo.className = 'purchase-cost-info';
  const costText = formatFunding(cost.funding || 0);
  const durationText = purchasable?.focusDuration ? formatDuration(purchasable.focusDuration) : '';
  genCostInfo.textContent = durationText ? `${costText} \u00b7 ${durationText}` : costText;
  genCostInfo.classList.toggle('affordable', queueable && gameState.resources.funding >= (cost.funding || 0));

  genDescRow.appendChild(genDesc);
  genDescRow.appendChild(genCostInfo);
  genCard.appendChild(genDescRow);

  // Row 3: Stats
  const genStats = document.createElement('div');
  genStats.className = 'purchase-stats';
  const perUnitRate = BALANCE.DATA_GENERATOR.ratePerUnit;
  const rateText = genRate > 0 ? `+${genRate.toFixed(1)}${getRateUnit()} (${perUnitRate}/unit)` : `${perUnitRate}/unit`;
  const runCostText = totalRunCost > 0 ? `${formatFunding(totalRunCost)}${getRateUnit()}` : '\u2014';
  const synthQuality = upgradeConfig.quality;
  const sqClass = synthQuality >= 0.7 ? 'positive' : synthQuality >= 0.4 ? 'warning' : 'negative';
  genStats.innerHTML = `<span class="positive">${rateText}</span> \u00b7 ${runCostText} \u00b7 Quality: <span class="${sqClass}">${synthQuality.toFixed(1)}</span> <span class="dim">(${upgradeConfig.name})</span>`;
  genCard.appendChild(genStats);

  // Row 4: Automation panel (if unlocked)
  if (isAutomationUnlocked('synthetic_generator')) {
    const autoPanel = createAutomationPanel('synthetic_generator');
    if (autoPanel) {
      genCard.appendChild(autoPanel);
      genCard._autoPanel = autoPanel;
    }
  }

  // Stash refs on generator card
  genCard._ownedEl = genNameEl;
  genCard._costInfoEl = genCostInfo;
  genCard._btn = genBtn;
  genCard._statsEl = genStats;
  genCard._reqEl = null;
  genCard._furloughBtn = genFurloughBtn;
  genCard._isFurloughable = true;
  genCard._purchasableName = 'Synthetic Generator';

  div.appendChild(genCard);

  // === Upgrade Card (if next upgrade available) ===
  if (nextUpgrade) {
    const nextUpgradeId = upgradeLevel === 0 ? 'generator_upgrade_verified' : 'generator_upgrade_autonomous';
    const upgPurchasable = getPurchasableById(nextUpgradeId);
    const upgCost = upgPurchasable ? getPurchaseCost(upgPurchasable) : {};
    const upgQueueable = canQueuePurchase(nextUpgradeId);
    const upgOwned = getCount(nextUpgradeId) > 0;

    const upgCard = document.createElement('div');
    upgCard.className = 'compact-purchase-card';
    upgCard.dataset.purchaseId = nextUpgradeId;
    if (upgOwned) upgCard.style.borderLeft = '3px solid var(--positive)';

    // Row 1: Header
    const upgHeader = document.createElement('div');
    upgHeader.className = 'purchase-header';

    const upgNameEl = document.createElement('span');
    upgNameEl.className = 'purchase-name';
    upgNameEl.textContent = `${nextUpgrade.name} ${upgOwned ? '(1)' : '(0)'}`;

    const upgHeaderActions = document.createElement('div');
    upgHeaderActions.className = 'purchase-header-actions';

    const upgBtn = document.createElement('button');
    upgBtn.textContent = 'Queue';
    upgBtn.disabled = !upgQueueable;

    upgBtn.addEventListener('click', (e) => {
      enqueuePurchase(nextUpgradeId, getModifierQty(e), false);
      _dataTabFingerprint = '';
      requestFullUpdate();
    });
    upgBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - _lastPriorityClickTime < 100) return;
      _lastPriorityClickTime = now;
      enqueuePurchase(nextUpgradeId, getModifierQty(e), true);
      _dataTabFingerprint = '';
      requestFullUpdate();
    });

    upgHeaderActions.appendChild(upgBtn);
    upgHeader.appendChild(upgNameEl);
    upgHeader.appendChild(upgHeaderActions);
    upgCard.appendChild(upgHeader);

    // Row 2: Description + Cost
    const upgDescRow = document.createElement('div');
    upgDescRow.className = 'purchase-desc-row';

    const upgDesc = document.createElement('div');
    upgDesc.className = 'purchase-description';
    upgDesc.textContent = upgPurchasable?.description || '';
    if (upgPurchasable?.flavorText) {
      upgDesc.classList.add('has-flavor');
      const flavorText = upgPurchasable.flavorText;
      const pId = nextUpgradeId;
      attachTooltip(upgDesc, () => {
        recordFlavorDiscovery(pId);
        return `<div class="tooltip-section"><div>${flavorText}</div></div>`;
      }, { delay: 400 });
    }

    const upgCostInfo = document.createElement('span');
    upgCostInfo.className = 'purchase-cost-info';
    const upgCostText = formatFunding(upgCost.funding || 0);
    const upgDuration = upgPurchasable?.focusDuration ? formatDuration(upgPurchasable.focusDuration) : '';
    upgCostInfo.textContent = upgDuration ? `${upgCostText} \u00b7 ${upgDuration}` : upgCostText;
    upgCostInfo.classList.toggle('affordable', upgQueueable && gameState.resources.funding >= (upgCost.funding || 0));

    upgDescRow.appendChild(upgDesc);
    upgDescRow.appendChild(upgCostInfo);
    upgCard.appendChild(upgDescRow);

    // Row 3: Stats
    const upgStatsEl = document.createElement('div');
    upgStatsEl.className = 'purchase-stats';
    upgStatsEl.textContent = `Quality ${upgradeConfig.quality.toFixed(1)} \u2192 ${nextUpgrade.quality.toFixed(1)} \u00b7 Cost/unit \u00d7${nextUpgrade.runningCostMult.toFixed(1)}`;
    upgCard.appendChild(upgStatsEl);

    // Row 4: Requirements
    let upgReqEl = null;
    if (!upgQueueable && upgPurchasable?.requires?.capability && !isCapUnlocked(upgPurchasable.requires.capability)) {
      upgReqEl = document.createElement('div');
      upgReqEl.className = 'purchase-requires dim';
      upgReqEl.textContent = `[requires: ${upgPurchasable.requires.capability.replace(/_/g, ' ')}]`;
      upgCard.appendChild(upgReqEl);
    }

    // Stash refs
    upgCard._ownedEl = upgNameEl;
    upgCard._costInfoEl = upgCostInfo;
    upgCard._btn = upgBtn;
    upgCard._statsEl = upgStatsEl;
    upgCard._reqEl = upgReqEl;
    upgCard._furloughBtn = null;
    upgCard._isFurloughable = false;
    upgCard._purchasableName = nextUpgrade.name;

    div.appendChild(upgCard);
  }

  // === Completed Upgrades (purchased one-time upgrades, admin pattern) ===
  const completedUpgradeIds = [];
  if (upgradeLevel >= 1) completedUpgradeIds.push('generator_upgrade_verified');
  if (upgradeLevel >= 2) completedUpgradeIds.push('generator_upgrade_autonomous');
  // Mark completed upgrades as seen so tab notification doesn't flag them (#780)
  const seenCards = gameState.ui.seenCards;
  for (const cId of completedUpgradeIds) {
    if (!seenCards.includes(cId)) seenCards.push(cId);
  }
  // Build completed section (appended after quality/collapse panels — #781)
  let completedSection = null;
  if (completedUpgradeIds.length > 0) {
    completedSection = document.createElement('div');
    completedSection.className = 'admin-completed-section';

    const cHeader = document.createElement('div');
    cHeader.className = 'completed-header collapsed';
    cHeader.innerHTML = `<h3>PURCHASED UPGRADES (${completedUpgradeIds.length})</h3><span class="toggle-icon">\u25BC</span>`;

    const cList = document.createElement('div');
    cList.className = 'completed-list collapsed';
    for (const cId of completedUpgradeIds) {
      const cPurch = getPurchasableById(cId);
      if (!cPurch) continue;
      const item = document.createElement('div');
      item.className = 'compact-completed-card';

      const nameEl = document.createElement('div');
      nameEl.className = 'completed-card-name';
      nameEl.textContent = cPurch.name;
      item.appendChild(nameEl);

      if (cPurch.description) {
        const descEl = document.createElement('div');
        descEl.className = 'completed-card-desc';
        if (cPurch.flavorText) descEl.classList.add('has-flavor');
        descEl.textContent = cPurch.description;
        item.appendChild(descEl);
        if (cPurch.flavorText) {
          const flavorText = cPurch.flavorText;
          const pId = cId;
          attachTooltip(descEl, () => {
            recordFlavorDiscovery(pId);
            return `<div class="tooltip-section"><div>${flavorText}</div></div>`;
          }, { delay: 400 });
        }
      }

      cList.appendChild(item);
    }

    cHeader.addEventListener('click', () => {
      cHeader.classList.toggle('collapsed');
      cList.classList.toggle('collapsed');
    });

    completedSection.appendChild(cHeader);
    completedSection.appendChild(cList);
  }

  // === Quality + Collapse panels (Phase 3+ only) — side-by-side row ===
  if (gameState.data.qualityRevealed) {
    const panelRow = document.createElement('div');
    panelRow.className = 'synth-panel-row';

    // Quality panel (left)
    const synthProportion = cd?.synthetic?.synthProportion ?? 0;
    const qClass = quality >= 0.7 ? 'positive' : quality >= 0.4 ? 'warning' : 'negative';
    const synthQuality = upgradeConfig.quality;
    const trendDir = genRate > 0 && synthQuality < quality ? 'declining' : 'stable';
    const trendClass = trendDir === 'declining' ? 'warning' : 'dim';
    const qualityPanel = document.createElement('div');
    qualityPanel.className = 'synth-subpanel';
    qualityPanel.id = 'synth-quality-panel';
    qualityPanel.innerHTML = `
      <h3>QUALITY</h3>
      <div class="stat-row">
        <span class="stat-label">Data quality</span>
        <span class="stat-value ${qClass}" id="synth-quality-value">${quality.toFixed(2)}x</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Synthetic proportion</span>
        <span class="stat-value" id="synth-proportion-value">${formatPercent(synthProportion)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Synthetic quality</span>
        <span class="stat-value dim">${synthQuality.toFixed(1)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Trend</span>
        <span class="stat-value ${trendClass}" id="synth-trend-value">${trendDir}</span>
      </div>
    `;
    panelRow.appendChild(qualityPanel);

    // Collapse risk panel (right)
    const remaining = gameState.data.collapsePauseRemaining;
    const belowThreshold = quality < BALANCE.DATA_QUALITY_COLLAPSE_THRESHOLD;

    let riskLabel, riskClass;
    if (remaining > 0) {
      riskLabel = `COLLAPSE ACTIVE (${remaining.toFixed(0)}s)`;
      riskClass = 'negative';
    } else if (belowThreshold) {
      const qualityRatio = quality / BALANCE.DATA_QUALITY_COLLAPSE_THRESHOLD;
      const mtth = BALANCE.DATA_QUALITY_COLLAPSE_MTTH_MAX * qualityRatio +
                   BALANCE.DATA_QUALITY_COLLAPSE_MTTH_MIN * (1 - qualityRatio);
      riskLabel = `~${Math.round(mtth)}s between events`;
      riskClass = mtth < 60 ? 'negative' : 'warning';
    } else {
      riskLabel = 'None';
      riskClass = 'positive';
    }

    const collapsePanel = document.createElement('div');
    collapsePanel.className = 'synth-subpanel';
    collapsePanel.id = 'synth-collapse-panel';
    collapsePanel.innerHTML = `
      <h3>COLLAPSE RISK</h3>
      <div class="stat-row">
        <span class="stat-label">Risk</span>
        <span class="stat-value ${riskClass}" id="synth-risk-value">${riskLabel}</span>
      </div>
    `;
    const riskValueEl = collapsePanel.querySelector('#synth-risk-value');
    attachTooltip(riskValueEl, () =>
      `<div class="tooltip-section">Model collapse risk increases as data quality falls below ${BALANCE.DATA_QUALITY_COLLAPSE_THRESHOLD}.</div>`);
    if (gameState.data.syntheticScore > 0) collapsePanel.appendChild(createPurgeButton());
    panelRow.appendChild(collapsePanel);

    div.appendChild(panelRow);
  }

  // Purge button outside quality panels (pre-reveal)
  if (!gameState.data.qualityRevealed && gameState.data.syntheticScore > 0) {
    div.appendChild(createPurgeButton());
  }

  // Completed upgrades after quality/collapse panels (#781)
  if (completedSection) div.appendChild(completedSection);

  // Stash generator card ref on container for dynamic updates
  div._genCard = genCard;

  return div;
}

// ---------------------------------------------------------------------------
// Dynamic Updates (called every tick when fingerprint unchanged)
// ---------------------------------------------------------------------------
function updateDataTabDynamicValues() {
  updateStatsPanelDynamic();
  updateSectionSummaries();
  updateRenewableDynamic();
  updateSyntheticDynamic();
  updateAffordability();
}

function updateStatsPanelDynamic() {
  const cd = gameState.computed?.data;
  if (!cd) return;

  const scores = cd.scores;
  const effectiveness = cd.effectiveness ?? 1.0;
  const quality = cd.quality ?? 1.0;
  const required = gameState.data.dataRequired || 1;
  const effectiveScore = scores.effective ?? scores.total;

  const effClass = effectiveness >= 1.5 ? 'positive' : effectiveness >= 0.8 ? 'warning' : 'negative';
  const effMultiplier = effectiveness <= 1.0
    ? (effectiveness * effectiveness).toFixed(2)
    : (1.0 + Math.log(1 + (effectiveness - 1.0))).toFixed(2);

  // Multiplier
  const effValue = document.getElementById('data-eff-value');
  if (effValue) { effValue.textContent = effMultiplier + 'x'; effValue.className = 'stat-value ' + effClass; }

  // Trend arrow
  const trend = cd.trend || 'stable';
  const trendArrow = trend === 'rising' ? '\u25B2' : trend === 'falling' ? '\u25BC' : '\u2550';
  const trendClass = trend === 'rising' ? 'positive' : trend === 'falling' ? 'negative' : 'dim';
  const effTrend = document.getElementById('data-eff-trend');
  if (effTrend) { effTrend.textContent = trendArrow; effTrend.className = 'stat-value ' + trendClass; }

  // Score / needed + surplus
  const effScoreEl = document.getElementById('data-eff-score');
  if (effScoreEl) effScoreEl.textContent = `${formatNumber(Math.round(effectiveScore))} effective / ${formatNumber(Math.round(required))} needed`;
  const surplus = effectiveScore - required;
  const surplusEl = document.getElementById('data-eff-surplus');
  if (surplusEl) {
    surplusEl.textContent = surplus >= 0
      ? `(+${formatNumber(Math.round(surplus))} surplus)`
      : `(${formatNumber(Math.round(surplus))} deficit)`;
    surplusEl.className = surplus >= 0 ? 'positive' : 'negative';
  }

  // Quality row (always visible)
  const qValue = document.getElementById('data-quality-value');
  const qClass = quality >= 0.7 ? 'positive' : quality >= 0.4 ? 'warning' : 'negative';
  if (qValue) { qValue.textContent = quality.toFixed(2); qValue.className = 'stat-value ' + qClass; }
  const qEffect = document.getElementById('data-quality-effect');
  if (qEffect) qEffect.textContent = '\u2192 ' + Math.round(quality * 100) + '% of raw data effective';
  if (gameState.data.qualityRevealed) {
    const synthPct = document.getElementById('data-synth-pct');
    if (synthPct) synthPct.textContent = '\u00b7 Synthetic ratio: ' + formatPercent(cd.synthetic?.synthProportion ?? 0);
  }

  // Category breakdown — effective scores with percentages
  const catQ = cd.categoryQuality || { bulk: 0, renewable: 0, synthetic: 0 };
  const bulkEff = scores.bulkEff ?? scores.bulk * (catQ.bulk || 1);
  const renewableEff = scores.renewableEff ?? scores.renewable * (catQ.renewable || 1);
  const syntheticEff = scores.syntheticEff ?? scores.synthetic * (catQ.synthetic || 1);
  const totalEff = effectiveScore || 1;
  const bulkPct = totalEff > 0 ? Math.round(bulkEff / totalEff * 100) : 0;
  const renewablePct = totalEff > 0 ? Math.round(renewableEff / totalEff * 100) : 0;
  const syntheticPct = totalEff > 0 ? Math.round(syntheticEff / totalEff * 100) : 0;

  const catBulk = document.getElementById('data-cat-bulk');
  if (catBulk) {
    const bulkHTML = `${formatNumber(Math.round(bulkEff))} <span class="cat-pct dim">(${bulkPct}%)</span>`;
    if (catBulk._prevHTML !== bulkHTML) { catBulk.innerHTML = bulkHTML; catBulk._prevHTML = bulkHTML; }
  }
  const catRenewable = document.getElementById('data-cat-renewable');
  if (catRenewable) {
    const renewHTML = `${formatNumber(Math.round(renewableEff))} <span class="cat-pct dim">(${renewablePct}%)</span>`;
    if (catRenewable._prevHTML !== renewHTML) { catRenewable.innerHTML = renewHTML; catRenewable._prevHTML = renewHTML; }
  }

  const renewableRate = Object.values(cd.renewables || {}).reduce((sum, r) => sum + (r.growthRate || 0), 0);
  const catRenewableRate = document.getElementById('data-cat-renewable-rate');
  if (catRenewableRate) catRenewableRate.textContent = renewableRate > 0 ? '+' + renewableRate.toFixed(1) + getRateUnit() : '\u2014';

  const dataBreakdown = gameState.computed?.costs?.data?.breakdown || {};
  const opsDiscount = gameState.computed?.costs?.opsDiscount ?? 1;
  let renewableCost = 0;
  for (const src of BALANCE.DATA_RENEWABLE_SOURCES) {
    const entry = dataBreakdown['data_' + src.id];
    if (entry) renewableCost += entry.cost;
  }
  renewableCost *= opsDiscount;
  const catRenewableCost = document.getElementById('data-cat-renewable-cost');
  if (catRenewableCost) catRenewableCost.textContent = renewableCost > 0 ? formatFunding(renewableCost) + getRateUnit() : '';

  const catSynth = document.getElementById('data-cat-synth');
  if (catSynth) {
    const synthHTML = `${formatNumber(Math.round(syntheticEff))} <span class="cat-pct dim">(${syntheticPct}%)</span>`;
    if (catSynth._prevHTML !== synthHTML) { catSynth.innerHTML = synthHTML; catSynth._prevHTML = synthHTML; }
  }
  const synthRate = cd.synthetic?.generationRate ?? 0;
  const catSynthRate = document.getElementById('data-cat-synth-rate');
  if (catSynthRate) catSynthRate.textContent = synthRate > 0 ? '+' + synthRate.toFixed(1) + getRateUnit() : '\u2014';

  const synthCost = (dataBreakdown.synthetic_generator?.cost || 0) * opsDiscount;
  const catSynthCost = document.getElementById('data-cat-synth-cost');
  if (catSynthCost) catSynthCost.textContent = synthCost > 0 ? formatFunding(synthCost) + getRateUnit() : '';
}

function updateSectionSummaries() {
  const cd = gameState.computed?.data;
  if (!cd) return;

  const bulkSummary = document.querySelector('[data-section-summary="BULK DATA"]');
  if (bulkSummary) {
    const catQ = cd.categoryQuality || {};
    const bulkEff = cd.scores.bulkEff ?? cd.scores.bulk * (catQ.bulk || 1);
    bulkSummary.textContent = `${formatNumber(Math.round(bulkEff))} effective`;
  }

  const renewSummary = document.querySelector('[data-section-summary="RENEWABLE DATA"]');
  if (renewSummary) {
    const visibleRenewable = (BALANCE.DATA_RENEWABLE_SOURCES || []).filter(s => isDataSourceVisible(s.id));
    renewSummary.textContent = buildRenewableSummary(cd, visibleRenewable);
  }

  const synthSummary = document.querySelector('[data-section-summary="SYNTHETIC DATA"]');
  if (synthSummary) {
    synthSummary.textContent = buildSyntheticSummary(cd);
  }
}

function buildRenewableSummary(cd, visibleRenewable) {
  const activeCount = visibleRenewable.filter(s => getActiveCount('data_' + s.id) > 0).length;
  const renewableRate = Object.values(cd?.renewables || {}).reduce((sum, r) => sum + (r.growthRate || 0), 0);
  const dataBreakdown = gameState.computed?.costs?.data?.breakdown || {};
  let renewCost = 0;
  for (const src of BALANCE.DATA_RENEWABLE_SOURCES) {
    const entry = dataBreakdown['data_' + src.id];
    if (entry) renewCost += entry.cost;
  }
  return `${formatNumber(cd?.scores?.renewable || 0)}` +
    (renewableRate > 0 ? ` (+${renewableRate.toFixed(1)}${getRateUnit()})` : '') +
    (renewCost > 0 ? ` \u2014 ${formatFunding(renewCost)}${getRateUnit()}` : '') +
    ` \u2014 ${activeCount}/${visibleRenewable.length} active`;
}

function buildSyntheticSummary(cd) {
  const synthRate = cd?.synthetic?.generationRate ?? 0;
  const owned = getCount('synthetic_generator');
  const running = getActiveCount('synthetic_generator');
  const genSummary = owned > 0 ? `${running}/${owned} running` : '';
  return `${formatNumber(gameState.data.syntheticScore)}` +
    (synthRate > 0 ? ` (+${synthRate.toFixed(1)}${getRateUnit()})` : '') +
    (genSummary ? ` \u2014 ${genSummary}` : '');
}

function updateRenewableDynamic() {
  document.querySelectorAll('.data-renewable-card[data-purchase-id]').forEach(card => {
    const purchId = card.dataset.purchaseId;
    const srcId = purchId.replace('data_', '');
    const count = getCount(purchId);
    if (count <= 0) return;

    const active = getActiveCount(purchId);
    const cd = gameState.computed?.data?.renewables?.[srcId];
    const curScore = cd?.score ?? 0;
    const maxScore = cd?.maxScore ?? 1;
    const growthRate = cd?.growthRate ?? 0;

    // Update border color
    card.style.borderLeft = `3px solid var(--${active > 0 ? 'positive' : 'warning'})`;

    // Update stats via stashed ref (skip if unchanged to avoid flash)
    if (card._statsEl) {
      const pct = maxScore > 0 ? (curScore / maxScore * 100) : 0;
      let timeToCapText = '';
      if (active > 0 && growthRate > 0 && pct < 99) {
        const remaining = maxScore - curScore;
        const estSeconds = remaining / growthRate;
        timeToCapText = estSeconds < 3600
          ? `~${Math.ceil(estSeconds / 60)}m to cap`
          : `~${(estSeconds / 3600).toFixed(1)}h to cap`;
      }
      let rateText;
      if (active <= 0) {
        rateText = '<span class="dim">paused</span>';
      } else if (growthRate < 0) {
        rateText = `<span class="warning">${growthRate.toFixed(1)}${getRateUnit()} (decaying)</span>`;
      } else {
        rateText = `<span class="positive">+${growthRate.toFixed(1)}${getRateUnit()}</span>`;
      }
      const html = `${rateText} \u00b7 ${curScore.toFixed(0)}/${maxScore.toFixed(0)} (${pct.toFixed(0)}%)${timeToCapText ? ' \u00b7 ' + timeToCapText : ''}`;
      if (card._statsEl._prevHTML !== html) {
        card._statsEl.innerHTML = html;
        card._statsEl._prevHTML = html;
      }
    }

    // Update stats line 2 (running cost — matches infrastructure pattern)
    if (card._statsEl2) {
      const purchasable = getPurchasableById(purchId);
      let html2;
      if (purchasable && active > 0) {
        const dataBreakdown = gameState.computed?.costs?.data?.breakdown || {};
        const opsDiscount = gameState.computed?.costs?.opsDiscount ?? 1;
        const totalRunCost = (dataBreakdown[purchId]?.cost || 0) * opsDiscount;
        let text = `Running: ${formatFunding(totalRunCost)}${getRateUnit()}`;
        if (active > 1) text += ` (${formatFunding(totalRunCost / active)}${getRateUnit()} ea)`;
        html2 = text;
      } else if (count > 0) {
        html2 = '<span class="dim">All copies furloughed</span>';
      } else {
        html2 = '';
      }
      if (card._statsEl2._prevHTML !== html2) {
        card._statsEl2.innerHTML = html2;
        card._statsEl2._prevHTML = html2;
      }
    }

    // Update automation panel if present
    if (card._autoPanel) {
      updateAutomationPanel(card._autoPanel);
    }
  });
}

function updateSyntheticDynamic() {
  const cd = gameState.computed?.data;
  if (!cd) return;
  const quality = cd.quality ?? 1.0;
  const synthProportion = cd.synthetic?.synthProportion ?? 0;
  const running = getActiveCount('synthetic_generator');
  const owned = getCount('synthetic_generator');
  const genRate = cd.synthetic?.generationRate ?? 0;

  // Update generator card stats via stashed ref
  const genCard = document.querySelector('.compact-purchase-card[data-purchase-id="synthetic_generator"]');
  if (genCard?._statsEl) {
    const dataBreakdown = gameState.computed?.costs?.data?.breakdown || {};
    const opsDiscount = gameState.computed?.costs?.opsDiscount ?? 1;
    const totalRunCost = (dataBreakdown.synthetic_generator?.cost || 0) * opsDiscount;
    const upgradeLevel = getCount('generator_upgrade_autonomous') > 0 ? 2
      : getCount('generator_upgrade_verified') > 0 ? 1 : 0;
    const upgradeConfig = BALANCE.DATA_GENERATOR_UPGRADES[upgradeLevel];
    const perUnitRate = BALANCE.DATA_GENERATOR.ratePerUnit;
    const rateText = genRate > 0 ? `+${genRate.toFixed(1)}${getRateUnit()} (${perUnitRate}/unit)` : `${perUnitRate}/unit`;
    const runCostText = totalRunCost > 0 ? `${formatFunding(totalRunCost)}${getRateUnit()}` : '\u2014';
    const synthQuality = upgradeConfig.quality;
    const sqClass = synthQuality >= 0.7 ? 'positive' : synthQuality >= 0.4 ? 'warning' : 'negative';
    genCard._statsEl.innerHTML = `<span class="positive">${rateText}</span> \u00b7 ${runCostText} \u00b7 Quality: <span class="${sqClass}">${synthQuality.toFixed(1)}</span> <span class="dim">(${upgradeConfig.name})</span>`;

    // Update border
    if (owned > 0) {
      genCard.style.borderLeft = `3px solid var(--${running > 0 ? 'positive' : 'warning'})`;
    }

    // Update automation panel if present
    if (genCard._autoPanel) {
      updateAutomationPanel(genCard._autoPanel);
    }
  }

  // Quality sub-panel (still uses IDs — these are unique info panels, not cards)
  const qValue = document.getElementById('synth-quality-value');
  if (qValue) {
    const qClass = quality >= 0.7 ? 'positive' : quality >= 0.4 ? 'warning' : 'negative';
    qValue.textContent = quality.toFixed(2) + 'x';
    qValue.className = 'stat-value ' + qClass;
  }
  const propValue = document.getElementById('synth-proportion-value');
  if (propValue) propValue.textContent = formatPercent(synthProportion);

  const upgradeLevel = getCount('generator_upgrade_autonomous') > 0 ? 2
    : getCount('generator_upgrade_verified') > 0 ? 1 : 0;
  const upgradeConfig = BALANCE.DATA_GENERATOR_UPGRADES[upgradeLevel];
  const trendValue = document.getElementById('synth-trend-value');
  if (trendValue) {
    const trendDir = genRate > 0 && upgradeConfig.quality < quality ? 'declining' : 'stable';
    trendValue.textContent = trendDir;
    trendValue.className = 'stat-value ' + (trendDir === 'declining' ? 'warning' : 'dim');
  }

  // Collapse risk
  const riskValue = document.getElementById('synth-risk-value');
  if (riskValue) {
    const remaining = gameState.data.collapsePauseRemaining;
    const belowThreshold = quality < BALANCE.DATA_QUALITY_COLLAPSE_THRESHOLD;
    let riskLabel, riskClass;
    if (remaining > 0) {
      riskLabel = `COLLAPSE ACTIVE (${remaining.toFixed(0)}s)`;
      riskClass = 'negative';
    } else if (belowThreshold) {
      const qualityRatio = quality / BALANCE.DATA_QUALITY_COLLAPSE_THRESHOLD;
      const mtth = BALANCE.DATA_QUALITY_COLLAPSE_MTTH_MAX * qualityRatio +
                   BALANCE.DATA_QUALITY_COLLAPSE_MTTH_MIN * (1 - qualityRatio);
      riskLabel = `~${Math.round(mtth)}s between events`;
      riskClass = mtth < 60 ? 'negative' : 'warning';
    } else {
      riskLabel = 'None';
      riskClass = 'positive';
    }
    riskValue.textContent = riskLabel;
    riskValue.className = 'stat-value ' + riskClass;
  }
}

function updateAffordability() {
  // Update all cards with stashed refs via data-purchase-id
  document.querySelectorAll('#data-tab-content .compact-purchase-card[data-purchase-id]').forEach(card => {
    const purchId = card.dataset.purchaseId;
    const purchasable = getPurchasableById(purchId);
    if (!purchasable) return;

    const count = getCount(purchId);
    const active = getActiveCount(purchId);
    const cost = getPurchaseCost(purchasable);
    const queueable = canQueuePurchase(purchId);

    // Update count text in name
    if (card._ownedEl) {
      const countText = card._isFurloughable && count > 0
        ? `(${active}/${count})`
        : `(${count})`;
      card._ownedEl.textContent = card._purchasableName + ' ' + countText;
    }

    // Update cost text and affordable class
    if (card._costInfoEl) {
      // For renewable owned cards: running cost + next level cost
      if (card._isFurloughable && count > 0 && purchId.startsWith('data_') && purchId !== 'synthetic_generator') {
        // Renewable data: purchase cost + duration + marginal cap
        const renewSrc = BALANCE.DATA_RENEWABLE_SOURCES.find(s => 'data_' + s.id === purchId);
        const marginalCap = renewSrc ? Math.round(getCapForCopies(renewSrc, active + 1, gameState) - getCapForCopies(renewSrc, active, gameState)) : 0;
        const costText = formatFunding(cost.funding || 0);
        const durationText = getPurchasableById(purchId)?.focusDuration ? formatDuration(getPurchasableById(purchId).focusDuration) : '';
        card._costInfoEl.textContent = `${costText} \u00b7 ${durationText} \u00b7 +${marginalCap} cap`;
      } else {
        const costText = formatFunding(cost.funding || 0);
        const durationText = purchasable.focusDuration ? formatDuration(purchasable.focusDuration) : '';
        card._costInfoEl.textContent = durationText ? `${costText} \u00b7 ${durationText}` : costText;
      }
      card._costInfoEl.classList.toggle('affordable', queueable && gameState.resources.funding >= (cost.funding || 0));
    }

    // Update Queue button disabled state
    if (card._btn) {
      card._btn.disabled = !queueable;
    }

    // Clear requirement hint when capability is now met
    if (card._reqEl && queueable) {
      card._reqEl.remove();
      card._reqEl = null;
    }

    // Update Furlough button disabled state
    if (card._furloughBtn) {
      card._furloughBtn.disabled = active <= 0;
    }
  });
}

// ---------------------------------------------------------------------------
// Research hint line ("Research X to unlock [more] Y data sources")
// ---------------------------------------------------------------------------

/** Capability IDs that gate sources in each category, ordered by unlock tier. */
const CATEGORY_CAPS = {
  bulk: ['data_curation', 'chain_of_thought', 'dataset_licensing', 'massive_scaling'],
  renewable: ['data_curation', 'dataset_licensing', 'massive_scaling'],
};

/** Return the name of the lowest-tier locked capability that gates a source in this category. */
function getNextLockedCapName(category) {
  for (const capId of CATEGORY_CAPS[category] || []) {
    if (!isCapUnlocked(capId)) {
      const cap = capabilitiesTrack.capabilities.find(c => c.id === capId);
      return cap?.name || capId;
    }
  }
  return null;
}

/**
 * Create a hint element for hidden data sources.
 * @param {string} category - 'bulk' or 'renewable'
 * @param {number} hiddenCount - number of hidden sources
 * @param {boolean} hasVisible - whether some sources in this category are already visible
 * @returns {HTMLElement}
 */
function createResearchHint(category, hiddenCount, hasVisible) {
  const capName = getNextLockedCapName(category);
  const label = category === 'renewable' ? 'renewable' : 'bulk';
  const more = hasVisible ? 'more ' : '';
  const el = document.createElement('div');
  el.className = 'data-research-hint';
  el.textContent = capName
    ? `Research ${capName} to unlock ${more}${label} data sources.`
    : `${hiddenCount} additional ${label} source${hiddenCount > 1 ? 's' : ''} requiring further research.`;
  return el;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isCapUnlocked(capId) {
  for (const track of Object.values(gameState.tracks)) {
    if (track.unlockedCapabilities?.includes(capId)) return true;
  }
  return false;
}

/** Show a data source if: no requirement, or required capability is unlocked. */
function isDataSourceVisible(sourceId) {
  const p = getPurchasableById('data_' + sourceId);
  if (!p?.requires?.capability) return true;
  return isCapUnlocked(p.requires.capability);
}

// Export reset function for game reset / tab switch.
export function reset() {
  _dataTabFingerprint = '';
}
