// Playtest Logger - Captures game state snapshots and player actions for pacing analysis
//
// Usage:
//   window.startPlaytestLog()   - Start logging (also via ?log=true URL param)
//   window.stopPlaytestLog()    - Stop logging
//   window.exportPlaytestLog()  - Download log as .md file
//   window.clearPlaytestLog()   - Clear all log entries
//
// Log entries persist across page reloads via localStorage.

import { gameState } from './game-state.js';
import { getActiveCount } from './automation-state.js';

// --- State ---
let logging = false;
let logEntries = [];
let lastSnapshotGameTime = -Infinity;
let pendingQueueActions = [];  // Batched queue actions
let queueFlushTimeout = null;
let sliderDebounceTimeout = null;
let pendingSliderEntry = null;

const SLIDER_SETTLE_MS = 1000;  // 1 second settle time

function flushToLocalStorage() {
  if (logEntries.length === 0) return;
  try {
    localStorage.setItem('playtest-log-backup', logEntries.join('\n'));
  } catch {
    // Ignore storage errors
  }
}

// Snapshot intervals (in seconds of game time)
const EARLY_SNAPSHOT_INTERVAL = 30;      // Every 30s for first 10 min
const LATE_SNAPSHOT_INTERVAL = 60;       // Every 60s after 10 min
const EARLY_PHASE_DURATION = 600;        // 10 minutes in seconds

const QUEUE_BATCH_WINDOW = 5000;  // 5 second window to batch queue actions
const MAX_LOG_ENTRIES = 5000;    // Cap to prevent memory growth

// --- Formatting Helpers ---

