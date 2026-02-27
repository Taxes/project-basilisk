// Resource Calculations and Updates

import { gameState } from './game-state.js';
import { BALANCE, AGI_RP_TARGET, AGI_LOG_K, FAREWELLS } from '../data/balance.js';
import { tracks, checkAllMilestones } from './capabilities.js';
import { getPurchasableById, PERSONNEL_IDS, COMPUTE_IDS, ADMIN_IDS, DATA_IDS } from './content/purchasables.js';
import { capabilitiesTrack } from './content/capabilities-track.js';
import { applicationsTrack } from './content/applications-track.js';
import { checkProgressMilestones } from './news-feed.js';
import { getOutputMultiplier } from './content/upgrades.js';
import { getResearchRateMultiplier, getComputeCapacityMultiplier, getTokenRevenueMultiplier, getGovernmentFundingBonus, getMarketEdgeDecayMultiplier, getMarketEdgeBoostMultiplier, getDemandMultiplier, getAcquiredDemandGrowthMultiplier } from './strategic-choices.js';
import { getDataEffectivenessMultiplier, isCapResearchPaused, isDataCleanupActive, computeDataDisplay } from './data-quality.js';
import { isMoratoriumActive } from './moratoriums.js';
import { isFarewellStalling } from './farewells.js';
import { getActiveCount } from './automation-state.js';
import { getCount } from './purchasable-state.js';
import { getCreditStatus, computeGrantIncome } from './economics.js';
import { computeEffects as computeCEOFocusEffects } from './ceo-focus.js';
import { getEffectiveScaling } from './talent-pool.js';

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

  // Culture modifier: apps allocation reduces elasticity (better product-market fit)
  const appAllocation = state.tracks?.applications?.researcherAllocation || 0.33;
  elasticity += 0.1 - (appAllocation * 0.3);  // -0.2 to +0.1

  // Competition modifier: lead reduces elasticity (pricing power)
  const playerProgress = state.agiProgress || 0;
  const competitorProgress = state.competitor?.progressToAGI || 0;
  const progressDelta = playerProgress - competitorProgress;
  const competitionMod = -BALANCE.COMPETITION_ELASTICITY_RANGE
    * Math.max(-1, Math.min(1, progressDelta / (BALANCE.COMPETITION_ELASTICITY_SCALE * 100)));
  elasticity += competitionMod;

  // Proprietary strategic choice modifier
  if (state.strategicChoices?.openVsProprietary === 'proprietary') {
    elasticity -= 0.1;
  }

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

  // Autonomy grant multiplier (Arc 2 — permanent effect from AI requests)
  if (gameState.arc >= 2 && gameState.revenueMultFromAutonomy) {
    revenue *= gameState.revenueMultFromAutonomy;
  }

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
//     - × marketEdge (decaying, boosted by mainline app marketEdgeMultiplier; PP slows decay up to 30%)
//     - × getMarketEdgeBoostMultiplier()                     (strategic choice: proprietary)
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

  // Market edge: floor applied only here, not on stored value
  const effectiveEdge = Math.max(BALANCE.MARKET_EDGE_FLOOR, state.resources.marketEdge);
  marketSize *= effectiveEdge * getMarketEdgeBoostMultiplier();

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


  // Price elasticity: demand = marketSize * (refPrice / price)^elasticity
  const referencePrice = calculateReferencePrice();
  const currentPrice = state.resources.tokenPrice || BALANCE.BASE_PRICE;
  const elasticity = calculateEffectiveElasticity();
  // Floor market size at 100M — well below 1B base, safety net only
  marketSize = Math.max(marketSize, 1e8);

  const demandAtPrice = marketSize * Math.pow(referencePrice / currentPrice, elasticity);

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
  const graceFactor = unlockedApps.includes('ai_market_expansion')
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

    // Proprietary strategic choice: +25% acquisition
    if (state.strategicChoices?.openVsProprietary === 'proprietary') {
      growthRate *= 1.25;
    }

    acquiredDemand += growthRate * deltaTime;
    acquiredDemand = Math.min(acquiredDemand, potentialDemand);  // Don't overshoot
  } else if (acquiredDemand > potentialDemand) {
    // Churn: faster decay when over target
    const excess = acquiredDemand - potentialDemand;
    let churnRate = excess * BALANCE.ACQUIRED_DEMAND_CHURN_RATE;

    // Proprietary strategic choice: -25% churn
    if (state.strategicChoices?.openVsProprietary === 'proprietary') {
      churnRate *= 0.75;
    }

    acquiredDemand -= churnRate * deltaTime;
    acquiredDemand = Math.max(acquiredDemand, potentialDemand);  // Don't undershoot
  }

  state.resources.acquiredDemand = acquiredDemand;
  state.resources.acquiredDemandDelta = deltaTime > 0 ? (acquiredDemand - prevAcquiredDemand) / deltaTime : 0;
  state.resources.acquiredDemandCap = potentialDemand;
  return acquiredDemand;
}

