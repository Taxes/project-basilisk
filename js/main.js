// Main Game Initialization and Loop

import { gameState, loadGame, rehydrateMessages, saveGame } from './game-state.js';
import { updateResources, updateForecasts } from './resources.js';
import { initializeEvents, checkResourceThresholdEvents, checkTimeBasedEvents } from './events.js';
import { updateUI, initializeUI, setOnHardReset, notify } from './ui.js';
import { showEndingModal, showChangelog } from './ui/modals.js';
import { initializePhaseCompletion, checkPhaseCompletion } from './phase-completion.js';
import { initializeCompetitor, updateCompetitor } from './competitor.js';
import { checkEndings } from './endings.js';
// checkIncidents disabled: incidents need UX rework (#333)
// resetForPrestige/transitionToArc2: not yet used in Arc 1
import { initializeNewsFeed, updateNewsFeed, checkAlignmentNews, checkAlignmentDebt, checkAlignmentTaxEvent } from './news-feed.js';
import { checkAIRequests } from './ai-requests.js';
import { checkConsequenceEvents } from './consequence-events.js';
import { updateAlignmentTaxEffects } from './alignment-tax-handler.js';
// triggerExtinctionSequence: not yet used in Arc 1
import { BALANCE } from '../data/balance.js';
import { checkChoiceUnlocks } from './strategic-choices.js';
import { checkTutorialTriggers, initTutorialContent } from './tutorial-messages.js';
import { checkFundraiseGates } from './capabilities.js';
// strategicChoiceDefinitions: accessed via test-api.js
import { updateSubMetrics } from './safety-metrics.js';
import { processQueue, applyPassiveDrift, initFocusQueueExports, restoreQueueIdCounter, processDisbursements } from './focus-queue.js';
import { processCEOFocus } from './ceo-focus.js';
import { processGrants, processCredit, initEconomicsExports } from './economics.js';
import { processPoolGrowth } from './talent-pool.js';
import { processAutomation } from './automation.js';
import { processDataQuality } from './data-quality.js';
import { milestone } from './analytics.js';
import { checkMoratoriumTriggers, processMoratorium, initializeMoratoriums } from './moratoriums.js';
import { samplePersonalitySignals, calculatePersonalityAxes } from './personality.js';
import { applyDebugSettings } from './debug-commands.js';
// VERSION: accessed via test-api.js
import { initPlaytestLogger } from './playtest-logger.js';
import { requestFullUpdate } from './ui/signals.js';
import { initializeMessages, checkMessageDeadlines, setOnNewMessageCallback, addInfoMessage, restoreMessageIdCounter, hasMessageBeenTriggered, markMessageTriggered } from './messages.js';
import { initializeTabNavigation, updateTabBadge, navigateToMessage } from './ui/tab-navigation.js';
import { initTutorialController, checkTutorialSteps } from './tutorial-controller.js';
import { initCueCards } from './ui/cue-cards.js';
import { initializeMessagesPanel, updatePauseOverlay, prependNewMessage } from './ui/messages-panel.js';
import { updateFavicon } from './favicon.js';
import { initializeFarewells, checkFarewells } from './farewells.js';
import { showNarrativeModal } from './narrative-modal.js';
import { onboardingMessage } from './content/message-content.js';
import { VERSION } from './version.js';
import { changelog } from './changelog.js';

// Import content
import { phase1Events } from './content/events-phase1.js';
import { phase2Events } from './content/events-phase2.js';
import { phase3Events } from './content/events-phase3.js';

// Side-effect import: expose internal functions to window for playtester harness
import './test-api.js';


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

  // 1z. Check farewell sequence (must run before checkEndings)
  checkFarewells();

  // 2. Check for events
  checkResourceThresholdEvents();
  checkTimeBasedEvents();

  // Check for strategic choice unlocks
  checkChoiceUnlocks();

  // Check for tutorial message triggers
  checkTutorialTriggers();

  // Check cue card tutorial steps
  checkTutorialSteps();

  // 3. Update UI
  updateUI();

  // 4. Check for phase completion
  checkPhaseCompletion();

  // 5. Check for game endings
  const endingId = checkEndings();
  if (endingId && !gameState.endingTriggered) {
    showEndingModal(endingId);
  }

  // 6. Update favicon color based on AGI progress
  updateFavicon(gameState.agiProgress || 0);

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
      checkTutorialSteps();  // Tutorial cards pause the game; still need trigger checks
      updateForecasts();
      updateUI();
      return;
    }

    const scaledDelta = deltaTime * (gameState.gameSpeed || 1);
    gameState.timeElapsed += scaledDelta;
    gameTick(scaledDelta);
  }, BALANCE.TICK_RATE);

  // Save on page close/refresh as safety net
  window.addEventListener('beforeunload', () => saveGame());
  window.addEventListener('pagehide', () => saveGame());
}

