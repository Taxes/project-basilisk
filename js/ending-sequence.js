// Arc 2 Ending Cinematic Sequence
// Three-scene typewriter cinematic: verdict → vignette → mirror
// Uses the shared typewriter engine from js/ui/typewriter.js

import { gameState } from './game-state.js';
import { getEndingById, getEndingNarrative, getPersonalityEpilogue, triggerEnding } from './endings.js';
import { buildMirrorLines } from './content/mirror-sentences.js';
import { calculateEffectiveAlignment } from './safety-metrics.js';
import { formatTime, formatPercent } from './utils/format.js';
import {
  getAlignmentLabel, getIntegrityLabel, getAutonomyLabel, buildShareText, copyShareImage
} from './share-card.js';
import { calculatePrestigeGain, applyPrestigeGains, resetForPrestige } from './prestige.js';
import { resetTriggeredMessages } from './messages.js';
import {
  setFastPacing, restoreNormalPacing,
  buildEndingDOM, typeNarrative, parseEmphasis,
} from './ui/typewriter.js';
import { BALANCE } from '../data/balance.js';

let debugFastMode = false;

export function setDebugFastMode(fast) {
  debugFastMode = fast;
}

// --- Scene Builders ---

/**
 * Build verdict scene lines from the ending's existing narrative.
 * @param {string} endingId
 * @returns {string[]}
 */
function buildVerdictScene(endingId) {
  return getEndingNarrative(endingId);
}

/**
 * Build vignette scene: archetype name (emphasized) + epilogue paragraphs.
 * @param {string} endingId
 * @returns {string[]}
 */
function buildVignetteScene(endingId) {
  const personalityData = getPersonalityEpilogue(endingId);
  if (!personalityData || !personalityData.archetype) return [];

  const lines = [];

  // Epilogue paragraphs (archetype name shown on stats screen, not here)
  const epilogueLines = Array.isArray(personalityData.epilogue)
    ? personalityData.epilogue
    : [personalityData.epilogue];
  for (let i = 0; i < epilogueLines.length; i++) {
    const line = epilogueLines[i];
    // Lines with \n are tight blocks (e.g. system logs) — split without spacing
    if (line.includes('\n')) {
      for (const subline of line.split('\n')) {
        lines.push(subline);
      }
    } else {
      lines.push(line);
    }
    // Blank line between paragraphs, but not after the last one or separators
    if (i < epilogueLines.length - 1 && line !== '---') {
      lines.push('');
    }
  }

  return lines;
}

/**
 * Build mirror scene from personality data.
 * @returns {string[]}
 */
function buildMirrorScene() {
  return buildMirrorLines();
}

// --- Scene Dispatch ---

const SCENE_BUILDERS = {
  verdict: buildVerdictScene,
  vignette: buildVignetteScene,
  mirror: buildMirrorScene,
};

/**
 * Build a list of scene objects, one per scene — no separators.
 * @param {string} endingId
 * @param {string[]} sceneNames
 * @returns {{ name: string, lines: string[] }[]}
 */
function buildSceneList(endingId, sceneNames) {
  const scenes = [];
  for (const name of sceneNames) {
    const builder = SCENE_BUILDERS[name];
    if (!builder) continue;
    const lines = name === 'mirror' ? builder() : builder(endingId);
    if (lines.length === 0) continue;
    scenes.push({ name, lines });
  }
  return scenes;
}

// --- Fade Transition Helpers ---

/**
 * Get fade timing values, respecting debug fast mode.
 * @returns {{ fadeOut: number, hold: number, fadeIn: number }}
 */
function getFadeTiming() {
  if (debugFastMode) return { fadeOut: 0, hold: 0, fadeIn: 0 };
  return { fadeOut: 800, hold: 1000, fadeIn: 800 };
}

/**
 * Show a blinking advance cursor at the bottom of a container.
 * Calls onAdvance on click or keypress.
 * @param {HTMLElement} container
 * @param {() => void} onAdvance
 */
