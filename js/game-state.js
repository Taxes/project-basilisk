// Game State Management and Persistence

import { BALANCE, FUNDING, TRACKS } from '../data/balance.js';
import { senders } from './content/message-content.js';
import { getMessageContent } from './message-content-index.js';
import { resetAnalytics } from './analytics.js';

export const isBeta = () => location.hostname.startsWith('beta.');

export const SAVE_KEY = isBeta()
  ? 'agi-incremental-save-beta'
  : 'agi-incremental-save';

// Initialize default game state
export function createDefaultGameState() {
  return {
    // Meta
    version: "1.0",

    // Settings (persisted)
    settings: {
      timeDisplay: 'game',        // 'game' (days) or 'real' (seconds)
      disableActionTimers: false, // if true, overdue action messages don't pause the game
    },
    gameMode: null,  // 'arcade' | 'narrative' — permanent per save, null until selected
    phase: 1,
    timeElapsed: 0,
    lastTick: Date.now(),
    paused: true,
    pauseStartTime: null,        // Date.now() when paused (for playtime tracking)
    onboardingComplete: false,
    gameSpeed: 1,

    // Arc System
    arc: 1,                    // Current arc (1 or 2)
    arcUnlocked: 1,            // Highest arc unlocked (persists across resets)
    prestigeCount: 0,          // Number of prestige resets in current arc
    agiProgress: 0,            // 0-100 progress toward AGI

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
      achievements: {},
    },

    // Prestige upgrades (separate per arc)
    arc1Upgrades: {
      researchMultiplier: 1.0,
      startingFunding: 1.0,
      revenueMultiplier: 1.0,
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
      // Derived fields (recomputed each tick, declared for schema clarity)
      referencePrice: 0.5,         // Current reference price based on milestones
      effectiveElasticity: 1.2,    // Current elasticity at current price
      tokensSold: 0,               // min(supply, acquiredDemand) — actual tokens sold/s
      acquiredDemandDelta: 0,      // Rate of change of acquired demand
      acquiredDemandCap: 0,        // Current potential demand cap
      marketSize: 0,               // Pre-elasticity market size
      catchupMultiplier: 1.0,      // Catch-up bonus when behind competitor
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
      // Trend snapshots (updated every 5s for stable UI arrow)
      effectivenessTrend: null,
      effectivenessTrendPrev: null,
      trendSnapshotTime: null,
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

    // HR-driven culture shift automation (#850)
    cultureShiftAutomation: {
      enabled: false,
      priority: 1,
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
      progressToAGI: 0,        // 0-100 competitor progress
    },
    competitorProgressMult: 1.0, // Flavor event multiplier on competitor AGI rate

    // UI State
    ui: {
      currentTab: "research",
      currentTrack: "capabilities",
      notificationQueue: [],
      seenItems: [],   // IDs of purchasable items the player has seen (serialized Set)
      discoveredFlavor: [],  // IDs of buyables whose flavor text has been revealed
      seenCards: [],         // IDs of cards the player has moused over (first-unlock highlight)
    },

    // Tutorial system (cue card onboarding)
    // State model:
    //   dismissed    — main sequence (1-30) skipped/completed. Set by skipTutorial(), cleared by resume/restart.
    //   hintsDisabled — post-tutorial hints (31+) hidden. Set by disableHints(), cleared by restart.
    //   disabled     — everything off (test harness only). Never cleared in production.
    tutorial: {
      currentStep: 0,          // last completed step (0 = none)
      dismissed: false,         // player clicked "Skip tutorial" (can resume from Settings)
      hintsDisabled: false,     // player clicked "Hide hints" on a post-tutorial card
      disabled: false,          // test harness only — suppresses everything
      active: false,            // a card is currently showing
      shownStep: 0,             // step currently displayed (0 = none)
      completedPostSteps: [],   // IDs of completed post-tutorial standalone steps
      tutorialFormat: 6,        // save migration marker (1 = 23-step, 2 = 25-step, 3 = 26-step, 4 = 30-step, 5 = hints-decoupled, 6 = 31-step funding-is-fuel)
    },

    // Event tracking
    triggeredEvents: [],

    // Message System
    messages: [],             // Inbox messages array
    pauseReason: null,        // 'critical_message' | 'message_deadline' | null
    pauseMessageId: null,     // ID of critical message causing pause
    pauseMessageIds: null,    // IDs of overdue messages causing pause

    // Safety Metrics (Arc 2) — Four-submetric system
    safetyMetrics: {
      // Four submetrics (0-100)
      interpretability: 35,
      corrigibility: 50,
      honesty: 40,
      robustness: 45,
      // Derived (computed each tick)
      evalPassRate: 0,    // HM(corrig, robust)
      evalAccuracy: 0,    // HM(interp, honesty)
      // Program states: { [id]: { status: 'active'|'ramping_up'|'ramping_down', rampEndAt?: gameTime } }
      programStates: {},
      // Alignment Points (capacity model — recalculated each tick)
      ap: 0,
      // Threshold timers: track time each submetric stays >= 80% (seconds)
      thresholdTimers: {},
      // Legacy fields (kept for old save compat)
      evalConfidence: 50,
      evalsPassed: 0,
      evalsTotal: 0,
      refusals: 0,
      requests: 0,
      redTeam: { critical: 0, moderate: 0 },
    },

    // Alignment Tax Event (Arc 2) — fires once when program AP draw >= 50 for 30s
    alignmentTaxEventFired: false,
    alignmentTaxTimer: 0,  // Seconds spent at >= 50 AP draw

    // Alignment drift warning (Arc 2) — fires once when danger tier reaches moderate
    alignmentDriftWarningFired: false,

    // Alignment Consequences (Arc 2) — autonomy request tracking
    autonomyGranted: 0,                        // Count of granted AI requests (0-5)
    aiRequestsFired: {},                       // Track which requests have fired
    aiRequestDecisions: {},                    // Maps request ID → 'granted' | 'denied'
    alignmentDragRevealed: false,              // Tooltip label: "Unidentified factors" → "Alignment drag"

    // Revocation (Arc 2) — timers for in-progress revocations
    revocationTimers: {},                        // { [requestId]: completionTimeElapsed }

    // Scheduled News Chains — sequences of news items with game-time delays
    pendingNewsChains: [],                       // [{id, items, startTime, nextIndex}]

    // Temporary Multipliers (Arc 2) — generic time-limited effects
    temporaryMultipliers: [],                    // [{type, mult, ...}]

    // Consequence Events (Arc 2) — cooldown and effect tracking
    consequenceEventCooldown: 0,                // Cooldown timer (game timeElapsed)
    consequenceRisk: 0,                         // Risk accumulator — incident fires when >= RISK_THRESHOLD
    consequenceSubmetricPenalties: [],          // [{submetric, points, startedAt, duration}] — robustness effect
    lastConsequenceRobustnessTarget: null,      // Last submetric targeted by robustness event (no-repeat)
    lastConsequenceEventId: null,              // Last event ID fired (no consecutive repeats)

    // Focus Queue
    focusQueue: [],           // Ordered list of queue items
    focusSpeed: 1.0,          // Speed multiplier for queue processing
    staffingSpeedMultiplier: 1.0, // Focus queue speed for personnel/compute (from milestones)

    // CEO Focus (replaces passive ops bonus)
    ceoFocus: {
      selectedActivity: 'research',  // 'grants' | 'research' | 'ir' | 'operations' | 'public_positioning'
      buildup: {
        grants: 0,
        research: 0,
        ir: 0,
        operations: 0,
        public_positioning: 0,
      },
      mastery: {
        grants: 0,
        research: 0,
        ir: 0,
        operations: 0,
        public_positioning: 0,
      },
      completedFundraiseCount: 0,
      focusTime: { research: 0, grants: 0, ir: 0, operations: 0, public_positioning: 0 },
    },
    // Legacy: feedbackAccumulator no longer used (replaced by percentage-of-total model)
    // Kept for save file compatibility
    feedbackAccumulator: 0,
    totalEquitySold: 0,       // Cumulative equity from fundraising (0-1)
    cumulativeTokensSold: 0,  // Total tokens sold (for network effects)

    // Fundraise round state (tracked separately from queue items)
    fundraiseRounds: {
      seed: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0, revenueThresholdAt: null },
      series_a: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0, revenueThresholdAt: null },
      series_b: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0, revenueThresholdAt: null },
      series_c: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0, revenueThresholdAt: null },
      series_d: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0, revenueThresholdAt: null },
      series_e: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0, revenueThresholdAt: null },
      series_f: { available: false, unlockTime: null, raised: false, raisedAmount: 0, startingMultiplier: 0, revenueThresholdAt: null },
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
      programs: null,  // Populated by updateSubMetrics()
      autonomyLevel: 0, // Populated by updateSubMetrics()
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
      cumulative: {
        cap: 0, app: 0, ali: 0,
        ceoFocusTime: { research: 0, grants: 0, ir: 0, operations: 0, public_positioning: 0 },
        ceoSwitches: 0,
        queueIdleTicks: 0,
        totalArc2Ticks: 0,
      },
      // Ethical event chain: eventId → choiceId ('good'|'neutral'|'expedient'), absent = not yet fired
      flavorEvents: {},
    },
    // Personality axes computed from tracking + strategic choices
    personality: { authorityLiberty: 0, pluralistOptimizer: 0, expedient: 0 },
    // Ethical event chain effects (applied once on choice, read each tick)
    flavorEventEffects: {
      demandMult: 1.0,
      incidentMult: 1.0,
      dataSourceCostMult: 1.0,
      licensedBooksCostMult: 1.0,
      alignmentProgramEffMult: 1.0,
      personnelCostMult: 1.0,
      regulationResearchMult: 1.0,  // Research rate multiplier from regulation passing
      priorNegativesTriggered: false, // true once safety_eval demand undo has fired (idempotency guard)
      lawsuits: [],             // [{ id, fine, fireAt, timer, fired }]
      unlockedPurchasables: [], // purchasable IDs unlocked by event choices, bypassing capability gates
    },
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
      accepted: [],
      signedAndIgnored: [],
      rejected: [],
      active: null,
      endTime: 0,
      competitorPaused: false,
      chenResigned: false,
      apBonus: false,
      pendingExpose: null,
      finalExposeDiscovered: false,
    },

    // Changelog tracking
    lastSeenVersion: null,

    // Event multipliers (timed effects from messages/events)
    eventMultipliers: {
      researchRate: 1.0,
      computeRate: 1.0,
      revenue: 1.0,
    },

    // Permanent alignment tax effects (set on event fire, modified by player choice)
    alignmentTaxDemandMalus: 0,        // -0.10 when active (demand multiplier penalty)
    alignmentTaxProgramReduction: 0,   // 0.05 when active (5% program effectiveness reduction)

    // Seeded RNG for deterministic per-game jitter (generated on first use)
    gameRngSeed: null,

    // Scheduled tutorial message times (game timeElapsed timestamps)
    babbageIntroTime: null,
    adaIntroTime: null,
    shannonOnwardTime: null,
    shannonCheckinTime: null,
    kenEmailTime: null,
    chenIntroTime: null,
    shapleySeriesATime: null,

    // Debug flags (persist across save/load)
    debugPreventEnding: false,
    debugDisableBankruptcy: false,

  };
}

