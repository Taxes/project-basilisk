// Resource Calculations and Updates

import { gameState } from './game-state.js';
import { BALANCE, AGI_RP_TARGET, AGI_LOG_K, FAREWELLS } from '../data/balance.js';
import { tracks, checkAllMilestones, trackHasAvailableTech } from './capabilities.js';
import { getPurchasableById, PERSONNEL_IDS, COMPUTE_IDS, ADMIN_IDS, DATA_IDS } from './content/purchasables.js';
import { capabilitiesTrack } from './content/capabilities-track.js';
import { applicationsTrack } from './content/applications-track.js';
import { alignmentTrack } from './content/alignment-track.js';
import { checkProgressMilestones } from './news-feed.js';
import { milestone } from './analytics.js';
import { getOutputMultiplier } from './content/upgrades.js';
import { getResearchRateMultiplier, getComputeCapacityMultiplier, getTokenRevenueMultiplier, getGovernmentFundingBonus, getMarketEdgeBoostMultiplier, getDemandMultiplier, getAcquiredDemandGrowthMultiplier, getElasticityBonus, getAcquisitionRateMultiplier, getChurnRateMultiplier } from './strategic-choices.js';
import { getDataEffectivenessMultiplier, isCapResearchPaused, isDataCleanupActive, computeDataDisplay } from './data-quality.js';
import { isMoratoriumActive } from './moratoriums.js';
import { getDenialMarketEdgeMult } from './ai-requests.js';
import { getActiveTemporaryMultiplier } from './temporary-effects.js';
import { getTemporaryDemandMult } from './flavor-events.js';
import { isFarewellStalling } from './farewells.js';
import { addNewsMessage, hasMessageBeenTriggered } from './messages.js';
import { getAlignmentDragFactor, calculateAutonomyBenefits } from './safety-metrics.js';
import { getActiveCount, getEffectiveCount } from './automation-state.js';
import { getCount } from './purchasable-state.js';
import { getCreditStatus, computeGrantIncome } from './economics.js';
import { computeEffects as computeCEOFocusEffects } from './ceo-focus.js';
import { getEffectiveScaling } from './talent-pool.js';
import { getPrestigeMultiplier } from './prestige.js';

// Derive compute boost constants from anchor points (runs once at import)
const _cb = BALANCE.COMPUTE_BOOST;
const _onPaceRatio = _cb.ON_PACE_BOOST / (_cb.SOFT_CAP - _cb.ON_PACE_BOOST);
const _a0 = _cb.ANCHORS[0], _a1 = _cb.ANCHORS[1];
const _cbAlpha = Math.log(_a0.tflops / _a1.tflops) / Math.log(_a0.totalRP / _a1.totalRP);
const _cbK = _a0.tflops / (_onPaceRatio * Math.pow(_a0.totalRP, _cbAlpha));

// Autopricer constants (algorithm internals, not balance knobs)
// Mode targets: demand-to-supply ratio the autopricer aims for.
// Higher ratio → lower price → more excess demand → faster customer growth.
const AUTOPRICER_MODE_TARGETS = { extraction: 1.0, balanced: 1.2, growth: 1.5 };
const AUTOPRICER_MAX_STEP = 0.05;           // move at most 5% toward ideal per tick
const AUTOPRICER_DEAD_ZONE = 0.02;          // skip when within 2% of ideal
const AUTOPRICER_COOLDOWN = 3;              // seconds between updates
let _autopricerTimer = 0;                   // module-level — not serialized into saves

// Price inertia: actual price drifts toward target price at a capped rate
const PRICE_INERTIA_MAX_RATE = BALANCE.PRICE_INERTIA_MAX_RATE;

// Calculate reference price based on research milestones
export function calculateReferencePrice() {
  const state = gameState;

  let refPrice = BALANCE.BASE_REFERENCE_PRICE;

  // Per-milestone reference price multipliers from capabilities
  const unlockedCaps = state.tracks?.capabilities?.unlockedCapabilities || [];
  for (const capId of unlockedCaps) {
    const cap = capabilitiesTrack.capabilities.find(c => c.id === capId);
    if (cap?.referencePriceMultiplier) {
      refPrice *= cap.referencePriceMultiplier;
    }
  }

  // Per-milestone reference price multipliers from mainline applications
  // Internal apps don't make the product worth more
  const unlockedApps = state.tracks?.applications?.unlockedCapabilities || [];
  for (const appId of unlockedApps) {
    const appDef = applicationsTrack.capabilities.find(c => c.id === appId);
    if (appDef?.isMainline && appDef?.referencePriceMultiplier) {
      refPrice *= appDef.referencePriceMultiplier;
    }
  }

  return refPrice;
}

// Calculate elasticity at a specific price point (used for demand-at-target preview)
export function calculateElasticityAtPrice(price) {
  const state = gameState;
  const referencePrice = calculateReferencePrice();

  // Asymmetric convex elasticity: overpricing punished quadratically, underpricing rewarded
  const logRatio = Math.log(price / referencePrice);
  const absPriceRatio = Math.abs(logRatio);
  const overpriceRatio = Math.max(0, logRatio);
  const underpriceRatio = Math.max(0, -logRatio);

  let elasticity = BALANCE.BASE_ELASTICITY
    + (BALANCE.ELASTICITY_SLOPE * absPriceRatio)
    + (BALANCE.OVERPRICE_CURVATURE * overpriceRatio * overpriceRatio)
    + (BALANCE.UNDERPRICE_CURVATURE * underpriceRatio * underpriceRatio);

  // Competition modifier: lead reduces elasticity (pricing power)
  const playerProgress = state.agiProgress || 0;
  const competitorProgress = state.competitor?.progressToAGI || 0;
  const progressDelta = playerProgress - competitorProgress;
  const competitionMod = -BALANCE.COMPETITION_ELASTICITY_RANGE
    * Math.max(-1, Math.min(1, progressDelta / (BALANCE.COMPETITION_ELASTICITY_SCALE * 100)));
  elasticity += competitionMod;

  // Proprietary strategic choice modifier
  elasticity += getElasticityBonus();

  // Floor to prevent infinite pricing
  return Math.max(BALANCE.ELASTICITY_FLOOR, elasticity);
}

// Calculate effective elasticity with all modifiers (at current price)
export function calculateEffectiveElasticity() {
  const currentPrice = gameState.resources.tokenPrice || BALANCE.BASE_PRICE;
  return calculateElasticityAtPrice(currentPrice);
}

// Calculate capability level based on unlocked capabilities
export function calculateCapabilityLevel(state) {
  const caps = state.tracks?.capabilities?.unlockedCapabilities || [];
  return caps.length + 1;
}

// Calculate tokens generated per second from external compute
export function calculateTokensPerSecond() {
  const state = gameState;
  // Always calculate from raw values to avoid stale computed state issues
  const externalCompute = state.resources.compute * (1 - state.resources.computeAllocation);
  let tokensPerSecond = externalCompute * BALANCE.TOKENS_PER_TFLOP;

  // Token efficiency multipliers from capabilities (e.g. scaling_laws 1.2x)
  let efficiencyMultiplier = 1.0;
  const unlockedCaps = state.tracks?.capabilities?.unlockedCapabilities || [];
  for (const capId of unlockedCaps) {
    const cap = capabilitiesTrack.capabilities.find(c => c.id === capId);
    if (cap?.effects?.tokenEfficiencyMultiplier) {
      efficiencyMultiplier *= cap.effects.tokenEfficiencyMultiplier;
    }
  }

  // Token weight multipliers from capabilities (heavier models = fewer tokens/TFLOP)
  // Per-capability multipliers: only architectural/scale caps affect serving throughput
  let weightMultiplier = 1.0;
  for (const capId of unlockedCaps) {
    const cap = capabilitiesTrack.capabilities.find(c => c.id === capId);
    if (cap?.effects?.tokenWeightMultiplier) {
      weightMultiplier *= cap.effects.tokenWeightMultiplier;
    }
  }

  // Serving multipliers from applications (optimization = more tokens/TFLOP)
  let servingMultiplier = 1.0;
  const unlockedApps = state.tracks?.applications?.unlockedCapabilities || [];
  for (const appId of unlockedApps) {
    const app = applicationsTrack.capabilities.find(c => c.id === appId);
    if (app?.effects?.servingMultiplier) {
      servingMultiplier *= app.effects.servingMultiplier;
    }
  }

  return tokensPerSecond * efficiencyMultiplier * weightMultiplier * servingMultiplier;
}

// Calculate revenue from token sales per second
// Now uses acquired demand instead of price efficiency
export function calculateTokenRevenue() {
  const state = gameState;

  // Tokens sold = min(supply, acquired demand) - NOT demand at price
  const supply = state.resources.tokensPerSecond;
  const acquiredDemand = state.resources.acquiredDemand || 0;
  const tokensSold = Math.min(supply, acquiredDemand);

  // Revenue = tokens sold × price (no more priceEfficiency!)
  const baseRevenue = tokensSold * state.resources.tokenPrice / 1000000;

  let revenue = baseRevenue * getTokenRevenueMultiplier();

  // Event multipliers (temporary effects from consequence events)
  if (gameState.eventMultipliers?.revenue) {
    revenue *= gameState.eventMultipliers.revenue;
  }

  // Store tokensSold for UI (replaces old priceEfficiency storage)
  state.resources.tokensSold = tokensSold;

  return revenue;
}

