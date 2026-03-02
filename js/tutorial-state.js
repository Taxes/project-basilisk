// Tutorial State Machine
// Sequential with skip-ahead: if step N+1's condition is met before N is dismissed,
// N auto-advances. Each step gates on all prior steps being completed.

import { gameState } from './game-state.js';
import { milestone } from './analytics.js';

export const MAIN_SEQUENCE_END = 31;  // Last step in the main tutorial sequence

// Track when a card was shown for duration measurement
let cardShownAt = 0;

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

  if (MILESTONE_STEPS.has(step)) {
    const durationSeconds = cardShownAt > 0
      ? Math.round((performance.now() - cardShownAt) / 100) / 10
      : null;
    milestone('tutorial_step_completed', {
      step,
      step_name: getStepName(step),
      method,  // 'action' | 'dismiss' | 'skip-ahead'
      duration_seconds: durationSeconds,
    }, `tutorial_step_completed_${step}`);
  }

  // Check if this was the final main sequence step
  if (step === MAIN_SEQUENCE_END) {
    milestone('tutorial_finished', {
      total_time_seconds: Math.round(gameState.timeElapsed),
    });
  }
}

// Milestone steps for analytics — only these fire tutorial_step_completed
const MILESTONE_STEPS = new Set([1, 4, 5, 6, 8, 13, 16, 20, 28, 31]);

// Show a tutorial step card
export function showTutorialStep(step) {
  gameState.tutorial.active = true;
  gameState.tutorial.shownStep = step;
  cardShownAt = performance.now();
}

// Skip the entire tutorial
export function skipTutorial(source = 'main') {
  const currentStep = gameState.tutorial.shownStep || gameState.tutorial.currentStep;
  gameState.tutorial.dismissed = true;
  gameState.tutorial.active = false;
  gameState.tutorial.shownStep = 0;

  milestone('tutorial_skipped', { step: currentStep, step_name: getStepName(currentStep), source }, 'tutorial_skipped');
}

// Resume tutorial from Settings — re-show the last completed step
export function resumeTutorial() {
  gameState.tutorial.dismissed = false;
  gameState.tutorial.disabled = false;
  // Step back one so the controller re-shows the last completed step's message
  if (gameState.tutorial.currentStep > 0) {
    gameState.tutorial.currentStep -= 1;
  }
}

// Restart tutorial from Settings — enters review mode up to the previous position
export function restartTutorial() {
  const previousStep = gameState.tutorial.currentStep;
  gameState.tutorial.currentStep = 0;
  gameState.tutorial.dismissed = false;
  gameState.tutorial.disabled = false;
  gameState.tutorial.active = false;
  gameState.tutorial.shownStep = 0;
  // Review mode: show all steps as informational until caught up
  gameState.tutorial.reviewMode = previousStep > 0 ? previousStep : 0;

  milestone('tutorial_restarted', {
    previous_step: previousStep,
  }, `tutorial_restarted_${Date.now()}`);
}

// Disable tutorial entirely from Settings
export function disableTutorial() {
  gameState.tutorial.disabled = true;
  gameState.tutorial.active = false;
  gameState.tutorial.shownStep = 0;
}

// Disable post-tutorial hints (player clicked "Hide hints" on a hint card)
export function disableHints(source = 'post_tutorial') {
  gameState.tutorial.hintsDisabled = true;
  gameState.tutorial.active = false;
  gameState.tutorial.shownStep = 0;

  milestone('hints_disabled', { source }, 'hints_disabled');
}

// Is the tutorial system active? (not disabled, not dismissed)
export function isTutorialActive() {
  return !gameState.tutorial.disabled && !gameState.tutorial.dismissed && gameState.arc === 1;
}

// Are post-tutorial hints enabled? (gates standalone steps 31+)
// Independent of dismissed — players who skip the tutorial still get contextual hints.
export function isTutorialEnabled() {
  return !gameState.tutorial.disabled && !gameState.tutorial.hintsDisabled && gameState.arc === 1;
}

// Review mode: returns the step the player had reached before restart (0 if not in review mode)
export function getReviewModeTarget() {
  return gameState.tutorial.reviewMode || 0;
}

// Clear review mode (called when player catches up to where they were)
export function clearReviewMode() {
  gameState.tutorial.reviewMode = 0;
}

// Get step name for analytics (registered from tutorial-steps.js to avoid circular dep)
let stepNameLookup = {};
export function registerStepNames(names) {
  stepNameLookup = names;
}
function getStepName(step) {
  return stepNameLookup[step] || `step_${step}`;
}
