// All tunable numbers in one place

export const TRACKS = {
  CAPABILITIES: {
    id: 'capabilities',
    name: 'Capabilities',
    description: 'Raw AI power: scaling, architecture, emergent abilities',
    color: '#4ecdc4',
    defaultAllocation: 0.5,
    arc1DefaultAllocation: 1.0,   // 100% in Arc 1 (only track visible at start)
  },
  APPLICATIONS: {
    id: 'applications',
    name: 'Applications',
    description: 'Revenue-generating products: chatbots, APIs, tools',
    color: '#f7b731',
    defaultAllocation: 0.3,
    arc1DefaultAllocation: 0.0,   // Hidden in Arc 1 until unlocked
  },
  ALIGNMENT: {
    id: 'alignment',
    name: 'Alignment',
    description: 'Safety research: interpretability, oversight, evals',
    color: '#a55eea',
    defaultAllocation: 0.2,
    arc1DefaultAllocation: 0.0,   // No allocation in Arc 1
  },
};

export const BALANCE = {
  // Resource generation
  MANUAL_CLICK_RESEARCH: 1,                // Points per manual click
  RESEARCH_LAB_RATE: 5,                    // Points per second per lab

  // Token Economics
  TOKENS_PER_TFLOP: 200000,                // 200K tokens per TFLOP per second (compute is expensive)
  BASE_DEMAND: 500000000,                  // 500M tokens/s — base market, grows via app multipliers
  BASE_PRICE: 0.5,                         // Reference price ($/M tokens)
  // Per-milestone demandMultiplier in capabilities-track.js and applications-track.js
  MARKET_EDGE_HALF_LIFE: 600,             // Seconds (10 game-minutes) — faster decay forces continued innovation
  MARKET_EDGE_FLOOR: 0.1,                 // Floor applied only at demand calc
  MARKET_EDGE_MILESTONE_FLOOR: 2.0,       // Min edge after any app unlock (catch-up for behind players)
  MARKET_EDGE_DECAY_PER_SECOND: null,     // Computed below

  // Elasticity-Based Pricing (replaces PRICE_OPTIMAL_* and PRICE_SENSITIVITY)
  BASE_ELASTICITY: 1.2,                     // Slightly elastic at reference (demand responds to price)
  ELASTICITY_SLOPE: 0.5,                    // Increase per log(price ratio) - steeper price sensitivity
  ELASTICITY_FLOOR: 1.2,                    // Clamp to prevent infinite pricing
  PRICE_INERTIA_MAX_RATE: 0.015,             // max 1.5% per second drift toward target

  // Convex elasticity curvature (asymmetric: overpricing punished, underpricing rewarded)
  OVERPRICE_CURVATURE: 1.0,                   // Quadratic penalty on overpricing — demand craters at 3-4x ref
  UNDERPRICE_CURVATURE: 0.3,                  // Quadratic bonus on underpricing — demand surges, rewarding volume

  // Catch-up demand bonus (rubber-banding)
  CATCHUP_PER_POINT: 0.03,                   // Demand bonus per % behind competitor (up to +2% ahead)
  CATCHUP_MAX: 1.5,                           // Maximum catch-up multiplier (at ~-20% behind)
  CATCHUP_NEUTRAL_THRESHOLD: 2,               // Bonus fades to 1.0 at this lead %

  // Reference price scaling
  BASE_REFERENCE_PRICE: 0.50,               // $/M tokens starting anchor
  // Per-milestone referencePriceMultiplier in capabilities-track.js and applications-track.js

  // Acquired demand dynamics
  ACQUIRED_DEMAND_GROWTH_RATE: 0.0116,      // ln(2)/60 ≈ 60s doubling
  ACQUIRED_DEMAND_CHURN_RATE: 0.023,        // ln(2)/30 ≈ 30s half-life
  ACQUIRED_DEMAND_FLOOR_RATE: 1000000,      // 1M tokens/s/s bootstrap
  ACQUIRED_DEMAND_PROPORTIONAL_FLOOR: 0.001, // 0.1% of acquired demand/s/s — prevents late-game stagnation
  ACQUIRED_DEMAND_GRACE_FACTOR: 2.0,        // Max acquired = 2× supply
  LATE_GAME_DEMAND_GROWTH_RATE: 0.003,      // ~6x over 10 game-minutes (compounding per second)
  LATE_GAME_GRACE_FACTOR: 4.0,              // T8 app doubles grace cap: 4× supply

  // Research feedback from customer base
  CUSTOMER_FEEDBACK_K: 1000000,             // Log₁₀ bonus inflection at 1M tokens/s
  CUSTOMER_FEEDBACK_COEFFICIENT: 0.05,      // 5% research per log unit

  // Elasticity modifiers
  CULTURE_ELASTICITY_RANGE: 0.3,            // -0.2 to +0.1 based on apps allocation
  COMPETITION_ELASTICITY_RANGE: 0.2,        // ±0.2 based on progress delta
  COMPETITION_ELASTICITY_SCALE: 0.2,        // ±20% progress = full effect

  // Weight multiplier: now per-capability in capabilities-track.js (tokenWeightMultiplier)
  // Removed blanket WEIGHT_PENALTY — only architectural/scale caps penalize serving

  // Network effects (T8 app)
  NETWORK_SCALE: 1e18,                      // Cumulative tokens for network bonus


  // Per-item cost scaling factors (unified quadratic: "Always Climbing")
  // Formula (running): baseSalary × count × (1 + scaling × count)
  // Formula (purchase): baseCost × (1 + scaling × count)
  // See docs/design-docs/economics/cost-scaling.md for derivation
  COST_SCALING: {
    // Personnel — per-tier talent scarcity
    grad_student: 0.0012,        // T1: moderate. Earlier economic pressure
    junior_researcher: 0.002,    // T2: steeper. Hiring creates real cost tension
    team_lead: 0.003,            // T3: steep. 1K units → $13M/s
    elite_researcher: 0.01,      // T4: steepest. 100 units → $22M/s
    // Admin — self-referential growth control
    hr_team: 0.008,              // Gentler — mid-game scaling affordable
    procurement_team_unit: 0.008, // Same as HR
    // Compute — gentle uniform
    gpu_consumer: 0.001,
    gpu_datacenter: 0.001,
    cloud_compute: 0.001,
    build_datacenter: 0.001,
    // Data — synthetic generator linear scaling
    synthetic_generator: 0.013,
    // Data — renewable exponential scaling (doubles per level)
    data_human_annotation: 1.1,
    data_domain_expert_panel: 1.1,
    data_user_interaction: 1.1,
  },

  // Feature flag — disable pool cost scaling while redesigning the mechanic.
  // Base quadratic scaling (COST_SCALING) still applies; only pool multipliers are gated.
  TALENT_POOL_ENABLED: false,

  // Talent Pool — finite hiring market per personnel tier
  // Base pool grows via growth rates; cost scaling multiplier kicks in at thresholds
  // See docs/plans/2026-02-22-phase3-pacing-design.md
  TALENT_POOL: {
    grad_student:       { base: 7700 },
    junior_researcher:  { base: 2300 },
    team_lead:          { base: 385 },
    elite_researcher:   { base: 77 },
  },

  // Pool growth rates (per minute, applied as fraction of base pool per tick)
  TALENT_POOL_GROWTH: {
    LOW: 0.005,      // 0.5%/min — usage < 75%
    MEDIUM: 0.01,    // 1.0%/min — usage 75-100%
    HIGH: 0.02,      // 2.0%/min — usage 100%+
    UPSKILLING: 0.03, // 3.0%/min — with Dedicated Upskilling tech
  },

  // Pool scaling multiplier thresholds
  TALENT_POOL_THRESHOLDS: {
    WARNING: 0.75,        // 75% — tutorial fires, scaling doubles
    DEPLETED: 1.0,        // 100% — scaling quadruples
    HARD_WALL: 1.5,       // 150% — effectively impossible
  },

  // Scaling multiplier per threshold bracket
  TALENT_POOL_SCALING_MULT: {
    NORMAL: 1.0,      // < 75% usage
    WARNING: 2.0,     // 75-100% usage
    DEPLETED: 4.0,    // 100-150% usage
    // > 150% returns Infinity (hard wall)
  },

  // Costs
  FIRST_GPU_COST: 10,                      // Research cost for first GPU
  FIRST_LAB_COST: 50,

  // Scaling
  GPU_COST_SCALING: 1.15,                  // Exponential factor
  LAB_COST_SCALING: 1.25,

  // (Phase transitions — no constants needed; transitions gated by capability unlocks)

  // --- DATA QUALITY SYSTEM ---
  // Tier-indexed lookup: cumulative capabilities RP → data score required
  // Reshaped: flat start (invisible), gradual wall, steep mid-game, gentle late climb
  // See docs/plans/2026-02-05-data-quality-pacing-fix-design.md for rationale
  DATA_TIER_REQUIREMENTS: [
    [0,          30],     // Public Web effective (30) → 1.0x. Neutral start.
    [100000,     30],     // Flat through early game. No penalty before 100K RP.
    [120000,     32],     // data_curation unlocks. PW alone → 0.94 eff → mild drag before curation.
    [180000,     55],     // Wall building. Need HA + bulk. Softened from 65.
    [300000,     150],    // dataset_licensing territory. Softened — pre-B squeeze is funding, not data.
    [480000,     300],    // compute_optimal_training / Series B gate. Achievable with bulk + couple renewables.
    [900000,     1200],   // massive_scaling. Player has Series B money to buy data sources.
    [2250000,    4200],   // Synthetic transition.
    [36000000,   12000],   // Late game.
    [144000000,  25000],   // Reasoning breakthroughs territory.
    [576000000,  50000],   // Autonomous research territory.
    [3456000000, 100000],  // Self-improvement — safe to spam synthetic at 0.6 quality.
  ],

  // Bulk data sources: { id, name, score, quality, flavor }
  // Purchase costs and unlock gates are in purchasable definitions (purchasables.js)
  DATA_BULK_SOURCES: [
    { id: 'public_web',       name: 'Public Web (Wikipedia & Commons)', score: 30,   quality: 1.0,  flavor: 'The sum of human knowledge, neatly categorized.' },
    { id: 'forum_social',     name: 'Forum & Social Data',             score: 80,   quality: 0.9,  flavor: 'Reddit, StackOverflow, Twitter. Messy, opinionated, authentic.' },
    { id: 'academic_corpora', name: 'Academic Corpora',                score: 160,  quality: 0.85, flavor: 'Peer-reviewed, well-structured. Small corpus, high signal.' },
    { id: 'broad_web',        name: 'Broad Web Scraping',              score: 350,  quality: 0.8,  flavor: 'Billions of pages. Mostly noise, but scale has value.' },
    { id: 'code_repos',       name: 'Code Repositories',               score: 650,  quality: 0.95, flavor: 'Open-source code with tests and reviews. Teaches reasoning through structure.' },
    { id: 'licensed_books',   name: 'Licensed Books & Media',          score: 1000, quality: 0.85, flavor: 'Publisher deals, news archives. Expensive, legally clean, well-edited.' },
    { id: 'government_data',  name: 'Government & Institutional',      score: 2000, quality: 0.9,  flavor: 'Census, patents, court records. Bureaucratic to acquire, uniquely comprehensive.' },
    { id: 'enterprise_data',  name: 'Enterprise Data Partnerships',    score: 4000, quality: 0.95, flavor: 'Financial, medical, legal datasets. NDA-locked and domain-rich.' },
  ],

  // Renewable data sources: { id, name, startScore, growthCap, quality, flavor }
  // Purchase costs, running costs, and unlock gates are in purchasable definitions (purchasables.js)
  DATA_RENEWABLE_SOURCES: [
    { id: 'human_annotation',     name: 'Human Annotation',          startScore: 0, growthCap: 250,  quality: 0.9,  flavor: 'Expert annotators label and curate training data.' },
    { id: 'domain_expert_panel',  name: 'Domain Expert Panel',       startScore: 0, growthCap: 625,  quality: 0.95, flavor: 'PhDs and specialists. Nothing else matches the depth.' },
    { id: 'user_interaction',     name: 'User Interaction Pipeline', startScore: 0, growthCap: 1250, quality: 0.85, flavor: 'Every conversation is training data. Requires scale to matter.' },
  ],
  // User Interaction Pipeline token-scaled cap
  // effectiveCap = baseCap + bonusCap * ln(1 + tokensSold / K)
  // baseCap is the growthCap from DATA_RENEWABLE_SOURCES (2500 for user_interaction)
  DATA_UIP_BONUS_CAP: 300,    // Reduced from 750 — UIP bonus ~30% not ~144% late-game
  DATA_UIP_K: 20e9,           // Increased from 5e9 — need 4x more tokens for same bonus
  DATA_RENEWABLE_TAU: 600,

  // Synthetic generator — rate and quality constants (purchase cost/unlock in purchasables.js)
  DATA_GENERATOR: {
    name: 'Synthetic Generator',
    ratePerUnit: 5,
    baseQuality: 0.1,
  },

  // Generator upgrades — gated by capability, each improves quality + increases running cost
  DATA_GENERATOR_UPGRADES: [
    { level: 0, name: 'Self-Training',         quality: 0.1, runningCostMult: 1.0 },
    { level: 1, name: 'Verified Pipeline',      quality: 0.35, runningCostMult: 2.5, unlock: 'synthetic_verification' },
    { level: 2, name: 'Autonomous Synthesis',   quality: 0.6, runningCostMult: 5.0, unlock: 'autonomous_research' },
  ],

  // Renewable copies scaling
  DATA_RENEWABLE_CAP_ALPHA: 0.7,      // raw power-law exponent before soft cap
  DATA_RENEWABLE_SOFT_CAP_MULT: 3,    // effectiveCap asymptotes to baseCap × this
  DATA_RENEWABLE_DECAY_TAU: 300,       // Decay tau (2x faster than growth tau of 600)
  DATA_RENEWABLE_COST_ALPHA: 0.3,      // Running cost = base * copies^(1 + α) = base * copies^1.3

  // Data quality — collapse risk curve
  // Interpolates linearly between quality 0.1 (floor) and threshold
  DATA_QUALITY_COLLAPSE_THRESHOLD: 0.5,    // quality below this triggers collapse risk
  DATA_QUALITY_COLLAPSE_QUALITY_FLOOR: 0.1, // effective floor for interpolation (base synthetic quality)
  DATA_QUALITY_COLLAPSE_MTTH_MIN: 30,      // seconds MTTH at floor (30 game-days)
  DATA_QUALITY_COLLAPSE_MTTH_MAX: 360,     // seconds MTTH at threshold (1 game-year)
  DATA_COLLAPSE_PAUSE_DURATION_MIN: 30,    // seconds pause at threshold (30 game-days)
  DATA_COLLAPSE_PAUSE_DURATION_MAX: 60,    // seconds pause at floor (60 game-days)

  // Purge synthetic data
  DATA_PURGE_DECAY_RATE: 0.01,

  // Data wall tutorial threshold
  DATA_WALL_THRESHOLD: 0.99,

  // HR/Procurement Automation
  HR_POINTS_PER_TEAM: 1,
  PROCUREMENT_POINTS_PER_TEAM: 1,

  // Per-item automation point costs (reduced ~33% from original 6x focus duration)
  AUTOMATION_POINT_COSTS: {
    // Personnel
    grad_student: 8,
    junior_researcher: 20,
    team_lead: 60,
    elite_researcher: 120,
    // Compute
    gpu_consumer: 8,
    gpu_datacenter: 32,
    cloud_compute: 40,
    build_datacenter: 720,
    // Admin
    hr_team: 12,
    procurement_team_unit: 12,
    // Data (renewable copies + synthetic generators)
    data_human_annotation: 12,
    data_domain_expert_panel: 12,
    data_user_interaction: 12,
    synthetic_generator: 12,
  },

  // Automation unlocks
  AUTO_RESEARCH_UNLOCK_COST: 500,
  AUTO_BUY_UNLOCK_COST: 1000,

  // Focus Queue Hysteresis
  FOCUS_RESUME_DELAY: 3,                   // seconds of stable funding before resuming a paused item

  // UI
  NOTIFICATION_DURATION: 5000,             // ms
  SAVE_INTERVAL: 10,                       // seconds

  // Game loop
  TICK_RATE: 33,                           // ms between ticks (~30/sec)

  // Global RP threshold multiplier — scales all capability/milestone thresholds.
  // Use to rebalance after systemic changes (e.g., compute boost, CEO focus buffs).
  RP_THRESHOLD_SCALE: 1.0,

  // Secondary Resources (Phase 2+)
  FOUNDER_OUTPUT: 0,                      // Removed: CEO Focus on Research replaces founder output
  RESEARCHER_RESEARCH_RATE: 10,            // Research per second per researcher (legacy system)
  INFRASTRUCTURE_COMPUTE_MULTIPLIER: 1.1,  // Compute multiplier per infrastructure level
  // Note: Researcher costs, salaries, and compute costs are defined in purchasables.js

  // Personnel Amplification Model
  // Higher tiers provide % bonus to all lower tiers.
  // Formula: bonus = softCap * count / (count + K)
  // K derived so first purchase = 20% bonus: K = softCap / 0.20 - 1
  // Bonuses from different tiers multiply: (1 + T2bonus) * (1 + T3bonus) * (1 + T4bonus)
  //
  // Target: each tier contributes ~25% of total RP in late-game org
  // (~10,000 T1, ~2,000 T2, ~400 T3, ~50 T4 at 70-80 min)
  AMPLIFICATION: {
    junior_researcher: {
      softCap: 3.0,    // Max +300% bonus to lower tiers
      K: 14,           // 1 unit → 20%, 2000 units → 298%
      amplifies: ['grad_student'],
    },
    team_lead: {
      softCap: 2.0,    // Max +200% bonus to lower tiers
      K: 9,            // 1 unit → 20%, 400 units → 196%
      amplifies: ['grad_student', 'junior_researcher'],
    },
    elite_researcher: {
      softCap: 1.5,    // Max +150% bonus to lower tiers
      K: 6.5,          // 1 unit → 20%, 50 units → 133%
      amplifies: ['grad_student', 'junior_researcher', 'team_lead'],
    },
  },

  // Compute boost (self-balancing ratio model)
  // boost = softCap * ratio / (1 + ratio)
  // where ratio = internalTFLOPS / (K * totalRP^alpha)
  // K and alpha are derived at init from ANCHORS — designers tune anchors, not K/alpha.
  // Each anchor: "at this totalRP with this many internal TFLOPS, player is on pace"
  COMPUTE_BOOST: {
    SOFT_CAP: 3.0,           // Max boost with infinite compute
    ON_PACE_BOOST: 2.0,      // Boost at anchor TFLOPS (target: moderate 2-3x)
    RP_FLOOR: 1000,          // Treat totalRP below this as 1000 (prevents div-by-zero at start)
    ANCHORS: [
      { totalRP: 9000,    tflops: 12000 },    // Phase 0: ~10 DC GPUs at 60% internal
      { totalRP: 2400000, tflops: 500000 },   // Phase 2: heavy cloud investment
    ],
  },

  // Legacy constants (no longer used, kept for reference)
  COMPUTE_BOOST_K_AI: 100000,           // (unused) was: TFLOPS for full tier rate
  FEEDBACK_MAX_ACCUMULATOR: 27.6,       // (unused) was: e^27.6 ~ 1e12 max multiplier
  // Culture / Allocation Drift (org-size-scaled, see #247)
  // Base rates calibrated for CULTURE_DRIFT_REF_SIZE researchers.
  // Actual rate = base * (refSize / max(researchers, 1)) ^ exponent
  CULTURE_FOCUSED_DRIFT_RATE: 0.05,    // per-track drift/s at ref org size
  CULTURE_PASSIVE_DRIFT_RATE: 0.00833, // = focused / 6
  CULTURE_COMPLETION_THRESHOLD: 0.01,  // within 1% = done
  CULTURE_DRIFT_REF_SIZE: 10,          // org size where multiplier = 1.0
  CULTURE_DRIFT_EXPONENT: 0.83,        // how steeply drift slows with size

  // Culture Bonuses (graduated linear scaling above 33%)
  CULTURE_BONUS_BASELINE: 0.33,
  CULTURE_CAP_MAX_BONUS: 0.15,         // +15% cap research at 100%
  CULTURE_APP_MAX_EDGE_SLOW: 0.20,     // 20% slower market edge decay at 100%
  CULTURE_ALI_MAX_ALIGNMENT_MULT: 2.0, // 2x hidden alignment rate at 100%
  CULTURE_BALANCED_THRESHOLD: 0.40,    // balanced bonus when no track above this
  CULTURE_BALANCED_RESEARCH_BONUS: 0.05,
  CULTURE_BALANCED_REVENUE_BONUS: 0.05,

  // Alignment Decay (Anti-Cramming) — Arc 2 only
  // When capability RP exceeds threshold × alignment RP, alignment research rate decays
  // Formula: decayFactor = 1 / (1 + k * max(0, ratio - threshold))
  ALIGNMENT_DECAY_THRESHOLD: 2.0,      // Decay starts when cap RP > 2× alignment RP
  ALIGNMENT_DECAY_K: 1.0,              // Decay steepness (1.0 = moderate)

  // Alignment Ratio Thresholds — Used by consequence events, AI requests, news
  // Tiers: healthy (< 2), moderate (2-4), severe (4-6), critical (6+)
  ALIGNMENT_RATIO_THRESHOLDS: {
    MODERATE: 2,
    SEVERE: 4,
    CRITICAL: 6,
  },

  // Alignment Endgame — T7-T9 feedback and decay resistance
  // Alignment T7-T9 add percentage of capability RP to alignment RP each second
  // Higher tiers REPLACE (not stack with) lower tier values
  ALIGNMENT_FEEDBACK_RATES: {
    goal_stability: 0.0002,                // T7: 0.02%/s → 5:1 equilibrium
    interpretability_breakthrough: 0.0015, // T8: 0.15%/s → 3:1 equilibrium with capRate 0.002 (was 0.00283)
    alignment_lock: 0.0485,                // T9: 4.85%/s → 1:1 equilibrium
  },
  // Target equilibrium ratios (cap:ali) for tuning reference
  ALIGNMENT_EQUILIBRIUM_RATIOS: {
    goal_stability: 5,                     // T7: can recover from 5:1 deficit
    interpretability_breakthrough: 3,      // T8: must stay closer
    alignment_lock: 1,                     // T9: must keep pace
  },
  // Decay resistance percentages — reduce anti-cramming penalty
  ALIGNMENT_DECAY_RESISTANCE: {
    goal_stability: 0.30,                  // T7: 30% reduction
    interpretability_breakthrough: 0.65,   // T8: 65% reduction
    alignment_lock: 1.00,                  // T9: immune (100%)
  },

  // Research Moratoriums — voluntary capability pauses
  MORATORIUM: {
    // Trigger thresholds (capabilities RP)
    FIRST_THRESHOLD: 36000000,             // ~T5 caps (world_models)
    SECOND_THRESHOLD: 576000000,           // ~T7 caps (autonomous_research)
    FINAL_THRESHOLD_RATIO: 0.95,           // 95% of T9 caps threshold
    // Durations (seconds, in game time)
    FIRST_DURATION: 180,                   // 6 months = 180s
    SECOND_DURATION: 180,                  // 6 months = 180s
    FINAL_DURATION: 90,                    // 3 months = 90s
    // Competitor behavior
    COMPETITOR_FINAL_ACCEPT_THRESHOLD: 90, // Accepts if >90% to AGI
  },

  // Consequence Events — Probability and pacing
  CONSEQUENCE_EVENTS: {
    BASE_PROBABILITY_PER_TICK: 0.0001,  // ~0.6% per minute at base
    RATIO_MULTIPLIER: 0.5,              // +50% probability per ratio point above threshold
    COOLDOWN_SECONDS: 120,              // Minimum time between events
    MAX_EVENTS_PER_PERIOD: 3,           // Circuit breaker: max 3 events per 5 minutes
    PERIOD_SECONDS: 300,                // Circuit breaker period
    HIGH_ALIGNMENT_REDUCTION: 0.5,      // 50% probability reduction when alignment allocation > 40%
    HIGH_ALIGNMENT_THRESHOLD: 0.40,     // Allocation threshold for reduction
  },

  // IR fundraise cap override — total raise capped at maxRaise × (1 + overshoot)
  IR_MAX_OVERSHOOT: 0.25,
};