// Late-game demand growth: T8 app (ai_market_expansion) provides compounding demand
export function updateLateGameDemandMultiplier(deltaTime) {
  const state = gameState;
  const unlockedApps = state.tracks?.applications?.unlockedCapabilities || [];
  if (!unlockedApps.includes('ai_market_expansion')) return;

  if (!state.resources.lateGameDemandMultiplier) {
    state.resources.lateGameDemandMultiplier = 1.0;
  }
  state.resources.lateGameDemandMultiplier *= Math.pow(1 + BALANCE.LATE_GAME_DEMAND_GROWTH_RATE, deltaTime);
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
  state.resources._autopricerTimer = (state.resources._autopricerTimer || 0) + deltaTime;
  if (state.resources._autopricerTimer < AUTOPRICER_COOLDOWN) return;
  state.resources._autopricerTimer = 0;

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

  let lo = 0.01, hi = 1000;
  for (let i = 0; i < 20; i++) {
    const mid = Math.sqrt(lo * hi);
    const e = calculateElasticityAtPrice(mid);
    const d = mktSize * Math.pow(refPrice / mid, e);
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

// Calculate culture bonuses based on allocation ratios
export function getCultureBonuses() {
  const trks = gameState.tracks;
  const baseline = BALANCE.CULTURE_BONUS_BASELINE;

  const capPct = trks.capabilities.researcherAllocation;
  const appPct = trks.applications.researcherAllocation;
  const aliPct = trks.alignment.researcherAllocation;

  const capBonus = Math.max(0, (capPct - baseline) / (1 - baseline)) * BALANCE.CULTURE_CAP_MAX_BONUS;
  const appEdgeSlow = Math.max(0, (appPct - baseline) / (1 - baseline)) * BALANCE.CULTURE_APP_MAX_EDGE_SLOW;
  const aliMult = 1 + Math.max(0, (aliPct - baseline) / (1 - baseline)) * (BALANCE.CULTURE_ALI_MAX_ALIGNMENT_MULT - 1);

  const maxAlloc = Math.max(capPct, appPct, aliPct);
  const balancedStrength = Math.max(0, 1 - (maxAlloc - BALANCE.CULTURE_BALANCED_THRESHOLD) / (1 - BALANCE.CULTURE_BALANCED_THRESHOLD));
  const balancedResearch = (maxAlloc <= BALANCE.CULTURE_BALANCED_THRESHOLD) ? BALANCE.CULTURE_BALANCED_RESEARCH_BONUS : BALANCE.CULTURE_BALANCED_RESEARCH_BONUS * balancedStrength;
  const balancedRevenue = (maxAlloc <= BALANCE.CULTURE_BALANCED_THRESHOLD) ? BALANCE.CULTURE_BALANCED_REVENUE_BONUS : BALANCE.CULTURE_BALANCED_REVENUE_BONUS * balancedStrength;

  return { capBonus, appEdgeSlow, aliMult, balancedResearch, balancedRevenue };
}

// AI self-improvement: T7+ capabilities contribute percentage of total research
// Returns the RP contribution from AI feedback for this tick
// Data quality multiplies the feedback rate — corrupted data degrades self-improvement
export function calculateFeedbackResearch(deltaTime) {
  // Frozen during moratorium
  if (isMoratoriumActive()) return 0;

  const totalRP = gameState.tracks.capabilities.researchPoints;
  const rate = getCurrentFeedbackRate();
  if (rate <= 0) return 0;

  const dataEffectiveness = getDataEffectivenessMultiplier();
  return totalRP * rate * dataEffectiveness * deltaTime;
}

// Alignment endgame: T7+ alignment milestones add percentage of capability RP to alignment RP
// Higher tiers REPLACE (not stack with) lower tier values
// Returns the RP contribution from alignment feedback for this tick
export function calculateAlignmentFeedbackResearch(deltaTime) {
  // Only applies in Arc 2
  if (gameState.arc < 2) return 0;

  const capRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const unlockedAli = gameState.tracks?.alignment?.unlockedCapabilities || [];

  // Check from highest tier down (replacement, not stacking)
  let feedbackRate = 0;
  if (unlockedAli.includes('alignment_lock')) {
    feedbackRate = BALANCE.ALIGNMENT_FEEDBACK_RATES.alignment_lock;
  } else if (unlockedAli.includes('interpretability_breakthrough')) {
    feedbackRate = BALANCE.ALIGNMENT_FEEDBACK_RATES.interpretability_breakthrough;
  } else if (unlockedAli.includes('goal_stability')) {
    feedbackRate = BALANCE.ALIGNMENT_FEEDBACK_RATES.goal_stability;
  }

  if (feedbackRate === 0) return 0;

  return capRP * feedbackRate * deltaTime;
}

// Get the current alignment feedback rate for display purposes
export function getCurrentAlignmentFeedbackRate() {
  if (gameState.arc < 2) return 0;

  const unlockedAli = gameState.tracks?.alignment?.unlockedCapabilities || [];

  if (unlockedAli.includes('alignment_lock')) {
    return BALANCE.ALIGNMENT_FEEDBACK_RATES.alignment_lock;
  }
  if (unlockedAli.includes('interpretability_breakthrough')) {
    return BALANCE.ALIGNMENT_FEEDBACK_RATES.interpretability_breakthrough;
  }
  if (unlockedAli.includes('goal_stability')) {
    return BALANCE.ALIGNMENT_FEEDBACK_RATES.goal_stability;
  }
  return 0;
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

// Items that can be furloughed - running costs use active count, not owned count
const AUTOMATABLE_IDS = ['grad_student', 'junior_researcher', 'team_lead', 'elite_researcher',
                         'gpu_consumer', 'gpu_datacenter', 'cloud_compute', 'build_datacenter',
                         'hr_team', 'procurement_team_unit', 'legal_team', 'coo',
                         'chief_of_staff', 'executive_team'];

// ---------------------------------------------------------------------------
// Computed cost state (populated once per tick, read by UI)
// ---------------------------------------------------------------------------

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
    const count = AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : (getCount(id));
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
    const count = AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : (getCount(id));
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
      const count = AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : (getCount(id));
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

  // Ops bonus discount (from CEO Focus Operations activity)
  const opsBonus = gameState.computed?.ceoFocus?.opsBonus ?? gameState.opsBonus ?? 0;
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
    const count = AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : getCount(id);
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
    const count = AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : getCount(id);
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

    const count = AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : getCount(id);
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
  const allocation = gameState.resources.computeAllocation ?? 0.5;
  const internal = total * allocation;
  const external = total * (1 - allocation);

  gameState.computed.compute = {
    total,
    internal,
    external,
    allocation,
  };
}

// Calculate funding costs per second from researchers and compute
// Uses computed state if available
function calculateFundingCosts(deltaTime) {
  // Use computed state if available
  if (gameState.computed?.costs) {
    return gameState.computed.costs.totalRunningCost * deltaTime;
  }

  // Fallback: compute on demand
  let salaryCost = 0;
  for (const id of PERSONNEL_IDS) {
    const count = AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : (getCount(id));
    const purchasable = getPurchasableById(id);
    if (count > 0 && purchasable?.salary) {
      const factor = getEffectiveScaling(id);
      salaryCost += getScaledRunningCost(purchasable.salary, count, factor);
    }
  }

  let computeCost = 0;
  for (const id of COMPUTE_IDS) {
    const count = AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : (getCount(id));
    const purchasable = getPurchasableById(id);
    if (count > 0 && purchasable?.runningCost) {
      const factor = getEffectiveScaling(id);
      computeCost += getScaledRunningCost(purchasable.runningCost, count, factor);
    }
  }

  // Data costs (purchasable-based)
  let dataCost = 0;
  for (const id of DATA_IDS) {
    const dCount = getActiveCount(id);
    const purchasable = getPurchasableById(id);
    if (dCount > 0 && purchasable?.runningCost) {
      let costMult = 1;
      if (id === 'synthetic_generator') costMult = getGeneratorCostMultiplier();
      const base = purchasable.runningCost * costMult;
      if (purchasable.runningCostFormula === 'superlinear') {
        const alpha = BALANCE.DATA_RENEWABLE_COST_ALPHA;
        dataCost += base * Math.pow(dCount, 1 + alpha);
      } else {
        const factor = getEffectiveScaling(id);
        dataCost += getScaledRunningCost(base, dCount, factor);
      }
    }
  }
  const opsDiscount = 1 - (gameState.computed?.ceoFocus?.opsBonus ?? gameState.opsBonus ?? 0);
  return (salaryCost + computeCost + dataCost) * opsDiscount * deltaTime;
}

// Recompute forecasts and computed state without advancing time.
// Called during pause so allocation/pricing/cost displays stay fresh.
export function updateForecasts() {
  // Recompute allocation split using current compute capacity.
  // Use stored compute value — don't recalculate from purchases during pause.
  const total = gameState.resources.compute || 0;
  const allocation = gameState.resources.computeAllocation ?? 0.5;
  gameState.computed.compute = {
    total,
    internal: total * allocation,
    external: total * (1 - allocation),
    allocation,
  };

  // Research rates (display only — does not add RP)
  const internalCompute = gameState.computed.compute.internal;
  computeResearchState(internalCompute);

  // Per-track breakdowns (display only — populates computed.research.tracks)
  computeTrackBreakdowns(internalCompute);

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

  // Revenue / financial stats (mirrors updateResources computation block)
  const externalCompute = gameState.resources.compute * (1 - gameState.resources.computeAllocation);
  const tps = gameState.resources.tokensPerSecond;
  const externalCostFraction = 1 - gameState.resources.computeAllocation;
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
  const cultureForRevenue = getCultureBonuses();
  const ppBonusRevStat = gameState.computed?.ceoFocus?.bonusRevenueMultiplier ?? 0;
  const prestigeRevenue = gameState.arc1Upgrades?.revenueMultiplier ?? 1;
  const adjustedTokenRevenue = tokenRevenue * (1 + cultureForRevenue.balancedRevenue + ppBonusRevStat) * prestigeRevenue;

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
    cultureBonus: cultureForRevenue.balancedRevenue,
    ppBonus: ppBonusRevStat,
    prestigeMultiplier: prestigeRevenue,
  };

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

  // Compute research state using internal compute from computed state
  const internalCompute = gameState.computed.compute.internal;
  const researchRate = computeResearchState(internalCompute);

  // AI self-improvement: T7+ capabilities contribute percentage of total research
  // This adds directly to capabilities track RP, creating natural compound growth
  const feedbackRP = calculateFeedbackResearch(deltaTime);
  if (feedbackRP > 0) {
    gameState.tracks.capabilities.researchPoints += feedbackRP;
  }

  // Store total research rate including AI contribution for stats bar display
  const feedbackContribution = gameState.computed.research.feedbackContribution;
  gameState.resources.researchRate = researchRate + feedbackContribution;

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

  const tokenRevenue = calculateTokenRevenue();

  // Market edge decay (only after first app unlock)
  // Strategic choice can slow decay (multiplier < 1 means slower decay)
  // Culture bonus: applications-heavy allocation slows edge decay
  // CEO Focus: Public Positioning reduces edge decay (up to 30%)
  if (gameState.resources.marketEdgeDecaying) {
    const cultureBonuses = getCultureBonuses();
    const ppEdgeReduction = gameState.computed?.ceoFocus?.edgeDecayReduction ?? 0;
    gameState.resources.marketEdge *= Math.pow(
      BALANCE.MARKET_EDGE_DECAY_PER_SECOND,
      deltaTime * getMarketEdgeDecayMultiplier() * (1 - cultureBonuses.appEdgeSlow) * (1 - ppEdgeReduction)
    );
  }

  // Apply culture balanced revenue bonus + PP bonus revenue to token revenue
  const cultureForRevenue = getCultureBonuses();
  const ppBonusRevenue = gameState.computed?.ceoFocus?.bonusRevenueMultiplier ?? 0;
  const prestigeRevenue = gameState.arc1Upgrades?.revenueMultiplier ?? 1;
  const adjustedTokenRevenue = tokenRevenue * (1 + cultureForRevenue.balancedRevenue + ppBonusRevenue) * prestigeRevenue;

  // Compute cost state FIRST (needed for operating profit calculation)
  computeCostState();

  // Compute stats for UI (single source of truth)
  const externalCompute = gameState.resources.compute * (1 - gameState.resources.computeAllocation);
  const tps = gameState.resources.tokensPerSecond;
  const externalCostFraction = 1 - gameState.resources.computeAllocation;
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

  // Calculate investor share from operating profit (#279)
  const equityShare = gameState.totalEquitySold || 0;
  const operatingCosts = gameState.computed.costs.totalRunningCost;
  const operatingProfit = adjustedTokenRevenue - operatingCosts;
  const investorShare = Math.max(0, operatingProfit) * equityShare;
  const playerRevenue = adjustedTokenRevenue - investorShare;

  // Interest cost (from line of credit)
  const creditStatus = getCreditStatus();
  const interestCost = creditStatus.interestPerSecond || 0;

  // Net income
  const netIncome = operatingProfit - investorShare - interestCost;

  // Other income (disbursements + grants + CEO discretionary grants)
  let disbursementRate = 0;
  if (gameState.disbursements) {
    for (const d of gameState.disbursements) disbursementRate += d.rate;
  }
  const grantIncome = gameState.computed?.grants?.income || 0;
  const ceoGrantRate = gameState.computed?.ceoFocus?.grantRate || 0;
  const otherIncome = disbursementRate + grantIncome + ceoGrantRate;

  // CapEx
  const capexHiring = gameState.computed?.capex?.hiring || 0;
  const capexInfra = gameState.computed?.capex?.infrastructure || 0;
  const capexTotal = capexHiring + capexInfra;

  // Free cash flow
  const freeCashFlow = netIncome + otherIncome - capexTotal;

  // Opex breakdown (post-discount, for UI display)
  const opsDiscount = gameState.computed.costs.opsDiscount;
  const personnelCost = (gameState.computed.costs.personnel.total + gameState.computed.costs.admin.total) * opsDiscount;
  const computeCost = gameState.computed.costs.compute.total * opsDiscount;
  const dataCost = gameState.computed.costs.data.total * opsDiscount;

  // Demand preview at target price (for UI) — uses target price's elasticity, not current
  const _targetPrice = gameState.resources.targetPrice ?? gameState.resources.tokenPrice;
  const _actualPrice = gameState.resources.tokenPrice;
  let demandAtTarget = null;
  if (Math.abs(_targetPrice / _actualPrice - 1) > 0.005) {
    const elastAtTarget = calculateElasticityAtPrice(_targetPrice);
    const _refPrice = gameState.resources.referencePrice;
    const _mktSize = gameState.resources.marketSize;
    demandAtTarget = _mktSize * Math.pow(_refPrice / _targetPrice, elastAtTarget);
  }

  // Store revenue in computed state (single source of truth)
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
    cultureBonus: cultureForRevenue.balancedRevenue,
    ppBonus: ppBonusRevenue,
    prestigeMultiplier: prestigeRevenue,
  };

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

  const count = AUTOMATABLE_IDS.includes(purchasableId)
    ? getActiveCount(purchasableId) : getCount(purchasableId);
  if (count <= 0) return null;

  const bonus = config.softCap * count / (count + config.K);
  const pct = Math.round(bonus * 100);

  const targetNames = config.amplifies.map(id => {
    const p = getPurchasableById(id);
    return p ? p.name + 's' : id;
  });

  const nearCap = bonus > config.softCap * 0.9;
  return `Org bonus: +${pct}% to ${targetNames.join(', ')}${nearCap ? ' (near cap)' : ''}`;
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
      : (AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : getCount(id));
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

    for (const targetId of config.amplifies) {
      if (!ampBonuses[targetId]) ampBonuses[targetId] = 1;
      ampBonuses[targetId] *= (1 + bonus);
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
  let base = BALANCE.FOUNDER_OUTPUT;
  base += getCount('research_lab') * BALANCE.RESEARCH_LAB_RATE;

  const { total, ampBonuses, personnelOutput, ampConfig } = amplifiedPersonnelRP();
  base += total;

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
  return mult;
}

// Compute boost: self-balancing ratio model
// boost = softCap * ratio / (1 + ratio), where ratio = TFLOPS / (K * totalRP^alpha)
// K and alpha derived from ANCHORS, allowing designers to tune by example rather than constants
export function getComputeBoost(internalCompute, totalRP) {
  if (internalCompute <= 0) return 0;
  const effectiveRP = Math.max(totalRP || 0, _cb.RP_FLOOR);
  const ratio = internalCompute / (_cbK * Math.pow(effectiveRP, _cbAlpha));
  return _cb.SOFT_CAP * ratio / (1 + ratio);
}

// ---------------------------------------------------------------------------
// Alignment Ratio — Centralized calculation for all alignment consequence mechanics
// ---------------------------------------------------------------------------

// Get the current capability/alignment RP ratio
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

// Get the highest decay resistance from unlocked alignment T7-T9 milestones
// Higher tiers REPLACE (not stack with) lower tier values
function getAlignmentDecayResistance() {
  const unlockedAli = gameState.tracks?.alignment?.unlockedCapabilities || [];

  // Check from highest tier down (replacement, not stacking)
  if (unlockedAli.includes('alignment_lock')) {
    return BALANCE.ALIGNMENT_DECAY_RESISTANCE.alignment_lock; // 100%
  }
  if (unlockedAli.includes('interpretability_breakthrough')) {
    return BALANCE.ALIGNMENT_DECAY_RESISTANCE.interpretability_breakthrough; // 65%
  }
  if (unlockedAli.includes('goal_stability')) {
    return BALANCE.ALIGNMENT_DECAY_RESISTANCE.goal_stability; // 30%
  }
  return 0; // No resistance
}

// Calculate alignment research decay factor based on capability/alignment RP ratio
// Returns 1.0 (no decay) if ratio <= threshold, otherwise decreasing factor
// Alignment T7-T9 provide graduated decay resistance
export function calculateAlignmentDecayFactor() {
  // Only applies in Arc 2
  if (gameState.arc < 2) return 1.0;

  const capRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const aliRP = gameState.tracks?.alignment?.researchPoints || 0;

  // Avoid division by zero; use Math.max(1, aliRP)
  const ratio = capRP / Math.max(1, aliRP);
  const threshold = BALANCE.ALIGNMENT_DECAY_THRESHOLD;
  const k = BALANCE.ALIGNMENT_DECAY_K;

  // No decay if ratio is at or below threshold
  if (ratio <= threshold) return 1.0;

  // Base decay formula: 1 / (1 + k * (ratio - threshold))
  const baseDecay = 1 / (1 + k * (ratio - threshold));

  // Apply decay resistance from alignment T7-T9 milestones
  // Resistance reduces the penalty: decay approaches 1.0 as resistance approaches 1.0
  const resistance = getAlignmentDecayResistance();
  if (resistance >= 1.0) return 1.0; // Immune (alignment_lock)

  // Interpolate: at 0% resistance, use baseDecay; at 100%, return 1.0
  return baseDecay + resistance * (1.0 - baseDecay);
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

  // AI self-improvement contribution (data effectiveness multiplies feedback rate)
  const feedbackRate = getCurrentFeedbackRate();
  const totalCapRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const feedbackContribution = totalCapRP * feedbackRate * dataEffectivenessMultiplier;

  // Customer feedback bonus: log₁₀ scaled research boost from acquired demand
  const acquiredDemand = gameState.resources.acquiredDemand || 0;
  const customerFeedbackBonus = acquiredDemand > 0
    ? BALANCE.CUSTOMER_FEEDBACK_COEFFICIENT * Math.log10(1 + acquiredDemand / BALANCE.CUSTOMER_FEEDBACK_K)
    : 0;

  // CEO Focus: Hands-on Research personnel multiplier
  const ceoResearchMult = gameState.computed?.ceoFocus?.personnelMultiplier ?? 1;
  const adjustedPersonnelBase = personnelBase * ceoResearchMult;

  // Base rate before track-specific multipliers
  const prestigeResearch = gameState.arc1Upgrades?.researchMultiplier ?? 1;
  const baseRate = adjustedPersonnelBase * capMultiplier * computeBoost * strategyMultiplier * prestigeResearch;

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
    feedbackMultiplier: 1.0, // Legacy: kept for compatibility
    feedbackRate,
    feedbackContribution,
    customerFeedbackBonus,
    total: baseRate,
    capTotal: baseRate * dataEffectivenessMultiplier,
    tracks: {},
  };

  return baseRate;
}