function showAdvanceCursor(container, onAdvance) {
  const cursor = document.createElement('div');
  cursor.className = 'ending-line ending-cursor-pause';
  cursor.textContent = '\u258C';
  container.appendChild(cursor);

  function advance(e) {
    if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
    if (e.type === 'keydown' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
    e.preventDefault();
    document.removeEventListener('keydown', advance);
    document.removeEventListener('click', advance);
    cursor.remove();
    onAdvance();
  }

  setTimeout(() => {
    document.addEventListener('keydown', advance);
    document.addEventListener('click', advance);
  }, 200);
}

/**
 * Fade a scroll area out, hold on black, then call onComplete.
 * @param {HTMLElement} scrollArea
 * @param {() => void} onComplete
 */
function fadeOut(scrollArea, onComplete) {
  const timing = getFadeTiming();
  scrollArea.style.transition = `opacity ${timing.fadeOut}ms ease`;
  scrollArea.style.opacity = '0';
  setTimeout(() => {
    setTimeout(onComplete, timing.hold);
  }, timing.fadeOut);
}

/**
 * Fade a scroll area in from black.
 * @param {HTMLElement} scrollArea
 * @param {() => void} onComplete
 */
function fadeIn(scrollArea, onComplete) {
  const timing = getFadeTiming();
  scrollArea.style.transition = `opacity ${timing.fadeIn}ms ease`;
  scrollArea.style.opacity = '1';
  setTimeout(onComplete, timing.fadeIn);
}

// --- Dynamic Vertical Centering ---

/**
 * Measure the rendered height of a scene's content without displaying it.
 * Creates a hidden clone with matching styles, measures, then removes it.
 */
function measureSceneHeight(scrollArea, lines) {
  const measure = document.createElement('div');
  measure.className = 'ending-container';
  measure.style.position = 'absolute';
  measure.style.visibility = 'hidden';
  measure.style.paddingTop = '0';
  measure.style.paddingBottom = '0';

  const section = document.createElement('div');
  section.className = 'ending-section';

  // Only measure the first section (before first ---) since the typewriter
  // engine scrolls subsequent sections into view dynamically
  for (const rawLine of lines) {
    if (rawLine === '---') break;
    const { clean } = parseEmphasis(rawLine);
    const lineEl = document.createElement('div');
    lineEl.className = 'ending-line';
    lineEl.textContent = clean;
    section.appendChild(lineEl);
  }

  measure.appendChild(section);
  scrollArea.appendChild(measure);
  const height = measure.offsetHeight;
  measure.remove();
  return height;
}

/**
 * Set container padding-top to vertically center the scene content.
 * Falls back to a minimum padding so content never touches the top edge.
 */
function centerScene(scrollArea, container, lines) {
  const contentHeight = measureSceneHeight(scrollArea, lines);
  const viewportHeight = scrollArea.clientHeight;
  const minPad = viewportHeight * 0.08;
  const idealPad = (viewportHeight - contentHeight) / 2;
  container.style.paddingTop = Math.max(minPad, idealPad) + 'px';
}

// --- Stats Screen ---

function getOutcomeLabel(endingId) {
  if (endingId === 'safe_agi' || endingId === 'fragile_safety') return 'Aligned AI';
  if (endingId === 'uncertain_outcome') return 'Unaligned AI';
  if (endingId === 'catastrophic_agi') return 'Unaligned AI';
  if (endingId === 'competitor_wins_arc2') return 'Race Lost';
  if (endingId === 'bankruptcy_arc2') return 'Bankruptcy';
  return 'Ending';
}

// Intentionally diverges from ending.tier — share card distinguishes
// uncertain_outcome (grey) from catastrophic_agi (red)
function getCardTierClass(endingId) {
  if (endingId === 'safe_agi') return 'golden';
  if (endingId === 'fragile_safety') return 'silver';
  if (endingId === 'uncertain_outcome') return 'dark';
  if (endingId === 'catastrophic_agi') return 'catastrophic';
  return '';
}

function handleCopy(btn, data) {
  const text = buildShareText(data);
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy (text)';
      btn.classList.remove('copied');
    }, 2000);
  });
}

