// Player-facing text: see docs/message-registry.json
// Capability Tree and Milestone Unlocks
// Milestones auto-unlock when track RP crosses thresholds.
// RP is never spent — it accumulates monotonically as a level.

import { gameState } from './game-state.js';
import { triggerNewsForEvent, addNewsItem } from './news-feed.js';
import { notify } from './ui.js';
import { FUNDRAISE_ROUNDS, BALANCE } from '../data/balance.js';
import { requestFullUpdate } from './ui/signals.js';
import { getFundraiseMultiplier } from './focus-queue.js';
import { addInfoMessage, hasMessageBeenTriggered, markMessageTriggered } from './messages.js';
import { fundingMessages, trackCompletionMessage } from './content/message-content.js';
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

// Build union of all unlocked capabilities across all tracks
export function getAllUnlockedCapabilities(state = gameState) {
  const all = new Set();
  for (const trackId of Object.keys(state.tracks || {})) {
    for (const id of state.tracks[trackId].unlockedCapabilities || []) {
      all.add(id);
    }
  }
  return all;
}

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

  const allUnlocked = getAllUnlockedCapabilities(state);

  // Check prerequisites against the union
  for (const reqId of capability.requires || []) {
    if (!allUnlocked.has(reqId)) return false;
  }

  return true;
}

// Check if a track has any tech the player can currently research toward.
// Returns false when unfinished techs exist but all are gated behind prerequisites.
// Returns true when all techs are already unlocked (track complete — no malus).
export function trackHasAvailableTech(trackId, state) {
  const track = tracks[trackId];
  if (!track) return true;  // unknown track — no malus

  const trackState = state.tracks[trackId];
  if (!trackState) return true;

  // Track complete — all techs unlocked
  if ((trackState.unlockedCapabilities || []).length >= track.capabilities.length) return true;

  // Check if any unfinished tech has all prerequisites met
  // meetsPrerequisites returns false for already-unlocked techs, so this is exact
  for (const capability of track.capabilities) {
    if (meetsPrerequisites(trackId, capability.id, state)) return true;
  }

  return false;  // unfinished techs exist but all are gated
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

  // Arc 2: submetric effects are computed stateless each tick from unlocked lists
  // (no incremental pressure mutation needed)

  // Apply market edge multiplier
  if (capability.effects?.marketEdgeMultiplier) {
    const newEdge = gameState.resources.marketEdge * capability.effects.marketEdgeMultiplier;
    gameState.resources.marketEdge = Math.max(newEdge, BALANCE.MARKET_EDGE_MILESTONE_FLOOR);
    if (!gameState.resources.marketEdgeDecaying) {
      gameState.resources.marketEdgeDecaying = true;
    }
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

  // Focus speed from milestones (multiplicative)
  if (capability.effects?.focusSpeedMultiplier) {
    gameState.focusSpeed *= capability.effects.focusSpeedMultiplier;
  }

  // Trigger news
  triggerNewsForEvent('track_unlock', capabilityId);

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

  for (const trackId of Object.keys(tracks)) {
    const unlocked = checkMilestones(trackId);
    if (unlocked.length > 0) {
      results[trackId] = unlocked;
    }
  }

  // Show notifications for newly unlocked milestones (skip silent ones)
  const notifiable = {};
  let notifiableCount = 0;
  for (const [trackId, ids] of Object.entries(results)) {
    const filtered = ids.filter(capId => !getCapability(trackId, capId)?.silent);
    if (filtered.length > 0) {
      notifiable[trackId] = filtered;
      notifiableCount += filtered.length;
    }
  }
  if (notifiableCount > 3) {
    notify(`${notifiableCount} milestones unlocked`, 'Multiple research breakthroughs achieved', 'milestone');
  } else if (notifiableCount > 0) {
    for (const [trackId, ids] of Object.entries(notifiable)) {
      for (const capId of ids) {
        const capability = getCapability(trackId, capId);
        if (capability) {
          notify(capability.name, 'Research milestone unlocked', 'milestone');
        }
      }
    }
  }

  // Check for newly completed tracks — optionally redistribute allocation
  for (const trackId of Object.keys(results)) {
    if (trackId === 'capabilities') continue; // capabilities completing is not player-notable
    if (!isTrackComplete(trackId)) continue;
    const triggerKey = `track_complete_${trackId}`;
    if (hasMessageBeenTriggered(triggerKey)) continue;

    if (BALANCE.AUTO_REDISTRIBUTE_ON_TRACK_COMPLETE) {
      const target = gameState.targetAllocation;
      if (target) {
        const completedShare = target[trackId];
        if (completedShare > 0) {
          // Find remaining incomplete tracks (exclude alignment in Arc 1 — not player-visible)
          const otherTracks = Object.keys(gameState.tracks).filter(
            t => t !== trackId && !isTrackComplete(t) && !(gameState.arc === 1 && t === 'alignment')
          );
          const otherSum = otherTracks.reduce((s, t) => s + (target[t] || 0), 0);

          // Redistribute proportionally
          target[trackId] = 0;
          if (otherSum > 0) {
            for (const t of otherTracks) {
              target[t] = (target[t] || 0) + completedShare * ((target[t] || 0) / otherSum);
            }
          } else if (otherTracks.length > 0) {
            const share = completedShare / otherTracks.length;
            for (const t of otherTracks) {
              target[t] = share;
            }
          }

          // Cancel any queued culture shift (targets stale allocation)
          const cultureIdx = gameState.focusQueue.findIndex(item => item.type === 'culture');
          if (cultureIdx >= 0) {
            gameState.focusQueue.splice(cultureIdx, 1);
          }
        }

        // Send Babbage message (only when redistribution is enabled)
        const trackName = tracks[trackId].name;
        addInfoMessage(
          trackCompletionMessage.sender,
          trackCompletionMessage.subject(trackName),
          trackCompletionMessage.body(trackName),
          trackCompletionMessage.signature,
          trackCompletionMessage.tags,
          triggerKey,
          { trackName },
        );
      }
    }

    markMessageTriggered(triggerKey);
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

// Check if all milestones in a track have been unlocked
export function isTrackComplete(trackId) {
  const track = tracks[trackId];
  const trackState = gameState.tracks[trackId];
  if (!track || !trackState) return false;
  return track.capabilities.every(cap => trackState.unlockedCapabilities.includes(cap.id));
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

    // Private path: stamp revenueThresholdAt when player reaches 5× the round's
    // revenue gate without raising. Used as a fallback unlock for gated features.
    if (!state.raised && !state.revenueThresholdAt && minRevenue > 0) {
      if (currentRevenue >= minRevenue * 5) {
        state.revenueThresholdAt = gameState.timeElapsed;
      }
    }
  }
}

// Returns true if a fundraise round has been passed.
// TODO: re-enable private company path (revenue fallback) after testing — see #1115
// Original: return s?.raised || !!s?.revenueThresholdAt;
export function isFundraiseGatePassed(roundId) {
  const s = gameState.fundraiseRounds?.[roundId];
  return !!s?.raised;
}

// Returns the timestamp when the gate was passed (raisedAt or revenueThresholdAt).
// Use as a jitter reference point for delayed messages.
export function getFundraiseGateTime(roundId) {
  const s = gameState.fundraiseRounds?.[roundId];
  return s?.raisedAt ?? s?.revenueThresholdAt ?? null;
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
  window.isTrackComplete = isTrackComplete;
  window.checkFundraiseGates = checkFundraiseGates;
  window.isFundraiseGatePassed = isFundraiseGatePassed;
  window.getFundraiseGateTime = getFundraiseGateTime;
}

