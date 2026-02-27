// Player-facing text: see docs/message-registry.json
// Extinction Sequence - Variable pacing based on hidden alignment
// Reckless players: fast, brutal (~30s). Safety-conscious: slow, tragic (~90s).

import { gameState, resetGame } from './game-state.js';
import { transitionToArc2 } from './prestige.js';
import { applyDebugSettings, isDebugMode } from './debug-commands.js';
import { addNewsItem, clearNewsFeed } from './news-feed.js';
import { EXTINCTION_TIMING, ALIGNMENT } from '../data/balance.js';
import { arc1Endings, triggerEnding } from './endings.js';
import { resetQueueIdCounter } from './focus-queue.js';
import { resetTriggeredMessages } from './messages.js';
import { extinctionNewsByTier } from './content/news-content.js';


let sequenceActive = false;
let sequenceTimeouts = [];

export function getExtinctionTier() {
  const ha = gameState.hiddenAlignment || 0;
  if (ha < ALIGNMENT.EXTINCTION_RECKLESS_THRESHOLD) return 'RECKLESS';
  if (ha > ALIGNMENT.EXTINCTION_SAFETY_THRESHOLD) return 'SAFETY';
  return 'MODERATE';
}

export function getExtinctionNewsForTier(tier) {
  return extinctionNewsByTier[tier] || extinctionNewsByTier.MODERATE;
}

export function triggerExtinctionSequence() {
  if (sequenceActive) return;

  // During fast-forward, skip cinematic and directly transition
  if (gameState._fastForwarding) {
    const tier = getExtinctionTier();
    if (!gameState._fastForwardEvents) gameState._fastForwardEvents = [];
    gameState._fastForwardEvents.push({
      id: 'extinction_sequence',
      name: `Extinction Sequence (${tier})`,
      tier: tier,
      autoResolved: true
    });
    transitionToArc2();
    applyDebugSettings();
    // Don't reload — we're in fast-forward, the server controls state
    return;
  }

  sequenceActive = true;

  const tier = getExtinctionTier();
  const timing = EXTINCTION_TIMING[tier];
  const news = extinctionNewsByTier[tier];

  clearNewsFeed();
  document.body.classList.add('extinction-active');

  news.forEach((item, i) => {
    const delay = timing.NEWS_DELAYS[i] || (timing.NEWS_DELAYS[timing.NEWS_DELAYS.length - 1] + (i * 4000));
    if (item.text) {
      const timeout = setTimeout(() => {
        addNewsItem(item.text, 'extinction');
      }, delay);
      sequenceTimeouts.push(timeout);
    }
  });

  const degradationTimeout = setTimeout(() => {
    startUIDegradation(tier);
  }, timing.DEGRADATION_DELAY);
  sequenceTimeouts.push(degradationTimeout);

  const fadeTimeout = setTimeout(() => {
    fadeToBlack();
  }, timing.FADE_TO_BLACK_DELAY);
  sequenceTimeouts.push(fadeTimeout);

  const unlockTimeout = setTimeout(() => {
    showEndingScreen(tier);
  }, timing.ARC2_UNLOCK_DELAY);
  sequenceTimeouts.push(unlockTimeout);

  const safetyTimeout = setTimeout(() => {
    if (sequenceActive) {
      console.warn('Extinction sequence safety timeout triggered');
      showEndingScreen(tier);
    }
  }, EXTINCTION_TIMING.SAFETY_TIMEOUT);
  sequenceTimeouts.push(safetyTimeout);
}

function startUIDegradation(tier) {
  document.body.classList.add('ui-degrading');
  const elements = document.querySelectorAll('.column, #stats-bar, #header');
  const baseDelay = tier === 'RECKLESS' ? 500 : tier === 'SAFETY' ? 2000 : 1000;
  elements.forEach((el, i) => {
    const timeout = setTimeout(() => {
      el.classList.add('glitching');
    }, i * baseDelay);
    sequenceTimeouts.push(timeout);
  });
}

function fadeToBlack() {
  const overlay = document.createElement('div');
  overlay.id = 'extinction-overlay';
  overlay.className = 'fade-in';
  document.body.appendChild(overlay);
}

