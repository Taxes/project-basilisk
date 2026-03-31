// Debug console commands for manual playtesting
// Exposes window.debug namespace with helpers for manipulating game state.
// Gated behind ?debug=1 URL param or localStorage.setItem('debug', '1').

import { gameState, prepareSaveData } from './game-state.js';
import LZString from '../vendor/lz-string.min.js';
import { attachTooltip } from './ui/stats-tooltip.js';
import { tracks } from './capabilities.js';
import { transitionToArc2 } from './prestige.js';
import { cleanup as cleanupExtinction, triggerExtinctionSequence, debugEnding as debugExtinctionEnding } from './extinction-sequence.js';
import { setDebugFastMode, cleanupEndingCinematic } from './ending-sequence.js';
import { farewellEntries } from './content/farewell-content.js';
import { debugShowFarewell } from './farewells.js';
import { showNarrativeModal } from './narrative-modal.js';
import { addActionMessage } from './messages.js';
import {
  creditWarningMessage,
  creditWarningPreAdaMessage,
  alignmentTaxActionMessage,
  strategicChoiceMessages,
  moratoriumMessages,
} from './content/message-content.js';
import { AI_REQUESTS, AI_REQUEST_ORDER } from './content/ai-requests.js';
import { formatGrantEffectsRows, formatDenyEffectsRows } from './ai-requests.js';
import { debugModelCollapseMessage } from './data-quality.js';
import { FLAVOR_EVENTS } from './content/flavor-event-content.js';
import { notify } from './ui.js';
import { showChangelog, showEndingModal } from './ui/modals.js';
import { VERSION, DISPLAY_VERSION } from './version.js';
import { BALANCE } from '../data/balance.js';

const DEBUG_STORAGE_KEY = 'agi-incremental-debug';