function formatGameTime(gameTimeSeconds) {
  const totalSeconds = Math.floor(gameTimeSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}

function formatRate(n) {
  const sign = n >= 0 ? '+' : '';
  return sign + formatNumber(n) + '/s';
}

function getTimestamp() {
  return `[${formatGameTime(gameState.timeElapsed)}]`;
}

// --- Logging Functions ---

function addEntry(entry) {
  if (!logging) return;
  if (logEntries.length >= MAX_LOG_ENTRIES) {
    logEntries.shift();  // FIFO eviction
  }
  logEntries.push(entry);
  console.log(entry);  // Real-time console output for debugging

  // Auto-save to localStorage every 10 entries
  if (logEntries.length % 10 === 0) {
    try {
      localStorage.setItem('playtest-log-backup', logEntries.join('\n'));
    } catch {
      // Ignore storage errors
    }
  }
}

function createSnapshot() {
  const gs = gameState;
  const res = gs.resources;
  const computed = gs.computed || {};

  // Funding breakdown: read from computed state (single source of truth)
  const tokenRevenue = computed.revenue?.net || 0;
  const grantIncome = computed.revenue?.otherIncome?.grants || 0;
  const disbursementRate = computed.revenue?.otherIncome?.disbursements || 0;
  const costs = computed.costs?.totalRunningCost || 0;
  const grossIncome = tokenRevenue + grantIncome + disbursementRate;
  const otherIncome = computed.revenue?.otherIncome?.total || 0;
  const netRate = computed.revenue?.freeCashFlow ?? (grossIncome - costs);

  // Research rate from computed state
  const rpRate = computed.research?.total || 0;
  const feedbackRP = computed.research?.feedbackContribution || 0;
  const customerFeedback = computed.research?.customerFeedbackBonus || 0;

  // Per-track cumulative RP
  const capRP = gs.tracks?.capabilities?.researchPoints || 0;
  const appRP = gs.tracks?.applications?.researchPoints || 0;
  const alignRP = gs.tracks?.alignment?.researchPoints || 0;

  // Token economics
  const tokenPrice = res.tokenPrice || 0;
  const supply = res.tokensPerSecond || 0;
  const demand = res.demand || 0;
  const acquired = res.acquiredDemand || 0;

  // Build buyables string (only non-zero)
  const buyables = [];
  const purchases = gs.purchases || {};

  // Only include scalable items (things you buy multiples of)
  // One-off upgrades are captured in QUEUE actions, not snapshots
  // IDs from js/content/purchasables.js
  const scalableItems = [
    'grad_student', 'junior_researcher', 'team_lead', 'elite_researcher',
    'gpu_consumer', 'gpu_datacenter', 'cloud_compute', 'build_datacenter',
    'recruiting_team_unit', 'procurement_team_unit'
  ];

  for (const id of scalableItems) {
    const total = purchases[id] || 0;
    if (total > 0) {
      const active = getActiveCount(id);
      if (active < total) {
        buyables.push(`${id}=${active}(${total})`);
      } else {
        buyables.push(`${id}=${total}`);
      }
    }
  }

  // Format with section labels for LLM parsing
  const fundingPart = `funding=$${formatNumber(res.funding)} gross=${formatRate(grossIncome)} token=${formatRate(tokenRevenue)} other=${formatRate(otherIncome)} costs=${formatRate(costs)} net=${formatRate(netRate)}`;
  const econPart = `econ price=$${tokenPrice.toFixed(2)} supply=${formatNumber(supply)} demand=${formatNumber(demand)} acquired=${formatNumber(acquired)}`;
  const rpPart = `research rp=${formatNumber(res.research)} ${formatRate(rpRate)} feedback=${formatRate(feedbackRP)} custFB=${formatRate(customerFeedback)} capRP=${formatNumber(capRP)} appRP=${formatNumber(appRP)} alignRP=${formatNumber(alignRP)}`;

  // Data quality system
  const dataComputed = computed.data || {};
  const dataScores = dataComputed.scores || {};
  const dataEff = dataComputed.effectiveness ?? gs.data?.effectiveness ?? 0;
  const dataQual = dataComputed.quality ?? gs.data?.quality ?? 1;
  const dataReq = gs.data?.dataRequired ?? 0;
  const dataEffScore = dataScores.effective ?? 0;
  const dataPart = `data eff=${dataEff.toFixed(2)}x qual=${dataQual.toFixed(2)} score=${formatNumber(dataEffScore)}/${formatNumber(dataReq)} bulk=${formatNumber(dataScores.bulk || 0)} renew=${formatNumber(dataScores.renewable || 0)} synth=${formatNumber(dataScores.synthetic || 0)}`;

  const buyablesStr = buyables.length > 0 ? ` | units ${buyables.join(' ')}` : '';

  return `${getTimestamp()} SNAPSHOT ${fundingPart} | ${econPart} | ${rpPart} | ${dataPart}${buyablesStr}`;
}

function checkSnapshot() {
  if (!logging) return;

  const gameTime = gameState.timeElapsed;
  const interval = gameTime < EARLY_PHASE_DURATION ? EARLY_SNAPSHOT_INTERVAL : LATE_SNAPSHOT_INTERVAL;

  // Snap to grid: 0:00, 0:30, 1:00, ... in early phase; 10:00, 11:00, ... in late phase
  const currentGridPoint = Math.floor(gameTime / interval) * interval;

  if (currentGridPoint > lastSnapshotGameTime) {
    addEntry(createSnapshot());
    lastSnapshotGameTime = currentGridPoint;
  }
}

// --- Queue Action Batching ---

function flushQueueActions() {
  if (pendingQueueActions.length === 0) return;

  // Group by target
  const grouped = {};
  for (const action of pendingQueueActions) {
    const key = action.target;
    if (!grouped[key]) {
      grouped[key] = { target: action.target, quantity: 0, type: action.type };
    }
    grouped[key].quantity += action.quantity;
  }

  // Format as single line - separate by type (purchase vs furlough)
  const purchases = Object.values(grouped).filter(g => g.type !== 'furlough');
  const furloughs = Object.values(grouped).filter(g => g.type === 'furlough');

  if (purchases.length > 0) {
    const parts = purchases.map(g => {
      return g.quantity > 1 ? `${g.target} x${g.quantity}` : g.target;
    });
    addEntry(`${getTimestamp()} QUEUE ${parts.join(', ')}`);
  }

  if (furloughs.length > 0) {
    const parts = furloughs.map(g => {
      return g.quantity > 1 ? `${g.target} x${g.quantity}` : g.target;
    });
    addEntry(`${getTimestamp()} FURLOUGH ${parts.join(', ')}`);
  }

  pendingQueueActions = [];
  queueFlushTimeout = null;
}


function logQueueAction(target, quantity, type = 'purchase') {
  if (!logging) return;

  pendingQueueActions.push({ target, quantity, type });

  // Reset flush timer
  if (queueFlushTimeout) clearTimeout(queueFlushTimeout);
  queueFlushTimeout = setTimeout(flushQueueActions, QUEUE_BATCH_WINDOW);
}

// --- Event Hooks ---

function logFurlough(target, quantity) {
  if (!logging) return;
  pendingQueueActions.push({ target, quantity, type: 'furlough' });
  if (queueFlushTimeout) clearTimeout(queueFlushTimeout);
  queueFlushTimeout = setTimeout(flushQueueActions, QUEUE_BATCH_WINDOW);
}

function logFundraise(roundId) {
  if (!logging) return;
  addEntry(`${getTimestamp()} FUNDRAISE ${roundId}`);
}

function logFundraiseComplete(roundId, valuation, amount) {
  if (!logging) return;
  addEntry(`${getTimestamp()} FUNDRAISE_COMPLETE ${roundId} valuation=${valuation}x raised=$${formatNumber(amount)}`);
}

function logUnlock(capabilityId) {
  if (!logging) return;
  addEntry(`${getTimestamp()} UNLOCK ${capabilityId}`);
}

function logArcTransition(arc) {
  if (!logging) return;
  addEntry(`${getTimestamp()} ARC ${arc}`);
}

function logPhaseTransition(phase) {
  if (!logging) return;
  addEntry(`${getTimestamp()} PHASE ${phase}`);
}

function logStrategicChoice(choiceId, optionId) {
  if (!logging) return;
  addEntry(`${getTimestamp()} CHOICE ${choiceId} → ${optionId}`);
}

function logDataSource(sourceId, type) {
  if (!logging) return;
  addEntry(`${getTimestamp()} DATA_SOURCE ${sourceId} (${type})`);
}

function logSliderChange(sliderType, values) {
  if (!logging) return;

  // Format the entry but don't log yet — wait for settle
  let entry;
  if (sliderType === 'compute') {
    entry = `${getTimestamp()} SLIDER compute ${values.toFixed(2)}`;
  } else if (sliderType === 'research') {
    entry = `${getTimestamp()} SLIDER research cap=${values.capabilities.toFixed(2)} app=${values.applications.toFixed(2)} ali=${values.alignment.toFixed(2)}`;
  }

  pendingSliderEntry = entry;

  if (sliderDebounceTimeout) clearTimeout(sliderDebounceTimeout);
  sliderDebounceTimeout = setTimeout(() => {
    if (pendingSliderEntry) {
      addEntry(pendingSliderEntry);
      pendingSliderEntry = null;
    }
    sliderDebounceTimeout = null;
  }, SLIDER_SETTLE_MS);
}

function logAutomationPolicy(itemId, policy, wasEnabled = null) {
  if (!logging) return;
  // Only log if enabled, or if enabled state changed
  const enabledChanged = wasEnabled !== null && wasEnabled !== policy.enabled;
  if (!policy.enabled && !enabledChanged) return;
  addEntry(`${getTimestamp()} AUTOMATION ${itemId} → ${policy.type}:${policy.targetValue} enabled=${policy.enabled} priority=${policy.priority}`);
}

// --- Control Functions ---

function startPlaytestLog() {
  if (logging) {
    console.log('Playtest logging already active');
    return;
  }

  logging = true;
  window.addEventListener('beforeunload', flushToLocalStorage);
  try { localStorage.setItem('playtest-logging-enabled', 'true'); } catch { /* ignore */ }
  // Restore previous entries from localStorage backup (survives reloads)
  try {
    const backup = localStorage.getItem('playtest-log-backup');
    if (backup) {
      logEntries = backup.split('\n').filter(line => line.length > 0);
      console.log(`[Playtest Logger] Restored ${logEntries.length} entries from previous session`);
    } else {
      logEntries = [];
    }
  } catch {
    logEntries = [];
  }
  pendingQueueActions = [];

  // Initialize to current grid point so next snapshot is at next grid boundary
  const gameTime = gameState.timeElapsed;
  const interval = gameTime < EARLY_PHASE_DURATION ? EARLY_SNAPSHOT_INTERVAL : LATE_SNAPSHOT_INTERVAL;
  lastSnapshotGameTime = Math.floor(gameTime / interval) * interval;

  // Reset state tracking for fresh detection
  lastArc = gameState.arc;
  lastPhase = gameState.phase;
  lastUnlockedCaps = new Set();
  for (const track of Object.values(gameState.tracks)) {
    for (const cap of (track.unlockedCapabilities || [])) {
      lastUnlockedCaps.add(cap);
    }
  }

  // Initialize fundraise state tracking
  lastFundraiseState = {};
  for (const [roundId, state] of Object.entries(gameState.fundraiseRounds || {})) {
    lastFundraiseState[roundId] = state.raised || false;
  }

  // Initialize strategic choice tracking
  lastStrategicChoices = {};
  for (const [choiceId, choice] of Object.entries(gameState.strategicChoices || {})) {
    lastStrategicChoices[choiceId] = choice.selected || null;
  }

  // Recreate interval if it was cleared by stopPlaytestLog
  if (!loggerInterval) {
    loggerInterval = setInterval(() => {
      if (logging) {
        playtestLoggerTick();
        checkStateChanges();
      }
    }, 1000);
  }

  // Initial entry with actual game time
  addEntry(`${getTimestamp()} START arc=${gameState.arc} phase=${gameState.phase}`);
  addEntry(createSnapshot());

  console.log('Playtest logging started. Use exportPlaytestLog() to download.');
}

function stopPlaytestLog() {
  if (!logging) {
    console.log('Playtest logging not active');
    return;
  }

  // Flush any pending slider entry
  if (sliderDebounceTimeout) {
    clearTimeout(sliderDebounceTimeout);
    if (pendingSliderEntry) {
      addEntry(pendingSliderEntry);
      pendingSliderEntry = null;
    }
    sliderDebounceTimeout = null;
  }

  // Flush any pending queue actions
  flushQueueActions();

  // Final snapshot
  addEntry(createSnapshot());
  addEntry(`${getTimestamp()} END`);

  logging = false;
  window.removeEventListener('beforeunload', flushToLocalStorage);
  try { localStorage.setItem('playtest-logging-enabled', 'false'); } catch { /* ignore */ }

  // Clear the snapshot interval
  if (loggerInterval) {
    clearInterval(loggerInterval);
    loggerInterval = null;
  }

  console.log(`Playtest logging stopped. ${logEntries.length} entries captured.`);
}

function clearPlaytestLog() {
  logEntries = [];
  try {
    localStorage.removeItem('playtest-log-backup');
  } catch {
    // Ignore storage errors
  }
  console.log('[Playtest Logger] Log cleared');
}

function createMarkdownHeader() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 16).replace('T', ' ') + ' GMT';
  const duration = formatGameTime(gameState.timeElapsed);

  return `# Playtest Log

- **Date**: ${dateStr}
- **Duration**: ${duration} (game time)
- **Arc**: ${gameState.arc}, **Phase**: ${gameState.phase}

---

`;
}

