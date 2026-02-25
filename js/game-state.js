// Game State Management and Persistence

import { BALANCE, FUNDING, TRACKS } from '../data/balance.js';

// Initialize default game state
export function createDefaultGameState() {
  return {
    // Meta
    version: "1.0",

    // Settings (persisted)
    settings: {
      timeDisplay: 'game',  // 'game' (days) or 'real' (seconds)
    },
    phase: 1,
    timeElapsed: 0,
    lastTick: Date.now(),
    paused: false,
    gameSpeed: 1,

    // Arc System
    arc: 1,                    // Current arc (1 or 2)
    arcUnlocked: 1,            // Highest arc unlocked (persists across resets)
    prestigeCount: 0,          // Number of prestige resets in current arc
    agiProgress: 0,            // 0-100 progress toward AGI

    // Hidden alignment (never shown in Arc 1)
    hiddenAlignment: 0,        // 0-100, accumulates from research choices

    // Lifetime stats (this run — reset on prestige)
    lifetime: {
      totalFundingEarned: 0,   // cumulative revenue received
      totalResearchEarned: 0,  // cumulative research points generated
      peakFundingRate: 0,      // highest net income/day achieved
      peakResearchRate: 0,     // highest research rate achieved
      dataCollapses: 0,        // number of model collapse events
    },

    // Lifetime stats (all time — survives prestige, only reset by full game reset)
    lifetimeAllTime: {
      totalFundingEarned: 0,
      totalResearchEarned: 0,
      totalPlaytime: 0,
      prestigeResets: 0,
    },

    // Prestige upgrades (separate per arc)
    arc1Upgrades: {
      researchMultiplier: 1.0,
      startingFunding: 1.0,
      computeEfficiency: 1.0,
    },
    arc2Upgrades: {
      safetyResearchSpeed: 1.0,
      incidentDetection: 1.0,
      interpretabilityBonus: 0,  // Additive bonus, starts at 0
    },

    // Primary Resources
    resources: {
      research: 0,
      researchRate: 1,
      compute: 0,
      computeRate: 0,
      funding: FUNDING.SEED_AMOUNT,
      // Token economics
      computeAllocation: 1.0,      // 100% internal at start (0-1 scale)
      tokenPrice: 0.5,             // $/million tokens (actual, drifts toward targetPrice)
      targetPrice: 0.5,            // $/million tokens (set by autopricer or manual controls)
      tokensPerSecond: 0,          // Generated tokens/s from external compute
      demand: 10000000000,          // 10B tokens/s starting demand ceiling
      acquiredDemand: 0,           // Sticky demand (grows slowly, churns fast)
      autopricerEnabled: false,    // Whether autopricer is active
      autopricerMode: 'balanced',  // 'growth', 'balanced', or 'extraction'
      marketEdge: 1.0,             // Competitive advantage multiplier (decays over time)
      marketEdgeDecaying: false,   // Starts decaying after first app unlock
      lateGameDemandMultiplier: 1.0,
    },

    // Data quality system
    data: {
      renewableScores: {},                 // { [srcId]: score } — renewable score accumulators
      syntheticScore: 0,                   // running accumulator
      quality: 1.0,                        // 0-1, computed from synthetic proportion
      qualityRevealed: false,              // true after Phase 3 CTO message
      phase3RevealStarted: null,           // timeElapsed when Phase 3 CTO message fires
      collapsePauseRemaining: 0,
      collapseCount: 0,
      dataCleanupPauseEnd: 0,
      dataTabRevealed: false,
      dataExhaustionTriggered: false,
      // Legacy UI cache (overwritten each tick)
      effectiveness: 3.0,
      dataScore: 30,
      dataRequired: 10,
      nextTierName: '',
    },

    // Secondary Resources
    // Founder contributes via FOUNDER_OUTPUT in track research, not here
    secondaryResources: {
      researchers: 0,  // No hired researchers at start
      researchersRate: 0,
      infrastructure: 0,
      infrastructureRate: 0,
    },

    // Research Tracks (Three-track system)
    tracks: {
      capabilities: {
        researchPoints: 0,
        researcherAllocation: TRACKS.CAPABILITIES.arc1DefaultAllocation,
        unlockedCapabilities: [],
        unlockOrder: [],
        unlockTimestamps: {},
      },
      applications: {
        researchPoints: 0,
        researcherAllocation: TRACKS.APPLICATIONS.arc1DefaultAllocation,
        unlockedCapabilities: [],
        unlockOrder: [],  // Tracks the order items were unlocked
        unlockTimestamps: {},
      },
      alignment: {
        researchPoints: 0,
        researcherAllocation: TRACKS.ALIGNMENT.arc1DefaultAllocation,
        unlockedCapabilities: [],
        alignmentLevel: 0, // 0-100 percentage
        unlockOrder: [],  // Tracks the order items were unlocked
        unlockTimestamps: {},
      },
    },

    // Consolidated purchasable state (count, furlough, automation per item)
    purchasables: {
      gpu_consumer: { count: 1, furloughed: 0, savedProgress: 0, automation: { enabled: false, type: 'fixed', targetValue: 0, targetItem: null, priority: 1 } },
      data_public_web: { count: 1, furloughed: 0, savedProgress: 0, automation: { enabled: false, type: 'fixed', targetValue: 0, targetItem: null, priority: 1 } },
    },

    // Upgrades state (per purchasable - separate semantics from purchasables)
    upgrades: {},

    // Automation Flags
    automation: {
      autoClickResearch: false,
      autoBuyCompute: false,
      autoTrain: false,
    },

    // Automation toggles (visible after buying operations_dept)
    autoHiringEnabled: true,
    autoComputeEnabled: true,


    // Strategic Choices (permanent, mutually exclusive decisions)
    // choiceId -> { selected: optionId, trigger: 'research'|'pressure' } when chosen
    // choiceId -> { selected: null, trigger: 'research'|'pressure' } when available
    // absent = locked
    strategicChoices: {},

    // Choice Tracking (for endings)
    choices: {
      alignmentInvestment: 0,
      openSourceDecisions: 0,
      safetyIncidents: 0,
      dataInvestment: 0,
      reputation: 0,
      fundingRounds: 0,
      efficiencyInvestment: 0,
      conservativeApproach: 0,
      // Phase 2 choices
      regulatoryStanding: 0,
      publicTrust: 0,
      talentRetention: 0,
    },

    // Talent Pools (accumulates growth from research track allocation)
    talentPools: {
      grad_student: { growthAccumulated: 0 },
      junior_researcher: { growthAccumulated: 0 },
      team_lead: { growthAccumulated: 0 },
      elite_researcher: { growthAccumulated: 0 },
      warningShown: false,
    },

    // Competitor State (stub for Phase 1)
    competitor: {
      capabilityLevel: 0,
      position: "behind",
      marketStandard: 1,       // Growing market standard (Red Queen)
      progressToAGI: 0,        // 0-100 competitor progress
    },

    // UI State
    ui: {
      currentTab: "research",
      currentTrack: "capabilities",
      notificationQueue: [],
      seenItems: [],   // IDs of purchasable items the player has seen (serialized Set)
    },

    // Event tracking
    triggeredEvents: [],

    // Message System
    messages: [],             // Inbox messages array
    pauseReason: null,        // 'critical_message' | 'message_deadline' | null
    pauseMessageId: null,     // ID of critical message causing pause
    pauseMessageIds: null,    // IDs of overdue messages causing pause

    // Incident tracking (Phase 2+ near-miss events)
    incidents: [],
    incidentTimer: 0,

    // Safety Metrics (Arc 2)
    safetyMetrics: {
      evalPassRate: 70,       // Starting pass rate (%)
      evalConfidence: 50,     // Starting eval confidence (%)
      interpretability: 5,    // Starting interpretability coverage (%)
      // Legacy fields (kept for compatibility)
      evalsPassed: 0,
      evalsTotal: 0,
      refusals: 0,
      requests: 0,
      redTeam: { critical: 0, moderate: 0 },
    },

    // Alignment Debt Tracking (Arc 2) — tracks which news events have fired
    // 0 = no events, 1 = mild (2:1), 2 = moderate (4:1), 3 = severe (6:1)
    alignmentDebtTier: 0,

    // Alignment Tax Event (Arc 2) — fires once when alignment allocation > 30% for 60s
    alignmentTaxEventFired: false,
    alignmentTaxTimer: 0,  // Seconds spent above 30% allocation

    // Alignment Consequences (Arc 2) — permanent multipliers from AI requests
    autonomyGranted: 0,                        // Count of granted AI requests (0-5)
    aiRequestsFired: {},                       // Track which requests have fired
    capResearchMultFromAutonomy: 1.0,          // Applied in capabilities RP calculation
    revenueMultFromAutonomy: 1.0,              // Applied in revenue calculation
    alignmentEffectivenessMultFromAutonomy: 1.0, // Applied in alignment calculations
    incidentProbMultFromAutonomy: 1.0,         // Applied in incident probability
    incidentSeverityMultFromAutonomy: 1.0,     // Applied in incident damage

    // Consequence Events (Arc 2) — circuit breaker tracking
    consequenceEventLog: [],                    // Timestamps of recent events
    consequenceEventCooldown: 0,                // Cooldown timer

    // Focus Queue
    focusQueue: [],           // Ordered list of queue items
    focusSlots: 1,            // Active parallel slots (1-5)
    totalEfficiency: 1.0,     // Total efficiency pool (divided among active slots)
    opsBonus: 0,              // Legacy — replaced by ceoFocus.buildup.operations
    opsMaxBonus: 0.25,        // Legacy — replaced by ceoFocus ops cap
    staffingSpeedMultiplier: 1.0, // Focus queue speed for personnel/compute (from milestones)

    // CEO Focus (replaces passive ops bonus)
    ceoFocus: {
      selectedActivity: 'research',  // 'grants' | 'research' | 'ir' | 'operations' | 'public_positioning'
      buildup: {
        research: 0,
        ir: 0,
        operations: 0,
        public_positioning: 0,
      },
      completedFundraiseCount: 0,
    },
    // Legacy: feedbackAccumulator no longer used (replaced by percentage-of-total model)
    // Kept for save file compatibility
    feedbackAccumulator: 0,
    totalEquitySold: 0,       // Cumulative equity from fundraising (0-1)
    cumulativeTokensSold: 0,  // Total tokens sold (for network effects)

    // Fundraise round state (tracked separately from queue items)
    fundraiseRounds: {
      seed: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0 },
      series_a: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0 },
      series_b: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0 },
      series_c: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0 },
      series_d: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0 },
      series_e: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0 },
      series_g: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0 },
    },

    // Target allocation for culture drift (null = no active target)
    targetAllocation: null,

    // Tranche disbursement (fundraise payouts arrive over time)
    disbursements: [],  // [{ roundId, totalAmount, remaining, rate }]

    // Grant system state
    grants: {
      seed: { active: true, elapsed: 0, exhausted: false, initialRemaining: 0, totalPaid: 0 },
      research: { active: false, elapsed: 0, exhausted: false, initialRemaining: 0, totalPaid: 0 },
    },

    // Line of credit state
    credit: {
      inUse: false,           // Currently using credit (funding < 0)
      warningShown: false,    // CFO warning message has been sent
      limit: 100000,          // Current credit limit (computed each tick)
    },

    // Computed values (populated each tick by game loop, read-only for UI)
    // All derived values live here - UI reads, never computes
    computed: {
      research: null,   // Populated by computeResearchState()
      costs: null,      // Populated by computeCostState()
      revenue: null,    // Populated by computeRevenueState()
      compute: null,    // Populated by computeComputeState()
      data: null,       // Populated by processDataQuality()
      purchases: null,  // Populated by computePurchaseState()
      capex: { hiring: 0, infrastructure: 0 },  // Populated by processQueue + processAutomationBuilds
    },

    // Personality Tracking (Arc 2) - Samples behavior to compute ending archetype
    personalityTracking: {
      samples: 0,
      cumulative: { cap: 0, app: 0, ali: 0, syntheticRatio: 0 },
    },
    // Personality axes computed from tracking + strategic choices
    personality: { passiveActive: 0, pluralistOptimizer: 0 },
    // Internal tick counter for sampling (sample every 60 ticks = 2 sec)
    _personalityTickCounter: 0,

  };
}