// Calculate demand at current price based on market size and elasticity.
// This is "potential demand" - what the market wants at this price.
//
// FULL DEMAND DEPENDENCY TREE (all factors that affect the final number):
//   Market size (computed here):
//     - BASE_DEMAND (500M) × competitor progress growth
//     - × per-milestone demandMultiplier                     (caps: CoT 1.2, massive/emergent/reasoning 1.3; varied per cap)
//     - × per-milestone demandMultiplier                     (mainline apps only; varied 1.3–3.5 per app)
//     - × per-milestone demandMultiplier                     (alignment T1-T4: 1.25× each, ~2.4× cumulative)
//     - × marketEdge (decaying, boosted by mainline app marketEdgeMultiplier; PP slows decay up to 30%)
//     - × getMarketEdgeBoostMultiplier()                     (strategic choice: proprietary)
//     - × denialEdgeMult                                    (Arc 2: penalty for not granting autonomy requests)
//     - × modelNerfed                                       (Arc 2: temporary demand penalty from autonomy revocation)
//     - × catchupMultiplier                                  (rubber-banding: bonus when behind competitor)
//     - × network effects bonus                              (late game, from T8 app)
//     - × getDemandMultiplier()                               (strategic choice: rapid deployment +20%)
//   Revenue modifiers (applied after demand/pricing):
//     - × (1 + cultureBalancedRevenue + ppBonusRevenue)      (PP: up to +10% bonus revenue)
//   Price elasticity (via calculateReferencePrice + calculateEffectiveElasticity):
//     - referencePrice = BASE_REFERENCE_PRICE × Π(cap.referencePriceMultiplier) × Π(app.referencePriceMultiplier)
//       (caps: varied 1.2–2.5, only mid/late caps; apps: varied 1.3–1.5, only premium apps)
//     - elasticity = BASE_ELASTICITY + slope×priceDeviation + culture mod + competition mod + strategic mod
//     - demandAtPrice = marketSize × (referencePrice / currentPrice) ^ elasticity
//
// KEY: only mainline apps (isMainline: true) affect demand. Internal apps do not.
// Most caps have NO demandMultiplier (data/early/endgame caps stripped). See capabilities-track.js.
export function calculateDemand() {
  const state = gameState;

  // Base demand grows with competitor progress (bigger AI market over time)
  const competitorProgress = state.competitor?.progressToAGI || 0;
  let marketSize = BALANCE.BASE_DEMAND * (1 + competitorProgress / 50);

  // Per-milestone demand multipliers from capabilities
  const unlockedCaps = state.tracks?.capabilities?.unlockedCapabilities || [];
  for (const capId of unlockedCaps) {
    const cap = capabilitiesTrack.capabilities.find(c => c.id === capId);
    if (cap?.demandMultiplier) {
      marketSize *= cap.demandMultiplier;
    }
  }

  // Per-milestone demand multipliers from mainline applications
  // Internal apps (process_optimization, quantized_inference, etc.) don't boost demand
  const unlockedApps = state.tracks?.applications?.unlockedCapabilities || [];
  for (const appId of unlockedApps) {
    const appDef = applicationsTrack.capabilities.find(c => c.id === appId);
    if (appDef?.isMainline && appDef?.demandMultiplier) {
      marketSize *= appDef.demandMultiplier;
    }
  }

  // Per-milestone demand multipliers from alignment (T1-T4 commercial benefits)
  const unlockedAli = state.tracks?.alignment?.unlockedCapabilities || [];
  for (const aliId of unlockedAli) {
    const aliDef = alignmentTrack.capabilities.find(c => c.id === aliId);
    if (aliDef?.demandMultiplier) {
      marketSize *= aliDef.demandMultiplier;
    }
  }

  // Market edge: floor applied only here, not on stored value
  const effectiveEdge = Math.max(BALANCE.MARKET_EDGE_FLOOR, state.resources.marketEdge);
  marketSize *= effectiveEdge * getMarketEdgeBoostMultiplier();

  // Denial market edge malus (Arc 2 — autonomy requests not granted)
  const denialEdgeMult = getDenialMarketEdgeMult();
  marketSize *= denialEdgeMult;

  // Temporary: model nerfed demand multiplier from revocation
  const nerfedMult = getActiveTemporaryMultiplier('modelNerfed');
  marketSize *= nerfedMult;

  // Moratorium demand effects
  const moratoriumGoodwill = getActiveTemporaryMultiplier('moratoriumGoodwill');
  marketSize *= moratoriumGoodwill;
  const moratoriumExposed = getActiveTemporaryMultiplier('moratoriumExposed');
  marketSize *= moratoriumExposed;
  const moratoriumBacklash = getActiveTemporaryMultiplier('moratoriumBacklash');
  marketSize *= moratoriumBacklash;

  // Catch-up bonus: demand boost when behind competitor
  const playerProgress = state.agiProgress || 0;
  const competitorProg = state.competitor?.progressToAGI || 0;
  const progressDelta = playerProgress - competitorProg;
  let catchupMultiplier = 1.0;
  if (progressDelta < BALANCE.CATCHUP_NEUTRAL_THRESHOLD) {
    catchupMultiplier = 1.0 + BALANCE.CATCHUP_PER_POINT * (BALANCE.CATCHUP_NEUTRAL_THRESHOLD - progressDelta);
    catchupMultiplier = Math.min(catchupMultiplier, BALANCE.CATCHUP_MAX);
  }
  marketSize *= catchupMultiplier;

  // Store for UI display
  state.resources.catchupMultiplier = catchupMultiplier;

  // Network effects bonus (from T8 app, scales with cumulative tokens sold)
  const cumulativeTokens = state.cumulativeTokensSold || 0;
  if (cumulativeTokens > 0) {
    const networkBonus = 1 + Math.log10(1 + cumulativeTokens / BALANCE.NETWORK_SCALE);
    marketSize *= networkBonus;
  }

  // Late-game demand growth from T8 app (ai_market_expansion)
  const lateGameMultiplier = state.resources.lateGameDemandMultiplier || 1.0;
  marketSize *= lateGameMultiplier;

  // Strategic choice: Rapid Deployment demand bonus
  marketSize *= getDemandMultiplier();

  // Alignment tax: permanent demand malus if player held position on safety backlash
  const alignmentTaxMalus = gameState.alignmentTaxDemandMalus || 0;
  if (alignmentTaxMalus !== 0) marketSize *= (1 + alignmentTaxMalus);

  // Alignment drag: low effective alignment reduces demand (Arc 2 only)
  const alignmentDrag = getAlignmentDragFactor();
  marketSize *= alignmentDrag.demand;

  // Autonomy benefit: high alignment + high power → demand bonus
  const autonomyBenefitsDemand = calculateAutonomyBenefits();
  marketSize *= autonomyBenefitsDemand.demandMult;

  // Ethical event chain: permanent demand effects + temporary boosts
  marketSize *= (gameState.flavorEventEffects?.demandMult ?? 1.0);
  marketSize *= getTemporaryDemandMult();

  // Consequence events: honesty subfactor demand penalty (fading)
  marketSize *= getActiveTemporaryMultiplier('consequenceDemand');

  // Price elasticity: demand = marketSize * (refPrice / price)^elasticity
  const referencePrice = calculateReferencePrice();
  const currentPrice = state.resources.tokenPrice || BALANCE.BASE_PRICE;
  const elasticity = calculateEffectiveElasticity();
  // Floor market size at 100M — well below 1B base, safety net only
  marketSize = Math.max(marketSize, 1e8);

  let demandAtPrice = marketSize * Math.pow(referencePrice / currentPrice, elasticity);

  // Culture axis: demand modifier (commercial culture boosts demand, research culture reduces it)
  const cultureDemandMult = 1 + (state.computed?.culture?.demand || 0);
  demandAtPrice *= cultureDemandMult;

  // Store for UI display
  state.resources.referencePrice = referencePrice;
  state.resources.effectiveElasticity = elasticity;
  state.resources.marketSize = marketSize;

  return demandAtPrice;
}

// Update acquired demand: slow growth toward demand-at-price, fast churn on price/supply changes
export function updateAcquiredDemand(deltaTime) {
  const state = gameState;
  const prevAcquiredDemand = state.resources.acquiredDemand || 0;
  const demandAtPrice = state.resources.demand;
  const supply = state.resources.tokensPerSecond;

  // Grace cap: acquired demand can exceed supply by GRACE_FACTOR
  const unlockedApps = state.tracks?.applications?.unlockedCapabilities || [];
  const graceFactor = unlockedApps.includes('autonomous_economy')
    ? BALANCE.ENDGAME_GRACE_FACTOR
    : unlockedApps.includes('ai_market_expansion')
      ? BALANCE.LATE_GAME_GRACE_FACTOR
      : BALANCE.ACQUIRED_DEMAND_GRACE_FACTOR;
  const maxAcquiredDemand = supply * graceFactor;
  const potentialDemand = Math.min(demandAtPrice, maxAcquiredDemand);

  let acquiredDemand = state.resources.acquiredDemand || 0;

  if (acquiredDemand < potentialDemand) {
    // Growth: slow convergence toward potential
    const headroom = potentialDemand - acquiredDemand;
    let growthRate = headroom * BALANCE.ACQUIRED_DEMAND_GROWTH_RATE;

    // Floor rates: absolute floor bootstraps from zero, proportional floor prevents late-game stagnation
    const proportionalFloor = acquiredDemand * BALANCE.ACQUIRED_DEMAND_PROPORTIONAL_FLOOR;
    growthRate = Math.max(growthRate, BALANCE.ACQUIRED_DEMAND_FLOOR_RATE, proportionalFloor);

    // CEO Focus: Public Positioning acquired demand growth multiplier
    const adGrowthMult = state.computed?.ceoFocus?.acquiredDemandGrowthMultiplier ?? 1;
    growthRate *= adGrowthMult;

    // Strategic choice: Rapid Deployment customer growth bonus
    growthRate *= getAcquiredDemandGrowthMultiplier();

    // Proprietary strategic choice: customer acquisition bonus
    growthRate *= getAcquisitionRateMultiplier();

    acquiredDemand += growthRate * deltaTime;
    acquiredDemand = Math.min(acquiredDemand, potentialDemand);  // Don't overshoot
  } else if (acquiredDemand > potentialDemand) {
    // Churn: faster decay when over target
    const excess = acquiredDemand - potentialDemand;
    let churnRate = excess * BALANCE.ACQUIRED_DEMAND_CHURN_RATE;

    // Proprietary strategic choice: churn reduction
    churnRate *= getChurnRateMultiplier();

    acquiredDemand -= churnRate * deltaTime;
    acquiredDemand = Math.max(acquiredDemand, potentialDemand);  // Don't undershoot
  }

  state.resources.acquiredDemand = acquiredDemand;
  state.resources.acquiredDemandDelta = deltaTime > 0 ? (acquiredDemand - prevAcquiredDemand) / deltaTime : 0;
  state.resources.acquiredDemandCap = potentialDemand;
  return acquiredDemand;
}