function exportPlaytestLog() {
  if (logEntries.length === 0) {
    console.log('No log entries to export. Start logging with startPlaytestLog()');
    return;
  }

  const header = createMarkdownHeader();
  const content = header + logEntries.join('\n');
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  // Filename: yyyy-mm-dd-hh-mm-playtest-manual-log.md (GMT)
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const filename = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}-${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-playtest-manual-log.md`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Exported ${logEntries.length} entries to ${filename}`);
}

function getPlaytestLog() {
  return [...logEntries];
}

function getPlaytestLogMarkdown() {
  if (logEntries.length === 0) return '';
  return createMarkdownHeader() + logEntries.join('\n');
}

function isLogging() {
  return logging;
}

// --- Tick Hook (called from game loop) ---

function playtestLoggerTick() {
  checkSnapshot();
}

// Programmatic tick for synchronous bot runs (where setInterval doesn't fire).
// Call this every game-second from the bot's tick loop.
function playtestLoggerGameTick() {
  if (!logging) return;
  playtestLoggerTick();   // checkSnapshot() — game-time driven
  checkStateChanges();    // arc/phase/unlock/fundraise detection
  flushQueueActions();    // flush batched actions (setTimeout won't fire in sync context)
}

// --- Monkey-patching for Action Hooks ---
// We wrap existing functions to intercept actions without modifying their source files

