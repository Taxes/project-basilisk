// Main Game Initialization and Loop

import { gameState, loadGame, saveGame, resetGame } from './game-state.js';
import { updateResources, updateForecasts } from './resources.js';
import { initializeEvents, checkResourceThresholdEvents, checkTimeBasedEvents } from './events.js';
import { updateUI, initializeUI } from './ui.js';
import { showEndingModal } from './ui/modals.js';
import { initializePhaseCompletion, checkPhaseCompletion } from './phase-completion.js';
import { initializeCompetitor, updateCompetitor } from './competitor.js';
import { checkEndings, triggerEnding } from './endings.js';
import { checkIncidents } from './incidents.js';
import { resetForPrestige, transitionToArc2 } from './prestige.js';
import { initializeNewsFeed, updateNewsFeed, checkAlignmentNews, checkAlignmentDebt, checkAlignmentTaxEvent } from './news-feed.js';
import { checkAIRequests } from './ai-requests.js';
import { checkConsequenceEvents } from './consequence-events.js';
import { updateAlignmentTaxEffects } from './alignment-tax-handler.js';
import { triggerExtinctionSequence } from './extinction-sequence.js';
import { BALANCE } from '../data/balance.js';
import { checkChoiceUnlocks } from './strategic-choices.js';
import { checkTutorialTriggers } from './tutorial-messages.js';
import { checkFundraiseGates } from './capabilities.js';
import { strategicChoiceDefinitions } from '../data/strategic-choices.js';
import { updateSubMetrics } from './safety-metrics.js';
import { processQueue, applyPassiveDrift, initFocusQueueExports, restoreQueueIdCounter, resetQueueIdCounter, processDisbursements } from './focus-queue.js';
import { processGrants, processCredit, initEconomicsExports } from './economics.js';
import { processPoolGrowth } from './talent-pool.js';
import { processAutomation } from './automation.js';
import { processDataQuality } from './data-quality.js';
import { checkMoratoriumTriggers, processMoratorium, initializeMoratoriums } from './moratoriums.js';
import { samplePersonalitySignals, calculatePersonalityAxes } from './personality.js';
import { applyDebugSettings } from './debug-commands.js';
import { VERSION } from './version.js';
import { initPlaytestLogger } from './playtest-logger.js';
import { requestFullUpdate } from './ui/signals.js';
import { initializeMessages, checkMessageDeadlines, setOnNewMessageCallback, addInfoMessage, restoreMessageIdCounter } from './messages.js';
import { initializeTabNavigation, updateTabBadge } from './ui/tab-navigation.js';
import { initializeMessagesPanel, updatePauseOverlay, renderMessagesPanel } from './ui/messages-panel.js';

// Import content
import { phase1Events } from './content/events-phase1.js';
import { phase2Events } from './content/events-phase2.js';
import { phase3Events } from './content/events-phase3.js';

// Side-effect import: expose internal functions to window for playtester harness
import './test-api.js';
import './debug-commands.js';

// Track last deadline check time
let lastDeadlineCheck = 0;

// Game tick function
function gameTick(deltaTime) {
  // -1. Check message deadlines (once per second, not every tick)
  if (gameState.timeElapsed - lastDeadlineCheck >= 1000) {
    checkMessageDeadlines();
    lastDeadlineCheck = gameState.timeElapsed;
    // If we just paused for messages, update UI and return early
    if (gameState.paused && (gameState.pauseReason === 'critical_message' || gameState.pauseReason === 'message_deadline')) {
      updatePauseOverlay();
      updateUI();
      return;
    }
  }

  // --- FUNDING WATCHDOG: snapshot before all processing ---
  const _wdBefore = gameState.resources.funding;
  const _wdSnapshots = {};
  const _wdSnap = (label) => { _wdSnapshots[label] = gameState.resources.funding; };

  // 0. Process focus queue and passive drift
  processQueue(deltaTime);
  _wdSnap('processQueue');
  // 0a. Process data quality system (renewables, generators, quality)
  processDataQuality(deltaTime);
  // 0b. Process tranche disbursements (fundraise payouts arriving over time)
  processDisbursements(deltaTime);
  _wdSnap('processDisbursements');
  // 0c. Process grants (rate-based income)
  processGrants(deltaTime);
  _wdSnap('processGrants');
  applyPassiveDrift(deltaTime);

  // 0c2. Process talent pool growth
  processPoolGrowth(deltaTime);

  // 0d. Process passive automation (recruiting team, procurement team)
  // Must run before updateResources so automation capex is included in funding breakdown
  processAutomation(deltaTime);
  _wdSnap('processAutomation');

  // 1. Update resources based on rates
  updateResources(deltaTime);
  _wdSnap('updateResources');

  // 1a. Process line of credit (interest, bankruptcy check)
  processCredit(deltaTime);
  _wdSnap('processCredit');

  // --- FUNDING WATCHDOG: check for anomalous change ---
  const _wdAfter = gameState.resources.funding;
  const _wdDelta = _wdAfter - _wdBefore;
  const _wdExpectedRate = gameState.computed?.revenue?.freeCashFlow || 0;
  const _wdExpectedDelta = _wdExpectedRate * deltaTime;
  // Trigger if actual change deviates from expected by more than 2x the expected magnitude
  const _wdThreshold = Math.max(Math.abs(_wdExpectedDelta) * 2, 100); // floor of $100 to avoid noise
  if (Math.abs(_wdDelta - _wdExpectedDelta) > _wdThreshold) {
    const steps = {};
    let prev = _wdBefore;
    for (const [label, val] of Object.entries(_wdSnapshots)) {
      steps[label] = +(val - prev).toFixed(2);
      prev = val;
    }
    console.warn(
      `[FUNDING WATCHDOG] Anomaly detected at t=${gameState.timeElapsed.toFixed(1)}s, dt=${deltaTime.toFixed(4)}s\n` +
      `  Before: $${_wdBefore.toFixed(0)} → After: $${_wdAfter.toFixed(0)} (Δ${_wdDelta.toFixed(0)})\n` +
      `  Expected Δ: ${_wdExpectedDelta.toFixed(0)} (rate: ${_wdExpectedRate.toFixed(0)}/s)\n` +
      `  Per-step deltas:`, steps
    );
  }

  // 1a2. Check fundraise round revenue gates (after revenue calc)
  checkFundraiseGates();

  // 1b. Update competitor
  updateCompetitor(deltaTime);

  // 1c. Check for safety incidents (Phase 2+)
  // checkIncidents(deltaTime); // Disabled: incidents need UX rework (#333)

  // 1d.5 Update alignment sub-metrics (Arc 2)
  updateSubMetrics(deltaTime);

  // 1d. Update news feed
  updateNewsFeed();

  // 1e. Check for ambient alignment news
  checkAlignmentNews();

  // 1f. Check for alignment debt news (Arc 2)
  checkAlignmentDebt();

  // 1g. Alignment consequences system (Arc 2)
  if (gameState.arc >= 2) {
    checkAIRequests();
    checkConsequenceEvents(deltaTime);
    checkAlignmentTaxEvent(deltaTime);
    updateAlignmentTaxEffects();
    checkMoratoriumTriggers();
    processMoratorium(deltaTime);

    // 1h. Personality tracking (Arc 2) - sample every 60 ticks (~2 sec)
    gameState._personalityTickCounter++;
    if (gameState._personalityTickCounter >= 60) {
      gameState._personalityTickCounter = 0;
      samplePersonalitySignals();
      calculatePersonalityAxes();
    }
  }

  // 2. Check for events
  checkResourceThresholdEvents();
  checkTimeBasedEvents();

  // Check for strategic choice unlocks
  checkChoiceUnlocks();

  // Check for tutorial message triggers
  checkTutorialTriggers();

  // 3. Update UI
  updateUI();

  // 4. Check for phase completion
  checkPhaseCompletion();

  // 5. Check for game endings
  const endingId = checkEndings();
  if (endingId && !gameState.endingTriggered) {
    showEndingModal(endingId);
  }

}

