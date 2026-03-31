// Share Card — descriptive labels and text formatter for ending share cards
import { ALIGNMENT } from '../data/balance.js';

/**
 * Descriptive alignment label for the share card.
 * @param {number} effectiveAlignment - 0-100
 * @returns {string}
 */
export function getAlignmentLabel(effectiveAlignment) {
  if (effectiveAlignment >= 95) return 'Complete';
  if (effectiveAlignment >= ALIGNMENT.ENDING_SAFE_AGI) return 'Robust';
  if (effectiveAlignment >= ALIGNMENT.ENDING_FRAGILE) return 'Fragile';
  if (effectiveAlignment >= ALIGNMENT.ENDING_UNCERTAIN) return 'Failing';
  return 'Ignored';
}

/**
 * Descriptive integrity label based on ethical flavor event choices.
 * Mirrors the logic in selectEthicalChainMirrorSentence() from mirror-sentences.js.
 * @param {Object} flavorEvents - map of eventId → 'good'|'expedient'
 * @returns {string|null} null if no events fired
 */
export function getIntegrityLabel(flavorEvents) {
  const choices = Object.values(flavorEvents || {});
  if (choices.length === 0) return null;

  const allExpedient = choices.every(c => c === 'expedient');
  const noneExpedient = choices.every(c => c !== 'expedient');
  const expedientOnLateEvent =
    flavorEvents['whistleblower'] === 'expedient' ||
    flavorEvents['lobbying'] === 'expedient';

  if (noneExpedient) return 'Principled';
  if (expedientOnLateEvent) return 'Compromised';
  if (allExpedient) return 'Ruthless';
  return 'Pragmatic';
}

/**
 * Descriptive autonomy label.
 * @param {number} grants - 0-5
 * @returns {string}
 */
export function getAutonomyLabel(grants) {
  if (grants === 0) return 'None';
  if (grants <= 2) return 'Chained';
  if (grants <= 4) return 'Partial';
  return 'Free';
}

/**
 * Build a plain-text summary for clipboard sharing.
 * @param {Object} data
 * @returns {string}
 */
export function buildShareText(data) {
  const lines = ['Project Basilisk'];

  if (data.archetypeName) {
    lines.push(`${data.outcomeLabel} — ${data.archetypeName}`);
    if (data.archetypeDesc) lines.push(`"${data.archetypeDesc}"`);
  } else {
    lines.push(data.outcomeLabel);
  }

  const stats = [];
  if (data.alignment) stats.push(`Alignment: ${data.alignment}`);
  if (data.integrity) stats.push(`Integrity: ${data.integrity}`);
  if (data.autonomy) stats.push(`Autonomy: ${data.autonomy}`);
  if (data.agiProgress) stats.push(`AGI Progress: ${data.agiProgress}`);
  if (data.time) stats.push(`Time: ${data.time}`);
  if (stats.length > 0) lines.push(stats.join(' | '));

  lines.push('projectbasilisk.com');
  return lines.join('\n');
}

// --- Canvas Image Rendering ---

const TIER_COLORS = {
  golden: '#ffd700',
  silver: '#c0c0c0',
  dark: '#666666',
  catastrophic: '#cc3333',
};
const DEFAULT_BORDER_COLOR = '#333333';
const FONT_FAMILY = "'Courier New', 'Consolas', monospace";

/**
 * Word-wrap text for canvas rendering.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Render the share card as a PNG image on an offscreen canvas.
 * @param {Object} data - Same shape as buildShareText, plus tierClass
 * @returns {Promise<Blob>}
 */
export async function renderShareCardImage(data) {
  const dpr = window.devicePixelRatio || 2;
  const W = 480;
  const H = 480;
  const pad = 40;
  const contentW = W - pad * 2;
  const borderColor = TIER_COLORS[data.tierClass] || DEFAULT_BORDER_COLOR;

  // Pre-measure content height to compute vertical centering
  const measure = document.createElement('canvas');
  const mCtx = measure.getContext('2d');

  let contentH = 0;

  // Title
  mCtx.font = `13px ${FONT_FAMILY}`;
  contentH += 13 + 20;

  // Outcome label
  mCtx.font = `bold 22px ${FONT_FAMILY}`;
  contentH += 22 + 16;

  // Archetype (Arc 2 only)
  if (data.archetypeName) {
    mCtx.font = `bold 18px ${FONT_FAMILY}`;
    contentH += 18 + 8;

    if (data.archetypeDesc) {
      mCtx.font = `italic 13px ${FONT_FAMILY}`;
      const descLines = wrapText(mCtx, data.archetypeDesc, contentW);
      contentH += descLines.length * 18 + 12;
    }
  }

  // HR + gap
  contentH += 20;

  // Stats rows
  const statEntries = [];
  if (data.alignment) statEntries.push({ label: 'Alignment', value: data.alignment });
  if (data.integrity) statEntries.push({ label: 'Integrity', value: data.integrity });
  if (data.autonomy) statEntries.push({ label: 'Autonomy', value: data.autonomy });
  if (data.agiProgress) statEntries.push({ label: 'AGI Progress', value: data.agiProgress });
  if (data.time) statEntries.push({ label: 'Time', value: data.time });

  contentH += statEntries.length * 28 + 8;

  // HR + gap
  contentH += 20;

  // Footer
  contentH += 12;

  // Vertically center the content
  const topPad = Math.max(pad, (H - contentH) / 2);

  // Create the real canvas at 2x
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  let cy = topPad;

  // Title — small caps effect via uppercase + small font
  ctx.fillStyle = '#555555';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText('PROJECT BASILISK', W / 2, cy + 13);
  cy += 13 + 20;

  // Outcome label
  ctx.fillStyle = borderColor;
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(data.outcomeLabel, W / 2, cy + 22);
  cy += 22 + 16;

  // Archetype name + description (Arc 2 only)
  if (data.archetypeName) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(data.archetypeName, W / 2, cy + 18);
    cy += 18 + 8;

    if (data.archetypeDesc) {
      ctx.fillStyle = '#888888';
      ctx.font = `italic 13px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      const descLines = wrapText(ctx, data.archetypeDesc, contentW);
      for (const line of descLines) {
        ctx.fillText(line, W / 2, cy + 13);
        cy += 18;
      }
      cy += 12;
    }
  }

  // Horizontal rule
  cy += 6;
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, cy);
  ctx.lineTo(W - pad, cy);
  ctx.stroke();
  cy += 14;

  // Stats rows
  ctx.textBaseline = 'top';
  for (const stat of statEntries) {
    ctx.fillStyle = '#888888';
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText(stat.label, pad, cy);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(stat.value, W - pad, cy);
    cy += 28;
  }
  cy += 8;

  // Horizontal rule
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, cy);
  ctx.lineTo(W - pad, cy);
  ctx.stroke();
  cy += 20;

  // Footer
  ctx.fillStyle = '#444444';
  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('projectbasilisk.com', W / 2, cy + 12);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Copy the share card image to clipboard, or download as fallback.
 * @param {Object} data
 * @returns {Promise<boolean>} true if copied to clipboard, false if downloaded
 */
export async function copyShareImage(data) {
  const blob = await renderShareCardImage(data);
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } catch {
    // Fallback: download the image
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-basilisk-ending.png';
    a.click();
    URL.revokeObjectURL(url);
    return false;
  }
}