// --- Terminal Ending Screen ---
// Typewriter pacing constants (mutable for debug fast mode)
let CHAR_DELAY = 40;          // ms per character
let LINE_PAUSE = 1500;        // ms pause between lines
let SENTENCE_PAUSE = 1500;    // ms pause after sentence-ending punctuation
let PROMPT_DELAY = 1500;      // ms after last line before prompt appears

function setFastPacing() {
  CHAR_DELAY = 5;
  LINE_PAUSE = 200;
  SENTENCE_PAUSE = 200;
  PROMPT_DELAY = 200;
}

function restoreNormalPacing() {
  CHAR_DELAY = 40;
  LINE_PAUSE = 1500;
  SENTENCE_PAUSE = 1500;
  PROMPT_DELAY = 1500;
}

// Detect sentence boundary: .?! (not ellipsis) optionally followed by closing quote, then space
function isSentenceBreak(text, nextIdx) {
  if (nextIdx >= text.length || text[nextIdx] !== ' ') return false;
  let i = nextIdx - 1;
  // Skip closing quotes
  while (i >= 0 && '"\'\u201D\u2019'.includes(text[i])) i--;
  if (i < 0 || !'.?!'.includes(text[i])) return false;
  // Exclude ellipsis (two or more consecutive dots)
  if (text[i] === '.' && i > 0 && text[i - 1] === '.') return false;
  return true;
}

// Parse **emphasis** markers from a line, return { clean, emphStart, emphEnd }
// emphStart/emphEnd are char indices in the cleaned string (-1 if no emphasis)
function parseEmphasis(line) {
  const open = line.indexOf('**');
  if (open === -1) return { clean: line, emphStart: -1, emphEnd: -1 };
  const afterOpen = line.substring(open + 2);
  const close = afterOpen.indexOf('**');
  if (close === -1) return { clean: line, emphStart: -1, emphEnd: -1 };
  const clean = line.substring(0, open) + afterOpen.substring(0, close) + afterOpen.substring(close + 2);
  return { clean, emphStart: open, emphEnd: open + close };
}

// Render text into a line element, with optional emphasis span
function renderLineText(lineEl, text, emphStart, emphEnd) {
  lineEl.textContent = '';
  if (emphStart >= 0 && emphStart < text.length) {
    const eStart = Math.min(emphStart, text.length);
    const eEnd = Math.min(emphEnd, text.length);
    if (eStart > 0) lineEl.appendChild(document.createTextNode(text.substring(0, eStart)));
    if (eEnd > eStart) {
      const em = document.createElement('span');
      em.className = 'ending-emphasis';
      em.textContent = text.substring(eStart, eEnd);
      lineEl.appendChild(em);
    }
    if (eEnd < text.length) lineEl.appendChild(document.createTextNode(text.substring(eEnd)));
  } else {
    lineEl.appendChild(document.createTextNode(text));
  }
}

// Show blinking cursor at end of text in a line element
function showBlinkCursor(lineEl, text, emphStart, emphEnd) {
  renderLineText(lineEl, text, emphStart !== undefined ? emphStart : -1, emphEnd !== undefined ? emphEnd : -1);
  const cursorSpan = document.createElement('span');
  cursorSpan.className = 'ending-cursor-blink';
  cursorSpan.textContent = '\u258C';
  lineEl.appendChild(cursorSpan);
}

// Build the ending screen DOM: scroll area (narrative) + prompt (fixed at bottom)
function buildEndingDOM(overlay) {
  overlay.innerHTML = '';
  overlay.classList.add('ending-screen');

  // Scroll area holds the narrative — separate from prompt so prompt never moves
  const scrollArea = document.createElement('div');
  scrollArea.className = 'ending-scroll-area';

  const container = document.createElement('div');
  container.className = 'ending-container';
  scrollArea.appendChild(container);

  // Prompt sits below scroll area, outside scrollable content
  const promptBlock = document.createElement('div');
  promptBlock.className = 'ending-prompt';
  promptBlock.style.display = 'none';

  overlay.appendChild(scrollArea);
  overlay.appendChild(promptBlock);

  return { scrollArea, container, promptBlock };
}