// Start game loop
function startGameLoop() {
  let lastSave = Date.now();

  setInterval(() => {
    const now = Date.now();
    const deltaTime = (now - gameState.lastTick) / 1000; // Convert to seconds
    gameState.lastTick = now;

    // Periodic save on wall-clock time (works even while paused)
    if (now - lastSave >= BALANCE.SAVE_INTERVAL * 1000) {
      saveGame();
      lastSave = now;
    }

    // Skip time advancement and game logic if paused, but still update forecasts + UI
    if (gameState.paused) {
      updateForecasts();
      updateUI();
      return;
    }

    const scaledDelta = deltaTime * (gameState.gameSpeed || 1);
    gameState.timeElapsed += scaledDelta;
    gameTick(scaledDelta);
  }, BALANCE.TICK_RATE);

  // Save on page close as safety net
  window.addEventListener('beforeunload', () => saveGame());
}

// Initialize game
function initializeGame() {
  console.log('Initializing AGI Incremental...');

  // Load event content (capability content is handled by track system)
  initializeEvents([phase1Events, phase2Events, phase3Events]);

  // Load saved game or start fresh
  const loaded = loadGame();
  if (loaded) {
    // Restore focus queue ID counter so new items don't collide with saved IDs
    restoreQueueIdCounter();
    // Restore message ID counter
    restoreMessageIdCounter();
    console.log('Loaded saved game');
  } else {
    console.log('Starting new game');
  }

  // Restore persisted debug settings (separate from game save)
  applyDebugSettings();

  // Initialize message system
  initializeMessages();

  // Set up message notification callback
  setOnNewMessageCallback((msg) => {
    updateTabBadge();
    if (msg.priority === 'critical') {
      updatePauseOverlay();
    }
  });

  // Welcome message is now handled by tutorial-messages.js

  // Initialize news feed
  initializeNewsFeed();

  // Initialize UI
  initializeUI();

  // Initialize phase completion system
  initializePhaseCompletion();

  // Initialize competitor system
  initializeCompetitor();

  // Initialize moratoriums system (Arc 2)
  initializeMoratoriums();

  // Initialize focus queue exports
  initFocusQueueExports();

  // Initialize economics exports
  initEconomicsExports();

  // Initialize tab navigation
  initializeTabNavigation();

  // Initialize messages panel
  initializeMessagesPanel();

  // Initial UI update
  updateUI();
  updateTabBadge();

  // Start game loop
  startGameLoop();

  // Initialize playtest logger (auto-starts if ?log=true in URL)
  initPlaytestLogger();

  // Skip DOM updates while tab is hidden (saves CPU/battery).
  // Game state keeps accumulating; UI catches up on tab return.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      gameState._backgroundMode = true;
    } else {
      gameState._backgroundMode = false;
      requestFullUpdate();  // snap all displays to current state
    }
  });

  console.log('Game initialized successfully!');
}

// Start game when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}

// gameTick stays here because it is a local function that cannot be imported
// without a circular dependency (main.js is the entry point).
window.gameTick = gameTick;
