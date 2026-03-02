// Tutorial Controller
// Checks tutorial step triggers each tick and manages card lifecycle.
// Called from gameTick() and also from the paused-state UI loop in startGameLoop().

import { gameState } from './game-state.js';
import { isTutorialActive, isTutorialEnabled, completeTutorialStep, registerStepNames, getReviewModeTarget, clearReviewMode } from './tutorial-state.js';
import { TUTORIAL_STEPS, STEP_NAMES } from './content/tutorial-steps.js';
import { showCard, hideCard, isCardVisible, isBackdropActive, replaceCard, showFollowUpCard } from './ui/cue-cards.js';

let initialized = false;

// Track whether we're showing a follow-up card for the current step
let followUpActiveForStep = 0;

export function initTutorialController() {
  registerStepNames(STEP_NAMES);
  initialized = true;
}

// Called each tick from gameTick() AND from the paused-state loop.
// Must work correctly whether game is paused or not, since cards pause the game.
export function checkTutorialSteps() {
  if (!initialized) return;

  // Main sequence (sequential, steps 1-30)
  if (isTutorialActive()) {
    checkMainSequence();
  }

  // Post-tutorial standalone steps (31+)
  if (isTutorialEnabled()) {
    checkPostTutorialSteps();
  }
}

function checkMainSequence() {
  // Phase 1: If a card is showing, check if its advance gate is met
  const shownId = gameState.tutorial.shownStep;
  if (isCardVisible() && shownId > 0) {
    const shownDef = TUTORIAL_STEPS.find(s => s.id === shownId && s.phase === 'main');

    // Follow-up card is active — check follow-up advance
    if (followUpActiveForStep === shownId && shownDef?.followUp?.advance) {
      if (shownDef.followUp.advance(gameState)) {
        followUpActiveForStep = 0;
        completeTutorialStep(shownDef.id, 'skip-ahead');
        // Fall through to Phase 2 to find next step
      } else {
        return;  // Follow-up showing, advance not met
      }
    } else if (shownDef?.advance && shownDef.advance(gameState)) {
      // Primary advance met — check for follow-up
      if (shownDef.followUp) {
        followUpActiveForStep = shownId;
        showFollowUpCard(shownDef);
        return;
      }
      completeTutorialStep(shownDef.id, 'skip-ahead');
      // Don't hide or unpause — fall through to Phase 2 to find next step
    } else {
      return;  // Card showing, advance not met — nothing to do
    }
  }

  // Phase 2: Find the next step to show, skipping satisfied nav steps
  const reviewTarget = getReviewModeTarget();
  let nextId = gameState.tutorial.currentStep + 1;

  // Clear review mode once we've caught up
  if (reviewTarget > 0 && nextId > reviewTarget) {
    clearReviewMode();
  }

  const inReview = reviewTarget > 0 && nextId <= reviewTarget;

  // Loop to skip chains of already-satisfied nav steps
  for (let i = 0; i < 10; i++) {  // Safety cap to prevent infinite loops
    const def = TUTORIAL_STEPS.find(s => s.id === nextId && s.phase === 'main');
    if (!def || !def.trigger(gameState)) break;  // No more steps or trigger not met

    // Nav step already satisfied — silently complete and check next
    // In review mode, don't skip nav steps (show them so player sees all messages)
    if (!inReview && def.major === false && def.advance && def.advance(gameState)) {
      completeTutorialStep(def.id, 'skip-ahead');
      nextId = gameState.tutorial.currentStep + 1;
      continue;
    }

    // In review mode, make action-gated steps informational (add "Got it" escape)
    // but NOT nav steps — those still auto-advance when their condition is met
    const stepToShow = (inReview && def.advance && def.major !== false)
      ? { ...def, reviewMode: true }
      : def;

    // Found a step to show
    if (stepToShow.onShow) stepToShow.onShow();
    if (isCardVisible()) {
      replaceCard(stepToShow);
    } else {
      showCard(stepToShow);
    }
    return;
  }

  // Phase 3: Nothing to show — clean up any lingering card/backdrop
  if (isCardVisible() || isBackdropActive()) {
    hideCard();
    if (gameState.paused) gameState.paused = false;
  }
}

function checkPostTutorialSteps() {
  // Check if visible post-tutorial card should auto-advance
  if (isCardVisible()) {
    const shownStep = gameState.tutorial.shownStep;
    const shownDef = TUTORIAL_STEPS.find(s => s.id === shownStep && s.phase === 'post');
    if (shownDef?.advance && shownDef.advance(gameState)) {
      hideCard();
      completeTutorialStep(shownDef.id, 'skip-ahead');
      if (gameState.paused) gameState.paused = false;
    }
    return;  // Don't show a new card while one is visible
  }

  let shown = false;
  for (const stepDef of TUTORIAL_STEPS) {
    if (stepDef.phase !== 'post') continue;
    if (gameState.tutorial.completedPostSteps.includes(stepDef.id)) continue;

    if (stepDef.trigger(gameState)) {
      // Skip nav-like post steps if condition already met
      if (stepDef.major === false && stepDef.advance && stepDef.advance(gameState)) {
        completeTutorialStep(stepDef.id, 'skip-ahead');
        continue;  // Check for next post step
      }
      if (stepDef.onShow) stepDef.onShow();
      showCard(stepDef);
      shown = true;
      break;  // Show one at a time
    }
  }

  // Clean up lingering backdrop after dismissCard if no new step was shown
  if (!shown && isBackdropActive()) {
    hideCard();
  }
}