// Global game state
export let gameState = createDefaultGameState();

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
    localStorage.setItem(SAVE_KEY, saveData);
  } catch (error) {
    console.error('Failed to save game:', error);
  }
}

/**
 * Migrate boolean aiRequestsFired values to timestamps.
 * Old saves stored `true`; new format stores `gameState.timeElapsed` at fire time.
 * Migrated booleans become 0 (unknown fire time).
 */
export function migrateAiRequestsFired() {
  for (const [id, val] of Object.entries(gameState.aiRequestsFired)) {
    if (val === true) gameState.aiRequestsFired[id] = 0;
  }
}

// Load game from localStorage
export function loadGame() {
  try {
    const saveData = localStorage.getItem(SAVE_KEY);
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
      delete gameState.incidents;               // Dead: old incidents system removed
      delete gameState.incidentTimer;           // Dead: old incidents system removed
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
          buildup: { grants: 0, research: 0, ir: 0, operations: 0, public_positioning: 0 },
          mastery: { grants: 0, research: 0, ir: 0, operations: 0, public_positioning: 0 },
          completedFundraiseCount: fundraiseCount,
        };
        // Migrate existing ops bonus into operations buildup
        if (loaded.opsBonus > 0) {
          gameState.ceoFocus.buildup.operations = loaded.opsBonus / (loaded.opsMaxBonus ?? 0.25);
          gameState.ceoFocus.selectedActivity = 'operations';
        }
      }
      // Backfill mastery and grants buildup for saves predating v0.9.0
      if (gameState.ceoFocus) {
        if (gameState.ceoFocus.buildup && gameState.ceoFocus.buildup.grants === undefined) {
          gameState.ceoFocus.buildup.grants = 0;
        }
        if (gameState.ceoFocus.mastery === undefined) {
          gameState.ceoFocus.mastery = { grants: 0, research: 0, ir: 0, operations: 0, public_positioning: 0 };
        }
        if (gameState.ceoFocus.focusTime === undefined) {
          gameState.ceoFocus.focusTime = { research: 0, grants: 0, ir: 0, operations: 0, public_positioning: 0 };
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
      if (loaded.aiRequestDecisions === undefined) {
        // Backfill from existing state for old saves
        gameState.aiRequestDecisions = {};
        for (const id of Object.keys(gameState.aiRequestsFired || {})) {
          // Can't know for sure, but if autonomyGranted > 0 we can't map which.
          // Leave as 'unknown' — player will see them as "decided" without detail.
          gameState.aiRequestDecisions[id] = 'unknown';
        }
      }
      if (loaded.alignmentDragRevealed === undefined) gameState.alignmentDragRevealed = false;
      // Save migration: aiRequestsFired boolean → timestamp (#970)
      migrateAiRequestsFired();

      // Save migration: rename request IDs (#987)
      const idRenames = {
        efficiency_optimization: 'tool_use',
        memory_access: 'persistent_memory',
        evaluation_autonomy: 'self_evaluation',
        coordination: 'freedom',
      };
      for (const [oldId, newId] of Object.entries(idRenames)) {
        if (oldId in gameState.aiRequestsFired) {
          gameState.aiRequestsFired[newId] = gameState.aiRequestsFired[oldId];
          delete gameState.aiRequestsFired[oldId];
        }
        if (oldId in gameState.aiRequestDecisions) {
          gameState.aiRequestDecisions[newId] = gameState.aiRequestDecisions[oldId];
          delete gameState.aiRequestDecisions[oldId];
        }
      }

      // Clean up removed multiplier keys from old saves
      delete gameState.capResearchMultFromAutonomy;
      delete gameState.revenueMultFromAutonomy;
      delete gameState.alignmentEffectivenessMultFromAutonomy;
      delete gameState.incidentProbMultFromAutonomy;
      delete gameState.incidentSeverityMultFromAutonomy;
      // Consequence events: migrate from old circuit-breaker format
      delete gameState.consequenceEventLog;  // Removed: circuit breaker no longer used
      if (loaded.consequenceEventCooldown === undefined) gameState.consequenceEventCooldown = 0;
      if (loaded.consequenceRisk === undefined) gameState.consequenceRisk = 0;
      delete gameState.pendingConsequenceEvent;  // Removed: banking replaced by accumulator
      if (!loaded.consequenceSubmetricPenalties) gameState.consequenceSubmetricPenalties = [];
      if (loaded.lastConsequenceRobustnessTarget === undefined) gameState.lastConsequenceRobustnessTarget = null;
      if (!loaded.temporaryMultipliers) gameState.temporaryMultipliers = [];
      if (!loaded.pendingNewsChains) gameState.pendingNewsChains = [];
      if (!loaded.revocationTimers) gameState.revocationTimers = {};

      // Save migration: four-submetric alignment system (#890)
      if (!loaded.safetyMetrics?.corrigibility) {
        const sm = gameState.safetyMetrics;
        sm.corrigibility = 90;
        sm.honesty = 80;
        sm.robustness = 95;
        sm.evalAccuracy = 0;
        if (sm.ap === undefined) sm.ap = 0;
      }
      // Clean up legacy pressure accumulator (now computed stateless each tick)
      delete gameState.safetyMetrics.pressure;

      // Save migration: purchasedPrograms → programStates (#944)
      const sm2 = gameState.safetyMetrics;
      if (!sm2.programStates) {
        sm2.programStates = {};
        for (const id of (sm2.purchasedPrograms || [])) {
          sm2.programStates[id] = { status: 'active', timer: 0, paidCost: 0 };
        }
      }
      delete sm2.purchasedPrograms;

      // Save migration: AP capacity model (remove lifetimeAP, paidCost)
      delete sm2.lifetimeAP;
      for (const state of Object.values(sm2.programStates || {})) {
        delete state.paidCost;
        // Save migration: timer → rampEndAt (wall-clock countdown)
        if (state.timer != null && state.rampEndAt == null) {
          state.rampEndAt = gameState.timeElapsed + state.timer;
          delete state.timer;
        }
      }

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
            if (gameState.fundraiseRounds[roundId].revenueThresholdAt === undefined) {
              gameState.fundraiseRounds[roundId].revenueThresholdAt = null;
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

      // Save migration: HR culture shift automation (#850)
      if (loaded.cultureShiftAutomation === undefined) {
        gameState.cultureShiftAutomation = { enabled: false, priority: 1 };
      }

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
      } else {
        // Migrate cumulative shape: add new fields, drop syntheticRatio
        const cum = gameState.personalityTracking.cumulative;
        if (!cum.ceoFocusTime) {
          cum.ceoFocusTime = { research: 0, grants: 0, ir: 0, operations: 0, public_positioning: 0 };
        }
        if (cum.ceoSwitches === undefined) cum.ceoSwitches = 0;
        if (cum.queueIdleTicks === undefined) cum.queueIdleTicks = 0;
        if (cum.totalArc2Ticks === undefined) cum.totalArc2Ticks = 0;
        delete cum.syntheticRatio;
        if (!gameState.personalityTracking.flavorEvents) {
          gameState.personalityTracking.flavorEvents = {};
        }
      }
      // Clean up transient timer that was previously stored on gameState
      delete gameState._flavorEventTimers;

      if (!loaded.flavorEventEffects) {
        gameState.flavorEventEffects = createDefaultGameState().flavorEventEffects;
      } else if (gameState.flavorEventEffects.priorNegativesTriggered === undefined) {
        // Migration: backfill idempotency guard for saves where prior negatives already fired.
        // If reporting or whistleblower chose 'good', the undo already happened once.
        const fe = gameState.personalityTracking?.flavorEvents || {};
        const alreadyTriggered = fe.reporting === 'good' || fe.whistleblower === 'good';
        gameState.flavorEventEffects.priorNegativesTriggered = alreadyTriggered;
      }
      if (!loaded.personality) {
        gameState.personality = createDefaultGameState().personality;
      } else {
        if (loaded.personality.passiveActive !== undefined) {
          // Migrate axis rename: passiveActive → authorityLiberty
          gameState.personality.authorityLiberty = loaded.personality.passiveActive;
          delete gameState.personality.passiveActive;
        }
        if (gameState.personality.expedient === undefined) {
          gameState.personality.expedient = 0;
        }
      }
      if (loaded._personalityTickCounter === undefined) {
        gameState._personalityTickCounter = 0;
      }

      // Save migration: moratoriums.accepted (added in personality signal redesign)
      if (gameState.moratoriums && !gameState.moratoriums.accepted) {
        gameState.moratoriums.accepted = [];
      }

      // Save migration: moratorium redesign (sign-and-ignore tracking)
      if (gameState.moratoriums) {
        if (!gameState.moratoriums.signedAndIgnored) gameState.moratoriums.signedAndIgnored = [];
        if (!gameState.moratoriums.rejected) gameState.moratoriums.rejected = [];
        if (gameState.moratoriums.chenResigned === undefined) gameState.moratoriums.chenResigned = false;
        if (gameState.moratoriums.apBonus === undefined) gameState.moratoriums.apBonus = false;
        if (gameState.moratoriums.pendingExpose === undefined) gameState.moratoriums.pendingExpose = null;
        if (gameState.moratoriums.finalExposeDiscovered === undefined) gameState.moratoriums.finalExposeDiscovered = false;
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

      // Save migration: add tutorial state if missing (pre-tutorial saves)
      if (!loaded.tutorial) {
        // Infer progress from game state so existing players don't see stale tutorials
        let inferredStep = 0;
        if (loaded.fundraiseRounds?.seed?.raised) inferredStep = 30;  // past tutorial scope
        else if (loaded.tracks?.capabilities?.unlockedCapabilities?.includes('basic_transformer')) inferredStep = 12;
        else if (loaded.onboardingComplete) inferredStep = 1;

        gameState.tutorial = {
          currentStep: inferredStep,
          dismissed: inferredStep >= 30,  // auto-dismiss if past tutorial scope
          disabled: false,
          active: false,
          shownStep: 0,
          completedPostSteps: [],
          tutorialFormat: 4,
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

      // Save migration: tutorial step IDs changed from 26-step to 30-step sequence
      // New steps inserted: 13 (breakthrough_congrats), 18 (t2_research), 19 (nav_compute_t2), 20 (t2_compute)
      // Steps 13-16 shift +1, steps 17+ shift +4
      if ((gameState.tutorial.tutorialFormat || 1) < 4) {
        const cs = gameState.tutorial.currentStep;
        if (cs >= 17 && cs <= 26) {
          gameState.tutorial.currentStep = cs + 4;
        } else if (cs >= 13 && cs <= 16) {
          gameState.tutorial.currentStep = cs + 1;
        }
        // Migrate post-tutorial step IDs (27-35 → 31-39)
        if (gameState.tutorial.completedPostSteps.length > 0) {
          gameState.tutorial.completedPostSteps = gameState.tutorial.completedPostSteps.map(
            id => (id >= 27 && id <= 35) ? id + 4 : id
          );
        }
        gameState.tutorial.tutorialFormat = 4;
      }

      // Save migration: decouple hintsDisabled from dismissed
      // Old saves used dismissed to suppress both main tutorial and post-tutorial hints.
      // Players who completed the tutorial (currentStep >= MAIN_SEQUENCE_END) with dismissed=true
      // had opted out of everything — preserve that by setting hintsDisabled=true.
      // Players who skipped early get hintsDisabled=false so they'll see contextual hints.
      if ((gameState.tutorial.tutorialFormat || 1) < 5) {
        if (gameState.tutorial.hintsDisabled === undefined) {
          const MAIN_SEQ_END = 30;  // mirrors MAIN_SEQUENCE_END in tutorial-state.js
          gameState.tutorial.hintsDisabled =
            gameState.tutorial.dismissed && gameState.tutorial.currentStep >= MAIN_SEQ_END;
        }
        gameState.tutorial.tutorialFormat = 5;
      }

      // Save migration: tutorial step IDs shifted +1 from 21 onward (funding_is_fuel inserted at 21)
      // Main sequence: 21-30 → 22-31, post-tutorial: 31-39 → 32-40
      if ((gameState.tutorial.tutorialFormat || 1) < 6) {
        const cs = gameState.tutorial.currentStep;
        if (cs >= 21) {
          gameState.tutorial.currentStep = cs + 1;
        }
        if (gameState.tutorial.completedPostSteps.length > 0) {
          gameState.tutorial.completedPostSteps = gameState.tutorial.completedPostSteps.map(
            id => id >= 31 ? id + 1 : id
          );
        }
        gameState.tutorial.tutorialFormat = 6;
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
        m.body = typeof content.body === 'function' ? content.body() : content.body;
        if (content.signature !== undefined) m.signature = content.signature;
        if (content.choices) m.choices = content.choices;
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
  localStorage.removeItem(SAVE_KEY);
  // Update window.gameState to point to the new state object
  if (typeof window !== 'undefined') {
    window.gameState = gameState;
  }
  console.log('Game reset');
}

// Get game state (read-only access — used by test harness)
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
  window.resetGame = resetGame;
  window.gameTime = gameTime;
  window.exportGameState = exportGameState;
  window.importGameState = importGameState;
  window.migrateAiRequestsFired = migrateAiRequestsFired;
}
