// Player-facing text: see docs/message-registry.json
// Competitor System

import { gameState, saveGame } from './game-state.js';
import { notify } from './ui.js';
import { isCapabilityUnlocked } from './capabilities.js';
import { addNewsItem, triggerNewsForEvent } from './news-feed.js';
import { COMPETITOR } from '../data/balance.js';
import { isCompetitorPausedByMoratorium } from './moratoriums.js';
import { isFarewellStalling } from './farewells.js';
import { newsContent, competitorBreakthroughs } from './content/news-content.js';

// Track which breakthroughs have been announced
let announcedBreakthroughs = new Set();

// Initialize competitor system
export function initializeCompetitor() {
  if (!gameState.competitor) {
    gameState.competitor = {
      progressToAGI: 0,
    };
  }
  // Ensure new fields exist on legacy saves
  if (gameState.competitor.progressToAGI === undefined) {
    gameState.competitor.progressToAGI = 0;
  }

  // Load announced breakthroughs from game state
  if (gameState.competitor.announcedBreakthroughs) {
    announcedBreakthroughs = new Set(gameState.competitor.announcedBreakthroughs);
  }
}

// Update competitor progress (called periodically)
export function updateCompetitor(deltaTime) {
  if (!gameState.competitor) {
    initializeCompetitor();
  }

  // Start competitor once the player unlocks scaling_laws, or after 25 min as fallback
  // (prevents avoiding the race entirely by never fundraising)
  const timerActivated = (gameState.timeElapsed || 0) >= COMPETITOR.ACTIVATION_TIMER;
  if (!isCapabilityUnlocked('scaling_laws') && !timerActivated) return;

  // Seed head start on first activation (competitor was already working before player noticed)
  if (gameState.competitor.progressToAGI === 0) {
    gameState.competitor.progressToAGI = COMPETITOR.HEAD_START;
  }

  // Progress to AGI — frozen during moratorium if competitor accepted the pause
  // Track elapsed time since activation for accelerating curve
  if (gameState.competitor.elapsedTime === undefined) {
    gameState.competitor.elapsedTime = 0;
  }

  // Accelerating curve for both arcs: rate increases linearly over duration
  const t = gameState.competitor.elapsedTime;
  let agiRate;
  if (gameState.arc === 2) {
    const accel = 1 + COMPETITOR.ARC_2_ACCEL * Math.min(t / COMPETITOR.ARC_2_DURATION, 1);
    agiRate = COMPETITOR.ARC_2_BASE_RATE * accel;
  } else {
    const accel = 1 + COMPETITOR.ARC_1_ACCEL * Math.min(t / COMPETITOR.ARC_1_DURATION, 1);
    agiRate = COMPETITOR.ARC_1_BASE_RATE * accel;
  }

  // Halve rival rate during farewell sequence when they're close to AGI
  const fw = gameState.farewells;
  if (fw?.sequenceStarted && gameState.competitor.progressToAGI >= 90) {
    agiRate *= 0.5;
  }

  // Lobbying event can slow competitor (e.g. competitorSlowdown: 0.25 → 75% reduction)
  agiRate *= (gameState.competitorProgressMult || 1.0);

  if (!isCompetitorPausedByMoratorium() && !isFarewellStalling()) {
    gameState.competitor.progressToAGI = Math.min(100,
      gameState.competitor.progressToAGI + (agiRate * deltaTime)
    );
    gameState.competitor.elapsedTime += deltaTime;
  }

  // Warn player when competitor AGI is imminent
  if (gameState.competitor.progressToAGI >= 95 && !gameState.competitor.imminentWarned) {
    gameState.competitor.imminentWarned = true;
    notify('Competitor AGI Imminent', 'Intelligence reports suggest OpenBrain is months from achieving AGI.', 'danger');
    addNewsItem('BREAKING: Sources say OpenBrain months from AGI breakthrough', 'competitor');
  }

  // Track position relative to player based on AGI progress
  const playerProgress = gameState.agiProgress || 0;
  const competitorProgress = gameState.competitor.progressToAGI;
  const previousPosition = gameState.competitor.position;
  const progressDelta = playerProgress - competitorProgress;

  let newPosition;
  if (progressDelta > 5) {
    newPosition = "behind";
  } else if (progressDelta < -5) {
    newPosition = "ahead";
  } else {
    newPosition = "even";
  }

  if (previousPosition !== newPosition) {
    gameState.competitor.position = newPosition;
    const positionKey = {
      behind: 'competitor_behind',
      ahead: 'competitor_ahead',
      even: 'competitor_close',
    };
    const newsEntry = newsContent.competitor[positionKey[newPosition]];
    if (newsEntry) {
      addNewsItem(newsEntry.text, newsEntry.type);
    }
  }

  // Check for competitor breakthrough announcements
  checkCompetitorBreakthroughs();

  // Check for competitor safety incident news
  checkCompetitorIncidents();
}

// Check if competitor should announce a breakthrough
// Keyed on AGI progress thresholds (evenly spaced across the 20-100% range)
function checkCompetitorBreakthroughs() {
  const progress = gameState.competitor.progressToAGI;
  for (const breakthrough of competitorBreakthroughs) {
    if (progress >= breakthrough.progress &&
        !announcedBreakthroughs.has(breakthrough.progress)) {

      // Announce the breakthrough (news feed only — no toast for informational items)
      addNewsItem(breakthrough.name, 'competitor');

      // Mark as announced
      announcedBreakthroughs.add(breakthrough.progress);
      gameState.competitor.announcedBreakthroughs = Array.from(announcedBreakthroughs);

      saveGame();
    }
  }
}

// Check for competitor safety incident news
// Triggered by competitor AGI progress, interleaved with breakthroughs
function checkCompetitorIncidents() {
  const competitorProgress = gameState.competitor?.progressToAGI || 0;

  const thresholds = [30, 50, 65, 80, 90, 95];
  for (const threshold of thresholds) {
    if (competitorProgress >= threshold) {
      triggerNewsForEvent('competitor_incident', threshold);
    }
  }
}
