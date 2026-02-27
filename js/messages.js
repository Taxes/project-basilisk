// Message System - Unified narrative delivery
// Replaces news-feed.js and event modals with email-like inbox

import { gameState } from './game-state.js';

// Message ID counter (restored from saved messages on load)
let messageIdCounter = 0;

// Callback for UI updates when new messages arrive
let onNewMessageCallback = null;

// Generate unique message ID
function generateMessageId() {
  messageIdCounter++;
  return `msg_${messageIdCounter}`;
}

// Restore ID counter from existing messages (call after load)
export function restoreMessageIdCounter() {
  if (!gameState.messages || gameState.messages.length === 0) {
    messageIdCounter = 0;
    return;
  }
  // Find highest existing ID number
  let maxId = 0;
  for (const msg of gameState.messages) {
    if (msg.id && msg.id.startsWith('msg_')) {
      const num = parseInt(msg.id.slice(4), 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
  }
  messageIdCounter = maxId;
}

// Initialize messages array if not present
export function initializeMessages() {
  if (!gameState.messages) {
    gameState.messages = [];
  }
  restoreMessageIdCounter();
  // Rebuild triggered keys from saved messages so page refreshes
  // don't re-fire tutorials with wrong timestamps
  triggeredMessageKeys.clear();
  for (const msg of gameState.messages) {
    if (msg.triggeredBy) {
      triggeredMessageKeys.add(msg.triggeredBy);
    }
  }
}

// Set callback for new message notifications
export function setOnNewMessageCallback(callback) {
  onNewMessageCallback = callback;
}

// Prune old messages when over limit
// Preserves unactioned action messages
const MAX_MESSAGES = 150;

function pruneOldMessages() {
  while (gameState.messages.length > MAX_MESSAGES) {
    // Find first message that's either:
    // - Not an action type, OR
    // - An action that's already been acted upon
    const pruneIndex = gameState.messages.findIndex(m =>
      m.type !== 'action' || m.actionTaken
    );

    if (pruneIndex === -1) {
      // All messages are unactioned actions - can't prune
      break;
    }
    gameState.messages.splice(pruneIndex, 1);
  }
}

/**
 * Add a message to the inbox
 * @param {Object} options Message options
 * @param {string} options.type - 'action' | 'info' | 'news'
 * @param {Object|null} options.sender - Sender object { id, name, role, type }
 * @param {string} options.subject - Message subject (for news, this IS the content)
 * @param {string|null} options.body - Full message body
 * @param {string|null} options.signature - Sign-off text
 * @param {Array|null} options.choices - For action type: [{ id, label, effects }]
 * @param {string|null} options.priority - 'critical' | 'normal' | null
 * @param {string[]} options.tags - Metadata tags
 * @param {string|null} options.triggeredBy - What caused this message
 * @returns {Object} The created message
 */
export function addMessage({
  type,
  sender = null,
  subject,
  body = null,
  signature = null,
  choices = null,
  priority = null,
  tags = [],
  triggeredBy = null,
  contentParams = null,
}) {
  // Calculate deadline for normal actions
  let deadline = null;
  if (type === 'action' && priority === 'normal') {
    deadline = gameState.timeElapsed + 30000; // 30 seconds grace period
  }

  const message = {
    id: generateMessageId(),
    timestamp: gameState.timeElapsed, // Game time, not wall time
    type,
    sender,
    subject,
    body,
    signature,
    read: false,
    actionTaken: false,
    choices,
    priority,
    deadline,
    tags,
    triggeredBy,
    contentParams,
  };

  gameState.messages.push(message);
  pruneOldMessages();

  // Notify UI
  if (onNewMessageCallback) {
    onNewMessageCallback(message);
  }

  // Critical messages pause immediately
  if (type === 'action' && priority === 'critical') {
    gameState.paused = true;
    gameState.pauseReason = 'critical_message';
    gameState.pauseMessageId = message.id;
  }

  return message;
}

/**
 * Add a news message (headline in feed, optional body for detail view)
 */
export function addNewsMessage(subject, tags = [], triggeredBy = null, body = null) {
  const msg = {
    type: 'news',
    subject,
    tags,
    triggeredBy,
  };
  if (body) msg.body = body;
  return addMessage(msg);
}

/**
 * Add an informational message (readable content, no action required)
 */
export function addInfoMessage(sender, subject, body, signature = null, tags = [], triggeredBy = null, contentParams = null) {
  return addMessage({
    type: 'info',
    sender,
    subject,
    body,
    signature,
    tags,
    triggeredBy,
    contentParams,
  });
}

/**
 * Add an action message (requires player choice)
 */
export function addActionMessage(sender, subject, body, signature, choices, priority = 'normal', tags = [], triggeredBy = null, contentParams = null) {
  return addMessage({
    type: 'action',
    sender,
    subject,
    body,
    signature,
    choices,
    priority,
    tags,
    triggeredBy,
    contentParams,
  });
}

// Get message by ID
export function getMessageById(id) {
  return gameState.messages?.find(m => m.id === id) || null;
}

// Mark message as read
export function markMessageRead(id) {
  const msg = getMessageById(id);
  if (msg && !msg.read) {
    msg.read = true;
  }
}

// Mark action as taken (after choice selected)
export function markActionTaken(id, choiceId) {
  const msg = getMessageById(id);
  if (msg && msg.type === 'action' && !msg.actionTaken) {
    msg.actionTaken = true;
    msg.selectedChoice = choiceId;
  }
}

// Get count of unread messages (excluding news - news doesn't badge)
export function getUnreadCount() {
  if (!gameState.messages) return 0;
  return gameState.messages.filter(m => {
    if (m.type === 'news') return false;
    if (m.type === 'action') return !m.actionTaken;
    return !m.read;
  }).length;
}

// Get count of pending actions (unactioned action messages)
export function getActionCount() {
  return gameState.messages?.filter(m => m.type === 'action' && !m.actionTaken).length || 0;
}

// Get messages grouped by type for UI rendering
export function getMessagesByType() {
  const messages = gameState.messages || [];
  return {
    action: messages.filter(m => m.type === 'action'),
    info: messages.filter(m => m.type === 'info'),
    news: messages.filter(m => m.type === 'news'),
  };
}

// Get messages grouped into 4 sections for inbox UI
// New: unactioned actions + unread info (never news)
// Reference: read tutorial-tagged info
// Archive: actioned decisions + read non-tutorial info
// News: all news messages (always here, never in New)
export function getMessagesBySections() {
  const messages = gameState.messages || [];
  const sections = { new: [], reference: [], archive: [], news: [] };

  for (const msg of messages) {
    if (msg.type === 'news') {
      sections.news.push(msg);
    } else if (msg.type === 'action' && !msg.actionTaken) {
      sections.new.push(msg);
    } else if (msg.type === 'action' && msg.actionTaken) {
      sections.archive.push(msg);
    } else if (msg.type === 'info' && !msg.read) {
      sections.new.push(msg);
    } else if (msg.type === 'info' && msg.tags?.includes('tutorial')) {
      sections.reference.push(msg);
    } else if (msg.type === 'info') {
      sections.archive.push(msg);
    }
  }

  // Helper: extract numeric ID for stable tiebreaking (msg_1 → 1)
  const idNum = (msg) => parseInt(msg.id.slice(4), 10) || 0;

  // New: actions first, then by timestamp descending (ID tiebreak)
  sections.new.sort((a, b) => {
    if (a.type === 'action' && b.type !== 'action') return -1;
    if (a.type !== 'action' && b.type === 'action') return 1;
    return (b.timestamp - a.timestamp) || (idNum(b) - idNum(a));
  });

  // Reference: newest first
  sections.reference.sort((a, b) => (b.timestamp - a.timestamp) || (idNum(b) - idNum(a)));

  // Archive: newest first
  sections.archive.sort((a, b) => (b.timestamp - a.timestamp) || (idNum(b) - idNum(a)));

  // News: newest first
  sections.news.sort((a, b) => (b.timestamp - a.timestamp) || (idNum(b) - idNum(a)));

  return sections;
}

// Get recent messages for dashboard widget (newest first)
export function getRecentMessages(count = 5) {
  const messages = gameState.messages || [];
  return messages.slice(-count).reverse();
}

// Check message deadlines and pause if any are overdue
// Called once per second from game loop
export function checkMessageDeadlines() {
  if (!gameState.messages) return;

  const now = gameState.timeElapsed;
  const overdue = gameState.messages.filter(m =>
    m.type === 'action' &&
    !m.actionTaken &&
    m.deadline &&
    now >= m.deadline
  );

  if (overdue.length > 0 && !gameState.paused) {
    gameState.paused = true;
    gameState.pauseReason = 'message_deadline';
    gameState.pauseMessageIds = overdue.map(m => m.id);
  }
}

// Check if game can unpause (all critical/overdue actions resolved)
export function canUnpause() {
  if (!gameState.messages) return true;

  // Check for unresolved critical messages
  const unresolvedCritical = gameState.messages.some(m =>
    m.type === 'action' &&
    m.priority === 'critical' &&
    !m.actionTaken
  );
  if (unresolvedCritical) return false;

  // Check for overdue normal actions
  const now = gameState.timeElapsed;
  const overdueNormal = gameState.messages.some(m =>
    m.type === 'action' &&
    !m.actionTaken &&
    m.deadline &&
    now >= m.deadline
  );
  if (overdueNormal) return false;

  return true;
}

// Clear pause state if all blocking messages resolved
export function updatePauseState() {
  if (gameState.pauseReason === 'critical_message' || gameState.pauseReason === 'message_deadline') {
    if (canUnpause()) {
      gameState.paused = false;
      gameState.pauseReason = null;
      gameState.pauseMessageId = null;
      gameState.pauseMessageIds = null;
    }
  }
}

// Clear all messages (for reset)
export function clearMessages() {
  gameState.messages = [];
  messageIdCounter = 0;
}

// Track triggered message keys to prevent duplicates (like triggeredNews in old system)
const triggeredMessageKeys = new Set();

// Check if a message key has been triggered
export function hasMessageBeenTriggered(key) {
  return triggeredMessageKeys.has(key);
}

// Mark a message key as triggered
export function markMessageTriggered(key) {
  triggeredMessageKeys.add(key);
}

// Reset triggered message tracking (for new game)
export function resetTriggeredMessages() {
  triggeredMessageKeys.clear();
}

// Export for testing and external use
if (typeof window !== 'undefined') {
  window.addMessage = addMessage;
  window.addNewsMessage = addNewsMessage;
  window.addInfoMessage = addInfoMessage;
  window.addActionMessage = addActionMessage;
  window.getMessageById = getMessageById;
  window.getUnreadCount = getUnreadCount;
  window.getActionCount = getActionCount;
  window.getMessagesByType = getMessagesByType;
  window.getMessagesBySections = getMessagesBySections;
  window.getRecentMessages = getRecentMessages;
  window.markMessageRead = markMessageRead;
  window.markActionTaken = markActionTaken;
  window.clearMessages = clearMessages;
}
