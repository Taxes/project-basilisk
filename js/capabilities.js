// Player-facing text: see docs/message-registry.json
// Capability Tree and Milestone Unlocks
// Milestones auto-unlock when track RP crosses thresholds.
// RP is never spent — it accumulates monotonically as a level.

import { gameState } from './game-state.js';
import { addAlignmentLevel, getCultureBonuses } from './resources.js';
import { triggerNewsForEvent, addNewsItem } from './news-feed.js';
import { notify } from './ui.js';
import { FUNDRAISE_ROUNDS, BALANCE } from '../data/balance.js';
import { requestFullUpdate } from './ui/signals.js';
import { getFundraiseMultiplier } from './focus-queue.js';
import { addInfoMessage, hasMessageBeenTriggered, markMessageTriggered } from './messages.js';
import { fundingMessages } from './content/message-content.js';
import { milestone } from './analytics.js';

// Send CFO email when a fundraise round becomes available
function notifyFundraiseAvailable(roundId) {
  const key = `fundraise_${roundId}`;
  const msg = fundingMessages[`${roundId}_available`];
  if (!msg || hasMessageBeenTriggered(key)) return;
  addInfoMessage(msg.sender, msg.subject, msg.body, msg.signature, msg.tags, key);
  markMessageTriggered(key);
}

// Get the RP threshold for a capability milestone (scaled by global multiplier)
export function getCapabilityThreshold(capability) {
  return (capability?.threshold || 0) * (BALANCE.RP_THRESHOLD_SCALE || 1);
}

// Apply hidden alignment effect from research choices
// Positive values = better alignment, negative values = worse alignment
// This is never shown to the player in Arc 1, but affects ending outcomes
// Culture bonus: alignment-heavy allocation multiplies the effect
export function applyHiddenAlignmentEffect(capabilityId, amount) {
  const culture = getCultureBonuses();
  const scaledAmount = amount * culture.aliMult;
  gameState.hiddenAlignment = Math.max(-100, Math.min(100,
    (gameState.hiddenAlignment || 0) + scaledAmount
  ));
}

// Export for testing
if (typeof window !== 'undefined') {
  window.applyHiddenAlignmentEffect = applyHiddenAlignmentEffect;
}

// Import track content files
import { capabilitiesTrack } from './content/capabilities-track.js';
import { applicationsTrack } from './content/applications-track.js';
import { alignmentTrack } from './content/alignment-track.js';

// Export tracks object for the three-track system
export const tracks = {
  capabilities: capabilitiesTrack,
  applications: applicationsTrack,
  alignment: alignmentTrack,
};

// Get a capability from a specific track
export function getCapability(trackId, capabilityId) {
  const track = tracks[trackId];
  return track?.capabilities.find(c => c.id === capabilityId);
}

// Check if a capability's prerequisites are met (same-track, cross-track, alignment)
export function meetsPrerequisites(trackId, capabilityId, state) {
  const capability = getCapability(trackId, capabilityId);
  if (!capability) return false;

  const trackState = state.tracks[trackId];
  if (!trackState) return false;

  // Check if already unlocked
  if (trackState.unlockedCapabilities.includes(capabilityId)) return false;

  // Build union of all unlocked capabilities across all tracks
  const allUnlocked = new Set();
  for (const tid of Object.keys(state.tracks)) {
    for (const id of state.tracks[tid].unlockedCapabilities || []) {
      allUnlocked.add(id);
    }
  }

  // Check prerequisites against the union
  for (const reqId of capability.requires || []) {
    if (!allUnlocked.has(reqId)) return false;
  }

  // Check alignment requirements (Arc 2+ only — alignment level is always 0 in Arc 1)
  if (state.arc >= 2 && capability.requiresAlignment) {
    if (state.tracks.alignment.alignmentLevel < capability.requiresAlignment) return false;
  }

  return true;
}

// Check if a milestone has been reached (prerequisites met AND threshold crossed)
export function hasReachedMilestone(trackId, capabilityId, state) {
  if (!meetsPrerequisites(trackId, capabilityId, state)) return false;

  const capability = getCapability(trackId, capabilityId);
  const trackState = state.tracks[trackId];

  // Check if track RP level has crossed the threshold
  const threshold = getCapabilityThreshold(capability);
  if (trackState.researchPoints < threshold) return false;

  return true;
}

