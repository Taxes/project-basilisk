// Shared formatting utilities for display values

import { gameState } from '../game-state.js';

/** Check if using game time (days) or real time (seconds). */
function useGameTime() {
  return gameState.settings?.timeDisplay !== 'real';
}

const TIERS = [
  { threshold: 1e15, suffix: 'Q' },
  { threshold: 1e12, suffix: 'T' },
  { threshold: 1e9,  suffix: 'B' },
  { threshold: 1e6,  suffix: 'M' },
  { threshold: 1e3,  suffix: 'K' },
];

/** Find the tier for a magnitude: returns { divisor, suffix } or null for < 1K. */
function getTier(abs) {
  for (const { threshold, suffix } of TIERS) {
    if (abs >= threshold) return { divisor: threshold, suffix };
  }
  return null;
}

export function formatFunding(amount, { dollar = true, precision = 2 } = {}) {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const prefix = dollar ? '$' : '';
  const tier = getTier(abs);
  if (tier) return sign + prefix + (abs / tier.divisor).toFixed(precision) + tier.suffix;
  return sign + prefix + abs.toFixed(precision);
}

/** Split funding into { sign, number, suffix } for fixed-width stats bar display. */
export function formatFundingParts(amount) {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const tier = getTier(abs);
  if (tier) return { sign, number: (abs / tier.divisor).toFixed(2), suffix: tier.suffix };
  return { sign, number: abs.toFixed(0), suffix: '' };
}

export function formatNumber(num) {
  const tier = getTier(num);
  if (tier) return (num / tier.divisor).toFixed(2) + tier.suffix;
  return num.toFixed(1);
}

/**
 * Format time duration based on user's time display setting.
 * Game time: days/years (1 second = 1 day)
 * Real time: seconds/minutes/hours
 */
export function formatTime(seconds) {
  if (useGameTime()) {
    const days = Math.floor(seconds);
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remainingDays = days % 365;
      return `${years}y ${remainingDays}d`;
    }
    return `${days}d`;
  } else {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }
}

/** Get rate unit suffix based on user's time display setting. */
export function getRateUnit() {
  return useGameTime() ? '/day' : '/s';
}

export function formatPercent(ratio, decimals = 1) {
  return (ratio * 100).toFixed(decimals) + '%';
}

/**
 * Format a duration in seconds as a compact string.
 * Respects user's time display setting.
 * @param {number} seconds - Duration in seconds
 */
export function formatDuration(seconds) {
  if (useGameTime()) {
    const days = Math.round(seconds);
    if (days >= 3650) return '>10y';
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remainingDays = days % 365;
      return remainingDays > 0 ? `${years}y ${remainingDays}d` : `${years}y`;
    }
    return `${days}d`;
  }
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds >= 36000) return '>10h';
  return `${(seconds / 3600).toFixed(1)}h`;
}

/**
 * Format an ETA string: "~3d remaining" for normal durations, ">10y remaining" for capped ones.
 * Skips the tilde when formatDuration already uses '>' to indicate a cap.
 * @param {number} seconds - Duration in seconds
 */
export function formatEta(seconds) {
  const dur = formatDuration(seconds);
  return dur.startsWith('>') ? `${dur} remaining` : `~${dur} remaining`;
}

/**
 * Format game time as "Year X, Day Y" or "Day Y" for first year.
 * @param {number} gameTimeSeconds - Game time in seconds (1 second = 1 day)
 */
export function formatGameDate(gameTimeSeconds) {
  const totalDays = Math.floor(gameTimeSeconds);
  const year = Math.floor(totalDays / 365);
  const day = (totalDays % 365) + 1; // Day 1-365
  if (year > 0) {
    return `Y${year} D${day}`;
  }
  return `Day ${day}`;
}

/**
 * Lightweight markdown-to-HTML renderer.
 * Supports: **bold**, `code`, [links](url), # headings, - lists.
 * HTML-escapes all input before processing.
 */
export function renderMarkdown(text) {
  const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inlineMd = s => {
    s = escapeHtml(s);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  };

  const lines = text.split('\n');
  const out = [];
  let inList = false;
  let inCodeBlock = false;
  let codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks (```)
    if (/^```/.test(line.trim())) {
      if (inCodeBlock) {
        out.push(`<pre><code>${codeLines.map(escapeHtml).join('\n')}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    // List items — wrap consecutive items in <ul>
    if (/^- /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inlineMd(line.slice(2))}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }

    // Horizontal rules
    if (/^---+$/.test(line.trim())) { out.push('<hr>'); continue; }

    // Headings
    if (line.startsWith('### ')) { out.push(`<h4>${escapeHtml(line.slice(4))}</h4>`); continue; }
    if (line.startsWith('## '))  { out.push(`<h3>${escapeHtml(line.slice(3))}</h3>`); continue; }
    if (line.startsWith('# '))   { out.push(`<h2>${escapeHtml(line.slice(2))}</h2>`); continue; }

    // Blank lines — skip (block elements provide their own spacing)
    if (line.trim() === '') continue;

    // Text line — trailing backslash joins with next line(s) via <br>
    if (line.endsWith('\\')) {
      const group = [inlineMd(line.slice(0, -1))];
      while (i + 1 < lines.length && lines[i + 1].endsWith('\\')) {
        i++;
        group.push(inlineMd(lines[i].slice(0, -1)));
      }
      if (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/^[-#`]/.test(lines[i + 1])) {
        i++;
        group.push(inlineMd(lines[i]));
      }
      out.push(`<p>${group.join('<br>')}</p>`);
      continue;
    }

    // Text paragraph
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  if (inList) out.push('</ul>');

  return out.join('\n');
}
