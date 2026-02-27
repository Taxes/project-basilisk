// Farewell Modal System — Phase 4 character goodbyes
// Modals pause game, force read, shown 60s apart starting at 85% AGI

import { gameState } from './game-state.js';
import { FAREWELLS } from '../data/balance.js';
import { farewellEntries } from './content/farewell-content.js';
import { renderMarkdown } from './utils/format.js';
import { addMessage } from './messages.js';
import { jitteredDelay } from './utils/seeded-rng.js';

// ── Queries ──────────────────────────────────────────────────────────────────

/** True when AGI/competitor should be clamped because farewells remain. */
export function isFarewellStalling() {
  return gameState.farewells.stalling;
}

// ── Initialization ───────────────────────────────────────────────────────────

/** Call once at game init. Wires dismiss button and re-shows modal on load. */
export function initializeFarewells() {
  const btn = document.getElementById('farewell-dismiss');
  if (btn) {
    btn.addEventListener('click', () => hideFarewellModal());
  }

  // Resume mid-sequence: re-show the modal that was showing when player saved
  if (gameState.farewells.currentlyShowing !== null) {
    const entry = farewellEntries.find(e => e.key === gameState.farewells.currentlyShowing);
    if (entry) {
      showFarewellModal(entry);
    }
  }
}

// ── Per-tick state machine ───────────────────────────────────────────────────

/** Called every game tick between updateResources and checkEndings. */
export function checkFarewells() {
  const fw = gameState.farewells;

  // Already done
  if (fw.sequenceComplete) return;

  // Only Arc 1
  if (gameState.arc !== 1) return;

  // Fast-forward mode (bot): auto-complete, skip modals and stall
  if (gameState._fastForwarding) {
    const enabled = farewellEntries.filter(e => e.enabled);
    fw.delivered = enabled.map(e => e.key);
    fw.dismissed = enabled.map(e => e.key);
    fw.sequenceStarted = true;
    fw.sequenceComplete = true;
    fw.stalling = false;
    fw.currentlyShowing = null;
    return;
  }

  // Waiting for player to dismiss current modal
  if (fw.currentlyShowing !== null) return;

  const enabledEntries = farewellEntries.filter(e => e.enabled);

  // All disabled = nothing to do
  if (enabledEntries.length === 0) {
    fw.sequenceComplete = true;
    fw.stalling = false;
    return;
  }

  // Start sequence at threshold
  if (!fw.sequenceStarted && gameState.agiProgress >= FAREWELLS.START_THRESHOLD) {
    fw.sequenceStarted = true;
    deliverNext(enabledEntries);
    return;
  }

  // Sequence started but not all delivered — check interval
  if (fw.sequenceStarted) {
    const allDismissed = enabledEntries.every(e => fw.dismissed.includes(e.key));
    if (allDismissed) {
      fw.sequenceComplete = true;
      fw.stalling = false;
      return;
    }

    // Next farewell pending — check jittered interval since last dismiss
    if (fw.lastDismissedTime !== null) {
      const elapsed = gameState.timeElapsed - fw.lastDismissedTime;
      const interval = jitteredDelay(gameState, `farewell_${fw.dismissed.length}`, FAREWELLS.INTERVAL);
      if (elapsed >= interval) {
        deliverNext(enabledEntries);
      }
    }
  }

  // Stall activation: AGI >= 99.9 and sequence not complete
  if (fw.sequenceStarted && !fw.sequenceComplete && gameState.agiProgress >= FAREWELLS.STALL_CAP) {
    fw.stalling = true;
  }
}

// ── Debug ────────────────────────────────────────────────────────────────────

/** Show a specific farewell by key (for debug/testing). Bypasses normal sequencing. */
export function debugShowFarewell(key) {
  const entry = farewellEntries.find(e => e.key === key);
  if (!entry) {
    const keys = farewellEntries.map(e => e.key).join(', ');
    console.error(`[farewell] Unknown key "${key}". Available: ${keys}`);
    return;
  }
  showFarewellModal(entry);
  console.log(`[farewell] Showing: ${key}`);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function deliverNext(enabledEntries) {
  const fw = gameState.farewells;
  const next = enabledEntries.find(e => !fw.delivered.includes(e.key));
  if (!next) return;

  fw.delivered.push(next.key);
  showFarewellModal(next);
}

function showFarewellModal(entry) {
  const fw = gameState.farewells;
  fw.currentlyShowing = entry.key;

  // Pause the game
  gameState.paused = true;
  gameState.pauseReason = 'farewell';

  // Populate DOM
  const modal = document.getElementById('farewell-modal');
  if (!modal) return;

  document.getElementById('farewell-subject').textContent = entry.subject;
  document.getElementById('farewell-sender-name').textContent = entry.sender.name;
  document.getElementById('farewell-sender-role').textContent = entry.sender.role || '';

  const narrative = document.getElementById('farewell-narrative');
  narrative.innerHTML = renderMarkdown(entry.body);

  const sig = document.getElementById('farewell-signature');
  if (entry.signature) {
    sig.textContent = entry.signature;
    sig.classList.remove('hidden');
  } else {
    sig.textContent = '';
    sig.classList.add('hidden');
  }

  document.getElementById('farewell-dismiss').textContent = entry.dismissText || 'Continue';

  modal.classList.remove('hidden');
  modal.scrollTop = 0;
  const content = modal.querySelector('.modal-content');
  if (content) content.scrollTop = 0;
}

function hideFarewellModal() {
  const fw = gameState.farewells;
  const key = fw.currentlyShowing;
  if (key === null) return;

  // Record dismissal
  if (!fw.dismissed.includes(key)) {
    fw.dismissed.push(key);
  }
  fw.lastDismissedTime = gameState.timeElapsed;
  fw.currentlyShowing = null;

  // Add to inbox so the player can re-read it
  const entry = farewellEntries.find(e => e.key === key);
  if (entry) {
    addMessage({
      type: 'info',
      sender: entry.sender,
      subject: entry.subject,
      body: entry.body,
      signature: entry.signature,
      tags: ['farewell'],
      triggeredBy: `farewell_${key}`,
    });
  }

  // Check if all enabled farewells are now dismissed
  const enabledEntries = farewellEntries.filter(e => e.enabled);
  if (enabledEntries.every(e => fw.dismissed.includes(e.key))) {
    fw.sequenceComplete = true;
    fw.stalling = false;
  }

  // Hide modal
  const modal = document.getElementById('farewell-modal');
  if (modal) modal.classList.add('hidden');

  // Unpause
  gameState.paused = false;
  gameState.pauseReason = null;
}