// Apply milestone effects when auto-unlocked (no RP spending)
function applyMilestoneEffects(trackId, capabilityId) {
  const trackState = gameState.tracks[trackId];
  if (!trackState) return false;
  if (trackState.unlockedCapabilities.includes(capabilityId)) return false;

  const capability = getCapability(trackId, capabilityId);
  if (!capability) return false;

  // Mark as unlocked
  trackState.unlockedCapabilities.push(capabilityId);
  milestone('first_research', { capability_id: capabilityId });
  trackState.unlockOrder = trackState.unlockOrder || [];
  trackState.unlockOrder.push(capabilityId);
  trackState.unlockTimestamps = trackState.unlockTimestamps || {};
  trackState.unlockTimestamps[capabilityId] = gameState.timeElapsed;

  // Apply alignment bonus
  if (capability.effects?.alignmentBonus) {
    addAlignmentLevel(capability.effects.alignmentBonus);
  }

  // Apply market edge multiplier
  if (capability.effects?.marketEdgeMultiplier) {
    const newEdge = gameState.resources.marketEdge * capability.effects.marketEdgeMultiplier;
    gameState.resources.marketEdge = Math.max(newEdge, BALANCE.MARKET_EDGE_MILESTONE_FLOOR);
    if (!gameState.resources.marketEdgeDecaying) {
      gameState.resources.marketEdgeDecaying = true;
    }
  }

  // Apply hidden alignment effect
  if (capability.hiddenAlignmentEffect) {
    applyHiddenAlignmentEffect(capabilityId, capability.hiddenAlignmentEffect);
  }

  // Check for fundraise round unlocks (delegate to shared gate check)
  checkFundraiseGates();

  // Announce feedback loop activation for capabilities with capFeedbackRate
  if (capability.effects?.capFeedbackRate) {
    addNewsItem('Internal: Research feedback loop confirmed, models now proposing their own experiments', 'warning');
  }

  // Staffing speed from milestones (multiplicative, applies to personnel + compute focus queue)
  if (capability.effects?.staffingSpeedMultiplier) {
    gameState.staffingSpeedMultiplier *= capability.effects.staffingSpeedMultiplier;
  }

  // Focus efficiency from milestones (multiplicative)
  if (capability.effects?.focusEfficiencyMultiplier) {
    gameState.totalEfficiency *= capability.effects.focusEfficiencyMultiplier;
  }
  // Focus slots from milestones (additive)
  if (capability.effects?.focusSlots) {
    gameState.focusSlots += capability.effects.focusSlots;
  }

  // Trigger news
  triggerNewsForEvent('track_unlock', capabilityId);

  // Trigger alignment-specific unlock news (shows what problems alignment research solves)
  if (trackId === 'alignment') {
    triggerNewsForEvent('alignment_unlock', capabilityId);
  }

  // Force UI rebuild so cards with capability requirements update immediately
  requestFullUpdate();

  return true;
}

// Check all milestones for a track and auto-unlock any that have been reached.
// Returns array of newly unlocked capability IDs.
export function checkMilestones(trackId) {
  const track = tracks[trackId];
  if (!track) return [];

  const newlyUnlocked = [];

  for (const capability of track.capabilities) {
    if (hasReachedMilestone(trackId, capability.id, gameState)) {
      if (applyMilestoneEffects(trackId, capability.id)) {
        newlyUnlocked.push(capability.id);
      }
    }
  }

  return newlyUnlocked;
}

// Check all milestones across all tracks. Returns map of trackId -> [unlocked IDs].
export function checkAllMilestones() {
  const results = {};
  let totalUnlocked = 0;

  for (const trackId of Object.keys(tracks)) {
    const unlocked = checkMilestones(trackId);
    if (unlocked.length > 0) {
      results[trackId] = unlocked;
      totalUnlocked += unlocked.length;
    }
  }

  // Show notifications for newly unlocked milestones
  if (totalUnlocked > 3) {
    // Cascade: show summary instead of spamming
    notify(`${totalUnlocked} milestones unlocked`, 'Multiple research breakthroughs achieved', 'milestone');
  } else if (totalUnlocked > 0) {
    for (const [trackId, ids] of Object.entries(results)) {
      for (const capId of ids) {
        const capability = getCapability(trackId, capId);
        if (capability) {
          notify(capability.name, 'Research milestone unlocked', 'milestone');
        }
      }
    }
  }

  return results;
}

// Check if a capability is unlocked across any track
export function isCapabilityUnlocked(capId) {
  for (const trackId of Object.keys(tracks)) {
    const trackState = gameState.tracks[trackId];
    if (trackState?.unlockedCapabilities?.includes(capId)) {
      return true;
    }
  }
  return false;
}

// Count total unlocked capabilities across all tracks
export function countUnlockedCapabilities() {
  let count = 0;
  for (const trackId of Object.keys(tracks)) {
    const trackState = gameState.tracks[trackId];
    count += trackState?.unlockedCapabilities?.length || 0;
  }
  return count;
}

// Get a flat list of all track content capabilities
export function getAllTrackCapabilities() {
  const all = [];
  for (const track of Object.values(tracks)) {
    for (const cap of track.capabilities) {
      all.push({ ...cap, trackId: track.id });
    }
  }
  return all;
}

// Check revenue gates for fundraise rounds.  Called each tick and on
// capability unlock.  Implements hysteresis: opens at 100% of minRevenue,
// closes at 90%.  Already-raised rounds are never re-evaluated.
export function checkFundraiseGates() {
  const currentRevenue = gameState.computed?.revenue?.gross || 0;

  for (const [roundId, round] of Object.entries(FUNDRAISE_ROUNDS)) {
    const state = gameState.fundraiseRounds[roundId];
    if (state.raised) continue;
    if (!round.gate.capability) continue;

    const capUnlocked = isCapabilityUnlocked(round.gate.capability);
    if (!capUnlocked) continue;

    const minRevenue = round.gate.minRevenue || 0;

    if (!state.available) {
      // Gate closed — open at 100% of threshold
      if (currentRevenue >= minRevenue) {
        state.available = true;
        state.unlockTime = gameState.timeElapsed;
        state.startingMultiplier = getFundraiseMultiplier(roundId);
        state.currentMultiplier = state.startingMultiplier;
        notifyFundraiseAvailable(roundId);
      }
    } else {
      // Gate open — close if revenue drops below 90% of threshold
      if (minRevenue > 0 && currentRevenue < minRevenue * 0.9) {
        state.available = false;
        addNewsItem(`Finance: ${round.name} investors retreat, citing insufficient revenue`, 'warning');
      }
    }
  }
}

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.tracks = tracks;
  window.getCapabilityThreshold = getCapabilityThreshold;
  window.getCapability = getCapability;
  window.hasReachedMilestone = hasReachedMilestone;
  window.checkMilestones = checkMilestones;
  window.checkAllMilestones = checkAllMilestones;
  window.isCapabilityUnlocked = isCapabilityUnlocked;
  window.countUnlockedCapabilities = countUnlockedCapabilities;
  window.getAllTrackCapabilities = getAllTrackCapabilities;
  window.checkFundraiseGates = checkFundraiseGates;
}

