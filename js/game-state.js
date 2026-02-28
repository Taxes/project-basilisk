// Game State Management and Persistence

import { BALANCE, FUNDING, TRACKS } from '../data/balance.js';
import { senders } from './content/message-content.js';
import { getMessageContent } from './message-content-index.js';
import { resetAnalytics } from './analytics.js';

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
    paused: true,
    onboardingComplete: false,
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
      peakFundingRate: 0,
      peakResearchRate: 0,
      dataCollapses: 0,
    },

    // Prestige upgrades (separate per arc)
    arc1Upgrades: {
      researchMultiplier: 1.0,
      startingFunding: 1.0,
      revenueMultiplier: 1.0,
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
      discoveredFlavor: [],  // IDs of buyables whose flavor text has been revealed
      seenCards: [],         // IDs of cards the player has moused over (first-unlock highlight)
      everUnlockedSections: [], // Section IDs unlocked at least once (survives prestige)
    },

    // Tutorial system (cue card onboarding)
    tutorial: {
      currentStep: 0,          // last completed step (0 = none)
      dismissed: false,         // player clicked "Skip tutorial" (can resume from Settings)
      disabled: false,          // player turned it off in Settings
      active: false,            // a card is currently showing
      shownStep: 0,             // step currently displayed (0 = none)
      completedPostSteps: [],   // IDs of completed post-tutorial standalone steps
      tutorialFormat: 3,        // save migration marker (1 = 23-step, 2 = 25-step, 3 = 26-step)
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
    focusSpeed: 1.0,          // Speed multiplier for queue processing
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
      series_f: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0 },
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

    // Farewell Modals (Phase 4 character goodbyes)
    farewells: {
      sequenceStarted: false,
      delivered: [],
      dismissed: [],
      lastDismissedTime: null,
      currentlyShowing: null,
      sequenceComplete: false,
      stalling: false,
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

    // Analytics dedup keys (persisted so page reload doesn't re-fire milestones)
    firedMilestones: [],

    // Ending state
    endingTriggered: null,       // Ending ID when triggered, null otherwise
    endingVariant: null,         // Ending variant string
    endingTime: null,            // Date.now() when ending triggered
    endingsSeen: [],             // Array of ending IDs seen across all runs (survives extinction reset)

    // Bankruptcy
    bankrupted: false,

    // Phase transition tracking
    phaseCompletion: {},         // { phase1Shown: bool, phase2Shown: bool }

    // Moratorium system
    moratoriums: {
      triggered: [],
      active: null,
      endTime: 0,
      competitorPaused: false,
    },

    // Changelog tracking
    lastSeenVersion: null,

    // Event multipliers (timed effects from messages/events)
    eventMultipliers: {
      researchRate: 1.0,
      computeRate: 1.0,
      revenue: 1.0,
      alignmentResearch: 1.0,
      fundingRate: 1.0,
      capabilitiesPaused: false,
      capabilitiesPauseEndTime: 0,
    },

    // Timed alignment tax effects (game timeElapsed timestamps, null = inactive)
    alignmentTaxRevenueBoostEnd: null,
    alignmentTaxRevenuePenaltyEnd: null,

    // Capability research pause (game timeElapsed timestamp, 0 = inactive)
    capResearchPauseEnd: 0,

    // Seeded RNG for deterministic per-game jitter (generated on first use)
    gameRngSeed: null,

    // Scheduled tutorial message times (game timeElapsed timestamps)
    shannonCheckinTime: null,
    kenEmailTime: null,
    chenIntroTime: null,

    // Debug flags (persist across save/load)
    debugPreventEnding: false,
    debugDisableBankruptcy: false,

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

// Prepare a save-optimized copy of gameState.
// Strips computed values, normalizes senders, and strips read message content.
export function prepareSaveData() {
  const data = JSON.parse(JSON.stringify(gameState));

  // Reset computed namespace — always recalculated on load
  data.computed = {
    research: null, costs: null, revenue: null,
    compute: null, data: null, purchases: null,
    capex: { hiring: 0, infrastructure: 0 },
  };

  // Optimize messages for save size
  if (data.messages) {
    data.messages = data.messages.map(m => {
      // Normalize sender objects to ID strings (resolved on load)
      if (m.sender && typeof m.sender === 'object' && m.sender.id) {
        m.sender = m.sender.id;
      }

      // Strip large content from read messages.
      // Keep tags (inbox routing) and triggeredBy (dedup on load).
      const isRead = m.read && (m.type !== 'action' || m.actionTaken);
      if (isRead) {
        delete m.body;
        delete m.signature;
        delete m.choices;
      }
      return m;
    });
  }

  return data;
}

// Save game to localStorage
export function saveGame() {
  // Skip if an import is pending — beforeunload would overwrite the imported data
  if (sessionStorage.getItem('agi-import-pending')) return;
  try {
    const saveData = JSON.stringify(prepareSaveData());
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
      // Never restore transient runtime flags from save — _backgroundMode is
      // written during visibilitychange/pagehide which fire on every refresh,
      // so the last save before unload always has _backgroundMode = true.
      delete gameState._backgroundMode;
      delete gameState._fastForwarding;
      delete gameState._fastForwardEpoch;
      delete gameState._fastForwardEvents;
      // Clean stale properties from old saves
      delete gameState.scheduledSevereIncident; // Dead code, never read
      delete gameState.baseCompute;             // Moved to computed
      delete gameState.computeMultiplier;       // Moved to computed
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
      if (loaded.opsBonus === undefined) gameState.opsBonus = 0;
      if (loaded.opsMaxBonus === undefined) gameState.opsMaxBonus = 0.25;
      if (loaded.totalEquitySold === undefined) gameState.totalEquitySold = 0;
      if (loaded.targetAllocation === undefined) gameState.targetAllocation = null;
      if (loaded.feedbackAccumulator === undefined) gameState.feedbackAccumulator = 0;
      if (loaded.disbursements === undefined) gameState.disbursements = [];
      if (loaded.staffingSpeedMultiplier === undefined) gameState.staffingSpeedMultiplier = 1.0;
      // Migrate old saves: totalEfficiency → focusSpeed, drop focusSlots
      if (loaded.totalEfficiency !== undefined && loaded.focusSpeed === undefined) {
        gameState.focusSpeed = loaded.totalEfficiency;
      } else if (loaded.focusSpeed === undefined) {
        gameState.focusSpeed = 1.0;
      }
      delete gameState.focusSlots;

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

      // Save migration: series_g renamed to series_f (#818)
      if (loaded.fundraiseRounds?.series_g && !loaded.fundraiseRounds?.series_f) {
        gameState.fundraiseRounds.series_f = loaded.fundraiseRounds.series_g;
        delete gameState.fundraiseRounds.series_g;
      }

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

      // Save migration: timed message delays were stored in ms instead of seconds (#698)
      // Reset to null so triggers recompute with correct units
      if (gameState.kenEmailTime > 10000) gameState.kenEmailTime = null;
      if (gameState.shannonCheckinTime > 10000) gameState.shannonCheckinTime = null;
      if (gameState.chenIntroTime > 10000) gameState.chenIntroTime = null;

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

      // Resolve sender ID strings back to full sender objects (save size optimization)
      if (gameState.messages) {
        for (const m of gameState.messages) {
          if (typeof m.sender === 'string') {
            m.sender = senders[m.sender] || { id: m.sender, name: m.sender, role: null };
          }
        }
      }

      // Rehydration is deferred to rehydrateMessages() so tutorial content
      // can be registered first (avoids circular-dependency timing issue).

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

      // Save migration: farewells (added in farewell modal system)
      if (loaded.farewells === undefined) {
        gameState.farewells = createDefaultGameState().farewells;
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

      // Save migration: discoveredFlavor (added in flavor visibility feature)
      if (!loaded.ui?.discoveredFlavor) {
        if (!gameState.ui) gameState.ui = createDefaultGameState().ui;
        gameState.ui.discoveredFlavor = [];
      }

      // Save migration: seenCards (added in first-unlock highlight feature)
      if (!loaded.ui?.seenCards) {
        if (!gameState.ui) gameState.ui = createDefaultGameState().ui;
        gameState.ui.seenCards = [];
      }

      // Save migration: auto-mark bought/completed items as seen
      // Prevents false "new" highlights on old saves (#750)
      {
        const seen = gameState.ui.seenCards;
        const seenSet = new Set(seen);
        for (const id of Object.keys(gameState.purchasables || {})) {
          if (gameState.purchasables[id].count > 0 && !seenSet.has(id)) {
            seen.push(id);
            seenSet.add(id);
          }
        }
        for (const trackKey of ['capabilities', 'applications', 'alignment']) {
          const unlocked = gameState.tracks?.[trackKey]?.unlockedCapabilities || [];
          for (const id of unlocked) {
            if (!seenSet.has(id)) {
              seen.push(id);
              seenSet.add(id);
            }
          }
        }
      }

      // Save migration: endingsSeen (tracks endings across runs)
      if (!loaded.endingsSeen) {
        gameState.endingsSeen = [];
      }

      // Save migration: everUnlockedSections (prestige UI persistence)
      if (!loaded.ui?.everUnlockedSections) {
        if (!gameState.ui) gameState.ui = createDefaultGameState().ui;
        gameState.ui.everUnlockedSections = [];
      }

      // Save migration: add tutorial state if missing (pre-tutorial saves)
      if (!loaded.tutorial) {
        // Infer progress from game state so existing players don't see stale tutorials
        let inferredStep = 0;
        if (loaded.fundraiseRounds?.seed?.raised) inferredStep = 26;  // past tutorial scope
        else if (loaded.tracks?.capabilities?.unlockedCapabilities?.includes('basic_transformer')) inferredStep = 12;
        else if (loaded.onboardingComplete) inferredStep = 1;

        gameState.tutorial = {
          currentStep: inferredStep,
          dismissed: inferredStep >= 26,  // auto-dismiss if past tutorial scope
          disabled: false,
          active: false,
          shownStep: 0,
          completedPostSteps: [],
          tutorialFormat: 3,
        };
      }

      // Ensure completedPostSteps array exists (future-proofing)
      if (!gameState.tutorial.completedPostSteps) {
        gameState.tutorial.completedPostSteps = [];
      }

      // Save migration: tutorial step IDs changed from 15-step to 26-step sequence
      // Old IDs 1-15 map to new IDs. Old post-steps 17-18 map to 25-26.
      // Detect old saves by checking if currentStep <= 15 and the save has the old format.
      // The old step 15 = tutorial_complete, new step 23 = tutorial_complete.
      {
        // Migration from original 15-step format to current 25-step format
        const OLD_TO_NEW = { 1: 1, 2: 4, 3: 6, 4: 8, 5: 10, 6: 11, 7: 12, 8: 14, 9: 16, 10: 18, 11: 20, 12: 21, 13: 23, 14: 24, 15: 25 };
        const OLD_POST_TO_NEW = { 17: 27, 18: 28 };
        const cs = gameState.tutorial.currentStep;
        // Only migrate if currentStep is in old range (1-15) and NOT already in new range
        // New step 16+ are nav/action steps that old saves never had
        if (cs >= 1 && cs <= 15 && OLD_TO_NEW[cs] !== undefined && OLD_TO_NEW[cs] !== cs) {
          gameState.tutorial.currentStep = OLD_TO_NEW[cs];
          // Also update dismissed threshold — old 15 → new 25
          if (gameState.tutorial.dismissed && cs >= 15) {
            gameState.tutorial.currentStep = 25;
          }
        }
        // Migrate completedPostSteps IDs
        if (gameState.tutorial.completedPostSteps.length > 0) {
          gameState.tutorial.completedPostSteps = gameState.tutorial.completedPostSteps.map(
            id => OLD_POST_TO_NEW[id] || id
          );
        }
      }

      // Save migration: tutorial step IDs changed from 23-step to 25-step sequence
      // Two new nav steps inserted at positions 15 and 22, shifting IDs >= 15 by +1 or +2
      // tutorialFormat tracks which ID scheme the save uses (undefined/1 = 23-step, 2 = 25-step)
      if ((gameState.tutorial.tutorialFormat || 1) < 2) {
        const cs = gameState.tutorial.currentStep;
        if (cs >= 15 && cs <= 23) {
          const STEP_23_TO_25 = { 15: 16, 16: 17, 17: 18, 18: 19, 19: 20, 20: 21, 21: 23, 22: 24, 23: 25 };
          if (STEP_23_TO_25[cs] !== undefined) {
            gameState.tutorial.currentStep = STEP_23_TO_25[cs];
          }
        }
        // Migrate post-tutorial step IDs (24-31 → 26-33)
        const POST_23_TO_25 = { 24: 26, 25: 27, 26: 28, 27: 29, 28: 30, 29: 31, 30: 32, 31: 33 };
        if (gameState.tutorial.completedPostSteps.length > 0) {
          gameState.tutorial.completedPostSteps = gameState.tutorial.completedPostSteps.map(
            id => POST_23_TO_25[id] || id
          );
        }
        gameState.tutorial.tutorialFormat = 2;
      }

      // Save migration: tutorial step IDs changed from 25-step to 26-step sequence
      // One new nav step inserted at position 24 (nav_admin), shifting IDs >= 24 by +1
      if ((gameState.tutorial.tutorialFormat || 1) < 3) {
        const cs = gameState.tutorial.currentStep;
        if (cs >= 24 && cs <= 25) {
          // 24 (admin_tab) → 25, 25 (tutorial_complete) → 26
          gameState.tutorial.currentStep = cs + 1;
        }
        // Migrate post-tutorial step IDs (26-33 → 27-34)
        if (gameState.tutorial.completedPostSteps.length > 0) {
          gameState.tutorial.completedPostSteps = gameState.tutorial.completedPostSteps.map(
            id => (id >= 26 && id <= 33) ? id + 1 : id
          );
        }
        gameState.tutorial.tutorialFormat = 3;
      }

      // Save migration: lifetimeAllTime new fields (peaks, dataCollapses)
      if (gameState.lifetimeAllTime) {
        if (gameState.lifetimeAllTime.peakFundingRate === undefined) gameState.lifetimeAllTime.peakFundingRate = 0;
        if (gameState.lifetimeAllTime.peakResearchRate === undefined) gameState.lifetimeAllTime.peakResearchRate = 0;
        if (gameState.lifetimeAllTime.dataCollapses === undefined) gameState.lifetimeAllTime.dataCollapses = 0;
      }

      // Save migration: computeEfficiency → revenueMultiplier rename
      if (gameState.arc1Upgrades?.computeEfficiency !== undefined) {
        gameState.arc1Upgrades.revenueMultiplier = gameState.arc1Upgrades.computeEfficiency;
        delete gameState.arc1Upgrades.computeEfficiency;
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

// Save migration: backfill triggeredBy for messages from older saves
const SUBJECT_TO_TRIGGERED_BY = {
  'The Transformer Era': 'phase_completion_1',
  'Something in the training logs': 'phase_completion_2',
};

/**
 * Rehydrate stripped message bodies from the content index.
 * Must be called AFTER initTutorialContent() so tutorial entries exist.
 */
export function rehydrateMessages() {
  if (!gameState.messages) return;
  let rehydrated = 0;
  let missed = 0;
  for (const m of gameState.messages) {
    // Backfill triggeredBy for messages from older saves that lacked it
    if (!m.triggeredBy && m.subject && SUBJECT_TO_TRIGGERED_BY[m.subject]) {
      m.triggeredBy = SUBJECT_TO_TRIGGERED_BY[m.subject];
    }

    if (!m.body && m.triggeredBy) {
      const content = getMessageContent(m.triggeredBy, m.contentParams);
      if (content) {
        m.body = content.body;
        if (content.signature !== undefined) m.signature = content.signature;
        if (content.choices && !m.actionTaken) m.choices = content.choices;
        rehydrated++;
      } else if (m.type !== 'news') {
        console.warn(`[messages] Could not rehydrate body for triggeredBy="${m.triggeredBy}"`);
        missed++;
      }
    }
  }
  if (rehydrated > 0 || missed > 0) {
    console.log(`[messages] Rehydrated ${rehydrated} message bodies (${missed} unresolved)`);
  }
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
  } catch {
    // Ignore storage errors
  }
  if (typeof window !== 'undefined' && window.clearPlaytestLog) {
    window.clearPlaytestLog();
  }

  gameState = createDefaultGameState();
  resetAnalytics();
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