function showEndingScreen(_tier) {
  const overlay = document.getElementById('extinction-overlay');
  if (!overlay) {
    console.error('Extinction overlay not found');
    return;
  }

  // Record the ending
  const ending = arc1Endings.extinction;
  const variant = ending.getVariant();
  triggerEnding('extinction', variant);

  const narrativeLines = ending.variants[variant].narrative;
  const { scrollArea, container, promptBlock } = buildEndingDOM(overlay);

  typeNarrative(scrollArea, container, narrativeLines, () => {
    showTerminalPrompt(promptBlock, overlay);
  });
}

// Split narrative lines into sections (split on '---')
function splitSections(lines) {
  const sections = [];
  let current = [];
  for (const line of lines) {
    if (line === '---') {
      sections.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) sections.push(current);
  return sections;
}

function typeNarrative(scrollArea, container, lines, onComplete) {
  const sections = splitSections(lines);
  let sectionIndex = 0;

  // Lock user scrolling (but allow programmatic scrollBy)
  function blockScroll(e) { e.preventDefault(); }
  scrollArea.addEventListener('wheel', blockScroll, { passive: false });
  scrollArea.addEventListener('touchmove', blockScroll, { passive: false });

  function unlockScroll() {
    scrollArea.removeEventListener('wheel', blockScroll);
    scrollArea.removeEventListener('touchmove', blockScroll);
  }

  function scrollToSection(sectionEl) {
    const areaRect = scrollArea.getBoundingClientRect();
    const sectionRect = sectionEl.getBoundingClientRect();
    const currentOffset = sectionRect.top - areaRect.top;
    const desiredOffset = areaRect.height * 0.3;
    scrollArea.scrollBy({ top: currentOffset - desiredOffset, behavior: 'smooth' });
  }

  function playSection() {
    if (sectionIndex >= sections.length) {
      // All sections done — unlock scrolling, smoothly transition to final layout
      unlockScroll();
      container.style.transition = 'padding-bottom 1s ease';
      container.style.paddingBottom = '2rem';
      // Don't scroll — keep user at section 3 where they just finished reading
      setTimeout(onComplete, PROMPT_DELAY);
      return;
    }

    const sectionLines = sections[sectionIndex];
    sectionIndex++;

    // Create section element
    const sectionEl = document.createElement('div');
    sectionEl.className = 'ending-section';
    container.appendChild(sectionEl);

    // Smooth-scroll so new section starts at consistent position
    scrollToSection(sectionEl);

    // Type lines within this section
    let lineIdx = 0;
    function nextLine() {
      if (lineIdx >= sectionLines.length) {
        // Section complete
        if (sectionIndex < sections.length) {
          // More sections — show cursor, wait for advance
          const cursor = document.createElement('div');
          cursor.className = 'ending-line ending-cursor-pause';
          cursor.textContent = '\u258C';
          sectionEl.appendChild(cursor);

          function advance(e) {
            if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
            if (e.type === 'keydown' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
            e.preventDefault();
            document.removeEventListener('keydown', advance);
            document.removeEventListener('click', advance);
            cursor.remove();
            // Dim the completed section
            sectionEl.classList.add('dimmed');
            // Brief pause, then scroll up and start next section
            setTimeout(playSection, 400);
          }

          setTimeout(() => {
            document.addEventListener('keydown', advance);
            document.addEventListener('click', advance);
          }, 200);
        } else {
          // Last section — go to prompt
          playSection(); // triggers unlock + onComplete
        }
        return;
      }

      const rawLine = sectionLines[lineIdx];
      lineIdx++;

      const { clean: line, emphStart, emphEnd } = parseEmphasis(rawLine);

      const lineEl = document.createElement('div');
      lineEl.className = 'ending-line';
      sectionEl.appendChild(lineEl);

      // Typewriter effect with trailing cursor and sentence pauses
      let charIndex = 0;
      const CURSOR = '\u258C';
      function typeChar() {
        if (charIndex < line.length) {
          const partial = line.substring(0, charIndex + 1);
          renderLineText(lineEl, partial + CURSOR, emphStart, emphEnd);
          charIndex++;

          // Sentence break: pause with blinking cursor
          if (isSentenceBreak(line, charIndex)) {
            showBlinkCursor(lineEl, line.substring(0, charIndex), emphStart, emphEnd);
            setTimeout(typeChar, SENTENCE_PAUSE);
          } else {
            setTimeout(typeChar, CHAR_DELAY);
          }
        } else {
          // End of line: blink cursor during pause, then advance
          showBlinkCursor(lineEl, line, emphStart, emphEnd);
          setTimeout(() => {
            renderLineText(lineEl, line, emphStart, emphEnd);
            nextLine();
          }, LINE_PAUSE);
        }
      }
      typeChar();
    }

    nextLine();
  }

  playSection();
}

function showTerminalPrompt(promptBlock, overlay) {
  promptBlock.style.display = '';

  const options = [
    { label: 'Arc 2: Alignment [coming soon]', action: 'arc2', enabled: false },
    { label: 'New game', action: 'new_game', enabled: true },
  ];

  // Start selection on first enabled option
  let selectedIndex = options.findIndex(o => o.enabled);

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
        activateOption(options[i].action);
      });

      promptBlock.appendChild(line);
    });
  }

  function activateOption(action) {
    if (action === 'new_game') {
      resetGame();
      applyDebugSettings();
      resetQueueIdCounter();
      resetTriggeredMessages();
      cleanup();
      location.reload();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      do {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
      } while (!options[selectedIndex].enabled && selectedIndex !== 0);
      render();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      do {
        selectedIndex = (selectedIndex + 1) % options.length;
      } while (!options[selectedIndex].enabled && selectedIndex !== options.length - 1);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[selectedIndex].enabled) {
        activateOption(options[selectedIndex].action);
      }
    }
  }

  document.addEventListener('keydown', handleKeydown);

  // Store cleanup ref so we can remove the listener
  overlay._endingKeyHandler = handleKeydown;

  render();
}

