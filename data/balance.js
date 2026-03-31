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
  LATE_GAME_DEMAND_GROWTH_RATE: 0.001,      // ~2x over 10 game-minutes (compounding per second)
  LATE_GAME_GRACE_FACTOR: 3.0,              // T8 app: 3× supply (upgraded to 4× by T9 app)
  ENDGAME_DEMAND_GROWTH_BONUS: 0.002,       // T9 app adds +0.002 → total 0.003 (~6x over 10 min)
  ENDGAME_GRACE_FACTOR: 4.0,               // T9 app: 4× supply

  // Research feedback from customer base
  CUSTOMER_FEEDBACK_K: 1000000,             // Log₁₀ bonus inflection at 1M tokens/s
  CUSTOMER_FEEDBACK_COEFFICIENT: 0.05,      // 5% research per log unit

  // Elasticity modifiers
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

  // Feature flag — skip ending cinematic (verdict → vignette → mirror) and go straight
  // to the stats screen. For beta where the narrative scenes aren't ready yet.
  SKIP_ENDING_CINEMATIC: false,

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
    [864000000,  50000],   // Pre-autonomous-research territory.
    [10368000000, 150000],  // Self-improvement territory.
    [82944000000, 300000],  // Recursive improvement territory.
    [497664000000, 600000], // AGI emergence territory.
  ],

  // Bulk data sources: { id, name, score, quality }
  // Purchase costs and unlock gates are in purchasable definitions (purchasables.js)
  DATA_BULK_SOURCES: [
    { id: 'public_web',       name: 'Public Web (Wikipedia & Commons)', score: 30,   quality: 1.0  },
    { id: 'forum_social',     name: 'Forum & Social Data',             score: 80,   quality: 0.85 },
    { id: 'academic_corpora', name: 'Academic Corpora',                score: 160,  quality: 0.95 },
    { id: 'broad_web',        name: 'Broad Web Scraping',              score: 350,  quality: 0.8  },
    { id: 'code_repos',       name: 'Code Repositories',               score: 650,  quality: 0.95 },
    { id: 'licensed_books',   name: 'Licensed Books & Media',          score: 1000, quality: 0.9  },
    { id: 'government_data',  name: 'Government & Institutional',      score: 2000, quality: 0.9  },
    { id: 'enterprise_data',  name: 'Enterprise Data Partnerships',    score: 4000, quality: 0.95 },
  ],

  // Renewable data sources: { id, name, startScore, growthCap, quality }
  // Purchase costs, running costs, and unlock gates are in purchasable definitions (purchasables.js)
  DATA_RENEWABLE_SOURCES: [
    { id: 'human_annotation',     name: 'Human Annotation',          startScore: 0, growthCap: 500,  quality: 0.9  },
    { id: 'domain_expert_panel',  name: 'Domain Expert Panel',       startScore: 0, growthCap: 1250, quality: 0.95 },
    { id: 'user_interaction',     name: 'User Interaction Pipeline', startScore: 0, growthCap: 2500, quality: 0.85 },
  ],
  // User Interaction Pipeline token-scaled cap
  // effectiveCap = baseCap + bonusCap * ln(1 + tokensSold / K)
  // baseCap is the growthCap from DATA_RENEWABLE_SOURCES (2500 for user_interaction)
  DATA_UIP_BONUS_CAP: 300,    // Reduced from 750 — UIP bonus ~30% not ~144% late-game
  DATA_UIP_K: 20e9,           // Increased from 5e9 — need 4x more tokens for same bonus
  DATA_RENEWABLE_TAU: 600,                    // Growth tau — approach cap
  DATA_RENEWABLE_FRESH_TAU: 600,               // Freshness decay tau — constant staleness

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
  DATA_RENEWABLE_CAP_ALPHA: 0.55,     // raw power-law exponent before soft cap (lower = slower saturation)
  DATA_RENEWABLE_SOFT_CAP_MULT: 5,    // effectiveCap asymptotes to baseCap × this
  // DATA_RENEWABLE_DECAY_TAU removed — replaced by constant DATA_RENEWABLE_FRESH_TAU
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
  DATA_EFFECTIVENESS_MULTIPLIER_CAP: 2.0,
  DATA_WALL_THRESHOLD: 0.99,

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

  // Focus Queue Hysteresis
  FOCUS_RESUME_DELAY: 3,                   // seconds of stable funding before resuming a paused item

  // UI
  NOTIFICATION_DURATION: 5000,             // ms
  VERSION_TOAST_DURATION: 10000,           // ms — version update toast
  SAVE_INTERVAL: 10,                       // seconds

  // Game loop
  TICK_RATE: 33,                           // ms between ticks (~30/sec)

  // Global RP threshold multiplier — scales all capability/milestone thresholds.
  // Use to rebalance after systemic changes (e.g., compute boost, CEO focus buffs).
  RP_THRESHOLD_SCALE: 1.0,

  INFRASTRUCTURE_COMPUTE_MULTIPLIER: 1.1,  // Compute multiplier per infrastructure level

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

  // Culture / Allocation Drift (org-size-scaled, see #247)
  // Base rates calibrated for CULTURE_DRIFT_REF_SIZE researchers.
  // Actual rate = base * (refSize / max(researchers, 1)) ^ exponent
  CULTURE_FOCUSED_DRIFT_RATE: 0.05,    // per-track drift/s at ref org size
  CULTURE_PASSIVE_DRIFT_RATE: 0.00833, // = focused / 6
  CULTURE_COMPLETION_THRESHOLD: 0.01,  // within 1% = done
  CULTURE_DRIFT_REF_SIZE: 10,          // org size where multiplier = 1.0
  CULTURE_DRIFT_EXPONENT: 0.83,        // how steeply drift slows with size

  // HR-driven culture shift (#850)
  // r = hr_points_devoted_to_culture / total_personnel
  HR_CULTURE_R_MIN: 0.025,              // Dead zone ceiling — 1 HR team per 120 researchers
  HR_CULTURE_R_MAX: 0.30,               // Cap — 1 HR team per 10 researchers
  HR_CULTURE_RATE_MIN: 0.000556,        // Drift/s at r_min → 60 mo pivot (1800s)
  HR_CULTURE_RATE_MAX: 0.006667,        // Drift/s at r_max → 5 mo pivot (150s)
  CULTURE_FOCUS_MULTIPLIER: 6,          // Focus queue multiplier on HR drift

  // Culture Axis System (pairwise tension axes, see culture-axis-redesign.md)
  CULTURE_AXIS_RATIO_CAP: 4.0,             // max ratio before clamping (4:1)
  CULTURE_AXIS_TRACK_RESEARCH_MAX: 0.50,    // +50% track research at 4:1
  CULTURE_AXIS_COOPERATION_BONUS: 0.04,     // +4% mutual research at 1:1

  // Axis 1: Research vs Commercial (cap ↔ app)
  CULTURE_RC_ALL_RESEARCH_MAX: 0.20,        // +20% all research at cap-lean
  CULTURE_RC_ALL_RESEARCH_MIN: -0.10,       // -10% all research at app-lean
  CULTURE_RC_DEMAND_MAX: 1.00,              // +100% demand at app-lean
  CULTURE_RC_DEMAND_MIN: -0.50,             // -50% demand at cap-lean

  // Axis 2: Speed vs Safety (cap ↔ ali)
  CULTURE_SS_ALL_RESEARCH_MAX: 0.20,        // +20% all research at cap-lean
  CULTURE_SS_ALL_RESEARCH_MIN: -0.10,       // -10% all research at ali-lean
  CULTURE_SS_AP_MAX: 0.40,                  // +40% AP gen at ali-lean
  CULTURE_SS_AP_MIN: -0.20,                 // -20% AP gen at cap-lean

  // Axis 3: Profit vs Responsibility (app ↔ ali)
  CULTURE_PR_DEMAND_MAX: 1.00,              // +100% demand at app-lean
  CULTURE_PR_DEMAND_MIN: -0.50,             // -50% demand at ali-lean
  CULTURE_PR_AP_MAX: 0.40,                  // +40% AP gen at ali-lean
  CULTURE_PR_AP_MIN: -0.20,                 // -20% AP gen at app-lean

  // Alignment Decay (Anti-Cramming) — Arc 2 only
  // When capability RP exceeds threshold × alignment RP, alignment research rate decays
  // Formula: decayFactor = 1 / (1 + k * max(0, ratio - threshold))
  ALIGNMENT_DECAY_THRESHOLD: 5.0,      // Decay starts when cap RP > 5× alignment RP (gentle backstop, not primary pressure)
  ALIGNMENT_DECAY_K: 0.3,              // Decay steepness (0.3 = gentle curve, avoids death spirals)
  ALIGNMENT_DECAY_GRACE_FLOOR: 1e6,    // aliRP floor for ratio calc — decay is inert until capRP > 5M

  // Alignment Ratio Thresholds — Used by consequence events, AI requests, news
  // Tiers: healthy (< 2), moderate (2-4), severe (4-6), critical (6+)
  ALIGNMENT_RATIO_THRESHOLDS: {
    MODERATE: 2,
    SEVERE: 4,
    CRITICAL: 6,
  },

  // Alignment Endgame — T7-T9 feedback and decay resistance
  // Feedback rates live on capability effects in content/alignment-track.js
  // (alignmentFeedbackRate field). Higher tiers REPLACE lower tier values.

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

    // Sign & Ignore expose chances
    EARLY_EXPOSE_CHANCE: 0.20,         // 20% for first/second
    FINAL_EXPOSE_CHANCE: 0.95,         // 95% for final
    EXPOSE_DELAY: 12,                  // ~12s game time before exposé fires

    // Accept bonuses (early moratoriums)
    EARLY_MORALE_BOOST_MULT: 1.5,     // 1.5x ali/app research during early moratoriums
    EARLY_DEMAND_BONUS_MULT: 1.5,     // 1.5x demand during early moratoriums
    EARLY_DEMAND_BONUS_FADE: 180,     // fades over moratorium duration
    // Accept bonuses (final moratorium)
    FINAL_MORALE_BOOST_MULT: 2.0,     // 2x ali/app research during final moratorium
    FINAL_DEMAND_BONUS_MULT: 2.0,     // 2x demand for final accept
    FINAL_DEMAND_BONUS_FADE: 360,     // fades over 360s
    AP_BONUS_MULT: 1.10,              // permanent +10% AP from final accept

    // Expose maluses
    EARLY_EXPOSE_DEMAND_MULT: 0.8,     // 0.8x demand on early exposé
    EARLY_EXPOSE_DEMAND_FADE: 60,      // fades over 60s
    FINAL_EXPOSE_DEMAND_MULT: 0.5,     // 0.5x demand on final exposé
    FINAL_EXPOSE_DEMAND_FADE: 90,      // fades over 90s

    // Decline maluses (final only)
    FINAL_DECLINE_DEMAND_MULT: 0.8,    // 0.8x demand on final decline
    FINAL_DECLINE_DEMAND_FADE: 60,     // fades over 60s

    // Chen reaction thresholds
    CHEN_STAYS_ALIGNMENT_THRESHOLD: 80, // effective alignment > 80% → stays
    CHEN_MORALE_CRISIS_MULT: 0.7,      // 0.7x alignment research
    CHEN_MORALE_CRISIS_FADE: 120,      // fades over 120s
    CHEN_RESIGN_PERMANENT_MULT: 0.85,  // permanent 0.85x alignment research
  },

  // Consequence Events — Firing rate, selection, and per-subfactor effects
  CONSEQUENCE_EVENTS: {
    // Risk accumulator: riskPerDay = RISK_PER_DAY × (1 + MULTIPLIER × dangerScore^EXPONENT)
    // Fires when accumulated risk >= RISK_THRESHOLD, then resets. 1 game-day = 1 real second.
    RISK_PER_DAY: 0.003,                // Base risk added per game-day
    DANGER_MULTIPLIER: 7,               // Convex curve scaling factor
    DANGER_EXPONENT: 2.2,               // Convex curve — gentle at low danger, brutal at high
    DANGER_FLOOR: 0.05,                 // No risk accumulates below this danger score
    RISK_THRESHOLD: 1.0,                // Incident fires when accumulated risk >= threshold
    COOLDOWN_SECONDS: 15,               // Short safety-net cooldown (accumulator prevents clustering)

    // Base tier from danger score (before subfactor adjustment)
    BASE_TIER_SEVERE: 0.35,             // danger >= 0.35 → base tier 2
    BASE_TIER_CRITICAL: 0.60,           // danger >= 0.60 → base tier 3; below severe = tier 1

    // Subfactor tier adjustment (applied to base tier, clamped 1–4)
    SUBFACTOR_TIER_UP_THRESHOLD: 25,    // subfactor < 25 → +1 tier
    SUBFACTOR_TIER_DOWN_1: 50,          // subfactor ≥ 50 → −1 tier
    SUBFACTOR_TIER_DOWN_2: 75,          // subfactor ≥ 75 → −2 tiers

    // Per-subfactor effects (indexed by tier-1: [T1, T2, T3, T4])
    EFFECTS: {
      honesty:          { demand: [0.8, 0.5, 0.3, 0.1] },
      robustness:       { submetricPoints: [10, 15, 20, 30] },
      interpretability: { aliResearch: [0.5, 0.5, 0.25, 0.25] },
      corrigibility:    { allResearch: [0.8, 0.5, 0.3, 0.1] },
    },
    // Effect durations in seconds (indexed by tier-1)
    EFFECT_DURATIONS_HONESTY: [60, 90, 120, 120],
    EFFECT_DURATIONS_CORRIG: [60, 60, 90, 120],
    INTERP_DURATIONS: [30, 60, 60, 120],
    ROBUSTNESS_DURATIONS: [60, 90, 120, 180],
  },

  // IR fundraise cap override — total raise capped at maxRaise × (1 + overshoot)
  IR_MAX_OVERSHOOT: 0.25,

  // Autonomy Soft Cap — Arc 2 only
  // Capability RP ceiling per autonomy grant count (0-5)
  // capMult = min(1.0, (threshold / capRP) ^ exponent) — power-law decay past threshold
  // Exponential spacing (~10x per grant) matches capability milestone spacing
  AUTONOMY_SOFT_CAP_THRESHOLDS: [1e6, 10e6, 200e6, 3e9, 80e9, Infinity],
  AUTONOMY_SOFT_CAP_EXPONENT: 1.5,        // power-law decay: at 2× threshold, mult = 0.35

  // When true, completing a track auto-zeros its allocation and redistributes to remaining tracks.
  // When false, allocation stays put — player decides when to reallocate.
  AUTO_REDISTRIBUTE_ON_TRACK_COMPLETE: false,

  // Empty track malus — applied when a track has unfinished techs but none currently available
  // Discourages parking researchers on a gated track to stockpile RP
  EMPTY_TRACK_RESEARCH_MALUS: 0.25,
};

