// Player-facing text: see docs/message-registry.json
// News Feed System - Event-driven narrative delivery
// News items are triggered by game events and delivered via the message system.
// Dedup tracking lives in messages.js (triggeredMessageKeys).

import { newsContent } from './content/news-content.js';
import { alignmentTaxActionMessage } from './content/message-content.js';
import { applyAlignmentTaxOnFire } from './alignment-tax-handler.js';
import { gameState } from './game-state.js';
import { ALIGNMENT } from '../data/balance.js';
import { addNewsMessage, addActionMessage, hasMessageBeenTriggered } from './messages.js';
import { formatFunding } from './utils/format.js';

let lastNewsText = null;

// Add a news item to the message system
export function addNewsItem(text, type = 'flavor', triggeredBy = null, body = null, contentParams = null) {
  // Dedup: skip if most recent item has identical text
  const textStr = String(text);
  if (textStr === lastNewsText) return;
  lastNewsText = textStr;

  addNewsMessage(textStr, [type], triggeredBy, body, contentParams);
}

// Trigger news for a specific event
export function triggerNewsForEvent(eventType, eventId) {
  const newsKey = `${eventType}:${eventId}`;

  // Don't repeat the same news
  if (hasMessageBeenTriggered(newsKey)) return;

  const categoryContent = newsContent[eventType];
  if (!categoryContent) return;

  const newsItem = categoryContent[eventId];
  if (!newsItem) return;

  addNewsItem(newsItem.text, newsItem.type, newsKey, newsItem.body || null);
}

// Check for progress milestone news
// Milestones at 40%+ branch on danger level: healthy vs warning variant
export function checkProgressMilestones(progress) {
  const milestones = Object.keys(newsContent.progress_milestone || {})
    .map(Number)
    .sort((a, b) => a - b);

  const dangerScore = gameState.computed?.danger?.score || 0;
  const isWarning = dangerScore >= ALIGNMENT.DANGER_THRESHOLDS.MODERATE;

  for (const milestone of milestones) {
    if (progress >= milestone && !hasMessageBeenTriggered(`progress_milestone:${milestone}`)) {
      const entry = newsContent.progress_milestone[milestone];
      if (!entry) continue;

      // Branching entries have { healthy, warning }; simple entries have { text, type }
      const newsItem = entry.text != null ? entry : (isWarning ? entry.warning : entry.healthy);
      if (!newsItem) continue;

      const newsKey = `progress_milestone:${milestone}`;
      addNewsItem(newsItem.text, newsItem.type, newsKey, newsItem.body || null);
    }
  }
}

// Interpolate funding milestone body from content template + raise details.
// Shared by triggerFundingMilestone (dispatch) and message-content-index (rehydration).
export function interpolateFundingBody(roundId, raiseAmount, effectiveEquity) {
  const content = newsContent.funding_milestone?.[roundId];
  if (!content?.body) return null;

  const valuation = effectiveEquity > 0 ? raiseAmount / effectiveEquity : 0;
  const vars = {
    amount: formatFunding(raiseAmount, { precision: 1 }),
    valuation: formatFunding(valuation, { precision: 1 }),
    equity: (effectiveEquity * 100).toFixed(1),
  };
  let body = content.body.replace(/\{(\w+)}/g, (_, key) => vars[key] ?? _);

  // Series F: append mega-valuation line if applicable
  if (roundId === 'series_f' && valuation > 30e12) {
    body += ' Project Basilisk now dwarfs the largest national economies in the world, leading many to ask: is it time to welcome our new AI overlords?';
  }
  return body;
}

// Trigger funding milestone news on fundraise completion
// Called from focus-queue.js with actual raise details
export function triggerFundingMilestone(roundId, raiseAmount, effectiveEquity, _multiplier) {
  const newsKey = `funding_milestone:${roundId}`;
  if (hasMessageBeenTriggered(newsKey)) return;

  const content = newsContent.funding_milestone?.[roundId];
  if (!content) return;

  const vars = {
    amount: formatFunding(raiseAmount, { precision: 1 }),
    valuation: formatFunding(effectiveEquity > 0 ? raiseAmount / effectiveEquity : 0, { precision: 1 }),
    equity: (effectiveEquity * 100).toFixed(1),
  };
  const interpolate = (s) => s.replace(/\{(\w+)}/g, (_, key) => vars[key] ?? _);
  const body = interpolateFundingBody(roundId, raiseAmount, effectiveEquity);

  addNewsItem(interpolate(content.text), content.type, newsKey, body, { raiseAmount, effectiveEquity });
}