// Global game state
export let gameState = createDefaultGameState();

// Backwards-compatibility shim for gameState.purchases
// Allows legacy code (tests) to read/write via gameState.purchases[id]
// by delegating to the new gameState.purchasables structure

// Helper to ensure purchasable entry exists
function ensurePurchasable(state, id) {
  if (!state.purchasables) state.purchasables = {};
  if (!state.purchasables[id]) {
    state.purchasables[id] = {
      count: 0,
      furloughed: 0,
      savedProgress: 0,
      automation: { enabled: false, type: 'fixed', targetValue: 0, targetItem: null, priority: 1 },
    };
  }
  return state.purchasables[id];
}

// Create a proxy that delegates property access to purchasables
function createPurchasesProxy(state) {
  return new Proxy({}, {
    get(target, id) {
      if (typeof id !== 'string') return undefined;
      return state.purchasables?.[id]?.count ?? 0;
    },
    set(target, id, value) {
      if (typeof id !== 'string') return false;
      ensurePurchasable(state, id);
      state.purchasables[id].count = value;
      return true;
    },
    has(target, id) {
      return typeof id === 'string' && state.purchasables?.[id]?.count > 0;
    },
    ownKeys() {
      return Object.keys(state.purchasables || {});
    },
    getOwnPropertyDescriptor(target, id) {
      if (state.purchasables?.[id]) {
        return { configurable: true, enumerable: true, value: state.purchasables[id].count };
      }
      return undefined;
    },
  });
}