// Calculate research rate per second
// Uses computed state if available, otherwise computes on demand
export function calculateResearchRate(internalCompute = null) {
  // If computed state exists and no specific internalCompute requested, use it
  if (gameState.computed?.research && internalCompute === null) {
    return gameState.computed.research.total;
  }

  // Compute on demand (for backwards compatibility or when called with specific compute)
  // When no internalCompute provided and no computed state, derive from game state
  if (internalCompute === null) {
    const total = calculateComputeRate();
    const allocation = gameState.resources?.computeAllocation ?? 0.5;
    internalCompute = total * allocation;
  }
  const totalRP = (gameState.tracks?.capabilities?.researchPoints || 0)
    + (gameState.tracks?.applications?.researchPoints || 0)
    + (gameState.tracks?.alignment?.researchPoints || 0);
  const personnelBase = getPersonnelBase();
  const capMultiplier = getCapabilityMultiplier();
  const computeBoost = getComputeBoost(internalCompute, totalRP);
  const strategyMultiplier = getResearchRateMultiplier();

  return personnelBase * capMultiplier * computeBoost * strategyMultiplier;
}

// Calculate research rate breakdown for UI display
// Returns computed state (populated each tick by computeResearchState)
export function calculateResearchRateBreakdown(internalCompute = null) {
  // Return computed state if available
  if (gameState.computed?.research) {
    return gameState.computed.research;
  }

  // Fallback: compute on demand (for testing or before first tick)
  if (internalCompute === null) {
    const total = calculateComputeRate();
    const allocation = gameState.resources?.computeAllocation ?? 0.5;
    internalCompute = total * allocation;
  }
  const totalAllRP = (gameState.tracks?.capabilities?.researchPoints || 0)
    + (gameState.tracks?.applications?.researchPoints || 0)
    + (gameState.tracks?.alignment?.researchPoints || 0);
  const personnelBase = getPersonnelBase();
  const capMultiplier = getCapabilityMultiplier();
  const computeBoost = getComputeBoost(internalCompute, totalAllRP);
  const strategyMultiplier = getResearchRateMultiplier();
  const dataEffectivenessMultiplier = getDataEffectivenessMultiplier();
  const feedbackRate = getCurrentFeedbackRate();
  const totalCapRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const dataQualityFeedback = gameState.data?.quality ?? 1.0;
  const feedbackContribution = totalCapRP * feedbackRate * dataQualityFeedback;
  const baseRate = personnelBase * capMultiplier * computeBoost * strategyMultiplier;

  return {
    personnelBase,
    capMultiplier,
    computeBoost,
    strategyMultiplier,
    dataEffectivenessMultiplier,
    feedbackMultiplier: 1.0,
    feedbackRate,
    feedbackContribution,
    total: baseRate,
    capTotal: baseRate * dataEffectivenessMultiplier,
  };
}

