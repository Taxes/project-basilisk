// Dynamic favicon — color tracks AGI progress, blinks near 100%
// Design doc: docs/plans/2026-02-25-favicon-design.md

const COLOR_STOPS = [
  { pct: 0,   r: 0x4e, g: 0xcd, b: 0xc4 }, // teal
  { pct: 25,  r: 0x4e, g: 0x7e, b: 0xc4 }, // blue
  { pct: 50,  r: 0x8e, g: 0x4e, b: 0xc4 }, // purple
  { pct: 75,  r: 0xc4, g: 0x4e, b: 0x4e }, // red
  { pct: 100, r: 0xff, g: 0x33, b: 0x33 }, // bright red
];

const BLINK_BLANK_DURATION = 500; // ms — constant 0.5s blank-out

let lastBucket = -1;
let lastProgress = 0;
let blinkInterval = null;
let blinkTimeout = null;
let isBlank = false;
let currentColor = null;

function interpolateColor(progress) {
  const p = Math.max(0, Math.min(100, progress));
  let lo = COLOR_STOPS[0];
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (p >= COLOR_STOPS[i].pct && p <= COLOR_STOPS[i + 1].pct) {
      lo = COLOR_STOPS[i];
      hi = COLOR_STOPS[i + 1];
      break;
    }
  }
  const range = hi.pct - lo.pct || 1;
  const t = (p - lo.pct) / range;
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);
  return `rgb(${r},${g},${b})`;
}

function buildSvgDataUrl(strokeColor) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<path d="M9 6 L23 16 L9 26" fill="none" stroke="${strokeColor}" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"/>` +
    `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function buildBlankDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"/>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function setFavicon(dataUrl) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    document.head.appendChild(link);
  }
  link.href = dataUrl;
}

function getBlinkCycleMs(progress) {
  // 95-98%: linear 10s → 2s
  // 99%: 1s
  if (progress >= 99) return 1000;
  const t = (progress - 95) / 3; // 0 at 95, 1 at 98
  return 10000 - t * 8000;
}

function clearBlink() {
  if (blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; }
  if (blinkTimeout) { clearTimeout(blinkTimeout); blinkTimeout = null; }
  isBlank = false;
}

function startBlink(progress) {
  clearBlink();
  const cycleMs = getBlinkCycleMs(progress);

  function doBlink() {
    isBlank = true;
    setFavicon(buildBlankDataUrl());
    blinkTimeout = setTimeout(() => {
      isBlank = false;
      if (currentColor) setFavicon(buildSvgDataUrl(currentColor));
    }, BLINK_BLANK_DURATION);
  }

  doBlink();
  blinkInterval = setInterval(doBlink, cycleMs);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearBlink();
  } else if (lastProgress >= 95 && lastProgress < 100) {
    startBlink(lastProgress);
  }
});

/**
 * Update favicon color based on AGI progress (0-100).
 * Call from game loop — color throttled to 5% buckets,
 * blink rate uses 1% buckets above 95% for smooth acceleration.
 */
export function updateFavicon(agiProgress) {
  if (document.hidden) return;

  const progress = Math.max(0, Math.min(100, agiProgress));
  const colorBucket = Math.floor(progress / 5);
  const colorChanged = colorBucket !== lastBucket;

  // Update blink rate at 1% granularity above 95%
  if (progress >= 95 && progress < 100) {
    const blinkBucket = Math.floor(progress);
    if (blinkBucket !== Math.floor(lastProgress) || lastProgress < 95) {
      startBlink(progress);
    }
  }

  if (!colorChanged) {
    lastProgress = progress;
    return;
  }
  lastBucket = colorBucket;
  lastProgress = progress;

  if (progress >= 100) {
    clearBlink();
    setFavicon(buildBlankDataUrl());
    currentColor = null;
    return;
  }

  currentColor = interpolateColor(progress);
  if (!isBlank) {
    setFavicon(buildSvgDataUrl(currentColor));
  }

  if (progress < 95) {
    clearBlink();
  }
}
