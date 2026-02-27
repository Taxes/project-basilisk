// Tutorial State Machine
// Sequential with skip-ahead: if step N+1's condition is met before N is dismissed,
// N auto-advances. Each step gates on all prior steps being completed.

import { gameState } from './game-state.js';
import { milestone } from './analytics.js';

const MAIN_SEQUENCE_END = 23;  // Last step in the main tutorial sequence

// Advance to the next step (or skip ahead if conditions already met)
export function completeTutorialStep(step, method = 'dismiss') {
  if (step <= MAIN_SEQUENCE_END && step > gameState.tutorial.currentStep) {
    gameState.tutorial.currentStep = step;
  }
  // Mark post-tutorial steps individually
  if (step > MAIN_SEQUENCE_END) {
    if (!gameState.tutorial.completedPostSteps.includes(step)) {
      gameState.tutorial.completedPostSteps.push(step);
    }
  }
  gameState.tutorial.active = false;
  gameState.tutorial.shownStep = 0;

  milestone('tutorial_step_completed', {
    step,
    step_name: getStepName(step),
    method,  // 'action' | 'dismiss' | 'skip-ahead'
  }, `tutorial_step_completed_${step}`);

  // Check if this was the final main sequence step
  if (step === MAIN_SEQUENCE_END) {
    milestone('tutorial_finished', {
      total_time_seconds: Math.round(gameState.timeElapsed),
    });
  }
}

// Show a tutorial step card
export function showTutorialStep(step) {
  gameState.tutorial.active = true;
  gameState.tutorial.shownStep = step;

  milestone('tutorial_step_shown', {
    step,
    step_name: getStepName(step),
  }, `tutorial_step_shown_${step}`);
}

// Skip the entire tutorial
export function skipTutorial() {
  const currentStep = gameState.tutorial.shownStep || gameState.tutorial.currentStep;
  gameState.tutorial.dismissed = true;
  gameState.tutorial.active = false;
  gameState.tutorial.shownStep = 0;

  milestone('tutorial_skipped', { step: currentStep }, 'tutorial_skipped');
}

// Resume tutorial from Settings
export function resumeTutorial() {
  gameState.tutorial.dismissed = false;
  gameState.tutorial.disabled = false;

  milestone('tutorial_resumed', {
    step: gameState.tutorial.currentStep + 1,
  }, `tutorial_resumed_${Date.now()}`);  // unique key so resume can fire multiple times
}

// Restart tutorial from Settings
export function restartTutorial() {
  gameState.tutorial.currentStep = 0;
  gameState.tutorial.dismissed = false;
  gameState.tutorial.disabled = false;
  gameState.tutorial.active = false;
  gameState.tutorial.shownStep = 0;
  gameState.tutorial.completedPostSteps = [];
}

// Disable tutorial entirely from Settings
export function disableTutorial() {
  gameState.tutorial.disabled = true;
  gameState.tutorial.active = false;
  gameState.tutorial.shownStep = 0;
}

// Is the tutorial system active? (not disabled, not dismissed)
export function isTutorialActive() {
  return !gameState.tutorial.disabled && !gameState.tutorial.dismissed && gameState.arc === 1;
}

// Is the tutorial system enabled at all? (for post-tutorial standalone steps)
export function isTutorialEnabled() {
  return !gameState.tutorial.disabled && gameState.arc === 1;
}

// Get step name for analytics (registered from tutorial-steps.js to avoid circular dep)
let stepNameLookup = {};
export function registerStepNames(names) {
  stepNameLookup = names;
}
function getStepName(step) {
  return stepNameLookup[step] || `step_${step}`;
}