// Set up purchases as a getter/setter property that handles object assignment
function setupPurchasesProperty(state) {
  let proxy = createPurchasesProxy(state);
  Object.defineProperty(state, 'purchases', {
    configurable: true,
    enumerable: false,
    get() {
      return proxy;
    },
    set(obj) {
      // Handle assignment of plain objects (e.g., from tests)
      // Populate purchasables from the assigned object's entries
      if (obj && typeof obj === 'object') {
        for (const [id, count] of Object.entries(obj)) {
          ensurePurchasable(state, id);
          state.purchasables[id].count = count;
        }
      }
      // Always keep using the existing proxy for subsequent access
    },
  });
}
setupPurchasesProperty(gameState);

// Save game to localStorage
export function saveGame() {
  try {
    const saveData = JSON.stringify(gameState);
    localStorage.setItem('agi-incremental-save', saveData);
  } catch (error) {
    console.error('Failed to save game:', error);
  }
}

// Load game from localStorage
export function loadGame() {
  try {
    const saveData = localStorage.getItem('agi-incremental-save');
    if (saveData) {
      const loaded = JSON.parse(saveData);
      // Merge with default state to handle version updates
      gameState = { ...createDefaultGameState(), ...loaded };
      gameState.lastTick = Date.now();
      gameState.gameSpeed = 1; // Never restore debug speed from save
      // Reset pause timestamp so playtime tracking works after reload
      if (gameState.paused) {
        gameState.pauseStartTime = Date.now();
      }

      // Save migration: Arc 1 no longer has alignment allocation
      // Old saves with alignment > 0 need redistribution to cap/app
      if (gameState.arc === 1 && gameState.tracks?.alignment?.researcherAllocation > 0) {
        const aliAlloc = gameState.tracks.alignment.researcherAllocation;
        const capAlloc = gameState.tracks.capabilities.researcherAllocation;
        const appAlloc = gameState.tracks.applications.researcherAllocation;
        const totalCapApp = capAlloc + appAlloc;
        if (totalCapApp > 0) {
          const scale = (totalCapApp + aliAlloc) / totalCapApp;
          gameState.tracks.capabilities.researcherAllocation = capAlloc * scale;
          gameState.tracks.applications.researcherAllocation = appAlloc * scale;
        } else {
          gameState.tracks.capabilities.researcherAllocation = 1.0;
        }
        gameState.tracks.alignment.researcherAllocation = 0.0;
      }

      // Save migration: focus queue fields (added in focus system update)
      if (loaded.focusQueue === undefined) gameState.focusQueue = [];
      if (loaded.focusSlots === undefined) gameState.focusSlots = 1;
      if (loaded.opsBonus === undefined) gameState.opsBonus = 0;
      if (loaded.opsMaxBonus === undefined) gameState.opsMaxBonus = 0.25;
      if (loaded.totalEquitySold === undefined) gameState.totalEquitySold = 0;
      if (loaded.targetAllocation === undefined) gameState.targetAllocation = null;
      if (loaded.feedbackAccumulator === undefined) gameState.feedbackAccumulator = 0;
      if (loaded.disbursements === undefined) gameState.disbursements = [];
      if (loaded.totalEfficiency === undefined) gameState.totalEfficiency = 1.0;
      if (loaded.staffingSpeedMultiplier === undefined) gameState.staffingSpeedMultiplier = 1.0;

      // Save migration: CEO Focus (replaces ops bonus)
      if (loaded.ceoFocus === undefined) {
        // Count completed fundraise rounds for grant/IR scaling
        let fundraiseCount = 0;
        for (const round of Object.values(gameState.fundraiseRounds || {})) {
          if (round.raised) fundraiseCount++;
        }
        gameState.ceoFocus = {
          selectedActivity: 'research',
          buildup: { research: 0, ir: 0, operations: 0, public_positioning: 0 },
          completedFundraiseCount: fundraiseCount,
        };
        // Migrate existing ops bonus into operations buildup
        if (loaded.opsBonus > 0) {
          gameState.ceoFocus.buildup.operations = loaded.opsBonus / (loaded.opsMaxBonus || 0.25);
          gameState.ceoFocus.selectedActivity = 'operations';
        }
      }
      // Backfill completedFundraiseCount for saves that have ceoFocus but no count
      if (gameState.ceoFocus && gameState.ceoFocus.completedFundraiseCount === undefined) {
        let count = 0;
        for (const round of Object.values(gameState.fundraiseRounds || {})) {
          if (round.raised) count++;
        }
        gameState.ceoFocus.completedFundraiseCount = count;
      }

      // Save migration: purchases + automationState → purchasables
      if (loaded.purchases && !loaded.purchasables) {
        gameState.purchasables = {};

        // Get union of all keys from both objects
        const allIds = new Set([
          ...Object.keys(loaded.purchases || {}),
          ...Object.keys(loaded.automationState || {}),
        ]);

        for (const id of allIds) {
          const count = loaded.purchases?.[id] ?? 0;
          const autoState = loaded.automationState?.[id];

          gameState.purchasables[id] = {
            count,
            furloughed: autoState?.furloughed ?? 0,
            savedProgress: 0,
            automation: {
              enabled: autoState?.policy?.enabled ?? false,
              type: autoState?.policy?.type ?? 'fixed',
              targetValue: autoState?.policy?.targetValue ?? 0,
              targetItem: autoState?.policy?.targetItem ?? null,
              priority: autoState?.policy?.priority ?? 1,
            },
          };
        }
      }

      // Save migration: strip stale accumulator fields from automation state
      if (gameState.purchasables) {
        for (const entry of Object.values(gameState.purchasables)) {
          if (entry.automation) {
            delete entry.automation.accumulator;
          }
        }
      }

      // Save migration: messages (added in message system redesign)
      if (loaded.messages === undefined) gameState.messages = [];
      if (loaded.pauseReason === undefined) gameState.pauseReason = null;
      if (loaded.pauseMessageId === undefined) gameState.pauseMessageId = null;
      if (loaded.pauseMessageIds === undefined) gameState.pauseMessageIds = null;

      // Save migration: alignment consequences (added in alignment consequences system)
      if (loaded.alignmentTaxEventFired === undefined) gameState.alignmentTaxEventFired = false;
      if (loaded.alignmentTaxTimer === undefined) gameState.alignmentTaxTimer = 0;
      if (loaded.autonomyGranted === undefined) gameState.autonomyGranted = 0;
      if (loaded.aiRequestsFired === undefined) gameState.aiRequestsFired = {};
      if (loaded.capResearchMultFromAutonomy === undefined) gameState.capResearchMultFromAutonomy = 1.0;
      if (loaded.revenueMultFromAutonomy === undefined) gameState.revenueMultFromAutonomy = 1.0;
      if (loaded.alignmentEffectivenessMultFromAutonomy === undefined) gameState.alignmentEffectivenessMultFromAutonomy = 1.0;
      if (loaded.incidentProbMultFromAutonomy === undefined) gameState.incidentProbMultFromAutonomy = 1.0;
      if (loaded.incidentSeverityMultFromAutonomy === undefined) gameState.incidentSeverityMultFromAutonomy = 1.0;
      if (loaded.consequenceEventLog === undefined) gameState.consequenceEventLog = [];
      if (loaded.consequenceEventCooldown === undefined) gameState.consequenceEventCooldown = 0;

      // Save migration: fundraiseRounds is a nested object — shallow merge
      // may produce incomplete state if old save is missing rounds
      if (!loaded.fundraiseRounds) {
        gameState.fundraiseRounds = createDefaultGameState().fundraiseRounds;
      } else {
        // Ensure every expected round key exists (in case new rounds were added)
        const defaults = createDefaultGameState().fundraiseRounds;
        for (const roundId of Object.keys(defaults)) {
          if (!gameState.fundraiseRounds[roundId]) {
            gameState.fundraiseRounds[roundId] = defaults[roundId];
          } else {
            // Migrate raisedAmount, startingMultiplier, and raisedAt fields
            if (gameState.fundraiseRounds[roundId].raisedAmount === undefined) {
              gameState.fundraiseRounds[roundId].raisedAmount = 0;
            }
            if (gameState.fundraiseRounds[roundId].startingMultiplier === undefined) {
              gameState.fundraiseRounds[roundId].startingMultiplier = 0;
            }
            if (gameState.fundraiseRounds[roundId].raised && gameState.fundraiseRounds[roundId].raisedAt == null) {
              gameState.fundraiseRounds[roundId].raisedAt = gameState.fundraiseRounds[roundId].unlockTime || 0;
            }
          }
        }
      }

      // Save migration: data sub-object (replaced dataQuality/dataStrategy)
      if (!loaded.data) {
        gameState.data = createDefaultGameState().data;
      } else {
        gameState.data = { ...createDefaultGameState().data, ...loaded.data };
      }

      // Save migration: bespoke data state → purchasable state
      // Generators (old format: { owned, running, upgradeLevel } or tier-based)
      if (loaded.data?.generators) {
        let gen = loaded.data.generators;
        // Handle ancient tier-based format first
        if (!('owned' in gen)) {
          const st = gen.self_training || 0;
          const vp = gen.verified_pipeline || 0;
          const as = gen.autonomous_synthesis || 0;
          const totalOwned = st + vp + as;
          let upgradeLevel = 0;
          if (as > 0) upgradeLevel = 2;
          else if (vp > 0) upgradeLevel = 1;
          gen = { owned: totalOwned, running: totalOwned, upgradeLevel };
        }
        // Migrate to purchasable
        if (!gameState.purchasables.synthetic_generator) {
          gameState.purchasables.synthetic_generator = {
            count: gen.owned || 0,
            furloughed: (gen.owned || 0) - (gen.running || 0),
            savedProgress: 0,
          };
        }
        const upgradeLevel = gen.upgradeLevel || 0;
        if (upgradeLevel >= 1 && !gameState.purchasables.generator_upgrade_verified) {
          gameState.purchasables.generator_upgrade_verified = { count: 1, furloughed: 0, savedProgress: 0 };
        }
        if (upgradeLevel >= 2 && !gameState.purchasables.generator_upgrade_autonomous) {
          gameState.purchasables.generator_upgrade_autonomous = { count: 1, furloughed: 0, savedProgress: 0 };
        }
        delete gameState.data.generators;
      }

      // Renewable migration (old format: { [srcId]: { score, level, active } })
      if (loaded.data?.renewables) {
        gameState.data.renewableScores = gameState.data.renewableScores || {};
        for (const [srcId, rs] of Object.entries(loaded.data.renewables)) {
          if (!rs) continue;
          // Handle accumulatedTime → score conversion (ancient saves)
          if (rs.accumulatedTime !== undefined && rs.score === undefined) {
            const src = (BALANCE.DATA_RENEWABLE_SOURCES || []).find(s => s.id === srcId);
            if (src) {
              const level = rs.level || 1;
              const baseCap = src.growthCap * (1 + 1.0 * (level - 1));
              rs.score = src.startScore + baseCap * (1 - Math.exp(-rs.accumulatedTime / 600));
            } else {
              rs.score = 0;
            }
          }
          const purchId = 'data_' + srcId;
          if (!gameState.purchasables[purchId]) {
            gameState.purchasables[purchId] = {
              count: rs.level || (rs.activated ? 1 : 0),
              furloughed: rs.active === false ? (rs.level || 1) : 0,
              savedProgress: 0,
            };
          }
          gameState.data.renewableScores[srcId] = rs.score || 0;
        }
        delete gameState.data.renewables;
      }

      // Bulk source migration (old format: { [srcId]: true/false })
      if (loaded.data?.bulkPurchased) {
        for (const [srcId, owned] of Object.entries(loaded.data.bulkPurchased)) {
          if (owned) {
            const purchId = 'data_' + srcId;
            if (!gameState.purchasables[purchId]) {
              gameState.purchasables[purchId] = { count: 1, furloughed: 0, savedProgress: 0 };
            }
          }
        }
        delete gameState.data.bulkPurchased;
      }

      // Clean up removed fields
      delete gameState.data.unlockedTiers;

      // Save migration: computed namespace (always reset on load - populated by game loop)
      gameState.computed = createDefaultGameState().computed;

      // Save migration: grants (added in economy pacing update)
      if (!loaded.grants) {
        gameState.grants = createDefaultGameState().grants;
      } else {
        // Ensure all expected grant keys exist
        const grantDefaults = createDefaultGameState().grants;
        for (const grantId of Object.keys(grantDefaults)) {
          if (!gameState.grants[grantId]) {
            gameState.grants[grantId] = grantDefaults[grantId];
          }
        }
      }

      // Save migration: credit (added in economy pacing update)
      if (!loaded.credit) {
        gameState.credit = createDefaultGameState().credit;
      }

      // Save migration: talentPools (added in talent pool system)
      if (!loaded.talentPools) {
        gameState.talentPools = createDefaultGameState().talentPools;
      }

      // Save migration: personality tracking (added in ending personality system)
      if (!loaded.personalityTracking) {
        gameState.personalityTracking = createDefaultGameState().personalityTracking;
      }
      if (!loaded.personality) {
        gameState.personality = createDefaultGameState().personality;
      }
      if (loaded._personalityTickCounter === undefined) {
        gameState._personalityTickCounter = 0;
      }

      // Save migration: act → phase rename
      if (loaded.act !== undefined) {
        gameState.phase = loaded.act;
        delete gameState.act;
      }
      if (loaded.actCompletion) {
        gameState.phaseCompletion = {};
        if (loaded.actCompletion.act1Shown) gameState.phaseCompletion.phase1Shown = true;
        if (loaded.actCompletion.act2Shown) gameState.phaseCompletion.phase2Shown = true;
        delete gameState.actCompletion;
      }
      if (gameState.pauseReason === 'act_completion') {
        gameState.pauseReason = 'phase_completion';
      }

      // Save migration: seenItems (added in tab notifications)
      if (!loaded.ui?.seenItems) {
        if (!gameState.ui) gameState.ui = createDefaultGameState().ui;
        gameState.ui.seenItems = [];
      }

      // NOTE: restoreQueueIdCounter() must be called after loadGame()
      // to sync the focus queue ID counter. Done in main.js to avoid
      // circular import (game-state <- focus-queue -> game-state).

      // Set up purchases property after loading
      setupPurchasesProperty(gameState);

      // Re-sync window.gameState since loadGame creates a new state object
      if (typeof window !== 'undefined') {
        window.gameState = gameState;
      }

      console.log('Game loaded successfully');
      return true;
    }
  } catch (error) {
    console.error('Failed to load game:', error);
  }
  return false;
}

