// Typewriter Engine — shared pacing, rendering, and narrative playback
// Extracted from extinction-sequence.js for reuse in Arc 2 ending cinematic.

// Pacing constants (mutable for debug fast mode)
let CHAR_DELAY = 40;          // ms per character
let LINE_PAUSE = 1500;        // ms pause between lines
let SENTENCE_PAUSE = 1500;    // ms pause after sentence-ending punctuation
let PROMPT_DELAY = 1500;      // ms after last line before prompt appears

export function setFastPacing() {
  CHAR_DELAY = 0;
  LINE_PAUSE = 50;
  SENTENCE_PAUSE = 50;
  PROMPT_DELAY = 50;
}

export function restoreNormalPacing() {
  CHAR_DELAY = 40;
  LINE_PAUSE = 1500;
  SENTENCE_PAUSE = 1500;
  PROMPT_DELAY = 1500;
}

// Detect sentence boundary: .?! (not ellipsis) optionally followed by closing quote, then space
export function isSentenceBreak(text, nextIdx) {
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
export function parseEmphasis(line) {
  const open = line.indexOf('**');
  if (open === -1) return { clean: line, emphStart: -1, emphEnd: -1 };
  const afterOpen = line.substring(open + 2);
  const close = afterOpen.indexOf('**');
  if (close === -1) return { clean: line, emphStart: -1, emphEnd: -1 };
  const clean = line.substring(0, open) + afterOpen.substring(0, close) + afterOpen.substring(close + 2);
  return { clean, emphStart: open, emphEnd: open + close };
}

// Render text into a line element, with optional emphasis span
export function renderLineText(lineEl, text, emphStart, emphEnd) {
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
export function showBlinkCursor(lineEl, text, emphStart, emphEnd) {
  renderLineText(lineEl, text, emphStart !== undefined ? emphStart : -1, emphEnd !== undefined ? emphEnd : -1);
  const cursorSpan = document.createElement('span');
  cursorSpan.className = 'ending-cursor-blink';
  cursorSpan.textContent = '\u258C';
  lineEl.appendChild(cursorSpan);
}

// Build the ending screen DOM: scroll area (narrative) + prompt (fixed at bottom)
export function buildEndingDOM(overlay) {
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

// Split narrative lines into sections (split on '---')
export function splitSections(lines) {
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

// Core typewriter engine — types narrative lines section by section with click-to-advance
export function typeNarrative(scrollArea, container, lines, onComplete, { skipEndTransition = false } = {}) {
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
      // All sections done — unlock scrolling
      unlockScroll();

      if (!skipEndTransition) {
        // Smoothly transition to final layout (Arc 1 — prompt appears below)
        const contentHeight = container.offsetHeight;
        const viewportHeight = scrollArea.clientHeight;
        const minPad = viewportHeight * 0.08;
        const idealPad = (viewportHeight - contentHeight) / 2;

        container.style.transition = 'padding-top 1s ease, padding-bottom 1s ease';
        container.style.paddingTop = Math.max(minPad, idealPad) + 'px';
        container.style.paddingBottom = '2rem';
      }
      // Don't scroll — keep user where they just finished reading
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
