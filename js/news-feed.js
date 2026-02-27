// Player-facing text: see docs/message-registry.json
// News Feed System - Event-driven narrative delivery
// News items are triggered by game events, not random selection
//
// NOTE: This is transitioning to the new message system.
// New messages go to both the old feed (for now) and the new message system.

import { newsContent } from './content/news-content.js';
import { alignmentTaxActionMessage } from './content/message-content.js';
import { gameState } from './game-state.js';
import { ALIGNMENT, BALANCE } from '../data/balance.js';
import { addNewsMessage, addActionMessage } from './messages.js';
import { getAlignmentRatio } from './resources.js';
import { formatFunding } from './utils/format.js';

const MAX_NEWS_ITEMS = 20;
let newsFeed = [];

// Track progress milestones that have fired
let firedProgressMilestones = new Set();

// Track alignment thresholds that have fired
let firedAlignmentThresholds = new Set();

// Track alignment debt tiers that have fired (Arc 2)
let firedAlignmentDebtTiers = new Set();

// Track which news keys have been triggered (to prevent duplicates)
let triggeredNews = new Set();

// Add a news item to the feed
export function addNewsItem(text, type = 'flavor', triggeredBy = null, body = null) {
  // Dedup: skip if most recent item has identical text
  if (newsFeed.length > 0 && newsFeed[newsFeed.length - 1].text === String(text)) {
    return;
  }

  const item = {
    text: String(text),
    type,  // 'flavor', 'warning', 'competitor', 'internal'
    timestamp: gameState.timeElapsed,
  };

  newsFeed.push(item);

  // Keep max items (remove oldest from front)
  if (newsFeed.length > MAX_NEWS_ITEMS) {
    newsFeed = newsFeed.slice(-MAX_NEWS_ITEMS);
  }

  // Also add to new message system as a news message
  addNewsMessage(String(text), [type], triggeredBy, body);

  // Trigger UI update
  renderNewsFeed();
}

// Clear all news
export function clearNewsFeed() {
  newsFeed = [];
  renderNewsFeed();
}

// Get current feed items
export function getNewsFeedItems() {
  return [...newsFeed];
}

// Trigger news for a specific event
export function triggerNewsForEvent(eventType, eventId) {
  const newsKey = `${eventType}:${eventId}`;

  // Don't repeat the same news
  if (triggeredNews.has(newsKey)) {
    return;
  }

  const categoryContent = newsContent[eventType];
  if (!categoryContent) {
    return;
  }

  const newsItem = categoryContent[eventId];
  if (!newsItem) {
    return;
  }

  triggeredNews.add(newsKey);
  addNewsItem(newsItem.text, newsItem.type, newsKey, newsItem.body || null);
}

// Check for progress milestone news
export function checkProgressMilestones(progress) {
  const milestones = Object.keys(newsContent.progress_milestone || {})
    .map(Number)
    .sort((a, b) => a - b);

  for (const milestone of milestones) {
    if (progress >= milestone && !firedProgressMilestones.has(milestone)) {
      firedProgressMilestones.add(milestone);
      triggerNewsForEvent('progress_milestone', milestone);
    }
  }
}

// Trigger funding milestone news on fundraise completion
// Called from focus-queue.js with actual raise details
export function triggerFundingMilestone(roundId, raiseAmount, effectiveEquity, multiplier) {
  const newsKey = `funding_milestone:${roundId}`;
  if (triggeredNews.has(newsKey)) return;

  const content = newsContent.funding_milestone?.[roundId];
  if (!content) return;

  const equityPct = (effectiveEquity * 100).toFixed(1);
  triggeredNews.add(newsKey);
  addNewsItem(
    content.text,
    content.type,
    newsKey,
    `${formatFunding(raiseAmount, { precision: 1 })} raised for ${equityPct}% equity at ${multiplier.toFixed(0)}x valuation.`,
  );
}

// Check for ambient alignment news triggers
export function checkAlignmentNews() {
  // Only fire in Arc 1
  if (gameState.arc !== 1) return;

  const ha = gameState.hiddenAlignment || 0;

  const thresholds = [
    { key: 'mild', threshold: ALIGNMENT.AMBIENT_THRESHOLD_MILD },
    { key: 'moderate', threshold: ALIGNMENT.AMBIENT_THRESHOLD_MODERATE },
    { key: 'severe', threshold: ALIGNMENT.AMBIENT_THRESHOLD_SEVERE },
  ];

  for (const { key, threshold } of thresholds) {
    if (ha <= threshold && !firedAlignmentThresholds.has(key)) {
      firedAlignmentThresholds.add(key);
      triggerNewsForEvent('alignment_ambient', key);
    }
  }
}

