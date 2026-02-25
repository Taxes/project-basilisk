// Debug console commands for manual playtesting
// Exposes window.debug namespace with helpers for manipulating game state.
// Gated behind ?debug=1 URL param or localStorage.setItem('debug', '1').

import { gameState } from './game-state.js';
import { tracks } from './capabilities.js';
import { transitionToArc2 } from './prestige.js';

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
export function applyDebugSettings() {
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
    gameState.timeElapsed = seconds * 1000;
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

  preventEnding(enabled) {
    if (enabled === undefined) {
      return gameState.debugPreventEnding || false;
    }
    gameState.debugPreventEnding = !!enabled;
    saveDebugSettings();
    console.log(`[debug] Prevent ending: ${gameState.debugPreventEnding ? 'ON' : 'OFF'}`);
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

  help() {
    console.log(`[debug] Available commands:
  debug.addFunding(amount)                    — Add $ to funding
  debug.addResearch(trackId, amount)          — Add RP to track (capabilities/applications/alignment)
  debug.unlockCapability(trackId, capId)      — Force-unlock a capability
  debug.setTime(seconds)                      — Set elapsed game time
  debug.setAGI(percent)                       — Set AGI progress (0-100)
  debug.speed(multiplier)                     — Set game speed (0.5–5x), omit arg to check
  debug.triggerArc2()                         — Force transition to Arc 2
  debug.preventEnding(bool)                   — Toggle ending prevention, omit arg to check
  debug.disableBankruptcy(bool)               — Toggle bankruptcy prevention, omit arg to check
  debug.status()                              — Show active persisted debug settings
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
    const btn = document.getElementById('debug-button');
    if (btn) btn.style.display = '';
  }

  // Speed control UI wiring
  const SPEED_STEPS = [0.5, 1, 2, 4];

  function initSpeedControl() {
    const control = document.getElementById('speed-control');
    if (!control) return;

    document.getElementById('speed-down')?.addEventListener('click', () => {
      const current = gameState.gameSpeed;
      const idx = SPEED_STEPS.findIndex(s => s >= current);
      const next = SPEED_STEPS[Math.max(0, idx - 1)];
      debug.speed(next);
    });

    document.getElementById('speed-up')?.addEventListener('click', () => {
      const current = gameState.gameSpeed;
      const idx = SPEED_STEPS.findIndex(s => s >= current);
      const next = SPEED_STEPS[Math.min(SPEED_STEPS.length - 1, (idx === -1 ? SPEED_STEPS.length - 1 : idx + 1))];
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