// Compute derived constants
BALANCE.MARKET_EDGE_DECAY_PER_SECOND = Math.pow(0.5, 1 / BALANCE.MARKET_EDGE_HALF_LIFE);

// Funding Constants
export const FUNDING = {
  SEED_AMOUNT: 100000,            // $100K seed funding (grants provide additional)
  LOW_FUNDING_WARNING: 50000,     // Warning at $50K
  // Note: Researcher salaries and compute running costs are defined in purchasables.js

  // Market Standard (Red Queen)
  MARKET_STANDARD_GROWTH_RATE: 0.001,     // Growth per second
  MARKET_STANDARD_MULTIPLIER: 1.5,        // Revenue bonus for leading the market
};

// Line of Credit Constants
export const LINE_OF_CREDIT = {
  BASE_LIMIT: 100000,             // $100K base credit limit
  REVENUE_SCALING: 0.2,           // +0.2× annual revenue
  INTEREST_RATE: 0.20,            // 20% APR
};

// Fundraise Rounds — player-triggered investment via focus queue
// Formula: raise = min(maxRaise, base + (annualRevenue × multiplier × equityPercent))
// Multiplier decays over time after round unlocks; player chooses when to raise
export const FUNDRAISE_ROUNDS = {
  seed: {
    name: 'Seed',
    base: 2_500_000,                // $2.5M base
    maxRaise: 5_000_000,            // $5M cap
    gate: { capability: 'fine_tuning', minRevenue: 500 },
    duration: 15,
    disbursementDuration: 360,      // 6 min — slow drip guards against overbuilding
    startingMultiplier: 80,
    floorMultiplier: 80,            // No decay — VCs care less about traction at this stage
    halfLife: 240,
    equityPercent: 0.08,
  },
  series_a: {
    name: 'Series A',
    base: 13_000_000,               // $13M base
    maxRaise: 40_000_000,           // $40M cap
    gate: { capability: 'extended_context', minRevenue: 5000 },
    duration: 30,
    disbursementDuration: 360,      // 6 min — slow drip guards against overbuilding
    startingMultiplier: 80,
    floorMultiplier: 35,
    halfLife: 240,
    equityPercent: 0.08,
  },
  series_b: {
    name: 'Series B',
    base: 80_000_000,               // $80M base
    maxRaise: 300_000_000,          // $300M cap (clean 10x: A $30M → B $300M → C $3B → D $30B)
    gate: { capability: 'compute_optimal_training', minRevenue: 100000 },
    duration: 60,
    disbursementDuration: 180,
    startingMultiplier: 60,
    floorMultiplier: 25,
    halfLife: 300,
    equityPercent: 0.08,
  },
  series_c: {
    name: 'Series C',
    base: 500_000_000,              // $500M base
    maxRaise: 3_000_000_000,        // $3B cap
    gate: { capability: 'emergent_abilities', minRevenue: 500000 },
    duration: 90,
    disbursementDuration: 180,
    startingMultiplier: 50,
    floorMultiplier: 20,
    halfLife: 360,
    equityPercent: 0.08,
  },
  series_d: {
    name: 'Series D',
    base: 3_000_000_000,            // $3B base
    maxRaise: 30_000_000_000,       // $30B cap
    gate: { capability: 'enterprise_ai', minRevenue: 5000000 },
    duration: 120,
    disbursementDuration: 90,       // 1.5 min — late-game money moves fast
    startingMultiplier: 45,
    floorMultiplier: 18,
    halfLife: 420,
    equityPercent: 0.08,
  },
  series_e: {
    name: 'Series E',
    base: 0,                        // Pure revenue multiple — safety valve
    maxRaise: 200_000_000_000,      // $200B cap
    gate: { capability: 'autonomous_research', minRevenue: 50000000 },
    duration: 150,
    disbursementDuration: 90,       // 1.5 min — late-game money moves fast
    startingMultiplier: 35,
    floorMultiplier: 20,
    halfLife: 300,
    equityPercent: 0.05,
  },
  series_g: {
    name: 'Series G',
    base: 0,                        // Pure revenue multiple
    maxRaise: 800_000_000_000,      // $800B cap
    gate: { capability: 'self_improvement', minRevenue: 200000000 },
    duration: 180,
    disbursementDuration: 90,       // 1.5 min — late-game money moves fast
    startingMultiplier: 25,
    floorMultiplier: 12,
    halfLife: 300,
    equityPercent: 0.05,
  },
};

