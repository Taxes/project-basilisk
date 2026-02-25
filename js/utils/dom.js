// js/utils/dom.js
/**
 * Create an element with optional class, text, and attributes.
 * Use for DOM creation (full rebuild paths). Do NOT use in
 * incremental update hot paths — write to cached refs instead.
 */
export function el(tag, opts = {}) {
  const elem = document.createElement(tag);
  if (opts.className) elem.className = opts.className;
  if (opts.text !== undefined) elem.textContent = opts.text;
  if (opts.html !== undefined) elem.innerHTML = opts.html;
  if (opts.data) {
    for (const [k, v] of Object.entries(opts.data)) {
      elem.dataset[k] = v;
    }
  }
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      elem.setAttribute(k, v);
    }
  }
  if (opts.children) {
    for (const child of opts.children) {
      if (typeof child === 'string') {
        elem.appendChild(document.createTextNode(child));
      } else if (child) {
        elem.appendChild(child);
      }
    }
  }
  return elem;
}

/**
 * Enhance an input element with standard UX behaviors:
 * - Enter key blurs (confirms value)
 * - Escape key reverts to value before focus and blurs
 * - Focus selects all text for easy replacement
 * - Scroll wheel prevented to avoid accidental changes
 */
export function enhanceInput(input) {
  let valueOnFocus = '';

  input.addEventListener('focus', () => {
    valueOnFocus = input.value;
    // Select all on next tick so the browser's own selection doesn't override
    requestAnimationFrame(() => input.select());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur(); // triggers change event naturally
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.value = valueOnFocus;
      input.blur();
    }
  });

  input.addEventListener('wheel', (e) => {
    if (document.activeElement === input) {
      e.preventDefault();
    }
  }, { passive: false });

  return input;
}