function buildStatsScreen(overlay, endingId) {
  const ending = getEndingById(endingId);
  const personalityData = getPersonalityEpilogue(endingId);

  const screen = document.createElement('div');
  screen.className = 'ending-stats-screen';

  // --- Share card ---
  const card = document.createElement('div');
  const tierClass = getCardTierClass(endingId);
  card.className = 'ending-share-card' + (tierClass ? ' ' + tierClass : '');

  // Title
  const title = document.createElement('div');
  title.className = 'ending-share-title';
  title.textContent = 'PROJECT BASILISK';
  card.appendChild(title);

  // Outcome label (replaces old tier badge)
  const tierBadge = document.createElement('div');
  tierBadge.className = `ending-stats-tier ${ending.tier}`;
  tierBadge.textContent = getOutcomeLabel(endingId);
  card.appendChild(tierBadge);

  // Archetype name and description
  if (personalityData && personalityData.archetype) {
    const archName = document.createElement('div');
    archName.className = 'ending-stats-archetype';
    archName.textContent = personalityData.archetype.name;
    card.appendChild(archName);

    const archDesc = document.createElement('div');
    archDesc.className = 'ending-stats-archetype-desc';
    archDesc.innerHTML = personalityData.archetype.description.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    card.appendChild(archDesc);
  }

  // Key stats — descriptive labels
  const ea = Math.round(calculateEffectiveAlignment());
  const flavorEvents = gameState.personalityTracking?.flavorEvents || {};

  const statEntries = [
    { label: 'Alignment', value: getAlignmentLabel(ea) },
    { label: 'Integrity', value: getIntegrityLabel(flavorEvents) },
    { label: 'Autonomy', value: getAutonomyLabel(gameState.autonomyGranted || 0) },
    { label: 'Time', value: formatTime(gameState.timeElapsed) },
  ].filter(s => s.value != null);

  const statsGrid = document.createElement('div');
  statsGrid.className = 'ending-stats-grid';

  for (const stat of statEntries) {
    const row = document.createElement('div');
    row.className = 'ending-stats-row';

    const label = document.createElement('span');
    label.className = 'ending-stats-label';
    label.textContent = stat.label;

    const value = document.createElement('span');
    value.className = 'ending-stats-value';
    value.textContent = stat.value;

    row.appendChild(label);
    row.appendChild(value);
    statsGrid.appendChild(row);
  }
  card.appendChild(statsGrid);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'ending-share-footer';
  footer.textContent = 'projectbasilisk.com';
  card.appendChild(footer);

  screen.appendChild(card);

  // --- Outside the card ---

  // Share data for copy button
  const shareData = {
    outcomeLabel: getOutcomeLabel(endingId),
    archetypeName: personalityData?.archetype?.name || null,
    archetypeDesc: personalityData?.archetype?.description || null,
    alignment: getAlignmentLabel(ea),
    integrity: getIntegrityLabel(flavorEvents),
    autonomy: getAutonomyLabel(gameState.autonomyGranted || 0),
    time: formatTime(gameState.timeElapsed),
  };

  // Copy (text) button
  const copyTextBtn = document.createElement('button');
  copyTextBtn.className = 'ending-copy-btn';
  copyTextBtn.textContent = 'Copy (text)';
  copyTextBtn.addEventListener('click', () => handleCopy(copyTextBtn, shareData));
  screen.appendChild(copyTextBtn);

  // Copy (image) button
  const copyImgBtn = document.createElement('button');
  copyImgBtn.className = 'ending-copy-btn';
  copyImgBtn.textContent = 'Copy (image)';
  copyImgBtn.addEventListener('click', async () => {
    const imgData = { ...shareData, tierClass: getCardTierClass(endingId) };
    const copied = await copyShareImage(imgData);
    copyImgBtn.textContent = copied ? 'Copied!' : 'Saved!';
    copyImgBtn.classList.add('copied');
    setTimeout(() => {
      copyImgBtn.textContent = 'Copy (image)';
      copyImgBtn.classList.remove('copied');
    }, 2000);
  });
  screen.appendChild(copyImgBtn);

  // Prestige bonus preview (guided/arcade mode only)
  if (ending.triggersPrestige && gameState.gameMode !== 'narrative') {
    const gains = calculatePrestigeGain();
    if (gains.researchMultiplier > 0 || gains.startingFunding > 0 || gains.revenueMultiplier > 0) {
      const prestigeBlock = document.createElement('div');
      prestigeBlock.className = 'ending-stats-prestige';

      const prestigeTitle = document.createElement('div');
      prestigeTitle.className = 'ending-stats-prestige-title';
      prestigeTitle.textContent = 'Prestige Bonuses:';
      prestigeBlock.appendChild(prestigeTitle);

      if (gains.researchMultiplier > 0) {
        const item = document.createElement('div');
        item.className = 'ending-stats-prestige-item';
        item.textContent = `+${formatPercent(gains.researchMultiplier)} Research Speed`;
        prestigeBlock.appendChild(item);
      }
      if (gains.startingFunding > 0) {
        const item = document.createElement('div');
        item.className = 'ending-stats-prestige-item';
        item.textContent = `+${formatPercent(gains.startingFunding)} Starting Funding`;
        prestigeBlock.appendChild(item);
      }
      if (gains.revenueMultiplier > 0) {
        const item = document.createElement('div');
        item.className = 'ending-stats-prestige-item';
        item.textContent = `+${formatPercent(gains.revenueMultiplier)} Token Revenue`;
        prestigeBlock.appendChild(item);
      }

      screen.appendChild(prestigeBlock);
    }
  }

  // Action buttons (terminal prompt style)
  const promptBlock = document.createElement('div');
  promptBlock.className = 'ending-stats-actions';

  const options = [];

  // Prestige option (always available unless narrative mode)
  if (ending.triggersPrestige && gameState.gameMode !== 'narrative') {
    options.push({ label: 'Try again (with bonuses)', action: 'prestige', enabled: true });
  }

  // Continue playing (hidden in narrative mode — narrative always has this)
  options.push({ label: 'Continue Playing', action: 'continue', enabled: true });

  let selectedIndex = 0;

  function render() {
    promptBlock.innerHTML = '';
    options.forEach((opt, i) => {
      const line = document.createElement('div');
      line.className = 'ending-prompt-option';
      if (i === selectedIndex) line.classList.add('selected');
      if (!opt.enabled) line.classList.add('disabled');
      line.textContent = (i === selectedIndex ? '> ' : '  ') + opt.label;

      line.addEventListener('click', () => {
        if (!opt.enabled) return;
        selectedIndex = i;
        activateOption(opt.action);
      });

      promptBlock.appendChild(line);
    });
  }

  function activateOption(action) {
    if (action === 'prestige') {
      const gains = calculatePrestigeGain();
      applyPrestigeGains(gains);
      resetForPrestige();
      resetTriggeredMessages();
      cleanupEndingCinematic();
      location.reload();
    } else if (action === 'continue') {
      gameState.paused = false;
      gameState.pauseReason = null;
      cleanupEndingCinematic();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + options.length) % options.length;
      render();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % options.length;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[selectedIndex].enabled) {
        activateOption(options[selectedIndex].action);
      }
    }
  }

  document.addEventListener('keydown', handleKeydown);
  overlay._endingKeyHandler = handleKeydown;

  screen.appendChild(promptBlock);
  render();

  return screen;
}