function installHooks() {
  let hooksInstalled = 0;
  const requiredHooks = ['enqueuePurchase', 'enqueueFurlough', 'enqueueFundraise'];

  // Hook enqueuePurchase
  const originalEnqueuePurchase = window.enqueuePurchase;
  if (originalEnqueuePurchase) {
    window.enqueuePurchase = function(purchasableId, quantity = 1, priority = false) {
      const result = originalEnqueuePurchase(purchasableId, quantity, priority);
      if (result !== null) {
        logQueueAction(purchasableId, quantity);
      }
      return result;
    };
    hooksInstalled++;
  } else {
    console.warn('[Playtest Logger] enqueuePurchase not found');
  }

  // Hook enqueueFurlough
  const originalEnqueueFurlough = window.enqueueFurlough;
  if (originalEnqueueFurlough) {
    window.enqueueFurlough = function(purchasableId, quantity = 1, priority = false) {
      const result = originalEnqueueFurlough(purchasableId, quantity, priority);
      if (result !== null) {
        logFurlough(purchasableId, quantity);
      }
      return result;
    };
    hooksInstalled++;
  } else {
    console.warn('[Playtest Logger] enqueueFurlough not found');
  }

  // Hook enqueueFundraise
  const originalEnqueueFundraise = window.enqueueFundraise;
  if (originalEnqueueFundraise) {
    window.enqueueFundraise = function(roundId, priority = false) {
      const result = originalEnqueueFundraise(roundId, priority);
      if (result !== null) {
        logFundraise(roundId);
      }
      return result;
    };
    hooksInstalled++;
  } else {
    console.warn('[Playtest Logger] enqueueFundraise not found');
  }

  // Hook makeStrategicChoice
  const originalMakeStrategicChoice = window.makeStrategicChoice;
  if (originalMakeStrategicChoice) {
    window.makeStrategicChoice = function(choiceId, optionId) {
      const result = originalMakeStrategicChoice(choiceId, optionId);
      if (result) {
        logStrategicChoice(choiceId, optionId);
      }
      return result;
    };
  }

  // Hook purchaseBulkSource
  const originalPurchaseBulkSource = window.purchaseBulkSource;
  if (originalPurchaseBulkSource) {
    window.purchaseBulkSource = function(sourceId) {
      const result = originalPurchaseBulkSource(sourceId);
      if (result) {
        logDataSource(sourceId, 'bulk');
      }
      return result;
    };
  }

  // Hook toggleRenewable
  const originalToggleRenewable = window.toggleRenewable;
  if (originalToggleRenewable) {
    window.toggleRenewable = function(sourceId) {
      const result = originalToggleRenewable(sourceId);
      if (result) {
        logDataSource(sourceId, 'renewable');
      }
      return result;
    };
  }

  // Hook purchaseGenerator
  const originalPurchaseGenerator = window.purchaseGenerator;
  if (originalPurchaseGenerator) {
    window.purchaseGenerator = function(tierId) {
      const result = originalPurchaseGenerator(tierId);
      if (result) logDataSource(tierId, 'generator');
      return result;
    };
  }

  // Return true if all required hooks were installed
  return hooksInstalled === requiredHooks.length;
}