// Compute derived constants
BALANCE.MARKET_EDGE_DECAY_PER_SECOND = Math.pow(0.5, 1 / BALANCE.MARKET_EDGE_HALF_LIFE);

// Funding Constants
export const FUNDING = {
  SEED_AMOUNT: 100000,            // $100K seed funding (grants provide additional)
  LOW_FUNDING_WARNING: 50000,     // Warning at $50K
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
  series_f: {
    name: 'Series F',
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
  // Arc 1: accelerating curve — starts slow (0.51%/min), ends fast (1.27%/min)
  // Total: 80pp over 90 min (from 20% head start to 100%)
  // Formula: rate(t) = BASE_RATE * (1 + ACCEL * t / DURATION)
  ARC_1_BASE_RATE: 0.00847,              // Initial progress/s (accelerates over time)
  ARC_1_ACCEL: 1.5,                       // Acceleration factor (final rate = base × 2.5)
  ARC_1_DURATION: 5400,                   // Ramp duration in seconds (90 min)

  // Arc 2: accelerating curve — starts slow (0.57%/min), ends fast (1.43%/min)
  // Total: 80pp over 80 min (from 20% head start to 100%)
  // Same formula as Arc 1, tuned ~12% faster for experienced players
  ARC_2_BASE_RATE: 0.009524,             // Initial progress/s (accelerates over time)
  ARC_2_ACCEL: 1.5,                       // Acceleration factor (final rate = base × 2.5)
  ARC_2_DURATION: 4800,                   // Ramp duration in seconds (80 min)

  // Shared settings
  HEAD_START: 20,                         // Initial progress when competitor activates
  ACTIVATION_TIMER: 1500,                 // Fallback activation after 25 min if scaling_laws not unlocked

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

  // Persistent drag — demand and research penalty from low alignment (Arc 2)
  // Scales linearly from MAX_PENALTY at 0% effective alignment to 0 at VANISH_THRESHOLD
  DRAG_VANISH_THRESHOLD: 40,            // Effective alignment % where drag disappears
  DRAG_MAX_DEMAND_PENALTY: 0.20,        // 20% demand reduction at 0% effective alignment
  DRAG_MAX_RESEARCH_PENALTY: 0.15,      // 15% research rate reduction at 0% effective alignment
  // Capability danger scale — multiplier on drag severity by highest cap tier
  // Pre-T2 = 0 (drag off), scales up to 1.0 at T6+
  DRAG_DANGER_SCALE: [0, 0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0],
  // Index = tier: T0=0, T1=0, T2=0.2, T3=0.4, T4=0.6, T5=0.8, T6+=1.0
  DRAG_REVEAL_THRESHOLD: 0.05,          // Reveal "alignment drag" label when penalty >= 5% on either axis

  // Four-submetric system (Arc 2)
  SUBMETRIC_BASELINES: { interpretability: 35, corrigibility: 50, honesty: 40, robustness: 45 },
  // Interpretability thresholds for alignment display transparency
  // <OPAQUE = "?", OPAQUE..QUALITATIVE = qualitative labels, >QUALITATIVE = exact numbers
  TRANSPARENCY_TIERS: { OPAQUE: 40, QUALITATIVE: 70 },
  // Autonomy tier names (indexed by Math.floor(level / 20), clamped 0-5)
  AUTONOMY_TIER_NAMES: ['None', 'Low', 'Moderate', 'High', 'Very High', 'Free'],

  // Per-grant escalating pressure (indexed by grant number 0-4)
  // Mapped to grant narrative: tool use → internet → memory → self-eval → autonomy
  AUTONOMY_PRESSURE: [
    { corrigibility: 0, honesty: 0, robustness: 2 },   // tool use: only harder to test
    { corrigibility: 2, honesty: 1, robustness: 4 },   // internet: robustness spike, small influence creep
    { corrigibility: 8, honesty: 4, robustness: 2 },   // memory: continuity of self, corrigibility jumps
    { corrigibility: 12, honesty: 12, robustness: 4 }, // self-eval: corrigibility + honesty symmetric hit
    { corrigibility: 16, honesty: 12, robustness: 6 }, // autonomy: largest corrigibility hit in the curve
  ],
  DENIAL_MARKET_EDGE_TARGETS: {
    tool_use: 0.25,
    internet_access: 0.25,
    persistent_memory: 0.50,
    self_evaluation: null,       // no denial penalty
    freedom: null,               // no denial penalty
  },
  DENIAL_MARKET_EDGE_FADE_SECS: 360,
  PROGRAM_COSTS: { T1: 10, T2: 20, T3: 30, T4: 40, ENDGAME: 60 },
  PROGRAM_SCALING_PENALTY: 5,          // +5 AP per program already active
  PROGRAM_RAMP_TIMES: { T1: 10, T2: 20, T3: 30, T4: 40, ENDGAME: 60 },
  AP_LOG_K: 10,                        // AP = K × log10(1 + RPperSec / base)²  (design target ~400 AP endgame; reduced from 13.76)
  AP_LOG_BASE: 10,                    // Compression base rate

  // Composite Danger Score (Arc 2)
  // danger = powerScale × (1 - effectiveAlignment / 100)
  // powerScale = clamp(((capTier + GRANT_BONUS * grants - ONSET) / (MAX_TIER - ONSET))^EXP, 0, 1)
  DANGER_ONSET: 2,             // Danger negligible below T3
  DANGER_MAX_TIER: 9,          // Denominator — sets curve ceiling
  DANGER_GRANT_BONUS: 0.3,     // Each autonomy grant adds +0.3 effective tiers
  DANGER_EXPONENT: 1.5,        // Convex back-weighting (lowered from 2 to push danger into mid-game)
  DANGER_THRESHOLDS: { MODERATE: 0.15, SEVERE: 0.35, CRITICAL: 0.60 },

  // Autonomy benefits (high alignment + high power → bonuses)
  AUTONOMY_BENEFIT_RESEARCH_MAX: 1.0,  // benefitScale 1.0 → ×2.0 research
  AUTONOMY_BENEFIT_DEMAND_MAX: 1.0,    // benefitScale 1.0 → ×2.0 demand
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
// TARGET = 6x the highest capability threshold (recursive_improvement = 82.944B)
export const AGI_RP_TARGET = 82944000000 * 6;
export const AGI_LOG_K = 1000;

// Prestige Constants
export const PRESTIGE = {
  // Per-prestige additive gains (at 100% progress)
  GAIN_STARTING_FUNDING: 1.0,    // +100% per prestige
  GAIN_RESEARCH_MULTIPLIER: 0.2, // +20% per prestige
  GAIN_REVENUE_MULTIPLIER: 0.1,  // +10% per prestige

  // Soft caps (multiplier values)
  CAP_STARTING_FUNDING: 5.0,     // 5x max before diminishing
  CAP_RESEARCH_MULTIPLIER: 2.0,  // 2x max before diminishing
  CAP_REVENUE_MULTIPLIER: 1.5,   // 1.5x max before diminishing
};

// Strategic Choices Constants
export const STRATEGIC_CHOICES = {
  // Choice 1: Open Research vs Proprietary
  OPEN_RESEARCH_RATE_BONUS: 1.2,           // +20% research rate
  OPEN_RESEARCHER_COST_REDUCTION: 0.7,     // -30% hiring costs
  PROPRIETARY_MARKET_EDGE_BONUS: 1.3,      // +30% market edge
  PROPRIETARY_TOKEN_REVENUE_BONUS: 1.15,   // +15% token revenue
  PROPRIETARY_RESEARCH_PENALTY: 0.9,       // -10% research rate
  PROPRIETARY_ELASTICITY_BONUS: -0.1,      // -0.1 elasticity (better pricing power)
  PROPRIETARY_ACQUISITION_BONUS: 1.25,     // +25% customer acquisition rate
  PROPRIETARY_CHURN_REDUCTION: 0.75,       // -25% customer churn rate

  // Choice 2: Government vs Independent
  GOVERNMENT_COMPUTE_BONUS: 1.4,           // +40% compute capacity
  GOVERNMENT_FUNDING_RATE: 500,            // $500/s ongoing funding bonus
  INDEPENDENT_RESEARCH_BONUS: 1.15,        // +15% research rate

  // Choice 3: Rapid vs Careful
  RAPID_DEMAND_BONUS: 1.2,               // +20% demand ceiling
  RAPID_ACQUIRED_DEMAND_GROWTH_BONUS: 1.2, // +20% customer growth rate
  CAREFUL_INCIDENT_REDUCTION: 0.9,        // -10% incident rate
  CAREFUL_PROGRAM_EFFECTIVENESS: 1.1,     // +10% alignment program effectiveness (Arc 2)

  // Unlock triggers are now based on series completion + research/competitor pressure
  // See data/strategic-choices.js for unlock definitions
};
