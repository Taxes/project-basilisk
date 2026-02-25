// Shared formatting utilities for display values

import { gameState } from '../game-state.js';

/** Check if using game time (days) or real time (seconds). */
function useGameTime() {
  return gameState.settings?.timeDisplay !== 'real';
}

export function formatFunding(amount, { dollar = true, precision = 2 } = {}) {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const prefix = dollar ? '$' : '';
  if (abs >= 1e15) return sign + prefix + (abs / 1e15).toFixed(precision) + 'Q';
  if (abs >= 1e12) return sign + prefix + (abs / 1e12).toFixed(precision) + 'T';
  if (abs >= 1e9) return sign + prefix + (abs / 1e9).toFixed(precision) + 'B';
  if (abs >= 1e6) return sign + prefix + (abs / 1e6).toFixed(precision) + 'M';
  if (abs >= 1e3) return sign + prefix + (abs / 1e3).toFixed(precision) + 'K';
  return sign + prefix + abs.toFixed(precision);
}

/** Split funding into { sign, number, suffix } for fixed-width stats bar display. */
export function formatFundingParts(amount) {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1e15) return { sign, number: (abs / 1e15).toFixed(2), suffix: 'Q' };
  if (abs >= 1e12) return { sign, number: (abs / 1e12).toFixed(2), suffix: 'T' };
  if (abs >= 1e9) return { sign, number: (abs / 1e9).toFixed(2), suffix: 'B' };
  if (abs >= 1e6) return { sign, number: (abs / 1e6).toFixed(2), suffix: 'M' };
  if (abs >= 1e3) return { sign, number: (abs / 1e3).toFixed(2), suffix: 'K' };
  return { sign, number: abs.toFixed(0), suffix: '' };
}

export function formatNumber(num) {
  if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Q';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
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
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remainingDays = days % 365;
      return remainingDays > 0 ? `${years}y ${remainingDays}d` : `${years}y`;
    }
    return `${days}d`;
  }
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
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
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  };

  const lines = text.split('\n');
  const out = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // List items — wrap consecutive items in <ul>
    if (/^- /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inlineMd(line.slice(2))}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }

    // Headings
    if (line.startsWith('### ')) { out.push(`<h4>${escapeHtml(line.slice(4))}</h4>`); continue; }
    if (line.startsWith('## '))  { out.push(`<h3>${escapeHtml(line.slice(3))}</h3>`); continue; }
    if (line.startsWith('# '))   { out.push(`<h2>${escapeHtml(line.slice(2))}</h2>`); continue; }

    // Blank lines — skip (block elements provide their own spacing)
    if (line.trim() === '') continue;

    // Text paragraph
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  if (inList) out.push('</ul>');

  return out.join('\n');
}
