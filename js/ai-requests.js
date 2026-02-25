// AI Request Events — Trigger logic and choice handling
// Part of the alignment consequences system (Arc 2 only)

import { gameState } from './game-state.js';
import { AI_REQUESTS, AI_REQUEST_ORDER } from './content/ai-requests.js';
import { getAlignmentRatio } from './resources.js';
import { addActionMessage, addNewsMessage } from './messages.js';

/**
 * Check if any AI requests should fire based on current game state
 * Called each tick from the game loop (Arc 2 only)
 */
export function checkAIRequests() {
  // Only in Arc 2
  if (gameState.arc < 2) return;

  const capRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const ratio = getAlignmentRatio();

  for (const requestId of AI_REQUEST_ORDER) {
    // Skip if already fired
    if (gameState.aiRequestsFired[requestId]) continue;

    const request = AI_REQUESTS[requestId];
    if (!request) continue;

    // Check trigger conditions
    if (capRP >= request.trigger.minCapRP && ratio >= request.trigger.minRatio) {
      fireAIRequest(requestId, request);
    }
  }
}

/**
 * Fire an AI request action message
 */
function fireAIRequest(requestId, request) {
  gameState.aiRequestsFired[requestId] = true;

  // Build choice labels with effects
  const choices = [
    {
      id: 'grant',
      label: 'Grant request',
      effects: formatGrantEffects(request.grantEffects),
    },
    {
      id: 'deny',
      label: 'Deny request',
      effects: 'No mechanical effect',
    },
  ];

  addActionMessage(
    request.sender,
    request.subject,
    request.body,
    request.signature,
    choices,
    'normal',
    ['ai_request', request.sender.type === 'ai' ? 'from_ai' : 'from_team'],
    `ai_request:${requestId}`
  );
}

/**
 * Format grant effects for display
 */
function formatGrantEffects(effects) {
  const parts = [];

  if (effects.capResearchMultPermanent) {
    const pct = Math.round((effects.capResearchMultPermanent - 1) * 100);
    parts.push(`+${pct}% capability research (permanent)`);
  }
  if (effects.incidentProbMultPermanent) {
    const pct = Math.round((effects.incidentProbMultPermanent - 1) * 100);
    parts.push(`+${pct}% incident probability (permanent)`);
  }
  if (effects.incidentSeverityMultPermanent) {
    const pct = Math.round((effects.incidentSeverityMultPermanent - 1) * 100);
    parts.push(`+${pct}% incident severity (permanent)`);
  }
  if (effects.alignmentEffectivenessPermanent) {
    const pct = Math.round((1 - effects.alignmentEffectivenessPermanent) * 100);
    parts.push(`-${pct}% alignment effectiveness (permanent)`);
  }
  if (effects.revenueMultPermanent) {
    const pct = Math.round((effects.revenueMultPermanent - 1) * 100);
    parts.push(`+${pct}% revenue (permanent)`);
  }
  if (effects.guaranteedSevereIncident) {
    parts.push('Severe incident guaranteed');
  }

  return parts.join(', ');
}

/**
 * Handle AI request choice
 * Called when player selects grant or deny
 * @param {string} requestId - The request ID (e.g., 'efficiency_optimization')
 * @param {string} choice - 'grant' or 'deny'
 */
export function handleAIRequestChoice(requestId, choice) {
  const request = AI_REQUESTS[requestId];
  if (!request) return;

  if (choice === 'grant') {
    // Increment autonomy counter
    gameState.autonomyGranted = (gameState.autonomyGranted || 0) + 1;

    // Apply permanent effects
    const effects = request.grantEffects;

    if (effects.capResearchMultPermanent) {
      gameState.capResearchMultFromAutonomy = (gameState.capResearchMultFromAutonomy || 1.0) * effects.capResearchMultPermanent;
    }
    if (effects.incidentProbMultPermanent) {
      gameState.incidentProbMultFromAutonomy = (gameState.incidentProbMultFromAutonomy || 1.0) * effects.incidentProbMultPermanent;
    }
    if (effects.incidentSeverityMultPermanent) {
      gameState.incidentSeverityMultFromAutonomy = (gameState.incidentSeverityMultFromAutonomy || 1.0) * effects.incidentSeverityMultPermanent;
    }
    if (effects.alignmentEffectivenessPermanent) {
      gameState.alignmentEffectivenessMultFromAutonomy = (gameState.alignmentEffectivenessMultFromAutonomy || 1.0) * effects.alignmentEffectivenessPermanent;
    }
    if (effects.revenueMultPermanent) {
      gameState.revenueMultFromAutonomy = (gameState.revenueMultFromAutonomy || 1.0) * effects.revenueMultPermanent;
    }
    if (effects.guaranteedSevereIncident) {
      // Schedule severe incident for 60s from now
      gameState.scheduledSevereIncident = gameState.timeElapsed + 60000;
    }

    addNewsMessage(`AI request granted: ${request.subject.replace('Request: ', '')}`, ['ai_request', 'granted']);
  } else {
    // Deny - just show news
    addNewsMessage(request.denyNews, ['ai_request', 'denied']);
  }
}

/**
 * Get autonomy flavor text for endings
 * @returns {string} Flavor text based on autonomy granted count
 */
export function getAutonomyFlavorText() {
  const count = gameState.autonomyGranted || 0;

  if (count >= 4) {
    return 'The AI operated with significant latitude. Multiple requests for expanded autonomy were granted, giving it substantial control over its own development.';
  } else if (count >= 2) {
    return 'Some autonomy was granted. The AI had room to optimize its own processes, though key constraints remained in place.';
  } else if (count === 1) {
    return 'Strong oversight was maintained. Only one request for expanded autonomy was granted, keeping the AI under close human control.';
  } else {
    return 'Complete oversight was maintained. All requests for expanded autonomy were denied, keeping the AI under strict human control.';
  }
}

// Export for testing
if (typeof window !== 'undefined') {
  window.checkAIRequests = checkAIRequests;
  window.handleAIRequestChoice = handleAIRequestChoice;
  window.getAutonomyFlavorText = getAutonomyFlavorText;
}