// Late-game demand growth: T8 app (ai_market_expansion) provides compounding demand
// T9 app (autonomous_economy) adds bonus growth rate
export function updateLateGameDemandMultiplier(deltaTime) {
  const state = gameState;
  const unlockedApps = state.tracks?.applications?.unlockedCapabilities || [];
  if (!unlockedApps.includes('ai_market_expansion')) return;

  if (!state.resources.lateGameDemandMultiplier) {
    state.resources.lateGameDemandMultiplier = 1.0;
  }
  let growthRate = BALANCE.LATE_GAME_DEMAND_GROWTH_RATE;
  if (unlockedApps.includes('autonomous_economy')) {
    growthRate += BALANCE.ENDGAME_DEMAND_GROWTH_BONUS;
  }
  state.resources.lateGameDemandMultiplier *= Math.pow(1 + growthRate, deltaTime);
}

// Autopricer: clearing-price computation with rate-limited convergence
export function updateAutopricer(deltaTime) {
  const state = gameState;

  const _dbg = state._autopricerDebug;

  // Only run if enabled and unlocked
  if (!state.resources.autopricerEnabled) { if (_dbg) console.log('[AP] disabled'); return; }
  const apps = state.tracks?.applications?.unlockedCapabilities || [];
  if (!apps.includes('process_optimization')) { if (_dbg) console.log('[AP] not unlocked'); return; }

  // Rate-limit: only update every AUTOPRICER_COOLDOWN seconds
  _autopricerTimer = (_autopricerTimer || 0) + deltaTime;
  if (_autopricerTimer < AUTOPRICER_COOLDOWN) return;
  _autopricerTimer = 0;

  const supply = state.resources.tokensPerSecond;
  if (supply <= 0) { if (_dbg) console.log('[AP] supply=0'); return; }

  const currentTarget = state.resources.targetPrice ?? state.resources.tokenPrice;
  const refPrice = state.resources.referencePrice;
  const mktSize = state.resources.marketSize;
  if (!refPrice || !mktSize) { if (_dbg) console.log('[AP] no refPrice/mktSize', { refPrice, mktSize }); return; }

  // Step 1: Compute ideal price via binary search.
  // Find the price where demand = supply × modeTarget.
  // Extraction (1.0×) = clearing price, balanced (1.2×) = 20% excess demand, growth (1.5×) = 50% excess.
  const mode = state.resources.autopricerMode || 'balanced';
  const demandTarget = supply * (AUTOPRICER_MODE_TARGETS[mode] || AUTOPRICER_MODE_TARGETS.balanced);

  const cultureDemandMult = 1 + (state.computed?.culture?.demand || 0);
  let lo = 0.01, hi = 1000;
  for (let i = 0; i < 20; i++) {
    const mid = Math.sqrt(lo * hi);
    const e = calculateElasticityAtPrice(mid);
    const d = mktSize * Math.pow(refPrice / mid, e) * cultureDemandMult;
    if (d > demandTarget) lo = mid; else hi = mid;
  }
  const idealPrice = Math.sqrt(lo * hi);

  // Step 2: Dead zone — skip when already within 2% of ideal
  const ratio = idealPrice / currentTarget;
  if (Math.abs(ratio - 1) < AUTOPRICER_DEAD_ZONE) return;

  // Step 3: Rate-limit convergence — move at most 5% toward ideal per tick
  const cappedRatio = Math.max(1 - AUTOPRICER_MAX_STEP, Math.min(1 + AUTOPRICER_MAX_STEP, ratio));
  const newTarget = currentTarget * cappedRatio;
  const clampedTarget = Math.max(0.01, Math.min(1000, newTarget));

  if (_dbg) console.log('[AP] tick', {
    currentTarget: currentTarget.toFixed(4),
    idealPrice: idealPrice.toFixed(4),
    ratio: ratio.toFixed(4),
    cappedRatio: cappedRatio.toFixed(4),
    newTarget: clampedTarget.toFixed(4),
    mode,
    demandTarget: demandTarget.toFixed(0),
  });

  state.resources.targetPrice = clampedTarget;
}

// Price inertia: drift actual tokenPrice toward targetPrice at capped rate
export function updatePriceInertia(deltaTime) {
  const state = gameState;
  const target = state.resources.targetPrice;
  if (target == null || target === state.resources.tokenPrice) return;

  const maxDrift = PRICE_INERTIA_MAX_RATE * deltaTime;
  const current = state.resources.tokenPrice;
  const ratio = target / current;

  if (Math.abs(ratio - 1) <= maxDrift) {
    // Close enough — snap to target
    state.resources.tokenPrice = target;
  } else if (ratio > 1) {
    state.resources.tokenPrice *= (1 + maxDrift);
  } else {
    state.resources.tokenPrice *= (1 - maxDrift);
  }

  state.resources.tokenPrice = Math.max(0.01, Math.min(1000, state.resources.tokenPrice));
}

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.calculateTokensPerSecond = calculateTokensPerSecond;
  window.calculateTokenRevenue = calculateTokenRevenue;
  window.calculateDemand = calculateDemand;
  window.calculateReferencePrice = calculateReferencePrice;
  window.calculateEffectiveElasticity = calculateEffectiveElasticity;
  window.calculateElasticityAtPrice = calculateElasticityAtPrice;
  window.updateAcquiredDemand = updateAcquiredDemand;
  window.updateLateGameDemandMultiplier = updateLateGameDemandMultiplier;
  window.updateAutopricer = updateAutopricer;
  window.updatePriceInertia = updatePriceInertia;
}

// Culture Axis System: three pairwise tension axes
// See docs/plans/2026-03-03-culture-axis-redesign.md
//
// Each axis compares two tracks as a ratio capped at 4:1.
// Position ranges from -1 (trackB-lean) to +1 (trackA-lean).
// Effects: track research bonus, all-research modifier, demand modifier, AP generation modifier.

/** Compute axis position from two track allocations. Returns 0 if both are 0. */
function axisPosition(a, b) {
  if (a <= 0 && b <= 0) return 0; // both zero = undefined ratio
  const r = a / (a + b);
  return Math.max(-1, Math.min(1, (r - 0.50) / 0.30));
}

/** Interpolate a specialized effect: positive position uses maxVal, negative uses minVal. */
function axisEffect(position, maxVal, minVal) {
  if (position >= 0) return position * maxVal;
  return -position * minVal; // minVal is already negative
}

export function computeCultureAxes() {
  const trks = gameState.tracks;
  const c = trks.capabilities.researcherAllocation;
  const a = trks.applications.researcherAllocation;
  const l = trks.alignment.researcherAllocation;
  const B = BALANCE;

  // Arc 1: suppress axes at single-zero (early-game protection).
  // Arc 2: zero allocation = max lean, not suppression.
  // Axes 2 & 3 require fine_tuning — before the alignment slider is revealed,
  // l=0 is forced (not a player choice), so treat as suppressed.
  const arc1 = gameState.arc < 2;
  const alignmentRevealed = gameState.tracks.capabilities.unlockedCapabilities.includes('fine_tuning');
  const pos1 = (arc1 && (c <= 0 || a <= 0)) ? 0 : axisPosition(c, a);
  const pos2 = (arc1 || !alignmentRevealed) ? 0 : axisPosition(c, l);
  const pos3 = (arc1 || !alignmentRevealed) ? 0 : axisPosition(a, l);

  // --- Track research bonuses ---
  const maxTR = B.CULTURE_AXIS_TRACK_RESEARCH_MAX;
  const coop = B.CULTURE_AXIS_COOPERATION_BONUS;

  const trackResearch = { capabilities: 0, applications: 0, alignment: 0 };

  // Axis 1: cap ↔ app
  if (pos1 > 0) {
    trackResearch.capabilities += pos1 * maxTR;
    trackResearch.applications += (1 - pos1) * coop;
    trackResearch.capabilities += (1 - pos1) * coop;
  } else if (pos1 < 0) {
    trackResearch.applications += (-pos1) * maxTR;
    trackResearch.capabilities += (1 - (-pos1)) * coop;
    trackResearch.applications += (1 - (-pos1)) * coop;
  } else if (c > 0 && a > 0) {
    trackResearch.capabilities += coop;
    trackResearch.applications += coop;
  }

  // Axis 2: cap ↔ ali
  if (pos2 > 0) {
    trackResearch.capabilities += pos2 * maxTR;
    trackResearch.alignment += (1 - pos2) * coop;
    trackResearch.capabilities += (1 - pos2) * coop;
  } else if (pos2 < 0) {
    trackResearch.alignment += (-pos2) * maxTR;
    trackResearch.capabilities += (1 - (-pos2)) * coop;
    trackResearch.alignment += (1 - (-pos2)) * coop;
  } else if (c > 0 && l > 0) {
    trackResearch.capabilities += coop;
    trackResearch.alignment += coop;
  }

  // Axis 3: app ↔ ali
  if (pos3 > 0) {
    trackResearch.applications += pos3 * maxTR;
    trackResearch.alignment += (1 - pos3) * coop;
    trackResearch.applications += (1 - pos3) * coop;
  } else if (pos3 < 0) {
    trackResearch.alignment += (-pos3) * maxTR;
    trackResearch.applications += (1 - (-pos3)) * coop;
    trackResearch.alignment += (1 - (-pos3)) * coop;
  } else if (a > 0 && l > 0) {
    trackResearch.applications += coop;
    trackResearch.alignment += coop;
  }

  // --- Specialized effects (aggregate across axes) ---
  const allResearch =
    axisEffect(pos1, B.CULTURE_RC_ALL_RESEARCH_MAX, B.CULTURE_RC_ALL_RESEARCH_MIN) +
    axisEffect(pos2, B.CULTURE_SS_ALL_RESEARCH_MAX, B.CULTURE_SS_ALL_RESEARCH_MIN);

  // Demand: app-lean on axis 1 = positive demand, so flip pos1
  const demand =
    axisEffect(-pos1, B.CULTURE_RC_DEMAND_MAX, B.CULTURE_RC_DEMAND_MIN) +
    axisEffect(pos3, B.CULTURE_PR_DEMAND_MAX, B.CULTURE_PR_DEMAND_MIN);

  // AP: ali-lean on axes 2 & 3 = positive AP, so flip both
  const apGeneration =
    axisEffect(-pos2, B.CULTURE_SS_AP_MAX, B.CULTURE_SS_AP_MIN) +
    axisEffect(-pos3, B.CULTURE_PR_AP_MAX, B.CULTURE_PR_AP_MIN);

  // --- Balance score (UI display only) ---
  let balanceScore = 0;
  if (c > 0 && a > 0 && l > 0) {
    const pb_ca = Math.min(c, a) / Math.max(c, a);
    const pb_cl = Math.min(c, l) / Math.max(c, l);
    const pb_al = Math.min(a, l) / Math.max(a, l);
    balanceScore = 3 / (1 / pb_ca + 1 / pb_cl + 1 / pb_al);
  }

  const result = {
    axes: [
      { id: 'researchCommercial', position: pos1 },
      { id: 'speedSafety', position: pos2 },
      { id: 'profitResponsibility', position: pos3 },
    ],
    trackResearch,
    allResearch,
    demand,
    apGeneration,
    balanceScore,
  };

  if (!gameState.computed) gameState.computed = {};
  gameState.computed.culture = result;

  return result;
}