// Debug entry point — skip extinction sequence, jump to ending screen
// debugEnding('SAFETY', true) for fast mode (5ms/char, 200ms pauses)
export function debugEnding(variant, fast = false) {
  const validVariants = ['SAFETY', 'RECKLESS', 'MODERATE'];
  if (!validVariants.includes(variant)) {
    console.error(`[debugEnding] Invalid variant: ${variant}. Use: ${validVariants.join(', ')}`);
    return;
  }

  if (fast) setFastPacing();
  else restoreNormalPacing();

  // Create overlay if not present
  let overlay = document.getElementById('extinction-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'extinction-overlay';
    document.body.appendChild(overlay);
  }
  overlay.style.opacity = '1';

  document.body.classList.add('extinction-active');

  const ending = arc1Endings.extinction;
  const narrativeLines = ending.variants[variant].narrative;

  // Record ending
  triggerEnding('extinction', variant);

  const { scrollArea, container, promptBlock } = buildEndingDOM(overlay);

  typeNarrative(scrollArea, container, narrativeLines, () => {
    showTerminalPrompt(promptBlock, overlay);
  });

  console.log(`[debugEnding] Playing ${variant} ending`);
}

function cleanup() {
  sequenceTimeouts.forEach(t => clearTimeout(t));
  sequenceTimeouts = [];
  sequenceActive = false;
  document.body.classList.remove('extinction-active', 'ui-degrading');
  const overlay = document.getElementById('extinction-overlay');
  if (overlay) {
    // Remove keyboard handler if attached
    if (overlay._endingKeyHandler) {
      document.removeEventListener('keydown', overlay._endingKeyHandler);
    }
    overlay.remove();
  }
}

export function isExtinctionSequenceActive() {
  return sequenceActive;
}

// Export for testing
if (typeof window !== 'undefined') {
  window.triggerExtinctionSequence = triggerExtinctionSequence;
  window.isExtinctionSequenceActive = isExtinctionSequenceActive;
  window.getExtinctionTier = getExtinctionTier;
  window.getExtinctionNewsForTier = getExtinctionNewsForTier;
  if (isDebugMode()) window.debugEnding = debugEnding;
}
