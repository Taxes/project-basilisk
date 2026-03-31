// js/ui/ceo-focus.js — CEO Focus UI rendering
import { gameState } from '../game-state.js';
import { registerUpdate, EVERY_TICK } from './scheduler.js';
import { getAvailableActivities, selectActivity, ACTIVITIES, BUILDUP_TIME, IR_BUILDUP_TIME, DECAY_TIME, MASTERY_BUILDUP_TIME } from '../ceo-focus.js';
import { formatFunding, formatDuration, getRateUnit } from '../utils/format.js';
import { $ } from '../utils/dom-cache.js';
import { attachTooltip } from './stats-tooltip.js';

let _renderedOptions = [];  // track for incremental updates

function updateCEOFocusDisplay() {
  const panel = $('ceo-focus-panel');
  if (!panel) return;

  const computed = gameState.computed?.ceoFocus;
  if (!computed) { panel.classList.add('hidden'); return; }

  const available = getAvailableActivities();
  if (available.length === 0) { panel.classList.add('hidden'); return; }

  panel.classList.remove('hidden');

  // Active/decaying border state
  panel.classList.toggle('active', computed.idle);
  panel.classList.toggle('decaying', !computed.idle);

  // Current activity display
  const activity = ACTIVITIES[computed.selected];
  const nameEl = $('ceo-focus-name');
  const valueEl = $('ceo-focus-value');
  const dirEl = $('ceo-focus-direction');

  if (nameEl) nameEl.textContent = activity?.name || '';
  if (valueEl) valueEl.textContent = formatActivityValue(computed);
  if (dirEl) {
    const { text, cls } = getDirectionIndicator(computed);
    dirEl.textContent = text;
    dirEl.className = 'ceo-focus-direction ' + cls;
  }

  // Progress bar (for continuous activities)
  const barContainer = $('ceo-focus-bar-container');
  const bar = $('ceo-focus-bar');
  const isContinuous = activity?.type === 'continuous' || activity?.type === 'mixed';
  if (barContainer && bar) {
    if (isContinuous) {
      barContainer.style.visibility = 'visible';
      const buildupVal = computed.buildup[computed.selected] || 0;
      bar.style.width = `${buildupVal * 100}%`;
    } else {
      barContainer.style.visibility = 'hidden';
    }
  }

  // Mastery bar (main display) — always visible for continuous activities
  const masteryBarContainer = $('ceo-focus-mastery-container');
  const masteryBarFill = $('ceo-focus-mastery-bar');
  if (masteryBarContainer && masteryBarFill) {
    if (isContinuous) {
      masteryBarContainer.style.visibility = 'visible';
      const masteryVal = computed.mastery?.[computed.selected] || 0;
      masteryBarFill.style.width = `${masteryVal * 100}%`;
    } else {
      masteryBarContainer.style.visibility = 'hidden';
    }
  }

  // Always show selector
  renderSelector(available, computed);
}

function formatActivityValue(computed) {
  switch (computed.selected) {
    case 'grants':
      return computed.grantRate > 0 ? `+${formatFunding(computed.grantRate)}${getRateUnit()}` : 'Idle to activate';
    case 'research': {
      const rpPart = computed.flatRP > 0 ? `+${Math.round(computed.flatRP)} RP${getRateUnit()}` : '';
      const multPart = computed.personnelMultiplier > 1
        ? `×${computed.personnelMultiplier.toFixed(2)} org`
        : '';
      return [rpPart, multPart].filter(Boolean).join(' \u2502 ') || 'Idle to activate';
    }
    case 'ir': {
      const total = computed.irTotalEstimate || computed.irFundraiseBonus;
      return total > 0 ? `+${formatFunding(total)}/raise` : '\u2014';
    }
    case 'operations':
      return `-${Math.round(computed.opsBonus * 100)}% running costs`;
    case 'public_positioning': {
      const revPct = Math.round(computed.bonusRevenueMultiplier * 100);
      return revPct > 0 ? `+${revPct}% rev` : '\u2014';
    }
    default:
      return '';
  }
}

function getDirectionIndicator(computed) {
  const selected = computed.selected;

  // Continuous / mixed
  if (computed.idle) {
    return { text: '\u25B2', cls: 'building' };
  }

  // IR special: paused during fundraise
  if (selected === 'ir' && gameState.focusQueue.some(i => i.type === 'fundraise')) {
    return { text: '\u2550', cls: 'paused' };
  }

  return { text: '\u25BC', cls: 'decaying' };
}