// --- Main Entry Point ---

/**
 * Show the Arc 2 ending cinematic sequence.
 * @param {string} endingId
 */
export function showEndingCinematic(endingId) {
  const ending = getEndingById(endingId);
  if (!ending) return;

  // Record the ending
  triggerEnding(endingId);

  // Apply fast pacing if debug mode
  if (debugFastMode) {
    setFastPacing();
  } else {
    restoreNormalPacing();
  }

  // Create overlay
  let overlay = document.getElementById('ending-cinematic-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ending-cinematic-overlay';
    document.body.appendChild(overlay);
  }
  document.body.classList.add('ending-active');

  // Build individual scenes (no --- separators)
  const sceneNames = ending.scenes || ['verdict'];
  const scenes = buildSceneList(endingId, sceneNames);

  // Skip cinematic and go straight to stats when flag is set
  if (BALANCE.SKIP_ENDING_CINEMATIC) {
    showStatsScreen(overlay, endingId);
    return;
  }

  // Allow click-to-reveal on replay (player has seen at least one ending before)
  const isReplay = (gameState.endingsSeen || []).length > 0;

  // Hold on black after fade-in before starting narration
  const holdDelay = debugFastMode ? 0 : 3500; // 2s fade + 1.5s silence

  const { scrollArea, container, promptBlock } = buildEndingDOM(overlay);
  // Hide the default prompt block — we use stats screen instead
  promptBlock.style.display = 'none';

  let sceneIndex = 0;

  function playNextScene() {
    if (sceneIndex >= scenes.length) {
      // All scenes done — fade out then show stats
      fadeOut(scrollArea, () => {
        showStatsScreen(overlay, endingId);
      });
      return;
    }

    const scene = scenes[sceneIndex];
    sceneIndex++;

    // Pre-calculate vertical position so text doesn't shift during typewriter
    centerScene(scrollArea, container, scene.lines);

    // Skip end-of-typing layout transition — cinematic fades out between scenes
    typeNarrative(scrollArea, container, scene.lines, () => {
      if (sceneIndex < scenes.length) {
        // More scenes — show advance cursor, then fade transition
        showAdvanceCursor(container, () => {
          fadeOut(scrollArea, () => {
            // Clear container and reset scroll/styles for fresh scene
            container.innerHTML = '';
            container.style.paddingBottom = '';
            container.style.transition = '';
            scrollArea.scrollTop = 0;
            fadeIn(scrollArea, playNextScene);
          });
        });
      } else {
        // Last scene — advance cursor then stats
        showAdvanceCursor(container, () => {
          fadeOut(scrollArea, () => {
            showStatsScreen(overlay, endingId);
          });
        });
      }
    }, { skipEndTransition: true, skippable: isReplay });
  }

  setTimeout(playNextScene, holdDelay);
}

function showStatsScreen(overlay, endingId) {
  // Fade out narrative, fade in stats
  overlay.innerHTML = '';
  overlay.classList.remove('ending-screen');
  overlay.classList.add('ending-stats-active');

  const statsScreen = buildStatsScreen(overlay, endingId);
  overlay.appendChild(statsScreen);
}

// --- Cleanup ---

export function cleanupEndingCinematic() {
  document.body.classList.remove('ending-active');
  const overlay = document.getElementById('ending-cinematic-overlay');
  if (overlay) {
    if (overlay._endingKeyHandler) {
      document.removeEventListener('keydown', overlay._endingKeyHandler);
    }
    overlay.remove();
  }
  debugFastMode = false;
  restoreNormalPacing();
}

// Export for testing
if (typeof window !== 'undefined') {
  window.showEndingCinematic = showEndingCinematic;
  window.cleanupEndingCinematic = cleanupEndingCinematic;
  window.setDebugFastMode = setDebugFastMode;
}
