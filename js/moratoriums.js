// Research Moratoriums - Voluntary capability pauses for alignment catch-up
// Three moratoriums at key capability thresholds give players strategic pause options

import { gameState } from './game-state.js';
import { BALANCE } from '../data/balance.js';
import { addActionMessage } from './messages.js';
import { addNewsItem } from './news-feed.js';
import { moratoriumMessages } from './content/message-content.js';
import { newsContent } from './content/news-content.js';

// T9 caps threshold for final moratorium calculation (raw; scaled by RP_THRESHOLD_SCALE at use)
const T9_CAPS_THRESHOLD = 9216000000;

// Moratorium definitions
const MORATORIUMS = {
  first: {
    id: 'first',
    threshold: BALANCE.MORATORIUM.FIRST_THRESHOLD,
    duration: BALANCE.MORATORIUM.FIRST_DURATION,
    competitorAccepts: false,
  },
  second: {
    id: 'second',
    threshold: BALANCE.MORATORIUM.SECOND_THRESHOLD,
    duration: BALANCE.MORATORIUM.SECOND_DURATION,
    competitorAccepts: false,
  },
  final: {
    id: 'final',
    threshold: T9_CAPS_THRESHOLD * BALANCE.MORATORIUM.FINAL_THRESHOLD_RATIO,
    duration: BALANCE.MORATORIUM.FINAL_DURATION,
    competitorAccepts: true, // Conditional on competitor progress
  },
};

// Initialize moratorium state
export function initializeMoratoriums() {
  if (!gameState.moratoriums) {
    gameState.moratoriums = {
      triggered: [],      // Moratorium IDs that have been triggered
      active: null,       // Currently active moratorium ID, or null
      endTime: 0,         // Game time when active moratorium ends
      competitorPaused: false,
    };
  }
}

// Check if a moratorium should trigger (called each tick)
export function checkMoratoriumTriggers() {
  // Only in Arc 2
  if (gameState.arc < 2) return;

  initializeMoratoriums();

  const capRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const triggered = gameState.moratoriums.triggered;

  // Check each moratorium in order
  for (const [key, def] of Object.entries(MORATORIUMS)) {
    if (triggered.includes(key)) continue;
    if (capRP < def.threshold * (BALANCE.RP_THRESHOLD_SCALE || 1)) continue;

    // Threshold crossed - trigger this moratorium
    triggered.push(key);
    triggerMoratoriumMessage(key, def);
    break; // Only trigger one at a time
  }
}

// Trigger the moratorium action message
function triggerMoratoriumMessage(moratoriumId, def) {
  const isFinal = moratoriumId === 'final';
  const competitorProgress = gameState.competitor?.progressToAGI || 0;
  const competitorWillPause = isFinal &&
    competitorProgress >= BALANCE.MORATORIUM.COMPETITOR_FINAL_ACCEPT_THRESHOLD;

  // News headline first
  const triggerKey = isFinal ? 'trigger_final' : 'trigger_standard';
  const triggerNews = newsContent.moratorium[triggerKey];
  addNewsItem(triggerNews.text, triggerNews.type);

  // Store competitor decision for use in effect
  gameState.moratoriums.pendingCompetitorPause = competitorWillPause;

  // Send action message
  const msg = getMoratoriumMessage(moratoriumId, competitorWillPause);
  addActionMessage(
    msg.sender,
    msg.subject,
    msg.body,
    msg.signature || null,
    msg.choices,
    msg.priority,
    msg.tags,
    `moratorium_${moratoriumId}`
  );
}

// Get the message template for a moratorium
function getMoratoriumMessage(moratoriumId, competitorWillPause) {
  const duration = MORATORIUMS[moratoriumId].duration;
  const durationMonths = Math.round(duration / 30);

  if (moratoriumId === 'final') {
    return moratoriumMessages.final(durationMonths, competitorWillPause);
  }

  const ordinal = moratoriumId === 'first' ? 'First' : 'Second';
  return moratoriumMessages.standard(moratoriumId, ordinal, durationMonths);
}

// Apply moratorium effect (called from message-effects.js)
export function applyMoratoriumEffect(moratoriumId, action) {
  initializeMoratoriums();

  if (action === 'accept') {
    const def = MORATORIUMS[moratoriumId];
    gameState.moratoriums.active = moratoriumId;
    gameState.moratoriums.endTime = gameState.timeElapsed + def.duration;

    // Check if competitor should also pause (final moratorium only)
    if (moratoriumId === 'final' && gameState.moratoriums.pendingCompetitorPause) {
      gameState.moratoriums.competitorPaused = true;
    }

    const acceptedNews = newsContent.moratorium.accepted;
    addNewsItem(acceptedNews.text.replace('{durationMonths}', Math.round(def.duration / 30)), acceptedNews.type);
  }
  // For reject, effects are handled by the message choice effects
}

// Process active moratorium (called each tick)
export function processMoratorium(deltaTime) {
  if (gameState.arc < 2) return;

  initializeMoratoriums();

  const active = gameState.moratoriums.active;
  if (!active) return;

  // Check if moratorium has ended
  if (gameState.timeElapsed >= gameState.moratoriums.endTime) {
    endMoratorium();
  }
}

// End the active moratorium
function endMoratorium() {
  const active = gameState.moratoriums.active;
  if (!active) return;

  gameState.moratoriums.active = null;
  gameState.moratoriums.endTime = 0;
  gameState.moratoriums.competitorPaused = false;

  const endedNews = newsContent.moratorium.ended;
  addNewsItem(endedNews.text, endedNews.type);
}

// Check if capabilities research is paused by moratorium
export function isMoratoriumActive() {
  initializeMoratoriums();
  return gameState.moratoriums?.active !== null;
}

// Check if competitor is paused by moratorium
export function isCompetitorPausedByMoratorium() {
  initializeMoratoriums();
  return gameState.moratoriums?.competitorPaused === true;
}

// Get moratorium status for UI/debugging
export function getMoratoriumStatus() {
  initializeMoratoriums();
  const m = gameState.moratoriums;
  return {
    active: m.active,
    endTime: m.endTime,
    remaining: m.active ? Math.max(0, m.endTime - gameState.timeElapsed) : 0,
    competitorPaused: m.competitorPaused,
    triggered: m.triggered,
  };
}

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.checkMoratoriumTriggers = checkMoratoriumTriggers;
  window.processMoratorium = processMoratorium;
  window.isMoratoriumActive = isMoratoriumActive;
  window.isCompetitorPausedByMoratorium = isCompetitorPausedByMoratorium;
  window.getMoratoriumStatus = getMoratoriumStatus;
  window.applyMoratoriumEffect = applyMoratoriumEffect;
}