function renderSelector(available, computed) {
  const container = $('ceo-focus-selector');
  if (!container) return;
  container.classList.remove('hidden');

  // Only rebuild if activity set changed
  const optionIds = available.map(a => a.id).join(',');
  if (optionIds !== _renderedOptions.join(',')) {
    container.innerHTML = '';
    for (const activity of available) {
      const div = document.createElement('div');
      div.className = 'ceo-focus-option';
      div.dataset.activityId = activity.id;
      div.innerHTML = `
        <span class="radio"></span>
        <span class="option-name">${activity.name}</span>
        <span class="option-value"></span>
        <span class="option-bars-wrapper">
          <span class="option-bar"><span class="option-bar-fill"></span></span>
          <span class="option-mastery-bar"><span class="option-mastery-fill"></span></span>
        </span>
      `;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        selectActivity(activity.id);
      });
      // Attach tooltip with activity description
      const activityId = activity.id;
      attachTooltip(div, () => {
        const c = gameState.computed?.ceoFocus;
        if (!c) return '';
        return ACTIVITY_TOOLTIPS[activityId]?.(c) || '';
      }, { position: 'right' });
      container.appendChild(div);
    }
    _renderedOptions = available.map(a => a.id);
  }

  // Update values
  for (const div of container.querySelectorAll('.ceo-focus-option')) {
    const id = div.dataset.activityId;
    const isSelected = id === computed.selected;
    div.classList.toggle('selected', isSelected);
    div.querySelector('.radio').textContent = isSelected ? '\u25CF' : '\u25CB';
    div.querySelector('.option-value').textContent = formatOptionValue(id, computed);

    const barFill = div.querySelector('.option-bar-fill');
    const buildup = computed.buildup[id];
    if (buildup !== undefined && barFill) {
      barFill.style.width = `${buildup * 100}%`;
      div.querySelector('.option-bar').style.display = '';
    } else if (barFill) {
      div.querySelector('.option-bar').style.display = 'none';
    }

    // Mastery bar (purple) — always visible so players see what they're working toward
    const masteryFill = div.querySelector('.option-mastery-fill');
    const masteryBarEl = div.querySelector('.option-mastery-bar');
    const masteryVal = computed.mastery?.[id] || 0;
    const idBuildupMaxed = (computed.buildup[id] || 0) >= 1.0;
    if (masteryBarEl && masteryFill) {
      masteryBarEl.style.display = '';
      masteryFill.style.width = `${masteryVal * 100}%`;
      const isMasteryBuilding = computed.idle && id === computed.selected && idBuildupMaxed;
      masteryBarEl.classList.toggle('building', isMasteryBuilding);
      masteryBarEl.classList.toggle('dimmed', !isMasteryBuilding);
    }
  }
}

function formatOptionValue(activityId, computed) {
  switch (activityId) {
    case 'grants':
      return computed.idle && computed.selected === 'grants'
        ? `+${formatFunding(computed.grantRate)}${getRateUnit()}`
        : `${formatFunding(computed.potentialGrantRate)}${getRateUnit()}`;
    case 'research':
      return `×${computed.personnelMultiplier.toFixed(2)} org`;
    case 'ir': {
      const total = computed.irTotalEstimate || computed.irFundraiseBonus;
      return total > 0 ? `+${formatFunding(total)}` : '\u2014';
    }
    case 'operations': {
      const pct = Math.round(computed.opsBonus * 100);
      return pct > 0 ? `-${pct}%` : `${Math.round(computed.opsFloor * 100)}% base`;
    }
    case 'public_positioning': {
      const revPct = Math.round(computed.bonusRevenueMultiplier * 100);
      return revPct > 0 ? `+${revPct}% rev` : '\u2014';
    }
    default: return '';
  }
}

function buildupTimeEstimate(activityId, computed) {
  const b = computed.buildup?.[activityId] || 0;
  if (computed.idle) {
    const remaining = 1 - b;
    if (remaining <= 0.01) return null;
    // IR scales buildup with sqrt(efficiency)
    const effScale = activityId === 'ir' ? Math.sqrt(computed.efficiency || 1) : 1;
    const baseTime = activityId === 'ir' ? IR_BUILDUP_TIME : BUILDUP_TIME;
    return `<div class="tooltip-row dim"><span>Time to max</span><span>~${formatDuration(remaining * baseTime / effScale)}</span></div>`;
  } else {
    if (b <= 0.01) return null;
    return `<div class="tooltip-row dim"><span>Time to zero</span><span>~${formatDuration(b * DECAY_TIME)}</span></div>`;
  }
}