// Calculate compute rate per second
// Also stores baseCompute and computeMultiplier on gameState for UI breakdown
export function calculateComputeRate() {
  // Sum up all compute purchases - read TFLOPS from purchasables.js with output multipliers
  // Use active count for automatable compute (furloughed equipment doesn't contribute)
  let total = 0;
  for (const id of COMPUTE_IDS) {
    const count = AUTOMATABLE_IDS.includes(id) ? getActiveCount(id) : (getCount(id));
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

// Manual research click
export function manualResearchClick() {
  gameState.resources.research += BALANCE.MANUAL_CLICK_RESEARCH;
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
function computeTrackBreakdowns(internalCompute = null) {
  const researchRate = calculateResearchRate(internalCompute);
  const culture = getCultureBonuses();

  for (const [trackId, track] of Object.entries(gameState.tracks)) {
    let trackRate = researchRate * track.researcherAllocation;

    // Culture bonus: capabilities-heavy allocation boosts cap track RP
    if (trackId === 'capabilities') {
      trackRate *= (1 + culture.capBonus);

      // Data effectiveness multiplier (capabilities only — apps/alignment unaffected)
      trackRate *= getDataEffectivenessMultiplier();

      // Customer feedback: research bonus from large customer base
      const customerBonus = gameState.computed?.research?.customerFeedbackBonus || 0;
      trackRate *= (1 + customerBonus);

      // Autonomy grant multiplier (Arc 2 — permanent effect from AI requests)
      if (gameState.arc >= 2 && gameState.capResearchMultFromAutonomy) {
        trackRate *= gameState.capResearchMultFromAutonomy;
      }

      // Model collapse: zero capabilities research during active pause
      if (isCapResearchPaused()) {
        trackRate = 0;
      }

      // Consequence event pause: zero capabilities research during incident investigation
      if (gameState.capResearchPauseEnd && gameState.timeElapsed < gameState.capResearchPauseEnd) {
        trackRate = 0;
      }

      // Moratorium: zero capabilities research during voluntary pause
      if (isMoratoriumActive()) {
        trackRate = 0;
      }
    }

    // Alignment decay: reduces alignment research when capabilities outpace alignment (Arc 2 only)
    if (trackId === 'alignment' && gameState.arc >= 2) {
      const decayFactor = gameState.computed?.research?.alignmentDecayFactor ?? 1.0;
      trackRate *= decayFactor;
    }

    // Culture bonus: balanced allocation boosts all tracks
    trackRate *= (1 + culture.balancedResearch);

    // Data cleanup pause: zero ALL research during emergency data cleanup
    if (isDataCleanupActive()) {
      trackRate = 0;
    }

    // Store per-track breakdown for tooltip display (single source of truth)
    const breakdown = {
      allocation: track.researcherAllocation,
      effective: trackRate,
      balancedBonus: culture.balancedResearch,
    };

    if (trackId === 'capabilities') {
      breakdown.cultureCapBonus = culture.capBonus;
      breakdown.dataEffectiveness = getDataEffectivenessMultiplier();
      breakdown.customerFeedback = gameState.computed?.research?.customerFeedbackBonus || 0;
      if (gameState.arc >= 2 && gameState.capResearchMultFromAutonomy) {
        breakdown.autonomyGrant = gameState.capResearchMultFromAutonomy;
      }
      const isPaused = isCapResearchPaused()
        || (gameState.capResearchPauseEnd && gameState.timeElapsed < gameState.capResearchPauseEnd)
        || isMoratoriumActive()
        || isDataCleanupActive();
      if (isPaused) breakdown.paused = true;
    }

    // Data cleanup pauses all tracks (not just capabilities)
    if (trackId !== 'capabilities' && isDataCleanupActive()) {
      breakdown.paused = true;
    }

    if (trackId === 'alignment' && gameState.arc >= 2) {
      breakdown.alignmentDecay = gameState.computed?.research?.alignmentDecayFactor ?? 1.0;
    }

    if (gameState.computed?.research) {
      gameState.computed.research.tracks[trackId] = breakdown;
    }

    // Store rate for UI (single source of truth for ETA calculations)
    // For capabilities, include AI feedback in the display rate
    if (trackId === 'capabilities') {
      const feedbackContribution = gameState.computed?.research?.feedbackContribution || 0;
      if (breakdown && feedbackContribution > 0) {
        breakdown.feedbackContribution = feedbackContribution;
        breakdown.effective = trackRate + feedbackContribution;
      }
      track.researchRate = trackRate + feedbackContribution;
    } else {
      track.researchRate = trackRate;
    }
  }
}

// Generate research points for each track based on researcher allocation
function generateTrackResearch(deltaTime, internalCompute = null) {
  // Compute display breakdowns first (populates computed.research.tracks and track.researchRate)
  computeTrackBreakdowns(internalCompute);

  for (const [trackId, track] of Object.entries(gameState.tracks)) {
    // Alignment endgame feedback: T7+ alignment milestones add % of capability RP (Arc 2 only)
    if (trackId === 'alignment' && gameState.arc >= 2) {
      const alignmentFeedback = calculateAlignmentFeedbackResearch(deltaTime);
      if (alignmentFeedback > 0) {
        track.researchPoints += alignmentFeedback;
      }
    }

    // Accumulate RP (the only mutation generateTrackResearch does beyond breakdowns)
    // track.researchRate already excludes feedback contribution for non-cap tracks
    const effectiveRate = trackId === 'capabilities'
      ? track.researchRate - (gameState.computed?.research?.feedbackContribution || 0)
      : track.researchRate;
    track.researchPoints += effectiveRate * deltaTime;
  }
}

// Add to alignment level (capped at 100)
export function addAlignmentLevel(amount) {
  gameState.tracks.alignment.alignmentLevel = Math.min(100,
    gameState.tracks.alignment.alignmentLevel + amount
  );
}

// Get current alignment level
export function getAlignmentLevel() {
  return gameState.tracks.alignment.alignmentLevel;
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
  window.addAlignmentLevel = addAlignmentLevel;
  window.getAlignmentLevel = getAlignmentLevel;
  window.calculateResearchRate = calculateResearchRate;
  window.calculateResearchRateBreakdown = calculateResearchRateBreakdown;
  window.calculateAGIProgress = calculateAGIProgress;
  window.calculateFundingCosts = calculateFundingCosts;
  window.getAlignmentRatio = getAlignmentRatio;
  window.getAlignmentRatioTier = getAlignmentRatioTier;
  window.calculateAlignmentFeedbackResearch = calculateAlignmentFeedbackResearch;
  window.getCurrentAlignmentFeedbackRate = getCurrentAlignmentFeedbackRate;
  window.getAmplificationBonusText = getAmplificationBonusText;
  window.getComputeBoost = getComputeBoost;
}