// Track state for detecting changes
let lastArc = null;
let lastPhase = null;
let lastUnlockedCaps = new Set();
let lastFundraiseState = {};  // roundId → raised boolean
let lastStrategicChoices = {};  // choiceId → selected optionId

function checkStateChanges() {
  if (!logging) return;

  // Arc transitions
  if (lastArc !== null && gameState.arc !== lastArc) {
    logArcTransition(gameState.arc);
  }
  lastArc = gameState.arc;

  // Phase transitions
  if (lastPhase !== null && gameState.phase !== lastPhase) {
    logPhaseTransition(gameState.phase);
  }
  lastPhase = gameState.phase;

  // Capability unlocks
  const currentCaps = new Set();
  for (const track of Object.values(gameState.tracks)) {
    for (const cap of (track.unlockedCapabilities || [])) {
      currentCaps.add(cap);
    }
  }

  for (const cap of currentCaps) {
    if (!lastUnlockedCaps.has(cap)) {
      logUnlock(cap);
    }
  }
  lastUnlockedCaps = currentCaps;

  // Fundraise completions
  for (const [roundId, state] of Object.entries(gameState.fundraiseRounds || {})) {
    const wasRaised = lastFundraiseState[roundId] || false;
    if (state.raised && !wasRaised) {
      // Find the disbursement to get valuation info
      const disbursement = (gameState.disbursements || []).find(d => d.roundId === roundId);
      const rawVal = disbursement?.lockedMultiplier;
      const valuation = rawVal != null ? rawVal.toFixed(0) : '?';
      logFundraiseComplete(roundId, valuation, state.raisedAmount || 0);
    }
    lastFundraiseState[roundId] = state.raised || false;
  }

  // Strategic choice selections
  for (const [choiceId, choice] of Object.entries(gameState.strategicChoices || {})) {
    const selected = choice.selected;
    if (selected && selected !== lastStrategicChoices[choiceId]) {
      logStrategicChoice(choiceId, selected);
    }
    lastStrategicChoices[choiceId] = selected || null;
  }
}