function masteryTimeEstimate(activityId, computed) {
  const m = computed.mastery?.[activityId] || 0;
  const isBuilding = computed.idle && computed.selected === activityId && (computed.buildup?.[activityId] || 0) >= 1.0;

  if (!isBuilding) return null;
  const remaining = 1 - m;
  if (remaining <= 0.01) return null;
  return `<div class="tooltip-row dim"><span>Mastery to max</span><span>~${formatDuration(remaining * MASTERY_BUILDUP_TIME)}</span></div>`;
}

/** Mastery tooltip hint — shows time estimate if building, or a dim unlock hint if mastery hasn't started */
function masteryHint(activityId, computed) {
  const m = computed.mastery?.[activityId] || 0;
  if (m > 0.001) return masteryTimeEstimate(activityId, computed) || '';
  return '<div class="tooltip-row dim"><span>Builds after max focus buildup</span></div>';
}

// Tooltip descriptions for each CEO focus activity
const ACTIVITY_TOOLTIPS = {
  grants: (computed) => {
    let html = '<div class="tooltip-header">Grant Writing</div>';
    html += '<div class="tooltip-section">';
    html += '<div class="tooltip-row dim"><span>Type: Hybrid (instant + buildup)</span></div>';
    html += '<div class="tooltip-row"><span>Passive funding income while your queue is empty. Rate improves as you stay focused.</span></div>';
    html += `<div class="tooltip-row"><span>Effective rate</span><span>${formatFunding(computed.potentialGrantRate)}${getRateUnit()}</span></div>`;
    const grantBuildup = computed.buildup?.grants || 0;
    const activeMultiplier = 1 + grantBuildup;
    html += `<div class="tooltip-row"><span>Focus buildup</span><span>×${activeMultiplier.toFixed(2)} (max ×2.00)</span></div>`;
    html += '<div class="tooltip-row dim"><span>Scales with efficiency and fundraise rounds</span></div>';
    html += buildupTimeEstimate('grants', computed) || '';
    html += '<div class="tooltip-section-header">Mastery</div>';
    const grantMastery = computed.mastery?.grants || 0;
    html += `<div class="tooltip-row" style="color: #9b59b6"><span>Grant rate</span><span>×${(1 + 3 * grantMastery).toFixed(2)} (max ×4.00)</span></div>`;
    html += masteryHint('grants', computed);
    html += '</div>';
    return html;
  },
  research: (computed) => {
    let html = '<div class="tooltip-header">Hands-on Research</div>';
    html += '<div class="tooltip-section">';
    html += '<div class="tooltip-row dim"><span>Type: Hybrid (instant + buildup)</span></div>';
    html += '<div class="tooltip-row"><span>Direct research contribution plus a growing bonus to your research team.</span></div>';
    const potentialRP = 10 * (computed.potentialEfficiency || 1);
    html += `<div class="tooltip-row"><span>Flat RP (while idle)</span><span>+${Math.round(potentialRP)} RP${getRateUnit()}</span></div>`;
    html += `<div class="tooltip-row"><span>Team multiplier</span><span>×${computed.personnelMultiplier.toFixed(2)} (max ×1.25)</span></div>`;
    html += '<div class="tooltip-row dim"><span>Multiplier builds while idle, decays while busy</span></div>';
    html += buildupTimeEstimate('research', computed) || '';
    html += '<div class="tooltip-section-header">Mastery</div>';
    const resMastery = computed.mastery?.research || 0;
    html += `<div class="tooltip-row" style="color: #9b59b6"><span>Org synergy</span><span>×${(1 + 0.50 * resMastery).toFixed(2)} (max ×1.50)</span></div>`;
    html += `<div class="tooltip-row" style="color: #9b59b6"><span>Compute cap</span><span>+${(2.0 * resMastery).toFixed(1)} (max +2.0)</span></div>`;
    html += masteryHint('research', computed);
    html += '</div>';
    return html;
  },
  ir: (computed) => {
    let html = '<div class="tooltip-header">Investor Relations</div>';
    html += '<div class="tooltip-section">';
    html += '<div class="tooltip-row dim"><span>Type: Buildup (grows while idle)</span></div>';
    html += '<div class="tooltip-row"><span>Build relationships with investors to improve your next fundraise.</span></div>';
    html += `<div class="tooltip-row"><span>Fixed fundraise bonus</span><span>+${formatFunding(computed.irFundraiseBonus)} / ${formatFunding(computed.irFundraiseCap || 0)}</span></div>`;
    const multFrac = computed.irMultFraction || 0;
    if (multFrac > 0.001) {
      html += `<div class="tooltip-row"><span>Revenue multiple bonus</span><span>+${Math.round(multFrac * 100)}% of multiplier</span></div>`;
    }
    html += '<div class="tooltip-row dim"><span>Resets after completing a fundraise</span></div>';
    html += buildupTimeEstimate('ir', computed) || '';
    html += '<div class="tooltip-section-header">Mastery</div>';
    const irMast = computed.mastery?.ir || 0;
    html += `<div class="tooltip-row" style="color: #9b59b6"><span>Overshoot cap</span><span>×${(1 + irMast).toFixed(2)} (max ×2.00)</span></div>`;
    html += `<div class="tooltip-row" style="color: #9b59b6"><span>Revenue multiple</span><span>+${Math.round(0.20 * irMast * 100)}pp (max +20pp)</span></div>`;
    html += masteryHint('ir', computed);
    html += '</div>';
    return html;
  },
  operations: (computed) => {
    const pct = Math.round(computed.opsBonus * 100);
    const capPct = Math.round(computed.opsCap * 100);
    const floorPct = Math.round(computed.opsFloor * 100);
    let html = '<div class="tooltip-header">Operations</div>';
    html += '<div class="tooltip-section">';
    html += '<div class="tooltip-row dim"><span>Type: Buildup (grows while idle)</span></div>';
    html += '<div class="tooltip-row"><span>Streamline operations to reduce ongoing costs and speed up hiring and procurement.</span></div>';
    html += `<div class="tooltip-row"><span>Running costs</span><span>-${pct}% (max ${capPct}%)</span></div>`;
    const autoMult = 1 + (computed.opsAutomationBonus || 0);
    const autoCapMult = 1 + (computed.autoCap || 0.5);
    html += `<div class="tooltip-row"><span>Automation speed</span><span>×${autoMult.toFixed(2)} (max ×${autoCapMult.toFixed(2)})</span></div>`;
    const autoFloorPct = Math.round((computed.autoFloor || 0) * 100);
    if (floorPct > 0 || autoFloorPct > 0) {
      const parts = [];
      if (floorPct > 0) parts.push(`-${floorPct}% costs`);
      if (autoFloorPct > 0) parts.push(`×${(1 + computed.autoFloor).toFixed(2)} auto speed`);
      html += `<div class="tooltip-row"><span>Baseline (from COO)</span><span>${parts.join(' · ')}</span></div>`;
    }
    html += '<div class="tooltip-row dim"><span>Cap increases with COO and Process Optimization</span></div>';
    html += buildupTimeEstimate('operations', computed) || '';
    html += '<div class="tooltip-section-header">Mastery</div>';
    const opsMast = computed.mastery?.operations || 0;
    html += `<div class="tooltip-row" style="color: #9b59b6"><span>TFLOPS</span><span>×${(1 + 0.50 * opsMast).toFixed(2)} (max ×1.50)</span></div>`;
    html += masteryHint('operations', computed);
    html += '</div>';
    return html;
  },
  public_positioning: (computed) => {
    const edgePct = Math.round(computed.edgeDecayReduction * 100);
    const revPct = Math.round(computed.bonusRevenueMultiplier * 100);
    let html = '<div class="tooltip-header">Public Positioning</div>';
    html += '<div class="tooltip-section">';
    html += '<div class="tooltip-row dim"><span>Type: Buildup (grows while idle)</span></div>';
    html += '<div class="tooltip-row"><span>Build public presence to strengthen your market position and generate brand revenue.</span></div>';
    html += `<div class="tooltip-row"><span>Customer growth rate</span><span>×${computed.acquiredDemandGrowthMultiplier.toFixed(2)} (max ×2.00)</span></div>`;
    html += `<div class="tooltip-row"><span>Market edge decay</span><span>-${edgePct}% (max -30%)</span></div>`;
    html += `<div class="tooltip-row"><span>Bonus revenue</span><span>+${revPct}% (max +10%)</span></div>`;
    html += '<div class="tooltip-row dim"><span>All build while idle, decay while busy</span></div>';
    html += buildupTimeEstimate('public_positioning', computed) || '';
    html += '<div class="tooltip-section-header">Mastery</div>';
    const ppMast = computed.mastery?.public_positioning || 0;
    html += `<div class="tooltip-row" style="color: #9b59b6"><span>Purchase costs</span><span>×${(1 - 0.20 * ppMast).toFixed(2)} (max ×0.80)</span></div>`;
    html += masteryHint('public_positioning', computed);
    html += '</div>';
    return html;
  },
};

function initCEOFocusPanel() {
  // Selector is always visible — no toggle needed
}

// Register with scheduler
registerUpdate(updateCEOFocusDisplay, EVERY_TICK);

export { initCEOFocusPanel };