// Handle first-time onboarding modal + inbox message
export function handleOnboarding() {
  // Send KTech reference message once per playthrough
  // Note: on first load, this runs before the modal so we can capture the
  // message ID for navigateToMessage in onDismiss.
  let guideMessageId = null;
  if (!hasMessageBeenTriggered('ktech_user_guide')) {
    const { sender, subject, body, tags } = onboardingMessage;
    const msg = addInfoMessage(sender, subject, body, null, tags, 'ktech_user_guide');
    guideMessageId = msg.id;
    markMessageTriggered('ktech_user_guide');
  }

  if (!gameState.onboardingComplete) {
    // First time — start paused, show modal
    gameState.paused = true;
    gameState.pauseStartTime = Date.now();
    showNarrativeModal({
      title: 'KTech Lab Operations Dashboard',
      narrative: `
        <p>Thanks for trying KTech's Lab Operations Dashboard!</p>
        <p>I set up your instance as "Project Basilisk" (cool name, by the way - does it mean anything?). Prof. Shannon told me you were starting a lab and strongly suggested I get you on board. His exact words were "set it up for them," so I did. Don't worry about the licensing fees; consider this a beta arrangement.</p>
        <p>Two main screens: <strong>Dashboard</strong> is where you run your lab - funding, personnel, compute, all of it. <strong>Messages</strong> is your inbox. I built some priority-detection algorithms that I'm pretty proud of, so important stuff should float to the top.</p>
        <p>I'd start with Messages. Prof. Shannon likes to send a welcome letter to his mentees (he's done it for as long as I've known him), and I'll send a proper user guide over there once you're settled in.</p>
        <p>I've paused time for you so you can look around. Hit <strong>Play</strong> (top-right) or press <strong>Space</strong> when you're ready to go.</p>
        <p>If anything breaks, just let me know. You're technically my first real user, so feedback welcome :)</p>
        <p>– Ken</p>
      `,
      phaseClass: 'phase-onboarding',
      buttonText: 'Begin Operations',
      noDismissOnBackdrop: true,
      onDismiss: () => {
        gameState.onboardingComplete = true;
        if (guideMessageId) {
          navigateToMessage(guideMessageId);
        }
        milestone('game_started');
      },
    });
  } else {
    // Returning player — stay paused so player can orient
    gameState.paused = true;
    gameState.pauseStartTime = Date.now();
  }
}

// Initialize game
function initializeGame() {
  console.log('Initializing AGI Incremental...');

  // Register game version as a PostHog super property (attached to every event)
  if (typeof posthog !== 'undefined' && typeof posthog.register === 'function') { // eslint-disable-line no-undef
    posthog.register({ game_version: VERSION }); // eslint-disable-line no-undef
  }

  // Load event content (capability content is handled by track system)
  initializeEvents([phase1Events, phase2Events, phase3Events]);

  // Load saved game or start fresh
  const loaded = loadGame();
  // Track save imports (before clearing the flag)
  if (loaded && sessionStorage.getItem('agi-import-pending')) {
    milestone('save_imported', {
      milestones_in_save: [...(gameState.firedMilestones || [])],
      arc: gameState.arc,
      phase: gameState.phase,
      prestige_count: gameState.prestigeCount || 0,
    }, `save_imported_${Date.now()}`);
  }
  // Clear import guard now that load is complete (safe to save again)
  sessionStorage.removeItem('agi-import-pending');
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

  // Initialize message system (must happen before rehydration so tutorial
  // content is registered in the content index)
  initializeMessages();
  initTutorialContent();

  // Rehydrate stripped message bodies now that all content is registered
  rehydrateMessages();

  // Set up message notification callback
  setOnNewMessageCallback((msg) => {
    updateTabBadge();
    prependNewMessage(msg);
    if (msg.priority === 'critical') {
      updatePauseOverlay();
    }
    // Flash the Messages tab for non-news messages
    if (msg.type !== 'news') {
      const tab = document.querySelector('.header-tab[data-tab="messages"]');
      if (tab) {
        tab.classList.remove('flash');
        // Force reflow so re-adding the class restarts the animation
        void tab.offsetWidth;
        tab.classList.add('flash');
        tab.addEventListener('animationend', () => tab.classList.remove('flash'), { once: true });
      }
    }
  });

  // Welcome message is now handled by tutorial-messages.js

  // Initialize news feed
  initializeNewsFeed();

  // Initialize UI
  initializeUI();
  setOnHardReset(() => handleOnboarding());

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

  // Initialize cue card tutorial
  initCueCards();
  initTutorialController();

  // Initialize messages panel
  initializeMessagesPanel();

  // Initialize farewell modal system
  initializeFarewells();

  // Seed computed state so first UI render has data (e.g. CEO Focus panel)
  processCEOFocus(0);

  // Initial UI update
  updateUI();
  updateTabBadge();

  // Set favicon to match current AGI progress
  updateFavicon(gameState.agiProgress || 0);

  // Handle onboarding (must be after UI init so modal DOM exists)
  handleOnboarding();

  // Re-show ending modal if save was mid-ending (e.g. after import)
  // Clear endingTriggered first so showPrestigeModal/triggerEnding guards pass;
  // they will re-set it immediately.
  if (gameState.endingTriggered) {
    const endingToReshow = gameState.endingTriggered;
    gameState.endingTriggered = null;
    showEndingModal(endingToReshow);
  }

  // Version update toast for returning players
  if (loaded && gameState.lastSeenVersion != null && gameState.lastSeenVersion < VERSION && changelog[0]?.version === VERSION) {
    const preview = changelog[0]?.changes?.[0];
    const body = preview || 'See changelog in Settings.';
    notify(`Updated to v${VERSION}`, body, 'info', {
      duration: BALANCE.VERSION_TOAST_DURATION,
      onClick: () => showChangelog(),
      onDismiss: () => { gameState.lastSeenVersion = VERSION; },
    });
  }

  // Start game loop
  startGameLoop();

  // Initialize playtest logger (auto-starts if ?log=true in URL)
  initPlaytestLogger();

  // Skip DOM updates while tab is hidden (saves CPU/battery).
  // Game state keeps accumulating; UI catches up on tab return.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      gameState._backgroundMode = true;
      saveGame();
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