// --- Initialization ---

let loggerInterval = null;

function initPlaytestLogger() {
  // Check for ?log=true URL param
  const params = new URLSearchParams(window.location.search);
  if (params.get('log') === 'true' || localStorage.getItem('playtest-logging-enabled') === 'true') {
    // Delay start slightly to let game initialize
    setTimeout(startPlaytestLog, 100);
  } else {
    // Log available commands for manual use
    console.log('%c[Playtest Logger] Commands: startPlaytestLog() | stopPlaytestLog() | exportPlaytestLog()', 'color: #888');
  }

  // Install hooks with retry logic to handle varying load times
  function tryInstallHooks(attempt = 0) {
    const maxAttempts = 5;
    const installed = installHooks();
    if (!installed && attempt < maxAttempts) {
      setTimeout(() => tryInstallHooks(attempt + 1), 200);
    }
  }
  setTimeout(tryInstallHooks, 100);

  // Use our own interval for snapshots and state change detection
  // (Can't hook gameTick because setInterval captures the function reference before we can hook it)
  loggerInterval = setInterval(() => {
    if (logging) {
      playtestLoggerTick();
      checkStateChanges();
    }
  }, 1000);  // Check every second
}

// --- Exports ---

export {
  startPlaytestLog,
  stopPlaytestLog,
  clearPlaytestLog,
  exportPlaytestLog,
  getPlaytestLog,
  getPlaytestLogMarkdown,
  isLogging,
  logSliderChange,
  logDataSource,
  logAutomationPolicy,
  playtestLoggerGameTick,
  initPlaytestLogger
};

// Window exports for console access
if (typeof window !== 'undefined') {
  window.startPlaytestLog = startPlaytestLog;
  window.stopPlaytestLog = stopPlaytestLog;
  window.clearPlaytestLog = clearPlaytestLog;
  window.exportPlaytestLog = exportPlaytestLog;
  window.getPlaytestLog = getPlaytestLog;
  window.isPlaytestLogging = isLogging;
  window.playtestLoggerGameTick = playtestLoggerGameTick;
  window.getPlaytestLogMarkdown = getPlaytestLogMarkdown;
}