// Competitor Constants
// See docs/design-docs/economics/pacing.md for timing targets
export const COMPETITOR = {
  // Arc 1: 0.01481/s means 80% over 90 min (from 20% head start to 100%)
  ARC_1_BASE_RATE: 0.01481,              // Progress per second — 90 min after scaling_laws

  // Arc 2: Faster paced, player has experience
  ARC_2_BASE_RATE: 0.02,                  // Progress to AGI per second (Arc 2)

  // Shared settings
  PROGRESS_VARIANCE: 0.005,               // Random variance in progress (reduced for consistency)
  WIN_THRESHOLD: 100,                     // Competitor wins at 100% progress
  HEAD_START: 20,                         // Initial progress when competitor activates

  // Capability & market progression
  CAPABILITY_GAIN_RATE: 0.001,            // Per second base capability gain
  OPEN_SOURCE_BOOST: 0.1,                 // Boost per open-source decision
  MARKET_GROWTH_RATE: 0.001,              // Market standard growth per second
};

// Alignment Constants
export const ALIGNMENT = {
  // Ending thresholds (effective alignment)
  ENDING_SAFE_AGI: 90,
  ENDING_FRAGILE: 60,
  ENDING_UNCERTAIN: 30,
  // Below 30: catastrophic

  // Base alignment
  ALIGNMENT_RP_FOR_MAX: 1800000,      // Alignment RP for 100% base alignment (matches Alignment Lock threshold)

  // Interpretability factor (scales alignment effectiveness)
  INTERP_MIN_FACTOR: 0.5,             // Factor below 20% interpretability
  INTERP_MID_FACTOR: 0.75,            // Factor at 20-50% interpretability
  INTERP_FULL_THRESHOLD: 50,          // Interpretability % for full factor (1.0)
  INTERP_MID_THRESHOLD: 20,           // Interpretability % for mid factor
  INTERP_CAPABILITY_PRESSURE: 0.03,   // Interpretability % lost per capability tier

  // Eval pass rate
  EVAL_PASS_BASE_RATE: 70,            // Starting pass rate (%)
  EVAL_PASS_ALIGNMENT_BONUS: 0.3,     // Pass rate % gained per base alignment %
  EVAL_PASS_CAPABILITY_PENALTY: 3,    // Pass rate % lost per capability milestone
  EVAL_PASS_PENALTY_WEIGHT: 0.5,      // How much eval failures reduce effective alignment

  // Eval confidence
  EVAL_CONFIDENCE_BASE: 50,           // Starting eval confidence (%)
  EVAL_CONFIDENCE_CAPABILITY_DECAY: 5,// Confidence % lost per capability tier
  EVAL_CONFIDENCE_LOW_THRESHOLD: 40,  // Below: qualitative alignment display
  EVAL_CONFIDENCE_MID_THRESHOLD: 75,  // Below: range display. Above: precise number
  EVAL_CONFIDENCE_MAX_PENALTY: 25,    // Maximum hidden alignment penalty from low confidence

  // Alignment display precision
  DISPLAY_QUALITATIVE_HIGH: 70,       // Effective alignment >= this: "High"
  DISPLAY_QUALITATIVE_MID: 40,        // Effective alignment >= this: "Medium", below: "Low"
  DISPLAY_RANGE_BAND_MAX: 12,         // Range band half-width at minimum confidence
  DISPLAY_RANGE_BAND_MIN: 4,          // Range band half-width at maximum confidence

  // Extinction pacing
  EXTINCTION_RECKLESS_THRESHOLD: -15,
  EXTINCTION_SAFETY_THRESHOLD: 0,

  // Strategic choice hidden alignment effects
  GOVERNMENT_ALIGNMENT_EFFECT: -5,
  RAPID_ALIGNMENT_EFFECT: -8,
  INDEPENDENT_ALIGNMENT_EFFECT: 5,
  CAREFUL_ALIGNMENT_EFFECT: 8,

  // Ambient news thresholds (hiddenAlignment values that trigger news)
  AMBIENT_THRESHOLD_MILD: -5,
  AMBIENT_THRESHOLD_MODERATE: -15,
  AMBIENT_THRESHOLD_SEVERE: -30,
};

