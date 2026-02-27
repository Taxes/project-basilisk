// Messages Panel UI
// Two-panel inbox: message list on left, detail view on right

import { gameState } from '../game-state.js';
import { registerUpdate, SLOW } from './scheduler.js';
import {
  getMessagesBySections,
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
import { handleCreditWarningChoice } from '../economics.js';
import { strategicChoiceDefinitions } from '../../data/strategic-choices.js';
import { attachTooltip, hideTooltip } from './stats-tooltip.js';


let selectedMessageId = null;

// Look up strategic choice option effects for tooltip display (returns HTML)
function getChoiceEffectsTooltipHTML(optionId) {
  for (const choice of strategicChoiceDefinitions) {
    for (const option of choice.options) {
      if (option.id === optionId && option.effects) {
        let html = '';
        for (const e of option.effects) {
          if (e.minPhase && gameState.phase < e.minPhase) continue;
          const cls = e.type === 'positive' ? ' class="positive"' : '';
          html += `<div class="tooltip-row"><span${cls}>${e.label}</span></div>`;
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

// Look up strategic choice option effects as raw array, filtering by current phase
function getChoiceEffects(optionId) {
  for (const choice of strategicChoiceDefinitions) {
    for (const option of choice.options) {
      if (option.id === optionId && option.effects) {
        return option.effects.filter(e => !e.minPhase || gameState.phase >= e.minPhase);
      }
    }
  }
  return [];
}

// Get currently selected message ID
export function getSelectedMessageId() {
  return selectedMessageId;
}

// Render the full messages panel
export function renderMessagesPanel() {
  const sections = getMessagesBySections();

  renderMessageList('new', sections.new);
  renderMessageList('reference', sections.reference);
  renderMessageList('archive', sections.archive);
  renderMessageList('news', sections.news);

  // Update section counts
  updateSectionCount('new', sections.new.length);
  updateSectionCount('reference', sections.reference.length);
  updateSectionCount('archive', sections.archive.length);
  updateSectionCount('news', sections.news.length);

  // Show/hide dismiss button (visible when New has non-action messages)
  const dismissBtn = document.getElementById('dismiss-all-btn');
  if (dismissBtn) {
    const hasDismissible = sections.new.some(m => m.type !== 'action');
    dismissBtn.classList.toggle('hidden', !hasDismissible);
  }

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
function renderMessageList(sectionId, messages) {
  const container = document.getElementById(`${sectionId}-list`);
  if (!container) return;

  const frag = document.createDocumentFragment();
  for (const msg of messages) {
    frag.appendChild(createMessageListItem(msg, sectionId));
  }
  container.replaceChildren(frag);
}

// Create a message list item element
function createMessageListItem(msg, sectionId) {
  const item = document.createElement('div');
  item.className = 'message-list-item';
  item.dataset.messageId = msg.id;

  // Action messages use actionTaken (not read) for unread styling
  if (msg.type === 'action') {
    if (!msg.actionTaken) item.classList.add('unread');
  } else if (!msg.read) {
    item.classList.add('unread');
  }

  if (selectedMessageId === msg.id) {
    item.classList.add('selected');
  }

  // Tag — archive uses context-specific labels
  const tag = document.createElement('span');
  if (sectionId === 'archive') {
    if (msg.type === 'action') {
      tag.className = 'message-tag decision';
      tag.textContent = 'DECISION';
    } else {
      tag.className = 'message-tag note';
      tag.textContent = 'NOTE';
    }
  } else {
    tag.className = `message-tag ${msg.type}`;
    tag.textContent = getTagLabel(msg.type);
  }
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

// Prepend a single new message to the panel without full re-render.
// Avoids flash and scroll-position reset that innerHTML='' causes.
export function prependNewMessage(msg) {
  // Route to correct section
  const sectionId = msg.type === 'news' ? 'news' : 'new';
  const container = document.getElementById(`${sectionId}-list`);
  if (!container) return;

  const item = createMessageListItem(msg, sectionId);
  container.prepend(item);

  // Update count
  const countEl = document.getElementById(`${sectionId}-count`);
  if (countEl) {
    const current = container.children.length;
    countEl.textContent = `(${current})`;
  }

  // Show dismiss button if this is a non-action message in "new"
  if (sectionId === 'new' && msg.type !== 'action') {
    const dismissBtn = document.getElementById('dismiss-all-btn');
    if (dismissBtn) dismissBtn.classList.remove('hidden');
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

  // Mark as read — but NOT action messages (they stay "unread" until actioned)
  if (!msg.read && msg.type !== 'action') {
    markMessageRead(messageId);
    import('./tab-navigation.js').then(({ updateTabBadge }) => updateTabBadge());
  }

  // Update list item selection styling
  const items = document.querySelectorAll('.message-list-item');
  items.forEach(item => {
    if (item.dataset.messageId === messageId) {
      item.classList.add('selected');
      // Only remove unread class for non-action messages
      if (msg.type !== 'action') {
        item.classList.remove('unread');
      }
      // Expand collapsed section and scroll into view
      const section = item.closest('.messages-section');
      if (section && section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
      }
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('selected');
    }
  });

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
    // Faux-link: style inline anchors with # hrefs as hoverable, non-navigating links
    for (const a of body.querySelectorAll('a[href="#ken-email"]')) {
      a.removeAttribute('href');
      a.classList.add('faux-link');
      attachTooltip(a, () => 'ken@projectbasilisk.com');
    }
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
        // Show which choice was taken, with consequences
        const actioned = document.createElement('div');
        actioned.className = 'message-actioned';
        const chosenChoice = msg.choices.find(c => c.id === msg.selectedChoice);
        const label = document.createElement('div');
        label.className = 'message-actioned-label';
        label.textContent = `Decision made: ${chosenChoice?.label || msg.selectedChoice}`;
        actioned.appendChild(label);

        // Look up effects from strategic choice definitions
        const effects = getChoiceEffects(msg.selectedChoice);
        if (effects.length > 0) {
          const list = document.createElement('ul');
          list.className = 'message-actioned-effects';
          for (const e of effects) {
            const li = document.createElement('li');
            li.textContent = e.label;
            if (e.type === 'positive') li.classList.add('positive');
            list.appendChild(li);
          }
          actioned.appendChild(list);
        }

        choices.appendChild(actioned);
      } else {
        // Show choice buttons
        for (const choice of msg.choices) {
          const btn = document.createElement('button');
          btn.className = 'message-choice-btn';
          btn.textContent = choice.label;

          // Add tooltip: strategic choice effects lookup, then inline tooltip
          const effectsHTML = getChoiceEffectsTooltipHTML(choice.id);
          const tooltipHTML = effectsHTML || choice.tooltip;
          if (tooltipHTML) {
            attachTooltip(btn, () => tooltipHTML);
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
  hideTooltip();
  const msg = getMessageById(messageId);
  if (!msg || msg.actionTaken) return;

  // Route to appropriate handler based on triggeredBy (startsWith for debug compat)
  const trigger = msg.triggeredBy || '';
  if (trigger.startsWith('ai_request:')) {
    const requestId = trigger.replace('ai_request:', '').replace(/_debug_\d+$/, '');
    handleAIRequestChoice(requestId, choice.id);
  } else if (trigger.startsWith('credit_warning')) {
    handleCreditWarningChoice(choice.id);
  } else if (trigger.startsWith('alignment_tax')) {
    handleAlignmentTaxChoice(choice.id);
  } else if (trigger.startsWith('model_collapse')) {
    handleModelCollapseChoice(choice.id);
  } else if (choice.effects && typeof choice.effects === 'object') {
    // Generic effects object
    applyMessageChoiceEffects(choice.effects);
  }

  // Mark as actioned
  markActionTaken(messageId, choice.id);
  markMessageRead(messageId);

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

  // Dismiss all button (marks non-action messages in New as read)
  const dismissBtn = document.getElementById('dismiss-all-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Don't toggle section collapse
      const sections = getMessagesBySections();
      for (const msg of sections.new) {
        if (msg.type !== 'action') {
          markMessageRead(msg.id);
        }
      }
      renderMessagesPanel();
      import('./tab-navigation.js').then(({ updateTabBadge }) => updateTabBadge());
    });
  }

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

  const frag = document.createDocumentFragment();

  if (recentMessages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'feed-empty';
    empty.textContent = 'No messages yet';
    empty.style.color = 'var(--text-dim)';
    empty.style.fontSize = '0.75rem';
    frag.appendChild(empty);
    container.replaceChildren(frag);
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

    // Unread state: actions use actionTaken, info uses read, news never unread
    if (msg.type === 'action' && !msg.actionTaken) {
      item.classList.add('unread');
    } else if (msg.type === 'info' && !msg.read) {
      item.classList.add('unread');
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

    frag.appendChild(item);
  }

  container.replaceChildren(frag);

  // Auto-scroll to top when new messages arrive (newest is at top)
  if (feedEl && shouldAutoScroll) {
    feedEl.scrollTop = 0;
  }
}

// Short tag labels for dashboard
function getTagLabelShort(type) {
  switch (type) {
    case 'action': return 'ACTION';
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