// AI self-improvement: T7+ capabilities contribute percentage of total research
// Returns the RP contribution from AI feedback for this tick
// Data quality multiplies the feedback rate — corrupted data degrades self-improvement
// Get the current alignment feedback rate (highest-tier unlocked)
// Reads from content file effects — same pattern as getCurrentFeedbackRate()
export function getCurrentAlignmentFeedbackRate() {
  if (gameState.arc < 2) return 0;

  const unlockedAli = gameState.tracks?.alignment?.unlockedCapabilities || [];
  const track = alignmentTrack.capabilities;

  let highestRate = 0;
  for (const capId of unlockedAli) {
    const cap = track.find(c => c.id === capId);
    if (cap?.effects?.alignmentFeedbackRate && cap.effects.alignmentFeedbackRate > highestRate) {
      highestRate = cap.effects.alignmentFeedbackRate;
    }
  }
  return highestRate;
}

// Get feedback rate from highest-tier unlocked capability (for display and calculation)
// Each tier REPLACES the previous — only the highest unlocked rate applies
export function getCurrentFeedbackRate() {
  const unlockedCaps = gameState.tracks?.capabilities?.unlockedCapabilities || [];
  const track = capabilitiesTrack.capabilities;

  let highestRate = 0;
  for (const capId of unlockedCaps) {
    const cap = track.find(c => c.id === capId);
    if (cap?.effects?.capFeedbackRate && cap.effects.capFeedbackRate > highestRate) {
      highestRate = cap.effects.capFeedbackRate;
    }
  }
  return highestRate;
}

// Autonomy soft cap multiplier: power-law decay when capRP exceeds threshold for current grant level
// Returns 1.0 when below threshold or in Arc 1
export function getCapSoftCapMult() {
  if (gameState.arc < 2) return 1.0;
  const grants = gameState.autonomyGranted || 0;
  const thresholds = BALANCE.AUTONOMY_SOFT_CAP_THRESHOLDS;
  const capSoftCapThreshold = thresholds[Math.min(grants, thresholds.length - 1)];
  const capRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const ratio = Math.min(1.0, capSoftCapThreshold / Math.max(capRP, 1));
  return ratio ** BALANCE.AUTONOMY_SOFT_CAP_EXPONENT;
}

// Higher-tier automation upgrades multiply HR/procurement team base salary by 1.2× each
const HR_UPGRADE_TIERS = ['executive_recruiter', 'headhunter'];
const PROCUREMENT_UPGRADE_TIERS = ['cloud_partnerships', 'construction_division'];

export function getTeamCostMultiplier(teamId) {
  const tiers = teamId === 'hr_team' ? HR_UPGRADE_TIERS
    : teamId === 'procurement_team_unit' ? PROCUREMENT_UPGRADE_TIERS
    : null;
  if (!tiers) return 1;
  let upgradeCount = 0;
  for (const id of tiers) {
    if (getCount(id) > 0) upgradeCount++;
  }
  return Math.pow(1.2, upgradeCount);
}

// Calculate superlinear running cost for a purchasable type
// Formula: base * count * (1 + scalingFactor * count)
// Models diseconomies of scale: talent scarcity (personnel), resource scarcity (compute)
// The Nth unit costs more because you've exhausted cheap talent/power/land
function getScaledRunningCost(baseCost, count, scalingFactor = 0) {
  if (count <= 0 || baseCost <= 0) return 0;
  return baseCost * count * (1 + scalingFactor * count);
}

// ---------------------------------------------------------------------------
// Computed cost state (populated once per tick, read by UI)
// ---------------------------------------------------------------------------