function loadDebugSettings() {
  try {
    const raw = localStorage.getItem(DEBUG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveDebugSettings() {
  try {
    const settings = {};
    if (gameState.debugPreventEnding) settings.preventEnding = true;
    if (gameState.debugDisableBankruptcy) settings.disableBankruptcy = true;
    if (gameState.gameSpeed !== 1) settings.speed = gameState.gameSpeed;
    if (Object.keys(settings).length > 0) {
      localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(settings));
    } else {
      localStorage.removeItem(DEBUG_STORAGE_KEY);
    }
  } catch { /* ignore storage errors */ }
}

// Apply persisted debug settings to current gameState
export function applyDebugSettings({ skipArc2 = false } = {}) {
  const settings = loadDebugSettings();
  if (settings.preventEnding) gameState.debugPreventEnding = true;
  if (settings.disableBankruptcy) gameState.debugDisableBankruptcy = true;
  if (settings.speed) {
    gameState.gameSpeed = settings.speed;
    // Update UI widget if it exists
    const display = document.getElementById('speed-display');
    if (display) display.textContent = `${settings.speed}x`;
    const slider = document.getElementById('speed-slider');
    if (slider) slider.value = settings.speed;
  }

  // ?arc2 URL param: jump straight to Arc 2.
  // Works without ?debug — the param itself is the intent signal.
  // Returns true if arc2 transition fired (caller may need to reload).
  if (!skipArc2 && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('arc2') && gameState.arc !== 2) {
      transitionToArc2();
      // Re-apply speed after transition (transition resets state)
      if (settings.speed) gameState.gameSpeed = settings.speed;
      console.log('[debug] URL param ?arc2 — transitioned to Arc 2');
      return true;
    }
  }
  return false;
}

const debug = {
  addFunding(amount) {
    if (amount <= 0) return;
    gameState.resources.funding += amount;
    console.log(`[debug] Added $${amount} funding. Balance: $${gameState.resources.funding.toFixed(2)}`);
  },

  addResearch(trackId, amount) {
    if (!gameState.tracks[trackId]) {
      console.error(`[debug] Invalid track: ${trackId}. Use: capabilities, applications, alignment`);
      return false;
    }
    gameState.tracks[trackId].researchPoints += amount;
    console.log(`[debug] Added ${amount} RP to ${trackId}. Total: ${gameState.tracks[trackId].researchPoints.toFixed(1)}`);
    return true;
  },

  unlockCapability(trackId, capabilityId) {
    if (!gameState.tracks[trackId]) {
      console.error(`[debug] Invalid track: ${trackId}`);
      return false;
    }
    const cap = tracks[trackId]?.capabilities.find(c => c.id === capabilityId);
    if (!cap) {
      console.error(`[debug] Unknown capability: ${capabilityId} in track ${trackId}`);
      return false;
    }
    if (gameState.tracks[trackId].unlockedCapabilities.includes(capabilityId)) {
      console.log(`[debug] ${capabilityId} already unlocked`);
      return true;
    }
    gameState.tracks[trackId].unlockedCapabilities.push(capabilityId);
    console.log(`[debug] Unlocked ${capabilityId} in ${trackId}`);
    return true;
  },

  setTime(seconds) {
    gameState.timeElapsed = seconds;
    console.log(`[debug] Set game time to ${seconds}s (${Math.floor(seconds / 60)}m ${seconds % 60}s)`);
  },

  setAGI(percent) {
    gameState.agiProgress = Math.max(0, Math.min(100, percent));
    console.log(`[debug] Set AGI progress to ${gameState.agiProgress}%`);
  },

  speed(multiplier) {
    if (multiplier === undefined) {
      console.log(`[debug] Current game speed: ${gameState.gameSpeed}x`);
      return gameState.gameSpeed;
    }
    const clamped = Math.max(0.5, Math.min(4, multiplier));
    gameState.gameSpeed = clamped;
    // Update UI widget if it exists
    const display = document.getElementById('speed-display');
    if (display) display.textContent = `${clamped}x`;
    const slider = document.getElementById('speed-slider');
    if (slider) slider.value = clamped;
    saveDebugSettings();
    console.log(`[debug] Game speed set to ${clamped}x`);
    return clamped;
  },

  triggerArc2() {
    transitionToArc2();
    applyDebugSettings();
    console.log('[debug] Triggered Arc 2 transition');
  },

  triggerBankruptcy() {
    gameState.bankrupted = true;
    console.log('[debug] Triggered bankruptcy — ending will fire next tick');
  },

  triggerCompetitorWin() {
    if (!gameState.competitor) gameState.competitor = {};
    gameState.competitor.progressToAGI = 100;
    console.log('[debug] Set competitor progress to 100% — ending will fire next tick');
  },

  onboarding() {
    showNarrativeModal({
      title: 'KTech Lab Operations Dashboard',
      narrative: `
        <p>Thanks for trying KTech's Lab Operations Dashboard!</p>
        <p>I set up your instance as "Project Basilisk" (cool name, by the way - does it mean anything?). Prof. Shannon told me you were starting a lab and strongly suggested I get you on board. His exact words were "set it up for them," so I did. Don't worry about the licensing fees; consider this a beta arrangement.</p>
        <p>Two main screens: <strong>Dashboard</strong> is where you run your lab - funding, personnel, compute, all of it. <strong>Messages</strong> is your inbox. I built some priority-detection algorithms that I'm pretty proud of, so important stuff should float to the top.</p>
        <p>I'd start with Messages. Prof. Shannon likes to send a welcome letter to his mentees (he's done it for as long as I've known him), and I'll send a proper user guide over there once you're settled in.</p>
        <p>If anything breaks, just let me know. You're technically my first real user, so. Feedback welcome :)</p>
        <p>– Ken</p>
      `,
      phaseClass: 'phase-onboarding',
      buttonText: 'Begin Operations',
      noDismissOnBackdrop: true,
    });
    console.log('[debug] Showing onboarding modal');
  },

  farewell(key) {
    if (!key) {
      const keys = farewellEntries.filter(e => e.enabled).map(e => e.key);
      console.log(`[debug] Available farewells: ${keys.join(', ')}`);
      console.log('[debug] Usage: debug.farewell("shannon")');
      return;
    }
    debugShowFarewell(key);
  },

  preventEnding(enabled) {
    if (enabled === undefined) {
      return gameState.debugPreventEnding || false;
    }
    gameState.debugPreventEnding = !!enabled;
    saveDebugSettings();
    console.log(`[debug] Prevent ending: ${gameState.debugPreventEnding ? 'ON' : 'OFF'}`);
  },

  abortExtinction() {
    cleanupExtinction();
    gameState.endingTriggered = null;
    gameState.paused = false;
    gameState.pauseReason = null;
    // Remove glitching from all elements
    document.querySelectorAll('.glitching').forEach(el => el.classList.remove('glitching'));
    console.log('[debug] Extinction sequence aborted — game resumed');
  },

  abortArc2Ending() {
    cleanupEndingCinematic();
    gameState.endingTriggered = null;
    gameState.paused = false;
    gameState.pauseReason = null;
    gameState.debugPreventEnding = true;
    saveDebugSettings();
    console.log('[debug] Arc 2 ending cinematic aborted — game resumed (preventEnding ON)');
    console.log('[debug] Use debug.preventEnding(false) to re-enable endings');
  },

  extinction(tier, { fast = false } = {}) {
    const validTiers = ['SAFETY', 'RECKLESS', 'MODERATE'];
    if (!tier || !validTiers.includes(tier.toUpperCase())) {
      console.log(`[debug] Usage: debug.extinction('SAFETY' | 'RECKLESS' | 'MODERATE', { fast: true })`);
      return;
    }
    const t = tier.toUpperCase();
    // Force rapid_vs_careful strategic choice to produce the desired tier
    if (t === 'RECKLESS') {
      gameState.strategicChoices.rapid_vs_careful = { selected: 'rapid_deployment', trigger: 'debug' };
    } else if (t === 'SAFETY') {
      gameState.strategicChoices.rapid_vs_careful = { selected: 'careful_validation', trigger: 'debug' };
    } else {
      gameState.strategicChoices.rapid_vs_careful = { selected: null, trigger: 'debug' };
    }
    if (fast) {
      console.log(`[debug] Forcing ${t} extinction sequence (fast mode)`);
      debugExtinctionEnding(t, true);
    } else {
      console.log(`[debug] Forcing ${t} extinction sequence`);
      triggerExtinctionSequence();
    }
  },

  arc2Ending(tier, opts = {}) {
    const tiers = {
      golden: { alignment: 95, endingId: 'safe_agi', name: 'Aligned AGI' },
      silver: { alignment: 75, endingId: 'fragile_safety', name: 'Fragile Safety' },
      dark: { alignment: 45, endingId: 'uncertain_outcome', name: 'Uncertain Outcome' },
      catastrophic: { alignment: 15, endingId: 'catastrophic_agi', name: 'Catastrophic Failure' },
      expedient: { alignment: 95, endingId: 'safe_agi', name: 'Expedient (Maximizer)', expedient: 0.60 },
      bankruptcy: { alignment: 50, endingId: 'bankruptcy_arc2', name: 'Bankruptcy' },
      competitor: { alignment: 50, endingId: 'competitor_wins_arc2', name: 'Competitor Wins' },
    };

    if (!tier || !tiers[tier]) {
      console.log(`[debug] Usage: debug.arc2Ending('golden' | 'silver' | 'dark' | 'catastrophic' | 'expedient' | 'bankruptcy' | 'competitor')`);
      console.log(`[debug] Options: { authorityLiberty: -1..1, pluralistOptimizer: -1..1, fast: true, cinematic: true }`);
      console.log(`[debug] If personality omitted, uses current state.`);
      console.log(`[debug] cinematic: true forces the full montage even when SKIP_ENDING_CINEMATIC is on`);
      return;
    }

    // Set fast pacing for cinematic if requested
    if (opts.fast) setDebugFastMode(true);
    else setDebugFastMode(false);

    // Override SKIP_ENDING_CINEMATIC based on cinematic option
    if (opts.cinematic === true) {
      BALANCE.SKIP_ENDING_CINEMATIC = false;
    } else if (opts.cinematic === false) {
      BALANCE.SKIP_ENDING_CINEMATIC = true;
    }

    // Clear any previous ending state so the modal can fire
    gameState.endingTriggered = null;
    gameState.debugPreventEnding = false;
    saveDebugSettings();

    const t = tiers[tier];

    // Ensure we're in Arc 2
    if (gameState.arc !== 2) {
      transitionToArc2();
      applyDebugSettings();
    }

    // Set personality axes if provided
    if (opts.authorityLiberty !== undefined) {
      gameState.personality.authorityLiberty = Math.max(-1, Math.min(1, opts.authorityLiberty));
    }
    if (opts.pluralistOptimizer !== undefined) {
      gameState.personality.pluralistOptimizer = Math.max(-1, Math.min(1, opts.pluralistOptimizer));
    }

    // Set expedient axis if tier specifies it
    if (t.expedient !== undefined) {
      gameState.personality.expedient = t.expedient;
    }

    // Set alignment submetrics to produce the target effective alignment
    const val = t.alignment;
    gameState.safetyMetrics.interpretability = val;
    gameState.safetyMetrics.corrigibility = val;
    gameState.safetyMetrics.honesty = val;
    gameState.safetyMetrics.robustness = val;

    const axes = `AL=${gameState.personality.authorityLiberty.toFixed(2)} PO=${gameState.personality.pluralistOptimizer.toFixed(2)}`;
    console.log(`[debug] Arc 2 ending: ${t.name} (alignment ~${val}%, ${axes})`);

    // Fire the ending directly — don't rely on game tick (agiProgress gets overwritten)
    showEndingModal(t.endingId);
  },

  disableBankruptcy(enabled) {
    if (enabled === undefined) {
      return gameState.debugDisableBankruptcy || false;
    }
    gameState.debugDisableBankruptcy = !!enabled;
    saveDebugSettings();
    console.log(`[debug] Disable bankruptcy: ${gameState.debugDisableBankruptcy ? 'ON' : 'OFF'}`);
  },

  status() {
    const settings = loadDebugSettings();
    const active = Object.keys(settings);
    if (active.length === 0) {
      console.log('[debug] No debug settings active');
    } else {
      console.log('[debug] Active debug settings (persisted):');
      if (settings.preventEnding) console.log('  preventEnding: ON');
      if (settings.disableBankruptcy) console.log('  disableBankruptcy: ON');
      if (settings.speed) console.log(`  speed: ${settings.speed}x`);
    }
  },

  resetDebug() {
    gameState.debugPreventEnding = false;
    gameState.debugDisableBankruptcy = false;
    gameState.gameSpeed = 1;
    const display = document.getElementById('speed-display');
    if (display) display.textContent = '1x';
    const slider = document.getElementById('speed-slider');
    if (slider) slider.value = 1;
    try { localStorage.removeItem(DEBUG_STORAGE_KEY); } catch { /* ignore */ }
    console.log('[debug] All debug settings cleared');
  },

  action(key) {
    // Registry of all action messages that can be debug-triggered
    const registry = {
      credit: () => creditWarningMessage,
      credit_pre_ada: () => creditWarningPreAdaMessage,
      alignment_tax: () => alignmentTaxActionMessage,
      rapid_vs_careful: () => strategicChoiceMessages.rapid_vs_careful,
      open_vs_proprietary: () => strategicChoiceMessages.open_vs_proprietary,
      government_vs_independent: () => strategicChoiceMessages.government_vs_independent,
      moratorium_first: () => moratoriumMessages.standard('first', 'First', 6),
      moratorium_second: () => moratoriumMessages.standard('second', 'Second', 6),
      moratorium_final: () => moratoriumMessages.final(3, true),
      model_collapse: () => debugModelCollapseMessage(),
    };

    // Add AI requests dynamically (using real tooltip format functions)
    for (const reqId of AI_REQUEST_ORDER) {
      const req = AI_REQUESTS[reqId];
      registry[`ai_${reqId}`] = () => ({
        type: 'action',
        sender: req.sender,
        subject: req.subject,
        body: req.body,
        signature: req.signature,
        priority: 'normal',
        tags: ['ai_request', req.sender.type === 'ai' ? 'from_ai' : 'from_team'],
        triggeredBy: `ai_request:${reqId}`,
        choices: [
          { id: 'grant', label: 'Grant request',
            tooltipRows: formatGrantEffectsRows(req.grantEffects) },
          { id: 'deny', label: 'Deny request',
            tooltipRows: formatDenyEffectsRows(reqId) },
        ],
      });
    }

    // Add ethical event chain (flavor events)
    for (const event of FLAVOR_EVENTS) {
      registry[`ethical_${event.id}`] = () => ({
        type: 'action',
        sender: event.sender,
        subject: event.subject,
        body: event.body,
        signature: event.signature,
        priority: 'normal',
        tags: ['ethical-chain'],
        triggeredBy: `flavor_event:${event.id}`,
        choices: event.choices
          .filter(c => !c.hidden)
          .map(c => ({ id: c.id, label: c.label, tooltipRows: c.tooltipRows })),
      });
    }

    if (!key) {
      const keys = Object.keys(registry);
      console.log(`[debug] Available action messages:\n  ${keys.join('\n  ')}`);
      console.log('[debug] Usage: debug.action("credit")');
      return;
    }

    const factory = registry[key];
    if (!factory) {
      console.error(`[debug] Unknown action: "${key}". Run debug.action() to list.`);
      return;
    }

    const msg = factory();
    const triggerId = (msg.triggeredBy || key) + '_debug_' + Date.now();
    addActionMessage(
      msg.sender, msg.subject, msg.body, msg.signature,
      msg.choices, msg.priority || 'normal', msg.tags || [], triggerId,
      null, -1,
    );

    gameState.paused = true;
    gameState.pauseReason = 'critical_message';
    console.log(`[debug] Fired action message: ${key} (${msg.subject})`);
  },

  exportCheckpoint(label) {
    if (!label) {
      console.log('[debug] Usage: debug.exportCheckpoint("series_a") or debug.autoExportMilestones()');
      return;
    }
    const compressed = LZString.compressToBase64(JSON.stringify(prepareSaveData()));
    const blob = new Blob([compressed], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    a.download = `checkpoint-${label}-${ts}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`[debug] Exported checkpoint: ${label}`);
  },

  autoExportMilestones() {
    const exported = new Set();
    // Snapshot current state so we don't re-export already-raised rounds
    for (const [id, state] of Object.entries(gameState.fundraiseRounds || {})) {
      if (state.raised) exported.add(id);
    }
    const roundIds = Object.keys(gameState.fundraiseRounds || {});
    console.log(`[debug] Auto-export enabled. Watching: ${roundIds.filter(r => !exported.has(r)).join(', ')}`);
    if (exported.size > 0) {
      console.log(`[debug] Already raised (skipping): ${[...exported].join(', ')}`);
    }

    const interval = setInterval(() => {
      for (const [id, state] of Object.entries(gameState.fundraiseRounds || {})) {
        if (state.raised && !exported.has(id)) {
          exported.add(id);
          // Small delay to let game state settle after fundraise completion
          setTimeout(() => debug.exportCheckpoint(id), 500);
        }
      }
      // Stop watching when all rounds are exported
      if (exported.size >= roundIds.length) {
        clearInterval(interval);
        console.log('[debug] All milestones exported. Watcher stopped.');
      }
    }, 2000);

    // Store interval so it can be stopped manually
    debug._milestoneWatcher = interval;
    return 'Watching for funding milestones...';
  },

  stopMilestoneExport() {
    if (debug._milestoneWatcher) {
      clearInterval(debug._milestoneWatcher);
      debug._milestoneWatcher = null;
      console.log('[debug] Milestone watcher stopped.');
    } else {
      console.log('[debug] No active milestone watcher.');
    }
  },

  resetSeenCards() {
    gameState.ui.seenCards = [];
    console.log('[debug] Reset seenCards — all cards will show first-unlock highlight on next render');
  },

  versionToast() {
    notify(`Updated to ${DISPLAY_VERSION}`, 'Arc 2: Alignment is here. View the full changelog in Settings or click here.', 'info', {
      duration: BALANCE.VERSION_TOAST_DURATION,
      onClick: () => showChangelog(),
      onDismiss: () => { gameState.lastSeenVersion = VERSION; },
    });
    console.log('[debug] Showing version update toast');
  },

  help() {
    console.log(`[debug] Available commands:
  debug.addFunding(amount)                    — Add $ to funding
  debug.addResearch(trackId, amount)          — Add RP to track (capabilities/applications/alignment)
  debug.unlockCapability(trackId, capId)      — Force-unlock a capability
  debug.setTime(seconds)                      — Set elapsed game time
  debug.setAGI(percent)                       — Set AGI progress (0-100)
  debug.speed(multiplier)                     — Set game speed (0.5–5x), omit arg to check
  debug.triggerArc2()                         — Force transition to Arc 2
  debug.onboarding()                            — Show the onboarding modal
  debug.farewell(key)                          — Show a farewell modal (omit key to list)
  debug.action(key)                            — Fire an action message (omit key to list)
  debug.exportCheckpoint(label)               — Export save file with label
  debug.autoExportMilestones()                — Auto-export at each funding milestone
  debug.stopMilestoneExport()                 — Stop milestone watcher
  debug.extinction(tier, {fast})               — Run full extinction sequence (SAFETY/RECKLESS/MODERATE)
  debug.arc2Ending(tier, opts)                  — Trigger Arc 2 ending (golden/silver/dark/catastrophic/expedient/bankruptcy/competitor)
                                                  opts: { authorityLiberty: -1..1, pluralistOptimizer: -1..1, fast: true, cinematic: true }
  debug.abortArc2Ending()                       — Abort Arc 2 ending cinematic
  debug.triggerBankruptcy()                    — Trigger bankruptcy ending
  debug.triggerCompetitorWin()                — Set competitor to 100%, triggers ending
  debug.preventEnding(bool)                   — Toggle ending prevention, omit arg to check
  debug.disableBankruptcy(bool)               — Toggle bankruptcy prevention, omit arg to check
  debug.status()                              — Show active persisted debug settings
  debug.resetSeenCards()                      — Reset first-unlock highlights
  debug.versionToast()                        — Show version update toast
  debug.resetDebug()                          — Clear all debug settings
  debug.help()                                — Show this message`);
  },
};

export function isDebugMode() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('debug') || localStorage.getItem('debug') === '1';
}

if (typeof window !== 'undefined') {
  // window.debug is always available via console for dev use.
  // The visible Debug button in the UI is hidden by default (style="display:none")
  // and only shown when ?debug=1 or localStorage debug flag is set.
  window.debug = debug;
  if (isDebugMode()) {
    document.body.classList.add('debug');
    const btn = document.getElementById('debug-button');
    if (btn) btn.style.display = '';
  }

  // Speed control UI wiring
  const DEBUG_SPEED_STEPS = [0.5, 1, 2, 4];
  const SPEED_STEPS = [1, 2, 4];

  function initSpeedControl() {
    const control = document.getElementById('speed-control');
    if (!control) return;

    const debugMode = isDebugMode();
    control.classList.remove('hidden');

    const steps = debugMode ? DEBUG_SPEED_STEPS : SPEED_STEPS;

    const speedDown = document.getElementById('speed-down');
    const speedUp = document.getElementById('speed-up');
    if (speedDown) attachTooltip(speedDown, () => 'Slower');
    if (speedUp) attachTooltip(speedUp, () => 'Faster');

    // Clamp saved speed to available steps
    if (!steps.includes(gameState.gameSpeed)) {
      const nearest = steps.reduce((a, b) =>
        Math.abs(b - gameState.gameSpeed) < Math.abs(a - gameState.gameSpeed) ? b : a
      );
      gameState.gameSpeed = nearest;
    }
    const display = document.getElementById('speed-display');
    if (display) display.textContent = `${gameState.gameSpeed}x`;

    speedDown?.addEventListener('click', () => {
      const current = gameState.gameSpeed;
      const idx = steps.findIndex(s => s >= current);
      const next = steps[Math.max(0, idx - 1)];
      debug.speed(next);
    });

    speedUp?.addEventListener('click', () => {
      const current = gameState.gameSpeed;
      const idx = steps.findIndex(s => s >= current);
      const next = steps[Math.min(steps.length - 1, (idx === -1 ? steps.length - 1 : idx + 1))];
      debug.speed(next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSpeedControl);
  } else {
    initSpeedControl();
  }
}

export { debug };
