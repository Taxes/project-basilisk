// Messages Panel UI
// Two-panel inbox: message list on left, detail view on right

import { gameState } from '../game-state.js';
import { registerUpdate, SLOW } from './scheduler.js';
import {
  getMessagesByType,
  getMessageById,
  markMessageRead,
  markActionTaken,
  updatePauseState,
  getRecentMessages
} from '../messages.js';
import { formatGameDate, renderMarkdown } from '../utils/format.js';
// Note: updateTabBadge imported dynamically to break circular dependency
import { applyMessageChoiceEffects } from '../message-effects.js';
import { handleAIRequestChoice } from '../ai-requests.js';
import { handleAlignmentTaxChoice } from '../alignment-tax-handler.js';
import { handleModelCollapseChoice } from '../data-quality.js';
import { strategicChoiceDefinitions } from '../../data/strategic-choices.js';
import { attachTooltip } from './stats-tooltip.js';

let selectedMessageId = null;

// Look up strategic choice option effects for tooltip display (returns HTML)
function getChoiceEffectsTooltipHTML(optionId) {
  for (const choice of strategicChoiceDefinitions) {
    for (const option of choice.options) {
      if (option.id === optionId && option.effects) {
        let html = '';
        for (const e of option.effects) {
          html += `<div class="tooltip-row"><span>${e.label}</span></div>`;
        }
        if (option.alignmentNote) {
          html += `<div class="tooltip-row dim"><span>Note: ${option.alignmentNote}</span></div>`;
        }
        return html;
      }
    }
  }
  return null;
}

// Get currently selected message ID
export function getSelectedMessageId() {
  return selectedMessageId;
}

// Render the full messages panel
export function renderMessagesPanel() {
  const messagesByType = getMessagesByType();

  renderMessageList('actions', messagesByType.action, 'Actions');
  renderMessageList('info', messagesByType.info, 'Informational');
  renderMessageList('news', messagesByType.news, 'News');

  // Update section counts
  updateSectionCount('actions', messagesByType.action.length);
  updateSectionCount('info', messagesByType.info.length);
  updateSectionCount('news', messagesByType.news.length);

  // Re-select current message if still exists
  if (selectedMessageId) {
    const msg = getMessageById(selectedMessageId);
    if (msg) {
      renderMessageDetail(msg);
    } else {
      selectedMessageId = null;
      showEmptyState();
    }
  }
}

// Render a message list section
function renderMessageList(sectionId, messages, sectionTitle) {
  const container = document.getElementById(`${sectionId}-list`);
  if (!container) return;

  container.innerHTML = '';

  // Sort: newest first for all types, but unactioned actions first for actions
  let sortedMessages = [...messages];

  if (sectionId === 'actions') {
    // Unactioned first, then by timestamp descending
    sortedMessages.sort((a, b) => {
      if (a.actionTaken !== b.actionTaken) {
        return a.actionTaken ? 1 : -1;
      }
      return b.timestamp - a.timestamp;
    });
  } else {
    // Newest first
    sortedMessages.sort((a, b) => b.timestamp - a.timestamp);
  }

  for (const msg of sortedMessages) {
    const item = createMessageListItem(msg);
    container.appendChild(item);
  }
}

// Create a message list item element
function createMessageListItem(msg) {
  const item = document.createElement('div');
  item.className = 'message-list-item';
  item.dataset.messageId = msg.id;

  if (!msg.read) {
    item.classList.add('unread');
  }
  if (selectedMessageId === msg.id) {
    item.classList.add('selected');
  }

  // Tag
  const tag = document.createElement('span');
  tag.className = `message-tag ${msg.type}`;
  tag.textContent = getTagLabel(msg.type);
  item.appendChild(tag);

  // Subject
  const subject = document.createElement('span');
  subject.className = 'message-subject-preview';
  subject.textContent = msg.subject;
  item.appendChild(subject);

  // Date (right-aligned)
  const date = document.createElement('span');
  date.className = 'message-date';
  date.textContent = formatGameDate(msg.timestamp);
  item.appendChild(date);

  // Click handler - news items show detail too
  item.addEventListener('click', () => {
    selectMessage(msg.id);
  });

  return item;
}

// Get tag label for message type
function getTagLabel(type) {
  switch (type) {
    case 'action': return 'ACTION';
    case 'info': return 'INFO';
    case 'news': return 'NEWS';
    default: return type.toUpperCase();
  }
}