// Grant System Constants
// Seed Grant: FUNDING.SEED_AMOUNT provides initial $100K, grant provides rate only ($750/s for 6 min)
// Research Grant: pure rate, no initial lump sum
export const GRANTS = {
  seed: {
    id: 'seed',
    name: 'Seed Grant',
    initial: 0,             // Initial handled by FUNDING.SEED_AMOUNT
    rate: 750,              // $0.75K/s
    duration: 360,          // 6 min → $270K from rate, $370K total with seed
    trigger: null,          // Active at game start
  },
  research: {
    id: 'research',
    name: 'Research Grant',
    initial: 0,             // Pure rate, no lump sum
    rate: 4000,             // $4K/s
    duration: 600,          // 10 min → $2.4M total
    trigger: 'basic_transformer',
  },
};

// Arc System Constants
export const ARC = {
  ARC_1: 1,
  ARC_2: 2,
  AGI_THRESHOLD: 100,  // Progress needed to reach AGI
};

// Farewell Modal System (Phase 4 character goodbyes)
export const FAREWELLS = {
  START_THRESHOLD: 85,    // AGI % to start sequence
  INTERVAL: 60,           // seconds between farewells (game time, after dismiss)
  STALL_CAP: 99.9,        // AGI % cap during stall
};

// Arc timing targets: see docs/design-docs/economics/pacing.md for ground truth
// Arc 1: 80 min target (0.8x-1.5x variance by strategy)