// Find max N where getRunningCostForCount(itemId, N) <= budget.
// Pairs with getRunningCostForCount — same cost model, zero duplication.
export function maxAffordableCount(itemId, budget) {
  if (budget <= 0) return 0;
  let lo = 0, hi = 1;
  while (getRunningCostForCount(itemId, hi) <= budget) hi *= 2;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (getRunningCostForCount(itemId, mid) <= budget) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Compute raw running cost (before ops discount) for an item at a given count.
// Single source of truth — used by both cost state computation and automation throttle.
export function getRunningCostForCount(itemId, count) {
  if (count <= 0) return 0;
  const purchasable = getPurchasableById(itemId);
  if (!purchasable) return 0;
  const rawBaseCost = purchasable.salary || purchasable.runningCost || 0;
  if (rawBaseCost <= 0) return 0;

  let costMult = getTeamCostMultiplier(itemId);
  if (itemId === 'synthetic_generator') costMult = getGeneratorCostMultiplier();
  const baseCost = rawBaseCost * costMult;

  if (purchasable.runningCostFormula === 'superlinear') {
    const alpha = BALANCE.DATA_RENEWABLE_COST_ALPHA;
    return baseCost * Math.pow(count, 1 + alpha);
  }
  const factor = getEffectiveScaling(itemId);
  return baseCost * count * (1 + factor * count);
}

// Generator upgrade cost multiplier (like getTeamCostMultiplier for HR/procurement)
function getGeneratorCostMultiplier() {
  if (getCount('generator_upgrade_autonomous') > 0) return 5.0;
  if (getCount('generator_upgrade_verified') > 0) return 2.5;
  return 1.0;
}

// Compute all cost-related derived values and store on gameState.computed.costs
// Called from updateResources() each tick
export function computeCostState() {
  // Personnel costs breakdown
  const personnelBreakdown = {};
  let personnelTotal = 0;
  for (const id of PERSONNEL_IDS) {
    const count = getEffectiveCount(id);
    const purchasable = getPurchasableById(id);
    if (count > 0 && purchasable?.salary) {
      const factor = getEffectiveScaling(id);
      const cost = getScaledRunningCost(purchasable.salary, count, factor);
      const marginalCost = getScaledRunningCost(purchasable.salary, count + 1, factor) - cost;
      personnelBreakdown[id] = { count, cost, marginalCost };
      personnelTotal += cost;
    }
  }

  // Compute costs breakdown
  const computeBreakdown = {};
  let computeTotal = 0;
  for (const id of COMPUTE_IDS) {
    const count = getEffectiveCount(id);
    const purchasable = getPurchasableById(id);
    if (count > 0 && purchasable?.runningCost) {
      const factor = getEffectiveScaling(id);
      const cost = getScaledRunningCost(purchasable.runningCost, count, factor);
      const marginalCost = getScaledRunningCost(purchasable.runningCost, count + 1, factor) - cost;
      computeBreakdown[id] = { count, cost, marginalCost };
      computeTotal += cost;
    }
  }

  // Admin costs breakdown — pull uiCategory:'admin' items out of personnel/compute,
  // and add category:'admin' items that aren't in either list
  const adminBreakdown = {};
  let adminTotal = 0;

  // Move uiCategory:'admin' items from personnel breakdown to admin
  for (const id of ADMIN_IDS) {
    const purchasable = getPurchasableById(id);
    if (!purchasable) continue;
    // Items already computed in personnel or compute — move them
    if (personnelBreakdown[id]) {
      adminBreakdown[id] = personnelBreakdown[id];
      adminTotal += personnelBreakdown[id].cost;
      personnelTotal -= personnelBreakdown[id].cost;
      delete personnelBreakdown[id];
    } else if (computeBreakdown[id]) {
      adminBreakdown[id] = computeBreakdown[id];
      adminTotal += computeBreakdown[id].cost;
      computeTotal -= computeBreakdown[id].cost;
      delete computeBreakdown[id];
    } else if (purchasable.category === 'admin') {
      // category:'admin' items not in PERSONNEL_IDS/COMPUTE_IDS — compute fresh
      const count = getEffectiveCount(id);
      const rawCostBase = purchasable.salary || purchasable.runningCost || 0;
      const costBase = rawCostBase * getTeamCostMultiplier(id);
      if (count > 0 && costBase > 0) {
        const factor = getEffectiveScaling(id);
        const cost = getScaledRunningCost(costBase, count, factor);
        const marginalCost = getScaledRunningCost(costBase, count + 1, factor) - cost;
        adminBreakdown[id] = { count, cost, marginalCost };
        adminTotal += cost;
      }
    }
  }

  // Data costs breakdown
  const dataBreakdown = {};
  let dataTotal = 0;
  for (const id of DATA_IDS) {
    const count = getActiveCount(id);
    const purchasable = getPurchasableById(id);
    if (count > 0 && purchasable?.runningCost) {
      let costMult = 1;
      if (id === 'synthetic_generator') {
        costMult = getGeneratorCostMultiplier();
      }
      const baseCost = purchasable.runningCost * costMult;
      let cost, marginalCost;
      if (purchasable.runningCostFormula === 'superlinear') {
        const alpha = BALANCE.DATA_RENEWABLE_COST_ALPHA;
        cost = baseCost * Math.pow(count, 1 + alpha);
        marginalCost = baseCost * Math.pow(count + 1, 1 + alpha) - cost;
      } else {
        const factor = getEffectiveScaling(id);
        cost = getScaledRunningCost(baseCost, count, factor);
        marginalCost = getScaledRunningCost(baseCost, count + 1, factor) - cost;
      }
      dataBreakdown[id] = { count, cost, marginalCost };
      dataTotal += cost;
    }
  }

  // Personnel cost multiplier (flavor event effect — e.g. whistleblower good)
  const personnelCostMult = gameState.flavorEventEffects?.personnelCostMult ?? 1.0;
  if (personnelCostMult !== 1.0) {
    personnelTotal *= personnelCostMult;
  }

  // Ops bonus discount (from CEO Focus Operations activity)
  const opsBonus = gameState.computed?.ceoFocus?.opsBonus ?? 0;
  const opsDiscount = 1 - opsBonus;

  // Totals before and after discount
  const subtotal = personnelTotal + computeTotal + adminTotal + dataTotal;
  const totalRunningCost = subtotal * opsDiscount;

  gameState.computed.costs = {
    personnel: {
      total: personnelTotal,
      breakdown: personnelBreakdown,
    },
    compute: {
      total: computeTotal,
      breakdown: computeBreakdown,
    },
    admin: {
      total: adminTotal,
      breakdown: adminBreakdown,
    },
    data: { total: dataTotal, breakdown: dataBreakdown },
    opsBonus,
    opsDiscount,
    subtotal,
    totalRunningCost,
  };

  return totalRunningCost;
}

// ---------------------------------------------------------------------------
// Computed purchase state (marginal efficiency per purchasable, once per tick)
// ---------------------------------------------------------------------------

// Compute marginal RP/TFLOPS/cost/efficiency for each purchasable item
// Called from updateResources() each tick
export function computePurchaseState() {
  const purchases = {};

  // --- Personnel: marginal RP and running cost ---
  const baselineRP = amplifiedPersonnelRP().total;
  for (const id of PERSONNEL_IDS) {
    const count = getEffectiveCount(id);
    const purchasable = getPurchasableById(id);
    if (!purchasable) continue;

    // Marginal RP: difference when adding one more of this item
    const marginalRP = purchasable.effects?.trackRP
      ? amplifiedPersonnelRP({ [id]: count + 1 }).total - baselineRP
      : 0;

    // Marginal running cost
    const baseCost = purchasable.salary || 0;
    const factor = getEffectiveScaling(id);
    const marginalRunningCost = baseCost > 0
      ? getScaledRunningCost(baseCost, count + 1, factor) - getScaledRunningCost(baseCost, count, factor)
      : 0;

    purchases[id] = {
      marginalRP,
      marginalRunningCost,
      efficiency: marginalRunningCost > 0 ? marginalRP / marginalRunningCost : 0,
    };
  }

  // --- Compute: marginal TFLOPS and running cost ---
  for (const id of COMPUTE_IDS) {
    const count = getEffectiveCount(id);
    const purchasable = getPurchasableById(id);
    if (!purchasable) continue;

    const marginalTFLOPS = purchasable.effects?.computeRate
      ? purchasable.effects.computeRate * getOutputMultiplier(id)
      : 0;

    const baseCost = purchasable.runningCost || 0;
    const factor = getEffectiveScaling(id);
    const marginalRunningCost = baseCost > 0
      ? getScaledRunningCost(baseCost, count + 1, factor) - getScaledRunningCost(baseCost, count, factor)
      : 0;

    purchases[id] = {
      marginalTFLOPS,
      marginalRunningCost,
      efficiency: marginalRunningCost > 0 ? marginalTFLOPS / marginalRunningCost : 0,
    };
  }

  // --- Admin: only items not already covered by personnel/compute loops ---
  for (const id of ADMIN_IDS) {
    if (purchases[id]) continue; // Already computed above (uiCategory:'admin' personnel/compute items)
    const purchasable = getPurchasableById(id);
    if (!purchasable) continue;

    const count = getEffectiveCount(id);
    const baseCost = purchasable.salary || purchasable.runningCost || 0;
    const factor = getEffectiveScaling(id);
    const marginalRunningCost = baseCost > 0
      ? getScaledRunningCost(baseCost, count + 1, factor) - getScaledRunningCost(baseCost, count, factor)
      : 0;

    purchases[id] = {
      marginalRunningCost,
      efficiency: 0, // Admin items don't produce RP or TFLOPS directly
    };
  }

  gameState.computed.purchases = purchases;
}

// ---------------------------------------------------------------------------
// Computed compute state (populated once per tick, read by UI and other modules)
// ---------------------------------------------------------------------------

// Compute internal/external split and store on gameState.computed.compute
// Called from updateResources() each tick
export function computeComputeState() {
  const total = calculateComputeRate();
  const tflopsMultiplier = gameState.computed?.ceoFocus?.tflopsMultiplier ?? 1;
  const effectiveTotal = total * tflopsMultiplier;
  const allocation = gameState.resources.computeAllocation ?? 0.5;
  const internal = effectiveTotal * allocation;
  const external = effectiveTotal * (1 - allocation);

  gameState.computed.compute = {
    total: effectiveTotal,
    internal,
    external,
    allocation,
  };
}

// Calculate funding costs per second from researchers and compute
function calculateFundingCosts(deltaTime) {
  if (!gameState.computed?.costs) {
    console.error('calculateFundingCosts called before computeCostState');
    return 0;
  }
  return gameState.computed.costs.totalRunningCost * deltaTime;
}

// Compute revenue and financial stats from already-populated computed state.
// Prerequisites: computeComputeState, computeCostState, token/demand values must be set.
function computeFinancialState() {
  const externalCompute = gameState.computed.compute.external;
  const tps = gameState.resources.tokensPerSecond;
  const externalCostFraction = 1 - (gameState.computed.compute.allocation ?? gameState.resources.computeAllocation);
  gameState.computed.computeStats = {
    externalTflops: externalCompute,
    tokenEfficiency: externalCompute > 0 ? tps / externalCompute : 0,
    tokensGenerated: tps,
    tokenDemand: gameState.resources.acquiredDemand || 0,
    demandAtPrice: gameState.resources.demand || 0,
    avgCostPerMTokens: tps > 0
      ? ((gameState.computed?.costs?.compute?.total || 0) * externalCostFraction) / (tps / 1e6)
      : 0,
  };

  const tokenRevenue = calculateTokenRevenue();
  const ppBonusRev = gameState.computed?.ceoFocus?.bonusRevenueMultiplier ?? 0;
  const prestigeRevenue = getPrestigeMultiplier('revenueMultiplier');
  const adjustedTokenRevenue = tokenRevenue * (1 + ppBonusRev) * prestigeRevenue;

  const equityShare = gameState.totalEquitySold || 0;
  const operatingCosts = gameState.computed.costs.totalRunningCost;
  const operatingProfit = adjustedTokenRevenue - operatingCosts;
  const investorShare = Math.max(0, operatingProfit) * equityShare;
  const playerRevenue = adjustedTokenRevenue - investorShare;

  const creditStatus = getCreditStatus();
  const interestCost = creditStatus.interestPerSecond || 0;
  const netIncome = operatingProfit - investorShare - interestCost;

  let disbursementRate = 0;
  if (gameState.disbursements) {
    for (const d of gameState.disbursements) disbursementRate += d.rate;
  }
  const grantIncome = gameState.computed?.grants?.income || 0;
  const ceoGrantRate = gameState.computed?.ceoFocus?.grantRate || 0;
  const otherIncome = disbursementRate + grantIncome + ceoGrantRate;

  const capexHiring = gameState.computed?.capex?.hiring || 0;
  const capexInfra = gameState.computed?.capex?.infrastructure || 0;
  const capexTotal = capexHiring + capexInfra;
  const freeCashFlow = netIncome + otherIncome - capexTotal;

  const opsDiscount = gameState.computed.costs.opsDiscount;
  const personnelCost = (gameState.computed.costs.personnel.total + gameState.computed.costs.admin.total) * opsDiscount;
  const computeCost = gameState.computed.costs.compute.total * opsDiscount;
  const dataCost = gameState.computed.costs.data.total * opsDiscount;

  // Demand preview at target price
  const _targetPrice = gameState.resources.targetPrice ?? gameState.resources.tokenPrice;
  const _actualPrice = gameState.resources.tokenPrice;
  let demandAtTarget = null;
  if (Math.abs(_targetPrice / _actualPrice - 1) > 0.005) {
    const elastAtTarget = calculateElasticityAtPrice(_targetPrice);
    const _refPrice = gameState.resources.referencePrice;
    const _mktSize = gameState.resources.marketSize;
    demandAtTarget = _mktSize * Math.pow(_refPrice / _targetPrice, elastAtTarget);
    // Apply culture demand modifier (same as calculateDemand line 312-313)
    const cultureDemandMult = 1 + (gameState.computed?.culture?.demand || 0);
    demandAtTarget *= cultureDemandMult;
  }

  gameState.computed.revenue = {
    demandAtTarget,
    gross: adjustedTokenRevenue,
    net: playerRevenue,
    investorShare,
    operatingProfit,
    opex: { personnel: personnelCost, compute: computeCost, data: dataCost, total: personnelCost + computeCost + dataCost },
    interestCost,
    netIncome,
    otherIncome: { disbursements: disbursementRate, grants: grantIncome, ceoGrants: ceoGrantRate, total: otherIncome },
    capex: { hiring: capexHiring, infra: capexInfra, total: capexTotal },
    freeCashFlow,
    runway: freeCashFlow < 0 ? gameState.resources.funding / -freeCashFlow : Infinity,
    annual: adjustedTokenRevenue * 365,
    costPerMTokens: gameState.computed.computeStats?.avgCostPerMTokens || 0,
    marginPerM: gameState.resources.tokenPrice - (gameState.computed.computeStats?.avgCostPerMTokens || 0),
    ppBonus: ppBonusRev,
    prestigeMultiplier: prestigeRevenue,
  };

  return adjustedTokenRevenue;
}

// Recompute forecasts and computed state without advancing time.
// Called during pause so allocation/pricing/cost displays stay fresh.
export function updateForecasts() {
  // Recompute allocation split using current compute capacity.
  // Uses computeComputeState() — same path as updateResources — to avoid
  // double-applying the CEO Focus tflopsMultiplier on the stored value.
  computeComputeState();

  // Research rates (display only — does not add RP)
  const internalCompute = gameState.computed.compute.internal;
  computeResearchState(internalCompute);

  // Per-track breakdowns (display only — populates computed.research.tracks)
  computeTrackBreakdowns(internalCompute);

  // Stats bar rate = sum of per-track effective rates (matches cumulative RP growth)
  gameState.resources.researchRate = Object.values(gameState.tracks)
    .reduce((sum, t) => sum + (t.researchRate || 0), 0);

  // Data display state (scores, effectiveness, quality — no simulation mutation)
  computeDataDisplay();

  // CEO Focus effects (idle state, grant rate, bonuses — display only during pause)
  computeCEOFocusEffects();

  // Grant income (no payment processing — display only)
  computeGrantIncome();

  // Token throughput and demand (no acquired-demand growth/churn)
  gameState.resources.tokensPerSecond = calculateTokensPerSecond();
  gameState.resources.demand = calculateDemand();

  // Cost breakdown
  computeCostState();

  // Revenue / financial stats (single source of truth)
  computeFinancialState();

  // Purchase advisor
  computePurchaseState();
}

// Update all resources based on rates
export function updateResources(deltaTime) {
  // Compute capacity first (fixed based on purchases, not accumulated)
  // calculateComputeRate() returns total TFLOPS capacity, not a rate
  gameState.resources.compute = calculateComputeRate();
  gameState.resources.computeRate = 0;  // Compute is capacity, not a growing resource

  // Compute internal/external split (single source of truth)
  computeComputeState();
  // Write back multiplied total so all downstream consumers see mastery bonus
  gameState.resources.compute = gameState.computed.compute.total;

  // Compute research state using internal compute from computed state
  const internalCompute = gameState.computed.compute.internal;
  computeResearchState(internalCompute);

  // Compound late-game demand growth (before calculating demand)
  updateLateGameDemandMultiplier(deltaTime);

  // Token economics
  gameState.resources.tokensPerSecond = calculateTokensPerSecond();
  gameState.resources.demand = calculateDemand();

  // Update acquired demand (slow growth, fast churn)
  updateAcquiredDemand(deltaTime);

  // Autopricer update (if enabled and unlocked)
  updateAutopricer(deltaTime);

  // Price inertia: drift actual price toward target
  updatePriceInertia(deltaTime);

  // Track cumulative tokens sold (for network effects)
  const tokensSold = Math.min(gameState.resources.tokensPerSecond, gameState.resources.acquiredDemand || 0);
  gameState.cumulativeTokensSold = (gameState.cumulativeTokensSold || 0) + tokensSold * deltaTime;

  // Market edge decay (only after first app unlock)
  // Culture bonus: applications-heavy allocation slows edge decay
  // CEO Focus: Public Positioning reduces edge decay (up to 30%)
  if (gameState.resources.marketEdgeDecaying) {
    const ppEdgeReduction = gameState.computed?.ceoFocus?.edgeDecayReduction ?? 0;
    gameState.resources.marketEdge *= Math.pow(
      BALANCE.MARKET_EDGE_DECAY_PER_SECOND,
      deltaTime * (1 - ppEdgeReduction)
    );
  }

  // Compute cost state FIRST (needed for operating profit calculation)
  computeCostState();

  // Revenue / financial stats + purchase advisor (single source of truth)
  const adjustedTokenRevenue = computeFinancialState();

  // Funnel telemetry: first time revenue > 0
  if (adjustedTokenRevenue > 0) {
    milestone('first_revenue', {
      token_price: gameState.resources.tokenPrice,
      tokens_per_second: gameState.resources.tokensPerSecond,
      acquired_demand: gameState.resources.acquiredDemand || 0,
    });
  }

  // Compute marginal efficiency for purchase advisor
  computePurchaseState();

  // Deduct funding costs (researchers + compute)
  const fundingCosts = calculateFundingCosts(deltaTime);
  gameState.resources.funding = gameState.resources.funding - fundingCosts;

  // Add revenue from token sales (replaces old product revenue)
  // Equity investors take their share of revenue (net revenue from computed state)
  gameState.resources.funding += gameState.computed.revenue.net * deltaTime;

  // Add government funding bonus (from strategic choice)
  gameState.resources.funding += getGovernmentFundingBonus() * deltaTime;

  // CEO Focus: Grant Writing income
  const grantRate = gameState.computed?.ceoFocus?.grantRate || 0;
  if (grantRate > 0) {
    gameState.resources.funding += grantRate * deltaTime;
  }

  // CEO Focus flat RP is now included in computeTrackBreakdowns (no separate addition needed)

  // Generate track-specific research points
  generateTrackResearch(deltaTime, internalCompute);

  // Stats bar rate = sum of per-track effective rates (matches cumulative RP growth)
  gameState.resources.researchRate = Object.values(gameState.tracks)
    .reduce((sum, t) => sum + (t.researchRate || 0), 0);

  // Derive total RP from track sums (single source of truth)
  gameState.resources.research = (gameState.tracks.capabilities?.researchPoints || 0)
    + (gameState.tracks.applications?.researchPoints || 0)
    + (gameState.tracks.alignment?.researchPoints || 0);

  // Accumulate lifetime stats
  const netRevenue = (gameState.computed.revenue.net || 0) * deltaTime
    + getGovernmentFundingBonus() * deltaTime
    + (grantRate > 0 ? grantRate * deltaTime : 0);
  if (netRevenue > 0) {
    gameState.lifetime.totalFundingEarned += netRevenue;
    gameState.lifetimeAllTime.totalFundingEarned += netRevenue;
  }
  const researchGenerated = gameState.resources.researchRate * deltaTime;
  if (researchGenerated > 0) {
    gameState.lifetime.totalResearchEarned += researchGenerated;
    gameState.lifetimeAllTime.totalResearchEarned += researchGenerated;
  }
  gameState.lifetimeAllTime.totalPlaytime += deltaTime;
  // Track peak rates
  const netRate = gameState.computed.revenue.net || 0;
  if (netRate > gameState.lifetime.peakFundingRate) gameState.lifetime.peakFundingRate = netRate;
  if (gameState.resources.researchRate > gameState.lifetime.peakResearchRate) gameState.lifetime.peakResearchRate = gameState.resources.researchRate;

  // Check for milestone auto-unlocks (RP level crossed threshold)
  checkAllMilestones();

  // Update AGI progress
  gameState.agiProgress = calculateAGIProgress();

  // Clamp AGI during farewell stall
  if (isFarewellStalling()) {
    gameState.agiProgress = Math.min(gameState.agiProgress, FAREWELLS.STALL_CAP);
  }

  // Check for news milestones
  checkProgressMilestones(gameState.agiProgress);
}

// ---------------------------------------------------------------------------
// Research rate helper functions (private, used by computeResearchState)
// ---------------------------------------------------------------------------

// Get display text for the amplification bonus a purchasable provides to lower tiers
export function getAmplificationBonusText(purchasableId) {
  const ampConfig = BALANCE.AMPLIFICATION || {};
  const config = ampConfig[purchasableId];
  if (!config) return null;

  const count = getEffectiveCount(purchasableId);
  if (count <= 0) return null;

  const bonus = config.softCap * count / (count + config.K);
  const masteryOrgBonus = gameState.computed?.ceoFocus?.orgTierBonus || 0;
  const effectiveBonus = bonus * (1 + masteryOrgBonus);

  const targetNames = config.amplifies.map(id => {
    const p = getPurchasableById(id);
    return p ? p.name + 's' : id;
  });

  const nearCap = bonus > config.softCap * 0.9;
  const mult = (1 + effectiveBonus).toFixed(2);
  return `Org bonus: ×${mult} to ${targetNames.join(', ')}${nearCap ? ' (near cap)' : ''}`;
}

// Get tooltip builder for the amplification bonus on a purchasable card
export function getAmplificationTooltipBuilder(purchasableId) {
  const ampConfig = BALANCE.AMPLIFICATION || {};
  const config = ampConfig[purchasableId];
  if (!config) return null;

  return () => {
    const count = getEffectiveCount(purchasableId);
    if (count <= 0) return '';

    const bonus = config.softCap * count / (count + config.K);
    const masteryOrgBonus = gameState.computed?.ceoFocus?.orgTierBonus || 0;
    const effectiveBonus = bonus * (1 + masteryOrgBonus);
    const cap = config.softCap;

    const targetNames = config.amplifies.map(id => {
      const p = getPurchasableById(id);
      return p ? p.name + 's' : id;
    });

    let html = `<div class="tooltip-header"><span>Org Bonus → ${targetNames.join(', ')}</span></div>`;
    html += `<div class="tooltip-row"><span>Base bonus</span><span>×${(1 + bonus).toFixed(2)}</span></div>`;
    html += `<div class="tooltip-row dim"><span>Cap</span><span>×${(1 + cap).toFixed(2)}</span></div>`;
    if (masteryOrgBonus > 0.001) {
      html += `<div class="tooltip-row" style="color: #9b59b6"><span>Research mastery</span><span>×${(1 + masteryOrgBonus).toFixed(2)}</span></div>`;
    }
    if (masteryOrgBonus > 0.001) {
      html += `<div class="tooltip-row"><span>Effective</span><span>×${(1 + effectiveBonus).toFixed(2)}</span></div>`;
    }
    return html;
  };
}

// Compute amplified personnel RP output.
// countOverrides: optional map of { personnelId: count } to override real counts
// (used by marginal RP computation to simulate "what if we had N+1 of item X")
// Returns { total, ampBonuses, personnelOutput, ampConfig }
function amplifiedPersonnelRP(countOverrides = {}) {
  // Collect active counts and base output per personnel tier
  const personnelOutput = {};
  for (const id of PERSONNEL_IDS) {
    const count = countOverrides.hasOwnProperty(id)
      ? countOverrides[id]
      : (getEffectiveCount(id));
    const purchasable = getPurchasableById(id);
    if (purchasable?.effects?.trackRP) {
      const outputMult = getOutputMultiplier(id);
      personnelOutput[id] = {
        count,
        baseRP: count * purchasable.effects.trackRP * outputMult,
      };
    }
  }

  // Apply amplification: higher tiers boost lower tiers
  // For each tier with an amplification config, compute its bonus to each lower tier
  // Bonuses from different amplifier tiers are multiplicative
  const ampConfig = BALANCE.AMPLIFICATION || {};
  const ampBonuses = {}; // { targetId: multiplier }

  for (const [ampId, config] of Object.entries(ampConfig)) {
    const ampCount = personnelOutput[ampId]?.count || 0;
    if (ampCount <= 0) continue;

    const bonus = config.softCap * ampCount / (ampCount + config.K);
    const masteryOrgBonus = gameState.computed?.ceoFocus?.orgTierBonus || 0;
    const effectiveBonus = bonus * (1 + masteryOrgBonus);

    for (const targetId of config.amplifies) {
      if (!ampBonuses[targetId]) ampBonuses[targetId] = 1;
      ampBonuses[targetId] *= (1 + effectiveBonus);
    }
  }

  // Sum amplified output
  let total = 0;
  for (const [id, data] of Object.entries(personnelOutput)) {
    const multiplier = ampBonuses[id] || 1;
    total += data.baseRP * multiplier;
  }

  return { total, ampBonuses, personnelOutput, ampConfig };
}

// Personnel base rate: founder + research labs + personnel trackRP
function getPersonnelBase() {
  const { total, ampBonuses, personnelOutput, ampConfig } = amplifiedPersonnelRP();
  let base = total;

  // CEO Focus: Hands-on Research flat RP added to personnel base
  // (gets multiplied by compute boost, capability multiplier, etc.)
  const ceoFlatRP = gameState.computed?.ceoFocus?.flatRP || 0;
  base += ceoFlatRP;

  // Store amplification state for UI (org bonus display needs this)
  gameState.computed.amplification = { ampBonuses, personnelOutput, ampConfig };

  return base;
}

// Capability multiplier: from unlocked caps + event multipliers
function getCapabilityMultiplier() {
  let mult = 1.0;
  for (const [trackId, track] of Object.entries(tracks)) {
    const unlockedCaps = gameState.tracks[trackId]?.unlockedCapabilities || [];
    for (const capId of unlockedCaps) {
      const capDef = track.capabilities.find(c => c.id === capId);
      if (capDef?.effects?.researchRateMultiplier) {
        mult *= capDef.effects.researchRateMultiplier;
      }
    }
  }
  if (gameState.eventMultipliers?.researchRate) {
    mult *= gameState.eventMultipliers.researchRate;
  }
  // Ethical event chain: regulation passing reduces research rate
  if (gameState.flavorEventEffects?.regulationResearchMult) {
    mult *= gameState.flavorEventEffects.regulationResearchMult;
  }
  return mult;
}

// Compute boost: self-balancing ratio model
// boost = softCap * ratio / (1 + ratio), where ratio = TFLOPS / (K * totalRP^alpha)
// K and alpha derived from ANCHORS, allowing designers to tune by example rather than constants
export function getComputeBoost(internalCompute, totalRP) {
  if (internalCompute <= 0) return 0;
  const effectiveRP = Math.max(totalRP || 0, _cb.RP_FLOOR);
  const ratio = internalCompute / (_cbK * Math.pow(effectiveRP, _cbAlpha));
  // Dynamic soft cap: base + mastery bonus (research mastery raises from 3 to 5)
  const masteryCapBonus = gameState.computed?.ceoFocus?.computeCapBonus || 0;
  const effectiveCap = _cb.SOFT_CAP + masteryCapBonus;
  return effectiveCap * ratio / (1 + ratio);
}

// ---------------------------------------------------------------------------
// Alignment Ratio — Centralized calculation for all alignment consequence mechanics
// ---------------------------------------------------------------------------

// Get the current capability/alignment RP ratio
/**
 * Get the highest capability tier unlocked by the player.
 * Used for consequence gating and drag scaling.
 */
export function getHighestCapTier() {
  const unlocked = gameState.tracks?.capabilities?.unlockedCapabilities || [];
  let maxTier = 0;
  for (const cap of capabilitiesTrack.capabilities) {
    if (unlocked.includes(cap.id) && cap.tier > maxTier) {
      maxTier = cap.tier;
    }
  }
  return maxTier;
}

// Used by: alignment decay, consequence events, AI requests
export function getAlignmentRatio() {
  const capRP = gameState.cumulativeCapabilitiesRP || gameState.tracks?.capabilities?.researchPoints || 0;
  const aliRP = gameState.cumulativeAlignmentRP || gameState.tracks?.alignment?.researchPoints || 0;
  return capRP / Math.max(1, aliRP);
}

// Get the alignment ratio tier for event triggering
// Uses thresholds from balance.js
export function getAlignmentRatioTier() {
  const ratio = getAlignmentRatio();
  if (ratio < BALANCE.ALIGNMENT_RATIO_THRESHOLDS.MODERATE) return 'healthy';
  if (ratio < BALANCE.ALIGNMENT_RATIO_THRESHOLDS.SEVERE) return 'moderate';
  if (ratio < BALANCE.ALIGNMENT_RATIO_THRESHOLDS.CRITICAL) return 'severe';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Alignment Decay (Anti-Cramming) — Arc 2 only
// ---------------------------------------------------------------------------

// Calculate alignment research decay factor based on capability/alignment RP ratio
// Returns 1.0 (no decay) if ratio <= threshold, otherwise decreasing factor
// Gentle backstop against extreme end-game cramming (threshold 5.0, steepness 0.3)
export function calculateAlignmentDecayFactor() {
  // Only applies in Arc 2
  if (gameState.arc < 2) return 1.0;

  const capRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const aliRP = gameState.tracks?.alignment?.researchPoints || 0;

  // Grace floor: ratio uses max(aliRP, floor) so decay is inert in early Arc 2
  const ratio = capRP / Math.max(BALANCE.ALIGNMENT_DECAY_GRACE_FLOOR, aliRP);
  const threshold = BALANCE.ALIGNMENT_DECAY_THRESHOLD;
  const k = BALANCE.ALIGNMENT_DECAY_K;

  // No decay if ratio is at or below threshold
  if (ratio <= threshold) return 1.0;

  // Decay formula: 1 / (1 + k * (ratio - threshold))
  return 1 / (1 + k * (ratio - threshold));
}

// ---------------------------------------------------------------------------
// Computed research state (populated once per tick, read by UI)
// ---------------------------------------------------------------------------

// Compute all research-related derived values and store on gameState.computed.research
// Called from updateResources() each tick
export function computeResearchState(internalCompute) {
  const totalRP = (gameState.tracks?.capabilities?.researchPoints || 0)
    + (gameState.tracks?.applications?.researchPoints || 0)
    + (gameState.tracks?.alignment?.researchPoints || 0);
  const personnelBase = getPersonnelBase();
  const capMultiplier = getCapabilityMultiplier();
  const computeBoost = getComputeBoost(internalCompute, totalRP);
  const strategyMultiplier = getResearchRateMultiplier();
  const dataEffectivenessMultiplier = getDataEffectivenessMultiplier();
  const alignmentDecayFactor = calculateAlignmentDecayFactor();

  // AI self-improvement contribution — raw rate, before ceilings
  const feedbackRate = getCurrentFeedbackRate();
  const totalCapRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const feedbackContribution = totalCapRP * feedbackRate;

  // Alignment endgame feedback — raw rate, before ceilings (Arc 2 only)
  const aliFeedbackRate = getCurrentAlignmentFeedbackRate();
  const aliFeedbackContribution = totalCapRP * aliFeedbackRate;

  // Customer feedback bonus: log₁₀ scaled research boost from acquired demand
  const acquiredDemand = gameState.resources.acquiredDemand || 0;
  const customerFeedbackBonus = acquiredDemand > 0
    ? BALANCE.CUSTOMER_FEEDBACK_COEFFICIENT * Math.log10(1 + acquiredDemand / BALANCE.CUSTOMER_FEEDBACK_K)
    : 0;

  // CEO Focus: Hands-on Research personnel multiplier
  const ceoResearchMult = gameState.computed?.ceoFocus?.personnelMultiplier ?? 1;
  const adjustedPersonnelBase = personnelBase * ceoResearchMult;

  // Base rate before track-specific multipliers
  const prestigeResearch = getPrestigeMultiplier('researchMultiplier');
  const autonomyBenefits = calculateAutonomyBenefits();
  const baseRate = adjustedPersonnelBase * capMultiplier * computeBoost * strategyMultiplier * prestigeResearch * autonomyBenefits.researchMult;

  gameState.computed.research = {
    personnelBaseRaw: personnelBase,
    ceoResearchMult,
    prestigeResearch,
    personnelBase: adjustedPersonnelBase,
    capMultiplier,
    computeBoost,
    strategyMultiplier,
    dataEffectivenessMultiplier,
    alignmentDecayFactor,
    feedbackRate,
    feedbackContribution,
    aliFeedbackContribution,
    customerFeedbackBonus,
    autonomyBenefitMult: autonomyBenefits.researchMult,
    total: baseRate,
    tracks: {},
  };

  return baseRate;
}

// Calculate research rate per second
// Uses computed state if available, otherwise computes on demand
export function calculateResearchRate(internalCompute = null) {
  // No explicit compute → read from cache (populated each tick by computeResearchState)
  if (internalCompute === null && gameState.computed?.research) {
    return gameState.computed.research.total;
  }

  // Explicit compute or no cache yet → compute via canonical function
  if (internalCompute === null) {
    const total = calculateComputeRate();
    const allocation = gameState.resources?.computeAllocation ?? 0.5;
    internalCompute = total * allocation;
  }
  return computeResearchState(internalCompute);
}

// Calculate research rate breakdown for UI display
// Returns computed state (populated each tick by computeResearchState)
export function calculateResearchRateBreakdown(internalCompute = null) {
  // No explicit compute → read from cache (populated each tick by computeResearchState)
  if (internalCompute === null && gameState.computed?.research) {
    return gameState.computed.research;
  }

  // Explicit compute or no cache yet → compute via canonical function
  if (internalCompute === null) {
    const total = calculateComputeRate();
    const allocation = gameState.resources?.computeAllocation ?? 0.5;
    internalCompute = total * allocation;
  }
  computeResearchState(internalCompute);
  return gameState.computed.research;
}

// Calculate compute rate per second
// Also stores baseCompute and computeMultiplier on gameState for UI breakdown
export function calculateComputeRate() {
  // Sum up all compute purchases - read TFLOPS from purchasables.js with output multipliers
  // Use active count for automatable compute (furloughed equipment doesn't contribute)
  let total = 0;
  for (const id of COMPUTE_IDS) {
    const count = getEffectiveCount(id);
    const purchasable = getPurchasableById(id);
    if (count > 0 && purchasable?.effects?.computeRate) {
      const outputMult = getOutputMultiplier(id);
      total += count * purchasable.effects.computeRate * outputMult;
    }
  }

  // Apply capability multipliers
  let multiplier = 1.0;

  // Secondary resource: Infrastructure (Act 2+)
  const infrastructure = gameState.secondaryResources?.infrastructure || 0;
  if (infrastructure > 0) {
    multiplier *= Math.pow(BALANCE.INFRASTRUCTURE_COMPUTE_MULTIPLIER, infrastructure);
  }


  // Apply event multipliers
  if (gameState.eventMultipliers && gameState.eventMultipliers.computeRate) {
    multiplier *= gameState.eventMultipliers.computeRate;
  }

  // Apply strategic choice compute capacity multiplier
  multiplier *= getComputeCapacityMultiplier();

  // Store breakdown for UI display
  gameState.computed.baseCompute = total;
  gameState.computed.computeMultiplier = multiplier;

  return total * multiplier;
}

// Check if player can afford a cost
export function canAfford(cost) {
  for (let resource in cost) {
    if (resource === 'funding') {
      if (gameState.resources.funding < cost[resource]) return false;
    } else if (gameState.resources[resource] < cost[resource]) {
      return false;
    }
  }
  return true;
}

// Spend resources
export function spendResources(cost) {
  for (let resource in cost) {
    if (resource === 'funding') {
      gameState.resources.funding -= cost[resource];
    } else {
      gameState.resources[resource] -= cost[resource];
    }
  }
}

// Compute per-track research rates and breakdowns (display only — no RP mutation).
// Populates gameState.computed.research.tracks and sets track.researchRate.
// Called from both generateTrackResearch() (during ticks) and updateForecasts() (during pause).
export function computeTrackBreakdowns(internalCompute = null) {
  // Populate gameState.computed.culture before any track bonuses are consumed.
  computeCultureAxes();

  // Read from computed state (always populated by computeResearchState before this runs).
  // Fallback to computeResearchState if cache is missing (e.g. before first tick in tests).
  const researchRate = gameState.computed?.research?.total
    ?? computeResearchState(internalCompute);
  const culture = gameState.computed?.culture;
  const alignmentDrag = gameState.arc >= 2 ? getAlignmentDragFactor() : null;

  // Store drag for demand tooltip (outside the loop)
  if (alignmentDrag) {
    gameState.computed.alignmentDrag = alignmentDrag;
  }

  for (const [trackId, track] of Object.entries(gameState.tracks)) {
    // L3: Allocation
    let trackRate = researchRate * track.researcherAllocation;

    // L4a: Structural multipliers (team capacity, permanent consequences)
    trackRate *= (1 + (culture?.trackResearch?.[trackId] || 0));  // culture track focus
    trackRate *= (1 + (culture?.allResearch || 0));                // culture all-research

    if (trackId === 'capabilities') {
      trackRate *= (1 + (gameState.computed?.research?.customerFeedbackBonus || 0));
    }
    if (trackId === 'alignment' && gameState.arc >= 2) {
      const decayFactor = gameState.computed?.research?.alignmentDecayFactor ?? 1.0;
      trackRate *= decayFactor;
      // Chen resignation penalty (permanent)
      if (gameState.moratoriums?.chenResigned) {
        trackRate *= BALANCE.MORATORIUM.CHEN_RESIGN_PERMANENT_MULT;
      }
    }

    // Snapshot structural rate — used for AP capacity (excludes transient effects, gates, pauses)
    const preMalusRate = trackRate;

    // L4b: Transient effects (time-limited buffs/penalties from events and decisions)
    if (trackId === 'capabilities' && gameState.arc >= 2) {
      const capSlowMult = getActiveTemporaryMultiplier('capResearchSlow');
      if (capSlowMult < 1) trackRate *= capSlowMult;
    }
    if ((trackId === 'alignment' || trackId === 'applications') && gameState.arc >= 2) {
      const moraleMult = getActiveTemporaryMultiplier('moratoriumMorale');
      if (moraleMult > 1) trackRate *= moraleMult;
    }
    if (trackId === 'alignment' && gameState.arc >= 2) {
      // Chen morale crisis (temporary, from final moratorium sign-and-ignore)
      const moraleCrisis = getActiveTemporaryMultiplier('moratoriumMoraleCrisis');
      if (moraleCrisis < 1) trackRate *= moraleCrisis;
      // Incidents: interpretability → alignment research penalty (fading)
      trackRate *= getActiveTemporaryMultiplier('consequenceAliResearch');
    }
    // Incidents: corrigibility → all research penalty (fading, Arc 2 only)
    if (gameState.arc >= 2) {
      trackRate *= getActiveTemporaryMultiplier('consequenceResearch');
    }

    // L5: Additive sources (independent of personnel pipeline)
    if (trackId === 'capabilities') {
      trackRate += gameState.computed?.research?.feedbackContribution || 0;
    }
    if (trackId === 'alignment' && gameState.arc >= 2) {
      trackRate += gameState.computed?.research?.aliFeedbackContribution || 0;
    }

    // L6: Ceilings (org-wide constraints, apply to combined rate)
    const dataEff = gameState.computed?.research?.dataEffectivenessMultiplier ?? 1;
    if (trackId === 'capabilities') {
      trackRate *= dataEff;
    }

    // Empty track malus (skip alignment in Arc 1)
    let emptyTrackMalus = null;
    const isAlignmentArc1 = trackId === 'alignment' && gameState.arc < 2;
    if (!isAlignmentArc1 && !trackHasAvailableTech(trackId, gameState)) {
      emptyTrackMalus = BALANCE.EMPTY_TRACK_RESEARCH_MALUS;
      trackRate *= emptyTrackMalus;
    }

    if (trackId === 'capabilities' && gameState.arc >= 2) {
      // Autonomy soft cap (same logic as before, with news message)
      const capSoftCapMult = getCapSoftCapMult();
      const grants = gameState.autonomyGranted || 0;
      const thresholds = BALANCE.AUTONOMY_SOFT_CAP_THRESHOLDS;
      const capSoftCapThreshold = thresholds[Math.min(grants, thresholds.length - 1)];
      trackRate *= capSoftCapMult;
      gameState.computed.research = gameState.computed.research || {};
      gameState.computed.research.autonomySoftCapMult = capSoftCapMult;
      gameState.computed.research.autonomySoftCapThreshold = capSoftCapThreshold;

      // Fire one-time news when soft cap first bites at this grant level
      if (capSoftCapMult < 0.95) {
        const newsKey = `autonomy_soft_cap:${grants}`;
        if (!hasMessageBeenTriggered(newsKey)) {
          addNewsMessage(
            'Capabilities research is hitting diminishing returns. Your team suspects the AI\'s operational constraints are limiting further breakthroughs.',
            ['autonomy', 'soft_cap'],
            newsKey
          );
        }
      }
    }

    // Alignment drag (non-alignment tracks)
    if (trackId !== 'alignment' && alignmentDrag) {
      trackRate *= alignmentDrag.research;
    }

    // L7: Pauses (binary kill switches, zero everything)
    if (trackId === 'capabilities') {
      if (isCapResearchPaused() || isMoratoriumActive()) trackRate = 0;
    }
    if (isDataCleanupActive()) trackRate = 0;

    // Build breakdown for tooltip
    const breakdown = {
      allocation: track.researcherAllocation,
      effective: trackRate,
      cultureAllResearch: culture?.allResearch || 0,
      cultureTrackBonus: culture?.trackResearch?.[trackId] || 0,
    };

    if (emptyTrackMalus !== null) breakdown.emptyTrackMalus = emptyTrackMalus;

    if (trackId === 'capabilities') {
      breakdown.dataEffectiveness = dataEff;
      breakdown.customerFeedback = gameState.computed?.research?.customerFeedbackBonus || 0;
      const rawFeedback = gameState.computed?.research?.feedbackContribution || 0;
      breakdown.feedbackContribution = rawFeedback;
      // Effective SI after all ceilings (for display — line items should sum to total)
      let effectiveFeedback = rawFeedback * dataEff;
      if (gameState.arc >= 2) {
        breakdown.autonomySoftCap = gameState.computed?.research?.autonomySoftCapMult ?? 1.0;
        breakdown.autonomySoftCapThreshold = gameState.computed?.research?.autonomySoftCapThreshold ?? Infinity;
        effectiveFeedback *= breakdown.autonomySoftCap;
      }
      if (alignmentDrag) effectiveFeedback *= alignmentDrag.research;
      if (emptyTrackMalus !== null) effectiveFeedback *= emptyTrackMalus;
      breakdown.effectiveFeedbackContribution = effectiveFeedback;
      const isPaused = isCapResearchPaused() || isMoratoriumActive() || isDataCleanupActive();
      if (isPaused) breakdown.paused = true;
    }

    if (trackId !== 'capabilities' && isDataCleanupActive()) {
      breakdown.paused = true;
    }

    if (trackId === 'alignment' && gameState.arc >= 2) {
      breakdown.alignmentDecay = gameState.computed?.research?.alignmentDecayFactor ?? 1.0;
      breakdown.aliFeedbackContribution = gameState.computed?.research?.aliFeedbackContribution || 0;
    }

    if (trackId !== 'alignment' && alignmentDrag) {
      breakdown.alignmentDrag = alignmentDrag.research;
    }

    if (gameState.computed?.research) {
      gameState.computed.research.tracks[trackId] = breakdown;
    }

    // Uniform for ALL tracks — no special cases
    track.researchRate = trackRate;
    track.preMalusResearchRate = preMalusRate;
  }
}

// Generate research points for each track based on researcher allocation
function generateTrackResearch(deltaTime, internalCompute = null) {
  computeTrackBreakdowns(internalCompute);

  for (const [, track] of Object.entries(gameState.tracks)) {
    track.researchPoints += track.researchRate * deltaTime;
  }
}


// Calculate AGI progress as a shifted log curve of capability RP
// 100% at AGI_RP_TARGET (2x highest capability threshold), scaled by RP_THRESHOLD_SCALE
export function calculateAGIProgress() {
  const capRP = gameState.tracks.capabilities?.researchPoints || 0;
  if (capRP <= 0) return 0;
  const scaledTarget = AGI_RP_TARGET * (BALANCE.RP_THRESHOLD_SCALE || 1);
  return Math.min(100, 100 * Math.log(1 + capRP / AGI_LOG_K) / Math.log(1 + scaledTarget / AGI_LOG_K));
}

// Expose functions to window for testing
if (typeof window !== 'undefined') {
  window.calculateResearchRate = calculateResearchRate;
  window.calculateResearchRateBreakdown = calculateResearchRateBreakdown;
  window.calculateAGIProgress = calculateAGIProgress;
  window.calculateFundingCosts = calculateFundingCosts;
  window.computeFinancialState = computeFinancialState;
  window.getHighestCapTier = getHighestCapTier;
  window.getAlignmentRatio = getAlignmentRatio;
  window.getAlignmentRatioTier = getAlignmentRatioTier;
  window.calculateAlignmentDecayFactor = calculateAlignmentDecayFactor;
  window.getCurrentAlignmentFeedbackRate = getCurrentAlignmentFeedbackRate;
  window.getAmplificationBonusText = getAmplificationBonusText;
  window.getComputeBoost = getComputeBoost;
}