// Check for alignment debt news triggers (Arc 2 only)
// Fires when capability RP significantly outpaces alignment RP
export function checkAlignmentDebt() {
  // Only fire in Arc 2
  if (gameState.arc < 2) return;

  const ratio = getAlignmentRatio();
  const thresholds = BALANCE.ALIGNMENT_RATIO_THRESHOLDS;

  // Tier thresholds: mild at 2:1 (MODERATE), moderate at 4:1 (SEVERE), severe at 6:1 (CRITICAL)
  const tiers = [
    { key: 'mild', ratioThreshold: thresholds.MODERATE },
    { key: 'moderate', ratioThreshold: thresholds.SEVERE },
    { key: 'severe', ratioThreshold: thresholds.CRITICAL },
  ];

  for (const { key, ratioThreshold } of tiers) {
    if (ratio >= ratioThreshold && !firedAlignmentDebtTiers.has(key)) {
      firedAlignmentDebtTiers.add(key);
      triggerNewsForEvent('alignment_debt', key);

      // Update game state tier for UI/debugging
      const tierNum = key === 'mild' ? 1 : key === 'moderate' ? 2 : 3;
      gameState.alignmentDebtTier = Math.max(gameState.alignmentDebtTier || 0, tierNum);
    }
  }
}

// Check for Alignment Tax event (Arc 2 only)
// Fires once when alignment allocation > 30% for 60 consecutive seconds
// Presents choice: revert safety constraints (+20% revenue 120s, -500 alignment RP) vs hold firm (-10% revenue 120s)
export function checkAlignmentTaxEvent(deltaTime) {
  // Only fire in Arc 2
  if (gameState.arc < 2) return;

  // Already fired
  if (gameState.alignmentTaxEventFired) return;

  const alignmentAlloc = gameState.tracks?.alignment?.researcherAllocation || 0;
  const threshold = 0.30;
  const requiredDuration = 60; // seconds

  if (alignmentAlloc > threshold) {
    gameState.alignmentTaxTimer = (gameState.alignmentTaxTimer || 0) + deltaTime;

    if (gameState.alignmentTaxTimer >= requiredDuration) {
      gameState.alignmentTaxEventFired = true;

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
    // Reset timer if allocation drops below threshold
    gameState.alignmentTaxTimer = 0;
  }
}

// Legacy function - now a no-op since news is event-driven
export function updateNewsFeed() {
  // No longer does periodic random news
  // All news is now event-triggered
}

// Render news feed to DOM
export function renderNewsFeed() {
  const container = document.getElementById('news-feed-list');
  if (!container) return;

  container.innerHTML = '';

  // Render oldest to newest (newest at bottom like a terminal)
  for (const item of newsFeed) {
    const el = document.createElement('div');
    el.className = `news-item news-${item.type}`;
    el.textContent = item.text;
    container.appendChild(el);
  }

  // Auto-scroll to bottom to show newest items
  const feedEl = document.getElementById('news-feed');
  if (feedEl) {
    feedEl.scrollTop = feedEl.scrollHeight;
  }
}

// Initialize news feed
export function initializeNewsFeed() {
  newsFeed = [];
  triggeredNews = new Set();
  firedProgressMilestones = new Set();
  firedAlignmentThresholds = new Set();
  firedAlignmentDebtTiers = new Set();

  // Rebuild triggered state from saved messages so page refreshes
  // don't re-fire news items
  if (gameState.messages) {
    for (const msg of gameState.messages) {
      if (!msg.triggeredBy) continue;
      triggeredNews.add(msg.triggeredBy);
      // Restore milestone sets from news keys (e.g. "progress_milestone:10")
      const [category, id] = msg.triggeredBy.split(':');
      if (category === 'progress_milestone') firedProgressMilestones.add(Number(id));
      else if (category === 'alignment_ambient') firedAlignmentThresholds.add(id);
      else if (category === 'alignment_debt') firedAlignmentDebtTiers.add(id);
    }
  }

}

// Export for testing and external triggering
if (typeof window !== 'undefined') {
  window.addNewsItem = addNewsItem;
  window.clearNewsFeed = clearNewsFeed;
  window.getNewsFeedItems = getNewsFeedItems;
  window.triggerNewsForEvent = triggerNewsForEvent;
  window.checkProgressMilestones = checkProgressMilestones;
  window.triggerFundingMilestone = triggerFundingMilestone;
  window.checkAlignmentNews = checkAlignmentNews;
  window.checkAlignmentDebt = checkAlignmentDebt;
  window.checkAlignmentTaxEvent = checkAlignmentTaxEvent;
  window.initializeNewsFeed = initializeNewsFeed;
}