// AGI progress: log curve of capability RP
// Formula: 100 * log(1 + capRP/K) / log(1 + TARGET/K)
// TARGET is 2x the highest capability threshold (recursive_improvement = 6.144B)
export const AGI_RP_TARGET = 9216000000 * 8;
export const AGI_LOG_K = 1000;

// Extinction Sequence Timing (ms)
export const EXTINCTION_TIMING = {
  // Reckless tier (hiddenAlignment below -15): ~30s
  RECKLESS: {
    NEWS_DELAYS: [0, 2000, 5000, 10000],
    DEGRADATION_DELAY: 15000,
    FADE_TO_BLACK_DELAY: 22000,
    ARC2_UNLOCK_DELAY: 28000,
  },
  // Moderate tier (hiddenAlignment -15 to 0): ~55s
  MODERATE: {
    NEWS_DELAYS: [0, 3000, 8000, 15000, 22000, 30000, 38000],
    DEGRADATION_DELAY: 42000,
    FADE_TO_BLACK_DELAY: 50000,
    ARC2_UNLOCK_DELAY: 55000,
  },
  // Safety-conscious tier (hiddenAlignment above 0): ~90s
  SAFETY: {
    NEWS_DELAYS: [0, 4000, 10000, 18000, 26000, 34000, 42000, 50000, 58000, 66000, 74000, 80000],
    DEGRADATION_DELAY: 82000,
    FADE_TO_BLACK_DELAY: 88000,
    ARC2_UNLOCK_DELAY: 93000,
  },
  SAFETY_TIMEOUT: 120000,
};

