// Tutorial Controller
// Checks tutorial step triggers each tick and manages card lifecycle.
// Called from gameTick() and also from the paused-state UI loop in startGameLoop().

import { gameState } from './game-state.js';
import { isTutorialActive, isTutorialEnabled, completeTutorialStep, registerStepNames } from './tutorial-state.js';
import { TUTORIAL_STEPS, STEP_NAMES } from './content/tutorial-steps.js';
import { showCard, hideCard, isCardVisible, replaceCard } from './ui/cue-cards.js';

let initialized = false;

export function initTutorialController() {
  registerStepNames(STEP_NAMES);
  initialized = true;
}

// Called each tick from gameTick() AND from the paused-state loop.
// Must work correctly whether game is paused or not, since cards pause the game.
export function checkTutorialSteps() {
  if (!initialized) return;

  // Main sequence (sequential, steps 1-23)
  if (isTutorialActive()) {
    checkMainSequence();
  }

  // Post-tutorial standalone steps (24-26)
  if (isTutorialEnabled()) {
    checkPostTutorialSteps();
  }
}

function checkMainSequence() {
  // Phase 1: If a card is showing, check if its advance gate is met
  const shownId = gameState.tutorial.shownStep;
  if (isCardVisible() && shownId > 0) {
    const shownDef = TUTORIAL_STEPS.find(s => s.id === shownId && s.phase === 'main');
    if (shownDef?.advance && shownDef.advance(gameState)) {
      completeTutorialStep(shownDef.id, 'skip-ahead');
      // Don't hide or unpause — fall through to Phase 2 to find next step
    } else {
      return;  // Card showing, advance not met — nothing to do
    }
  }

  // Phase 2: Find the next step to show, skipping satisfied nav steps
  let nextId = gameState.tutorial.currentStep + 1;
  // Loop to skip chains of already-satisfied nav steps
  for (let i = 0; i < 10; i++) {  // Safety cap to prevent infinite loops
    const def = TUTORIAL_STEPS.find(s => s.id === nextId && s.phase === 'main');
    if (!def || !def.trigger(gameState)) break;  // No more steps or trigger not met

    // Nav step already satisfied — silently complete and check next
    if (def.major === false && def.advance && def.advance(gameState)) {
      completeTutorialStep(def.id, 'skip-ahead');
      nextId = gameState.tutorial.currentStep + 1;
      continue;
    }

    // Found a step to show
    if (isCardVisible()) {
      replaceCard(def);
    } else {
      showCard(def);
    }
    return;
  }

  // Phase 3: Nothing to show — clean up any lingering card
  if (isCardVisible()) {
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

  for (const stepDef of TUTORIAL_STEPS) {
    if (stepDef.phase !== 'post') continue;
    if (gameState.tutorial.completedPostSteps.includes(stepDef.id)) continue;

    if (stepDef.trigger(gameState)) {
      // Skip nav-like post steps if condition already met
      if (stepDef.major === false && stepDef.advance && stepDef.advance(gameState)) {
        completeTutorialStep(stepDef.id, 'skip-ahead');
        continue;  // Check for next post step
      }
      showCard(stepDef);
      break;  // Show one at a time
    }
  }
}
