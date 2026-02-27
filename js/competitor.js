// Player-facing text: see docs/message-registry.json
// Competitor System

import { gameState, saveGame } from './game-state.js';
import { notify } from './ui.js';
import { isCapabilityUnlocked, getAllTrackCapabilities } from './capabilities.js';
import { triggerEnding } from './endings.js';
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
      capabilityLevel: 0,
      position: "behind",
      lastUpdateTime: 0,
      marketStandard: 1,
      progressToAGI: 0,
    };
  }
  // Ensure new fields exist on legacy saves
  if (gameState.competitor.marketStandard === undefined) {
    gameState.competitor.marketStandard = 1;
  }
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

  // Start competitor timer once the player unlocks scaling_laws (first real breakthrough)
  if (!isCapabilityUnlocked('scaling_laws')) return;

  // Seed head start on first activation (competitor was already working before player noticed)
  if (gameState.competitor.progressToAGI === 0) {
    gameState.competitor.progressToAGI = COMPETITOR.HEAD_START;
  }

  // Competitor gains capability over time (slower than player typically)
  const baseGainRate = COMPETITOR.CAPABILITY_GAIN_RATE;
  let gainMultiplier = 1.0;

  // Open-source decisions help competitors
  const openSourceDecisions = gameState.choices?.openSourceDecisions || 0;
  if (openSourceDecisions > 0) {
    gainMultiplier += openSourceDecisions * COMPETITOR.OPEN_SOURCE_BOOST;
  }

  // Competitor boost from events
  if (gameState.competitorBoost) {
    gainMultiplier += gameState.competitorBoost;
  }

  // Update competitor level
  gameState.competitor.capabilityLevel += baseGainRate * gainMultiplier * deltaTime;

  // Market standard grows based on competitor progress (Red Queen effect)
  gameState.competitor.marketStandard += COMPETITOR.MARKET_GROWTH_RATE * deltaTime;

  // Progress to AGI — use arc-specific base rate
  // Frozen during moratorium if competitor accepted the pause
  let agiRate = gameState.arc === 2 ? COMPETITOR.ARC_2_BASE_RATE : COMPETITOR.ARC_1_BASE_RATE;

  // Halve rival rate during farewell sequence when they're close to AGI
  const fw = gameState.farewells;
  if (fw?.sequenceStarted && gameState.competitor.progressToAGI >= 90) {
    agiRate *= 0.5;
  }

  if (!isCompetitorPausedByMoratorium() && !isFarewellStalling()) {
    gameState.competitor.progressToAGI = Math.min(100,
      gameState.competitor.progressToAGI + (agiRate * deltaTime)
    );
  }

  // Warn player when competitor AGI is imminent
  if (gameState.competitor.progressToAGI >= 95 && !gameState.competitor.imminentWarned) {
    gameState.competitor.imminentWarned = true;
    notify('Competitor AGI Imminent', 'Intelligence reports suggest a rival lab is on the verge of achieving AGI.', 'danger');
    addNewsItem('BREAKING: Sources say rival lab weeks from AGI breakthrough', 'competitor');
  }

  // Check for competitor win — skip if player already reached AGI (ending in progress)
  if (gameState.competitor.progressToAGI >= 100 && !gameState.endingTriggered) {
    triggerEnding(gameState.arc === 1 ? 'competitor_wins_arc1' : 'competitor_wins_arc2');
  }

  // Calculate player's capability level
  const playerLevel = calculatePlayerCapabilityLevel();

  // Track previous position for change detection
  const previousPosition = gameState.competitor.position;

  // Update position
  const levelDiff = playerLevel - gameState.competitor.capabilityLevel;
  if (levelDiff > 2) {
    gameState.competitor.position = "behind";
  } else if (levelDiff < -2) {
    gameState.competitor.position = "ahead";
  } else {
    gameState.competitor.position = "even";
  }

  // Trigger news on position change
  if (previousPosition !== gameState.competitor.position) {
    const positionKey = {
      behind: 'competitor_behind',
      ahead: 'competitor_ahead',
      even: 'competitor_close',
    };
    const newsEntry = newsContent.competitor[positionKey[gameState.competitor.position]];
    if (newsEntry) {
      addNewsItem(newsEntry.text, newsEntry.type);
    }
  }

  // Check for competitor breakthrough announcements
  checkCompetitorBreakthroughs();

  // Check for competitor safety incident news
  checkCompetitorIncidents();
}

// Calculate player's capability level based on unlocked track capabilities
function calculatePlayerCapabilityLevel() {
  let level = 0;
  const allCaps = getAllTrackCapabilities();

  for (const cap of allCaps) {
    if (isCapabilityUnlocked(cap.id)) {
      level += (cap.tier || 1);
    }
  }

  return level;
}

// Check if competitor should announce a breakthrough
function checkCompetitorBreakthroughs() {
  for (let breakthrough of competitorBreakthroughs) {
    if (gameState.competitor.capabilityLevel >= breakthrough.level &&
        !announcedBreakthroughs.has(breakthrough.level)) {

      // Announce the breakthrough
      notify(breakthrough.name, breakthrough.message, 'warning');
      addNewsItem(breakthrough.name, 'competitor');

      // Mark as announced
      announcedBreakthroughs.add(breakthrough.level);
      gameState.competitor.announcedBreakthroughs = Array.from(announcedBreakthroughs);

      saveGame();
    }
  }
}

// Check for competitor safety incident news (Phase 4 escalation)
// Triggered by max(player, competitor) AGI progress at 50/60/70/80/90%
function checkCompetitorIncidents() {
  const playerProgress = gameState.agiProgress || 0;
  const competitorProgress = gameState.competitor?.progressToAGI || 0;
  const maxProgress = Math.max(playerProgress, competitorProgress);

  const thresholds = [50, 60, 70, 80, 90];
  for (const threshold of thresholds) {
    if (maxProgress >= threshold) {
      triggerNewsForEvent('competitor_incident', threshold);
    }
  }
}

// Get competitor status for UI
export function getCompetitorStatus() {
  if (!gameState.competitor) {
    return { position: "unknown", level: 0 };
  }

  return {
    position: gameState.competitor.position,
    level: gameState.competitor.capabilityLevel.toFixed(1),
  };
}

// Boost competitor progress (called from events)
export function boostCompetitor(amount) {
  if (!gameState.competitor) {
    initializeCompetitor();
  }
  gameState.competitor.capabilityLevel += amount;
}