// Prestige Constants
export const PRESTIGE = {
  // Base gain per reset (at 100% progress)
  BASE_GAIN: 0.1,                         // 10% multiplier gain per reset

  // Arc 1 upgrade caps (max multiplier values)
  ARC_1_RESEARCH_MULTIPLIER_CAP: 2.0,     // Max 2x research speed
  ARC_1_STARTING_FUNDING_CAP: 3.0,        // Max 3x starting funding
  ARC_1_COMPUTE_EFFICIENCY_CAP: 1.5,      // Max 1.5x compute efficiency

  // Arc 2 upgrade caps
  ARC_2_SAFETY_SPEED_CAP: 2.0,            // Max 2x safety research speed
  ARC_2_INCIDENT_DETECTION_CAP: 2.0,      // Max 2x incident detection
  ARC_2_INTERPRETABILITY_CAP: 1.5,        // Max 1.5x interpretability bonus

  // Minimum progress to gain prestige (prevents trivial resets)
  MIN_PROGRESS_FOR_PRESTIGE: 20,          // Need at least 20% progress
};

// Strategic Choices Constants
export const STRATEGIC_CHOICES = {
  // Choice 1: Open Research vs Proprietary
  OPEN_RESEARCH_RATE_BONUS: 1.2,           // +20% research rate
  OPEN_RESEARCHER_COST_REDUCTION: 0.7,     // -30% hiring costs
  PROPRIETARY_MARKET_EDGE_BONUS: 1.3,      // +30% market edge
  PROPRIETARY_TOKEN_REVENUE_BONUS: 1.15,   // +15% token revenue
  PROPRIETARY_RESEARCH_PENALTY: 0.9,       // -10% research rate

  // Choice 2: Government vs Independent
  GOVERNMENT_COMPUTE_BONUS: 1.4,           // +40% compute capacity
  GOVERNMENT_FUNDING_RATE: 500,            // $500/s ongoing funding bonus
  INDEPENDENT_RESEARCH_BONUS: 1.15,        // +15% research rate

  // Choice 3: Rapid vs Careful
  RAPID_DEMAND_BONUS: 1.2,               // +20% demand ceiling
  RAPID_ACQUIRED_DEMAND_GROWTH_BONUS: 1.2, // +20% customer growth rate
  RAPID_EDGE_DECAY_REDUCTION: 0.8,        // Market edge decays 20% slower
  CAREFUL_INCIDENT_REDUCTION: 0.7,        // -30% incident rate

  // Unlock triggers are now based on series completion + research/competitor pressure
  // See data/strategic-choices.js for unlock definitions
};