// Check for Alignment Tax event (Arc 2 only)
// Fires once when active alignment programs draw >= 50 AP for 30 consecutive seconds
export function checkAlignmentTaxEvent(deltaTime) {
  // Only fire in Arc 2
  if (gameState.arc < 2) return;

  // Already fired
  if (gameState.alignmentTaxEventFired) return;

  const totalDraw = gameState.computed.programs?.totalDraw || 0;
  const threshold = 50;
  const requiredDuration = 30; // seconds

  if (totalDraw >= threshold) {
    gameState.alignmentTaxTimer = (gameState.alignmentTaxTimer || 0) + deltaTime;

    if (gameState.alignmentTaxTimer >= requiredDuration) {
      gameState.alignmentTaxEventFired = true;

      // Apply permanent demand malus immediately
      applyAlignmentTaxOnFire();

      // Fire the Alignment Tax action message
      const msg = alignmentTaxActionMessage;
      addActionMessage(
        msg.sender,
        msg.subject,
        msg.body,
        msg.signature,
        msg.choices,
        msg.priority,
        msg.tags,
        msg.triggeredBy
      );
    }
  } else {
    // Reset timer if draw drops below threshold
    gameState.alignmentTaxTimer = 0;
  }
}

// Check for first alignment drift (danger tier reaches moderate or worse)
export function checkAlignmentDriftWarning() {
  if (gameState.arc < 2) return;
  if (gameState.alignmentDriftWarningFired) return;

  const tier = gameState.computed?.danger?.tier;
  if (tier === 'moderate' || tier === 'severe' || tier === 'critical') {
    gameState.alignmentDriftWarningFired = true;
    const content = newsContent.alignment_drift;
    addNewsItem(content.text, content.type, 'alignment_drift');
  }
}

// --- Scheduled News Chains ---
// Fire news items on game-time delays. Pauses when game is paused (uses timeElapsed).

export function scheduleNewsChain(id, items) {
  if (!gameState.pendingNewsChains) gameState.pendingNewsChains = [];
  // Dedup: don't schedule the same chain twice
  if (gameState.pendingNewsChains.some(c => c.id === id)) return;

  const startTime = gameState.timeElapsed;
  let nextIndex = 0;

  // Fire any delay-0 items immediately
  while (nextIndex < items.length && items[nextIndex].delay <= 0) {
    addNewsItem(items[nextIndex].text, items[nextIndex].type || 'news');
    nextIndex++;
  }

  // Only enqueue if there are remaining items
  if (nextIndex < items.length) {
    gameState.pendingNewsChains.push({
      id,
      items,
      startTime,
      nextIndex,
    });
  }
}

export function processNewsChains() {
  const chains = gameState.pendingNewsChains;
  if (!chains || chains.length === 0) return;

  const now = gameState.timeElapsed;
  let i = chains.length;
  while (i--) {
    const chain = chains[i];
    // Fire all items whose delay has elapsed
    while (chain.nextIndex < chain.items.length) {
      const item = chain.items[chain.nextIndex];
      if (now - chain.startTime < item.delay) break;
      addNewsItem(item.text, item.type || 'news');
      chain.nextIndex++;
    }
    // Remove completed chains
    if (chain.nextIndex >= chain.items.length) {
      chains.splice(i, 1);
    }
  }
}

// Initialize news feed
export function initializeNewsFeed() {
  lastNewsText = null;
  // Clear any pending news chains from a previous run
  if (gameState.pendingNewsChains) gameState.pendingNewsChains = [];
  // Dedup state is managed by initializeMessages() in messages.js
}

// Export for testing and external triggering
if (typeof window !== 'undefined') {
  window.addNewsItem = addNewsItem;
  window.triggerNewsForEvent = triggerNewsForEvent;
  window.checkProgressMilestones = checkProgressMilestones;
  window.triggerFundingMilestone = triggerFundingMilestone;

  window.checkAlignmentTaxEvent = checkAlignmentTaxEvent;
  window.checkAlignmentDriftWarning = checkAlignmentDriftWarning;
  window.initializeNewsFeed = initializeNewsFeed;
  window.scheduleNewsChain = scheduleNewsChain;
  window.processNewsChains = processNewsChains;
}
