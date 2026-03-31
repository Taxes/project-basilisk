// Submetric Discovery + Threshold Messages
// 8 messages (2 per submetric) marking alignment journey milestones.
// Discovery: fires once when the alignment milestone reveals that submetric.
// Threshold: fires once when submetric sustained >= 80% for 60s of game time.

import { gameState } from './game-state.js';
import { addInfoMessage, hasMessageBeenTriggered } from './messages.js';
import { submetricMessages, alignmentDragMessage } from './content/message-content.js';
import { getAlignmentDragFactor } from './safety-metrics.js';
import { ALIGNMENT } from '../data/balance.js';
import { hasTutorialFired } from './tutorial-messages.js';

// Milestone → submetric mapping (from computeRevealState)
const DISCOVERY_TRIGGERS = {
  rlhf: 'robustness',
  constitutional_ai: 'interpretability',
  feature_visualization: 'corrigibility',
  circuit_analysis: 'honesty',
};

const SUBMETRICS = ['robustness', 'interpretability', 'corrigibility', 'honesty'];
const THRESHOLD_VALUE = 70;
const THRESHOLD_DURATION = 60; // seconds of game time

/**
 * Check discovery and threshold conditions for submetric messages.
 * Called once per tick from the game loop (after updateSubMetrics).
 */
export function checkSubmetricMessages(deltaTime) {
  if (gameState.arc < 2) return;

  checkDiscoveryMessages();
  checkThresholdMessages(deltaTime);
  checkAlignmentDragReveal();
}

// --- Discovery: fire when alignment milestone reveals the submetric ---

function checkDiscoveryMessages() {
  // Discovery messages come from Babbage/Chen — wait until Babbage has introduced himself
  if (!hasTutorialFired('babbage_intro')) return;

  const unlocked = gameState.tracks?.alignment?.unlockedCapabilities || [];

  for (const [milestone, submetric] of Object.entries(DISCOVERY_TRIGGERS)) {
    const triggerId = `alignment_discovery:${submetric}`;
    if (hasMessageBeenTriggered(triggerId)) continue;
    if (!unlocked.includes(milestone)) continue;

    const msg = submetricMessages[`discovery_${submetric}`];
    if (!msg) continue;

    addInfoMessage(
      msg.sender,
      msg.subject,
      msg.body,
      msg.signature,
      msg.tags,
      triggerId,
    );
  }
}

// --- Threshold: fire when submetric sustained >= 80% for 60s ---

function checkThresholdMessages(deltaTime) {
  // Initialize timers if missing
  if (!gameState.safetyMetrics.thresholdTimers) {
    gameState.safetyMetrics.thresholdTimers = {};
  }
  const timers = gameState.safetyMetrics.thresholdTimers;

  for (const submetric of SUBMETRICS) {
    const triggerId = `alignment_threshold:${submetric}`;
    if (hasMessageBeenTriggered(triggerId)) continue;

    const value = gameState.safetyMetrics[submetric] || 0;

    if (value >= THRESHOLD_VALUE) {
      timers[submetric] = (timers[submetric] || 0) + deltaTime;

      if (timers[submetric] >= THRESHOLD_DURATION) {
        const msg = submetricMessages[`threshold_${submetric}`];
        if (!msg) continue;

        addInfoMessage(
          msg.sender,
          msg.subject,
          msg.body,
          msg.signature,
          msg.tags,
          triggerId,
        );
      }
    } else {
      // Reset timer when below threshold
      timers[submetric] = 0;
    }
  }
}

// --- Alignment drag reveal: fire when drag penalty first exceeds threshold ---

function checkAlignmentDragReveal() {
  if (gameState.alignmentDragRevealed) return;

  const triggerId = 'alignment_drag_revealed';
  if (hasMessageBeenTriggered(triggerId)) return;

  const drag = getAlignmentDragFactor();
  const penalty = Math.max(1 - drag.demand, 1 - drag.research);
  if (penalty < (ALIGNMENT.DRAG_REVEAL_THRESHOLD || 0.05)) return;

  gameState.alignmentDragRevealed = true;

  const msg = alignmentDragMessage;
  addInfoMessage(
    msg.sender,
    msg.subject,
    msg.body,
    msg.signature,
    msg.tags,
    triggerId,
  );
}
