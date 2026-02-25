// Player-facing text: see docs/message-registry.json
import { gameState } from './game-state.js';
import { BALANCE } from '../data/balance.js';
import { getCount, getActiveCount, getPurchasableState } from './purchasable-state.js';
import { capabilitiesTrack } from './content/capabilities-track.js';
import { addActionMessage, addNewsMessage } from './messages.js';
import { notify } from './ui.js';
import { senders } from './content/message-content.js';

// --- Pure Calculation Functions ---

/** Linear interpolation on the tier requirements table.
 *  RP breakpoints are scaled by RP_THRESHOLD_SCALE so data walls
 *  stay aligned with capability milestones after global rebalances. */
export function interpolateTierRequirement(cumulativeCapRP) {
  const table = BALANCE.DATA_TIER_REQUIREMENTS;
  const scale = BALANCE.RP_THRESHOLD_SCALE || 1;
  if (cumulativeCapRP <= table[0][0] * scale) return table[0][1];
  if (cumulativeCapRP >= table[table.length - 1][0] * scale) return table[table.length - 1][1];

  for (let i = 1; i < table.length; i++) {
    if (cumulativeCapRP <= table[i][0] * scale) {
      const x0 = table[i - 1][0] * scale, y0 = table[i - 1][1];
      const x1 = table[i][0] * scale, y1 = table[i][1];
      const t = (cumulativeCapRP - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

/**
 * Calculate total data score from all sources.
 * Returns { bulk, renewable, synthetic, total, effective }.
 * effective = Σ(score × quality) — quality baked into one metric.
 */
export function calculateDataScore(state) {
  let bulk = 0;
  let bulkEff = 0;
  for (const src of BALANCE.DATA_BULK_SOURCES) {
    if (getCount('data_' + src.id) > 0) {
      bulk += src.score;
      bulkEff += src.score * src.quality;
    }
  }

  let renewable = 0;
  let renewableEff = 0;
  for (const src of BALANCE.DATA_RENEWABLE_SOURCES) {
    const score = state.data.renewableScores?.[src.id] || 0;
    renewable += score;
    if (score > 0 && getActiveCount('data_' + src.id) > 0) {
      renewableEff += score * src.quality;
    }
  }

  const synthetic = state.data.syntheticScore;
  const synthQuality = synthetic > 0 ? getSyntheticQuality() : 0;
  const syntheticEff = synthetic * synthQuality;

  return {
    bulk, renewable, synthetic,
    bulkEff, renewableEff, syntheticEff,
    total: bulk + renewable + synthetic,
    effective: bulkEff + renewableEff + syntheticEff,
  };
}

/**
 * Get the effective growth cap for a renewable source.
 * For User Interaction Pipeline, cap scales with tokens sold.
 * For all other sources, returns the base growthCap.
 */
/**
 * Compute the soft-capped growth cap for a given number of copies.
 * Exported so UI can compute marginal cap previews without duplicating the formula.
 */
export function getCapForCopies(src, copies, state) {
  if (copies <= 0) return 0;

  const alpha = BALANCE.DATA_RENEWABLE_CAP_ALPHA;
  const maxMult = BALANCE.DATA_RENEWABLE_SOFT_CAP_MULT;
  const raw = Math.pow(copies, alpha);
  let cap = src.growthCap * maxMult * raw / (raw + maxMult - 1);

  if (src.id !== 'user_interaction') return cap;

  // UIP token bonus — multiplicative, scales with copies
  const tokensSold = Math.min(
    state.resources.tokensPerSecond || 0,
    state.resources.demand || 0
  );
  if (tokensSold <= 0) return cap;

  const bonusFraction = BALANCE.DATA_UIP_BONUS_CAP * Math.log(1 + tokensSold / BALANCE.DATA_UIP_K) / src.growthCap;
  return cap * (1 + bonusFraction);
}

export function getEffectiveCap(src, state) {
  const activeCopies = getActiveCount('data_' + src.id);
  return getCapForCopies(src, activeCopies, state);
}

/** Calculate effectiveness = effectiveScore / tierRequirement. */
export function calculateEffectiveness(state) {
  const score = calculateDataScore(state);
  const capRP = state.tracks.capabilities.researchPoints;
  const required = interpolateTierRequirement(capRP);
  if (required <= 0) return score.effective > 0 ? 10 : 1;
  return score.effective / required;
}

/** Map effectiveness to a capabilities research multiplier. */
export function effectivenessToMultiplier(effectiveness) {
  if (effectiveness <= 0) return 0;
  if (effectiveness <= 1.0) return effectiveness * effectiveness;
  return 1.0 + Math.log(1 + (effectiveness - 1.0));
}

/**
 * Calculate data quality as weighted average of per-source quality values.
 * quality = Σ(source_score × source_quality) / Σ(source_score)
 */
export function calculateQuality(scores, state) {
  if (scores.total <= 0) return 1.0;

  let weightedSum = 0;
  let totalWeight = 0;

  // Bulk sources
  const st = state || gameState;
  for (const src of BALANCE.DATA_BULK_SOURCES) {
    if (getCount('data_' + src.id) > 0) {
      weightedSum += src.score * src.quality;
      totalWeight += src.score;
    }
  }

  // Renewable sources
  for (const src of BALANCE.DATA_RENEWABLE_SOURCES) {
    const renewScore = st.data.renewableScores?.[src.id] || 0;
    if (renewScore > 0 && getActiveCount('data_' + src.id) > 0) {
      weightedSum += renewScore * src.quality;
      totalWeight += renewScore;
    }
  }

  // Synthetic (uses current upgrade quality)
  if (scores.synthetic > 0) {
    const synthQuality = getSyntheticQuality();
    weightedSum += scores.synthetic * synthQuality;
    totalWeight += scores.synthetic;
  }

  if (totalWeight <= 0) return 1.0;
  return weightedSum / totalWeight;
}

// --- Synthetic Generator Functions ---

/** Calculate total synthetic generation rate from running generators. */
export function getTotalGenerationRate() {
  return getActiveCount('synthetic_generator') * BALANCE.DATA_GENERATOR.ratePerUnit;
}

/** Get the synthetic data quality based on current upgrade level. */
export function getSyntheticQuality() {
  const level = getCount('generator_upgrade_autonomous') > 0 ? 2
    : getCount('generator_upgrade_verified') > 0 ? 1 : 0;
  return BALANCE.DATA_GENERATOR_UPGRADES[level].quality;
}

// --- Display-Only Computation ---

/**
 * Compute data display state without mutating simulation state.
 * Populates gameState.computed.data, data.quality, and legacy cache fields.
 * Called from both processDataQuality() (during ticks) and updateForecasts() (during pause).
 */
export function computeDataDisplay() {
  const data = gameState.data;

  // Calculate scores and effectiveness
  const scores = calculateDataScore(gameState);
  const capRP = gameState.tracks.capabilities.researchPoints;
  const required = interpolateTierRequirement(capRP);
  const effectiveness = required > 0 ? scores.effective / required : (scores.effective > 0 ? 10 : 1);

  // Calculate quality (weighted average of per-source quality)
  const quality = calculateQuality(scores, gameState);
  data.quality = quality;

  // Cache values for UI (legacy)
  data.effectiveness = effectiveness;
  data.dataScore = scores.effective;
  data.dataRequired = required;
  data.nextTierName = getNextTierName(capRP);

  // Renewable display info
  const renewablesComputed = {};
  for (const src of BALANCE.DATA_RENEWABLE_SOURCES) {
    const activeCopies = getActiveCount('data_' + src.id);
    const ec = activeCopies > 0 ? getEffectiveCap(src, gameState) : 0;
    const score = data.renewableScores?.[src.id] || 0;
    const isGrowing = score < ec;
    const tau = isGrowing ? BALANCE.DATA_RENEWABLE_TAU : BALANCE.DATA_RENEWABLE_DECAY_TAU;
    const growthRate = activeCopies > 0
      ? (ec - score) / tau
      : (score > 0 ? -score / BALANCE.DATA_RENEWABLE_DECAY_TAU : 0);
    const rawPow = Math.pow(activeCopies, BALANCE.DATA_RENEWABLE_CAP_ALPHA);
    const scm = BALANCE.DATA_RENEWABLE_SOFT_CAP_MULT;
    const baseCap = activeCopies > 0 ? src.growthCap * scm * rawPow / (rawPow + scm - 1) : 0;
    const tokenBonus = src.id === 'user_interaction' ? ec - baseCap : 0;
    renewablesComputed[src.id] = { score, maxScore: ec, effectiveCap: ec, growthRate, tokenBonus };
  }

  // Compute trend arrow: compare current to previous 5s snapshot
  const trendDelta = effectiveness - (data.effectivenessTrendPrev ?? effectiveness);
  const trend = trendDelta > 0.01 ? 'rising' : trendDelta < -0.01 ? 'falling' : 'stable';

  const genRate = getTotalGenerationRate();

  // Per-category average quality (weighted by score within each category)
  let bulkWeighted = 0, bulkTotal = 0;
  for (const src of BALANCE.DATA_BULK_SOURCES) {
    if (getCount('data_' + src.id) > 0) {
      bulkWeighted += src.score * src.quality;
      bulkTotal += src.score;
    }
  }
  let renewWeighted = 0, renewTotal = 0;
  for (const src of BALANCE.DATA_RENEWABLE_SOURCES) {
    const s = data.renewableScores?.[src.id] || 0;
    if (s > 0 && getActiveCount('data_' + src.id) > 0) {
      renewWeighted += s * src.quality;
      renewTotal += s;
    }
  }
  const synthQuality = scores.synthetic > 0 ? getSyntheticQuality() : 0;

  gameState.computed.data = {
    renewables: renewablesComputed,
    scores,
    categoryQuality: {
      bulk: bulkTotal > 0 ? bulkWeighted / bulkTotal : 0,
      renewable: renewTotal > 0 ? renewWeighted / renewTotal : 0,
      synthetic: synthQuality,
    },
    synthetic: {
      generationRate: genRate,
      synthProportion: scores.total > 0 ? scores.synthetic / scores.total : 0,
    },
    quality: data.quality,
    effectiveness,
    trend,
  };
}

// --- Tick Processing ---

/**
 * Main tick function for the data quality system.
 * Called once per game loop tick from main.js.
 */
export function processDataQuality(deltaTime) {
  const data = gameState.data;

  // Ensure renewableScores exists
  if (!data.renewableScores) data.renewableScores = {};

  // 1. Grow/decay renewable scores
  for (const src of BALANCE.DATA_RENEWABLE_SOURCES) {
    const activeCopies = getActiveCount('data_' + src.id);
    const cap = activeCopies > 0 ? getEffectiveCap(src, gameState) : 0;
    const currentScore = data.renewableScores[src.id] || 0;

    if (currentScore < cap) {
      // Growth: approach cap at normal tau
      const gain = (cap - currentScore) * (1 - Math.exp(-deltaTime / BALANCE.DATA_RENEWABLE_TAU));
      data.renewableScores[src.id] = currentScore + gain;
    } else if (currentScore > cap) {
      // Decay: approach cap at faster decay tau
      const loss = (currentScore - cap) * (1 - Math.exp(-deltaTime / BALANCE.DATA_RENEWABLE_DECAY_TAU));
      data.renewableScores[src.id] = currentScore - loss;
    }
  }

  // 2. Synthetic score growth from running generators
  const genRate = getTotalGenerationRate();
  if (genRate > 0) {
    data.syntheticScore += genRate * deltaTime;
  }

  // 3-4. Calculate scores, effectiveness, quality, and populate computed.data
  computeDataDisplay();
  const effectiveness = gameState.computed.data.effectiveness;
  const quality = data.quality;
  const scores = gameState.computed.data.scores;
  const required = data.dataRequired;

  // 5. Collapse pause countdown
  if (data.collapsePauseRemaining > 0) {
    data.collapsePauseRemaining = Math.max(0, data.collapsePauseRemaining - deltaTime);
  }

  // 6. Collapse roll — triggered by low quality
  if (quality < BALANCE.DATA_QUALITY_COLLAPSE_THRESHOLD && data.collapsePauseRemaining <= 0) {
    const qualityRatio = quality / BALANCE.DATA_QUALITY_COLLAPSE_THRESHOLD;
    const mtth = BALANCE.DATA_QUALITY_COLLAPSE_MTTH_MAX * qualityRatio +
                 BALANCE.DATA_QUALITY_COLLAPSE_MTTH_MIN * (1 - qualityRatio);
    const probability = 1 - Math.exp(-deltaTime / mtth);
    if (Math.random() < probability) {
      data.collapsePauseRemaining = BALANCE.DATA_COLLAPSE_PAUSE_DURATION;
      triggerCollapseNews();
    }
  }

  // 7. Progressive disclosure: reveal data tab when effectiveness drops below wall threshold
  if (!data.dataTabRevealed && effectiveness < BALANCE.DATA_WALL_THRESHOLD) {
    data.dataTabRevealed = true;
    triggerDataWallEvent();
  }

  // 8. Phase 3 data crisis reveal — phased over ~60s
  if (!data.phase3RevealStarted) {
    const hasSynthetic = isCapUnlocked('synthetic_data');
    const qualityDegraded = quality < 0.85;
    const seriesCRaised = gameState.fundraiseRounds?.series_c?.raised;
    if (hasSynthetic && qualityDegraded && seriesCRaised) {
      data.phase3RevealStarted = gameState.timeElapsed;
    }
  }
  if (data.phase3RevealStarted && !data.qualityRevealed) {
    if (gameState.timeElapsed - data.phase3RevealStarted > 30) {
      data.qualityRevealed = true;
    }
  }

  // 9. Check for late-game data exhaustion (all sources maxed, still data-constrained)
  if (!data.dataExhaustionTriggered && effectiveness < BALANCE.DATA_WALL_THRESHOLD) {
    const allBulkPurchased = BALANCE.DATA_BULK_SOURCES.every(src => getCount('data_' + src.id) > 0);
    const renewablesNearCap = BALANCE.DATA_RENEWABLE_SOURCES.every(src => {
      if (getActiveCount('data_' + src.id) <= 0) return false;
      const effectiveCap = getEffectiveCap(src, gameState);
      const currentScore = data.renewableScores[src.id] || 0;
      return currentScore >= effectiveCap * 0.95;
    });
    if (allBulkPurchased && renewablesNearCap) {
      data.dataExhaustionTriggered = true;
      triggerDataExhaustionNews();
    }
  }

  // 10. Effectiveness trend snapshot (updates every 5s for stable UI arrow)
  if (!data.trendSnapshotTime || gameState.timeElapsed - data.trendSnapshotTime >= 5) {
    data.effectivenessTrendPrev = data.effectivenessTrend ?? effectiveness;
    data.effectivenessTrend = effectiveness;
    data.trendSnapshotTime = gameState.timeElapsed;
    // Re-run display to pick up updated trend
    computeDataDisplay();
  }

  return {
    effectiveness,
    multiplier: effectivenessToMultiplier(effectiveness),
    scores,
    required,
    quality: data.quality,
    collapsePaused: data.collapsePauseRemaining > 0,
  };
}

/** Returns true if capabilities research is paused due to model collapse. */
export function isCapResearchPaused() {
  return gameState.data.collapsePauseRemaining > 0;
}

/** Get the data effectiveness multiplier for capabilities research. */
export function getDataEffectivenessMultiplier() {
  const eff = gameState.data.effectiveness;
  return effectivenessToMultiplier(eff);
}

// --- Helpers ---

/** Check if a capability is unlocked in any track. */
function isCapUnlocked(capId) {
  for (const track of Object.values(gameState.tracks)) {
    if (track.unlockedCapabilities?.includes(capId)) return true;
  }
  return false;
}

// Capabilities sorted by threshold — built once at import, used for next-milestone lookups.
// Dynamically reads from capabilitiesTrack so no hand-maintained list can drift out of sync.
const _capsByThreshold = [...capabilitiesTrack.capabilities].sort((a, b) => a.threshold - b.threshold);

function getNextTierName(capRP) {
  const scale = BALANCE.RP_THRESHOLD_SCALE || 1;
  for (const cap of _capsByThreshold) {
    if (cap.threshold * scale > capRP) return cap.id;
  }
  return 'max tier';
}

/**
 * Get the data requirement for the next capabilities milestone.
 * Returns { name, capRP, dataRequired } or null if at max tier.
 */
export function getNextTierInfo(capRP) {
  const scale = BALANCE.RP_THRESHOLD_SCALE || 1;
  for (const cap of _capsByThreshold) {
    const scaledThreshold = cap.threshold * scale;
    if (scaledThreshold > capRP) {
      return {
        name: cap.id,
        capRP: scaledThreshold,
        dataRequired: interpolateTierRequirement(scaledThreshold),
      };
    }
  }
  return null;
}

function triggerCollapseNews() {
  // Initialize collapse tracking
  if (!gameState.data.collapseCount) gameState.data.collapseCount = 0;
  gameState.data.collapseCount++;
  if (gameState.lifetime) gameState.lifetime.dataCollapses = (gameState.lifetime.dataCollapses || 0) + 1;

  const count = gameState.data.collapseCount;
  const quality = gameState.data.quality;
  const qualityPct = (quality * 100).toFixed(0);
  const pauseDuration = BALANCE.DATA_COLLAPSE_PAUSE_DURATION;

  if (count === 1) {
    // First collapse: ACTION message from CTO
    addActionMessage(
      senders.babbage,
      'Model collapse detected — immediate action needed',
      `We have a serious problem. Our models just produced degenerate output in production — garbled text, hallucinated patterns, complete nonsense. I've already rolled back the deployment.

**What happened:** We've been training on too much synthetic data. The models are learning from their own mistakes, amplifying errors with each generation. Data quality is at ${qualityPct}% and falling.

**The impact:** Capabilities research is paused for ${pauseDuration} days while we audit the data pipeline. This will keep happening — and get worse — unless we fix the underlying problem.

**Your call on next steps.**`,
      '— Dennis',
      [
        { id: 'evaluate', label: "I'll evaluate our options", effects: 'Navigate to data tab' },
        { id: 'cleanup', label: 'Temporarily pause research to clean up data', effects: `Pause all research ${pauseDuration} days, purge 50% synthetic data, furlough generators` },
      ],
      'normal',
      ['data', 'crisis'],
      'model_collapse'
    );
  } else {
    // Subsequent collapses: incident-style toast notification
    const toastMessages = [
      `Model collapse — capabilities research paused ${pauseDuration} days. Quality: ${qualityPct}%.`,
      `Another collapse — synthetic contamination spreading. Research paused ${pauseDuration} days.`,
      `Recurring collapse — data pipeline critically unstable. Quality: ${qualityPct}%.`,
    ];
    const msgIndex = Math.min(count - 2, toastMessages.length - 1);
    const hint = count <= 3
      ? ' Reduce synthetic generators or invest in real data.'
      : '';

    notify(
      'DATA COLLAPSE',
      toastMessages[msgIndex] + hint,
      'warning'
    );

    // Also add to news feed for the record
    addNewsMessage(
      `Model collapse #${count} — capabilities research paused ${pauseDuration}s. Data quality: ${qualityPct}%.`,
      ['data', 'negative']
    );
  }
}

/**
 * Handle the "cleanup" choice from the first model collapse ACTION message.
 * Pauses ALL research for 30s, purges 50% of synthetic data, furloughs all generators.
 */
export function handleCollapseCleanup() {
  const pauseDuration = BALANCE.DATA_COLLAPSE_PAUSE_DURATION;

  // 1. Pause all research (not just capabilities) via gameState
  gameState.data.dataCleanupPauseEnd = gameState.timeElapsed + pauseDuration;

  // 2. Purge 50% of synthetic data score
  gameState.data.syntheticScore = (gameState.data.syntheticScore || 0) * 0.5;

  // 3. Furlough all synthetic generators
  const genState = getPurchasableState('synthetic_generator');
  if (genState.count > 0) {
    genState.furloughed = genState.count;
  }

  addNewsMessage(
    'Emergency data cleanup initiated — all research paused, synthetic generators offline.',
    ['data', 'internal']
  );
}

/** Returns true if all research is paused due to data cleanup. */
export function isDataCleanupActive() {
  return gameState.data.dataCleanupPauseEnd > 0
    && gameState.timeElapsed < gameState.data.dataCleanupPauseEnd;
}

/**
 * Route model_collapse ACTION message choices.
 * Called from messages-panel.js handleChoice().
 */
export function handleModelCollapseChoice(choiceId) {
  if (choiceId === 'cleanup') {
    handleCollapseCleanup();
  } else {
    // 'evaluate' — navigate to data tab
    import('./ui/tab-navigation.js').then(({ switchTab }) => {
      switchTab('data');
    }).catch(() => {});
  }
}

function triggerDataWallEvent() {
  if (!gameState.triggeredEvents.includes('data_wall')) {
    gameState.triggeredEvents.push('data_wall');
  }
  import('./narrative-modal.js').then(({ showNarrativeModal }) => {
    showNarrativeModal({
      title: 'The Data Wall',
      narrative: `<p>Your models have learned everything they can from your current data. Researchers report diminishing returns — the same training runs produce smaller and smaller improvements.</p>
<p>To push further, you'll need higher-quality data sources. The internet got you this far, but frontier AI needs curated, specialized, and eventually synthetic data.</p>`,
      buttonText: 'Seek Better Data',
    });
  }).catch(() => {});
  if (typeof window !== 'undefined' && window.addNewsItem) {
    window.addNewsItem('RESEARCH: Diminishing returns detected — models outpacing available data quality.', 'warning');
  }
}

function triggerDataExhaustionNews() {
  if (typeof window !== 'undefined' && window.addNewsItem) {
    window.addNewsItem("Your AI's appetite for data exceeds human output. The era of training on human knowledge is ending.", 'warning');
  }
}