// Reset game state
export function resetGame() {
  // Archive playtest log before clearing
  try {
    const logBackup = localStorage.getItem('playtest-log-backup');
    if (logBackup) {
      localStorage.setItem('playtest-log-archive', logBackup);
    }
    localStorage.removeItem('playtest-log-backup');
    localStorage.removeItem('playtest-logging-enabled');
  } catch (e) {
    // Ignore storage errors
  }
  if (typeof window !== 'undefined' && window.clearPlaytestLog) {
    window.clearPlaytestLog();
  }

  gameState = createDefaultGameState();
  setupPurchasesProperty(gameState);
  localStorage.removeItem('agi-incremental-save');
  // Update window.gameState to point to the new state object
  if (typeof window !== 'undefined') {
    window.gameState = gameState;
  }
  console.log('Game reset');
}

// Update game state
export function updateGameState(updates) {
  gameState = { ...gameState, ...updates };
}

// Get game state (read-only access)
export function getGameState() {
  return gameState;
}

// Get current game time (supports fast-forward mode)
// During normal play: returns Date.now()
// During fast-forward: returns synthetic timestamp based on timeElapsed
export function gameTime() {
  if (gameState._fastForwarding) {
    return gameState._fastForwardEpoch + (gameState.timeElapsed * 1000);
  }
  return Date.now();
}

// Export full game state for checkpoints (deep clone)
export function exportGameState() {
  return JSON.parse(JSON.stringify(gameState));
}

// Import full game state from checkpoint
export function importGameState(state) {
  // Deep merge with defaults to handle version differences
  const defaults = createDefaultGameState();
  gameState = deepMerge(defaults, state);
  gameState.lastTick = Date.now();
  gameState.paused = true;
  setupPurchasesProperty(gameState);

  // Update window reference
  if (typeof window !== 'undefined') {
    window.gameState = gameState;
  }

  return gameState;
}

// Deep merge helper for state import
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// Export for testing
if (typeof window !== 'undefined') {
  window.createDefaultGameState = createDefaultGameState;
  window.gameTime = gameTime;
  window.exportGameState = exportGameState;
  window.importGameState = importGameState;
}