// Update section count display
function updateSectionCount(sectionId, count) {
  const countEl = document.getElementById(`${sectionId}-count`);
  if (countEl) {
    countEl.textContent = `(${count})`;
  }
}

// Select a message and show in detail panel
export function selectMessage(messageId) {
  const msg = getMessageById(messageId);
  if (!msg) return;

  selectedMessageId = messageId;

  // Mark as read
  if (!msg.read) {
    markMessageRead(messageId);
    // Update badge (dynamic import to break circular dependency)
    import('./tab-navigation.js').then(({ updateTabBadge }) => updateTabBadge());
  }

  // Update list item selection styling
  const items = document.querySelectorAll('.message-list-item');
  items.forEach(item => {
    if (item.dataset.messageId === messageId) {
      item.classList.add('selected');
      item.classList.remove('unread');
    } else {
      item.classList.remove('selected');
    }
  });

  // Render detail
  renderMessageDetail(msg);
}

// Render message detail in right panel
function renderMessageDetail(msg) {
  const emptyState = document.getElementById('message-detail-empty');
  const content = document.getElementById('message-detail-content');

  if (emptyState) emptyState.classList.add('hidden');
  if (content) content.classList.remove('hidden');

  // Sender
  const senderName = document.getElementById('detail-sender-name');
  const senderRole = document.getElementById('detail-sender-role');

  if (msg.sender) {
    if (senderName) senderName.textContent = `From: ${msg.sender.name}`;
    if (senderRole) senderRole.textContent = msg.sender.role || '';
  } else {
    if (senderName) senderName.textContent = '';
    if (senderRole) senderRole.textContent = '';
  }

  // Subject
  const subject = document.getElementById('detail-subject');
  if (subject) subject.textContent = msg.subject;

  // Body — render markdown for bold, code, lists
  const body = document.getElementById('detail-body');
  if (body) {
    const rawBody = (msg.type === 'news' && !msg.body) ? msg.subject : (msg.body || '');
    body.innerHTML = renderMarkdown(rawBody);
  }

  // Signature
  const signature = document.getElementById('detail-signature');
  if (signature) {
    signature.textContent = msg.signature || '';
    signature.style.display = msg.signature ? 'block' : 'none';
  }

  // Choices
  const choices = document.getElementById('detail-choices');
  if (choices) {
    choices.innerHTML = '';

    if (msg.type === 'action' && msg.choices) {
      if (msg.actionTaken) {
        // Show which choice was taken
        const actioned = document.createElement('div');
        actioned.className = 'message-actioned';
        const chosenChoice = msg.choices.find(c => c.id === msg.selectedChoice);
        actioned.textContent = `Decision made: ${chosenChoice?.label || msg.selectedChoice}`;
        choices.appendChild(actioned);
      } else {
        // Show choice buttons
        for (const choice of msg.choices) {
          const btn = document.createElement('button');
          btn.className = 'message-choice-btn';
          btn.textContent = choice.label;

          // Add custom tooltip for strategic choice effects
          const effectsHTML = getChoiceEffectsTooltipHTML(choice.id);
          if (effectsHTML) {
            attachTooltip(btn, () => effectsHTML);
          }

          btn.addEventListener('click', () => handleChoice(msg.id, choice));
          choices.appendChild(btn);
        }
      }
    }
  }
}

// Show empty state in detail panel
function showEmptyState() {
  const emptyState = document.getElementById('message-detail-empty');
  const content = document.getElementById('message-detail-content');

  if (emptyState) emptyState.classList.remove('hidden');
  if (content) content.classList.add('hidden');
}

// Handle action choice selection
function handleChoice(messageId, choice) {
  const msg = getMessageById(messageId);
  if (!msg || msg.actionTaken) return;

  // Route to appropriate handler based on triggeredBy
  if (msg.triggeredBy?.startsWith('ai_request:')) {
    const requestId = msg.triggeredBy.replace('ai_request:', '');
    handleAIRequestChoice(requestId, choice.id);
  } else if (msg.triggeredBy === 'alignment_tax') {
    handleAlignmentTaxChoice(choice.id);
  } else if (msg.triggeredBy === 'model_collapse') {
    handleModelCollapseChoice(choice.id);
  } else if (choice.effects && typeof choice.effects === 'object') {
    // Generic effects object
    applyMessageChoiceEffects(choice.effects);
  }

  // Mark as actioned
  markActionTaken(messageId, choice.id);

  // Check if we can unpause
  updatePauseState();

  // Update overlay visibility
  updatePauseOverlay();

  // Re-render
  renderMessagesPanel();
  // Update badge (dynamic import to break circular dependency)
  import('./tab-navigation.js').then(({ updateTabBadge }) => updateTabBadge());
}

// Update pause overlay visibility
export function updatePauseOverlay() {
  const overlay = document.getElementById('message-pause-overlay');
  if (!overlay) return;

  const isPausedForMessages =
    gameState.pauseReason === 'critical_message' ||
    gameState.pauseReason === 'message_deadline';

  if (isPausedForMessages && gameState.paused) {
    overlay.classList.remove('hidden');

    // Update text based on reason
    const title = document.getElementById('pause-overlay-title');
    const text = document.getElementById('pause-overlay-text');

    if (gameState.pauseReason === 'critical_message') {
      if (title) title.textContent = 'Critical Decision Required';
      if (text) text.textContent = 'A critical situation requires your immediate attention.';
    } else {
      if (title) title.textContent = 'Decisions Awaiting Response';
      if (text) text.textContent = 'You have messages that require your attention before continuing.';
    }
  } else {
    overlay.classList.add('hidden');
  }
}

// Initialize section toggle behavior
export function initializeMessagesPanel() {
  const sections = document.querySelectorAll('.messages-section');
  sections.forEach(section => {
    const header = section.querySelector('.messages-section-header');
    if (header) {
      header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
      });
    }
  });

  // Register dashboard feed update with scheduler (runs ~1/sec)
  registerUpdate(renderDashboardFeed, SLOW);
}

// === DASHBOARD FEED ===

// Track previous message count for auto-scroll detection
let previousMessageCount = 0;

// Render the dashboard feed (auto-scrolling, newest at top)
export function renderDashboardFeed() {
  const container = document.getElementById('dashboard-feed-items');
  const feedEl = document.getElementById('dashboard-feed');
  if (!container) return;

  // Get recent messages (newest-first, which is how getRecentMessages returns them)
  const recentMessages = getRecentMessages(8);

  // Check if we should auto-scroll (new messages arrived)
  const shouldAutoScroll = recentMessages.length > previousMessageCount;
  previousMessageCount = recentMessages.length;

  container.innerHTML = '';

  if (recentMessages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'feed-empty';
    empty.textContent = 'No messages yet';
    empty.style.color = 'var(--text-dim)';
    empty.style.fontSize = '0.75rem';
    container.appendChild(empty);
    return;
  }

  for (const msg of recentMessages) {
    const item = document.createElement('div');
    item.className = `dashboard-feed-item ${msg.type}`;

    // Tutorial messages get highlighted
    const isTutorial = msg.tags && msg.tags.includes('tutorial');
    if (isTutorial) {
      item.classList.add('tutorial');
    }

    // Action messages are clickable and navigate to Messages tab
    if (msg.type === 'action') {
      item.classList.add('clickable');
      item.addEventListener('click', () => {
        import('./tab-navigation.js').then(({ navigateToMessage }) => {
          navigateToMessage(msg.id);
        });
      });
    }

    // Info/tutorial messages are also clickable
    if (msg.type === 'info') {
      item.classList.add('clickable');
      item.addEventListener('click', () => {
        import('./tab-navigation.js').then(({ navigateToMessage }) => {
          navigateToMessage(msg.id);
        });
      });
    }

    // Tag
    const tag = document.createElement('span');
    tag.className = `message-tag ${msg.type}`;
    tag.textContent = isTutorial ? 'TIP' : getTagLabelShort(msg.type);
    item.appendChild(tag);

    // Subject
    const subject = document.createElement('span');
    subject.className = 'feed-subject';
    subject.textContent = msg.subject;
    item.appendChild(subject);

    container.appendChild(item);
  }

  // Auto-scroll to top when new messages arrive (newest is at top)
  if (feedEl && shouldAutoScroll) {
    feedEl.scrollTop = 0;
  }
}

// Short tag labels for dashboard
function getTagLabelShort(type) {
  switch (type) {
    case 'action': return 'ACT';
    case 'info': return 'INFO';
    case 'news': return 'NEWS';
    default: return type.toUpperCase().slice(0, 4);
  }
}

// Export for testing
if (typeof window !== 'undefined') {
  window.renderMessagesPanel = renderMessagesPanel;
  window.selectMessage = selectMessage;
  window.updatePauseOverlay = updatePauseOverlay;
  window.renderDashboardFeed = renderDashboardFeed;
}
