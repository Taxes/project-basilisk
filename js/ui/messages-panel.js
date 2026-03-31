// Messages Panel UI
// Two-panel inbox: message list on left, detail view on right

import { gameState } from '../game-state.js';
import { registerUpdate, FAST, SLOW } from './scheduler.js';
import {
  getMessagesBySections,
  getMessageById,
  markMessageRead,
  markActionTaken,
  updatePauseState,
  getRecentMessages
} from '../messages.js';
import { formatGameDate, renderMarkdown, formatDuration } from '../utils/format.js';
// Note: updateTabBadge imported dynamically to break circular dependency
import { applyMessageChoiceEffects } from '../message-effects.js';
import { handleAIRequestChoice } from '../ai-requests.js';
import { handleAlignmentTaxChoice } from '../alignment-tax-handler.js';
import { handleModelCollapseChoice } from '../data-quality.js';
import { handleCreditWarningChoice } from '../economics.js';
import { applyFlavorEventChoice } from '../flavor-events.js';
import { strategicChoiceDefinitions } from '../../data/strategic-choices.js';
import { attachTooltip, hideTooltip } from './stats-tooltip.js';
import { buildEffectDescription } from '../consequence-events.js';


let selectedMessageId = null;

// Track which blocking message has already had a toast shown (prevents re-fire every second)
let _shownBlockingToastId = null;

// Build tooltip HTML from a choice's tooltipRows array (universal format)
function buildChoiceTooltipHTML(choice) {
  if (choice.tooltipRows?.length) {
    const rows = choice.tooltipRows.map(r => {
      const cls = r.type && r.type !== 'neutral' ? ` class="${r.type}"` : '';
      return `<div class="tooltip-row"><span${cls}>${r.label}</span></div>`;
    }).join('');
    return `<div class="tooltip-section">${rows}</div>`;
  }
  // Legacy fallback for old saves without tooltipRows
  return choice.tooltip || null;
}

// Look up strategic choice option effects as raw array, filtering by current phase
function getChoiceEffects(optionId) {
  for (const choice of strategicChoiceDefinitions) {
    for (const option of choice.options) {
      if (option.id === optionId && option.effects) {
        return option.effects.filter(e =>
          (!e.minPhase || gameState.phase >= e.minPhase) &&
          (!e.minArc || gameState.arc >= e.minArc));
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
  renderMessageList('incidents', sections.incidents);
  renderMessageList('news', sections.news);

  // Update section counts
  updateSectionCount('new', sections.new.length);
  updateSectionCount('reference', sections.reference.length);
  updateSectionCount('archive', sections.archive.length);
  updateSectionCount('incidents', sections.incidents.length);
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

  // Tag — consistent labels across all views
  const tag = document.createElement('span');
  const isTutorial = msg.tags && msg.tags.includes('tutorial');
  const isConsequence = msg.tags && msg.tags.includes('consequence');
  if (sectionId === 'archive' && msg.type === 'action') {
    tag.className = 'message-tag decision';
    tag.textContent = 'DECISION';
  } else if (isTutorial) {
    tag.className = 'message-tag ref';
    tag.textContent = 'REF';
  } else if (isConsequence) {
    const isTier4 = msg.tags.includes('tier_4');
    const isTier3 = msg.tags.includes('tier_3');
    if (isTier4) {
      tag.className = 'message-tag incident-critical';
      tag.textContent = 'CRITICAL';
    } else if (isTier3) {
      tag.className = 'message-tag incident';
      tag.textContent = 'SEVERE';
    } else {
      tag.className = 'message-tag incident';
      tag.textContent = 'INCIDENT';
    }
  } else if (msg.type === 'info') {
    tag.className = 'message-tag note';
    tag.textContent = 'NOTE';
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

  // Countdown badge for timed action messages
  if (msg.type === 'action' && !msg.actionTaken && msg.deadline != null) {
    const countdown = document.createElement('span');
    countdown.className = 'message-countdown';
    countdown.dataset.deadline = msg.deadline;
    updateCountdownEl(countdown, msg.deadline);
    item.appendChild(countdown);
  } else {
    // Date (right-aligned)
    const date = document.createElement('span');
    date.className = 'message-date';
    date.textContent = formatGameDate(msg.timestamp);
    item.appendChild(date);
  }

  item.addEventListener('click', () => {
    selectMessage(msg.id);
  });

  return item;
}

// Update a single countdown element text and urgency class
function updateCountdownEl(el, deadline) {
  const remaining = Math.ceil(deadline - Math.floor(gameState.timeElapsed));
  if (remaining <= 0) {
    el.textContent = 'OVERDUE';
    el.className = 'message-countdown overdue';
  } else {
    el.textContent = `⏱ ${formatDuration(remaining)}`;
    el.className = `message-countdown${remaining <= 15 ? ' urgent' : remaining <= 60 ? ' warning' : ''}`;
  }
}

// Lightweight per-second refresh of all visible countdown badges
function refreshCountdowns() {
  const els = document.querySelectorAll('.message-countdown[data-deadline]');
  for (const el of els) {
    updateCountdownEl(el, parseFloat(el.dataset.deadline));
  }
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

  // Consequence event effect description (reconstructed from tags)
  const effectContainer = document.getElementById('detail-effect');
  if (effectContainer) {
    effectContainer.innerHTML = '';
    const isConsequence = msg.tags && msg.tags.includes('consequence');
    if (isConsequence) {
      const subfactorTag = msg.tags.find(t => t.startsWith('subfactor_'));
      const tierTag = msg.tags.find(t => t.startsWith('tier_'));
      if (subfactorTag && tierTag) {
        const subfactor = subfactorTag.replace('subfactor_', '');
        const tier = parseInt(tierTag.replace('tier_', ''), 10);
        const effectDesc = buildEffectDescription(subfactor, tier);
        if (effectDesc) {
          const list = document.createElement('ul');
          list.className = 'message-actioned-effects';
          const li = document.createElement('li');
          li.className = 'negative';
          li.textContent = effectDesc;
          list.appendChild(li);
          effectContainer.appendChild(list);
        }
      }
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

        // Show effects: strategic choices use phase-gated definitions,
        // everything else uses tooltipRows stored on the choice object
        let rows = getChoiceEffects(msg.selectedChoice);
        if (!rows.length && chosenChoice?.tooltipRows?.length) {
          rows = chosenChoice.tooltipRows;
        }
        if (rows.length > 0) {
          const list = document.createElement('ul');
          list.className = 'message-actioned-effects';
          for (const r of rows) {
            const li = document.createElement('li');
            li.textContent = r.label;
            if (r.type && r.type !== 'neutral') li.classList.add(r.type);
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

          // Add tooltip from tooltipRows (universal format) or legacy fallback
          const tooltipHTML = buildChoiceTooltipHTML(choice);
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
  } else if (trigger.startsWith('flavor_event:')) {
    const eventId = trigger.replace('flavor_event:', '');
    applyFlavorEventChoice(eventId, choice.id);
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

  const blockingId = gameState.pauseMessageId || gameState.pauseMessageIds?.[0];
  const blockingMsg = blockingId ? getMessageById(blockingId) : null;

  const isPaused = gameState.paused &&
    (gameState.pauseReason === 'critical_message' || gameState.pauseReason === 'message_deadline');

  if (isPaused) {
    // Both critical and deadline messages: persistent toast, no blocking overlay
    overlay.classList.add('hidden');
    if (blockingId && blockingId !== _shownBlockingToastId) {
      _shownBlockingToastId = blockingId;
      import('../ui.js').then(({ showDecisionToast }) => {
        showDecisionToast(
          blockingMsg ? blockingMsg.subject : 'A message requires your attention.',
          () => import('./tab-navigation.js').then(({ navigateToMessage, switchTab }) => {
            if (blockingMsg) navigateToMessage(blockingMsg.id);
            else switchTab('messages');
          })
        );
      });
    }
  } else {
    overlay.classList.add('hidden');
    _shownBlockingToastId = null;
    import('../ui.js').then(({ dismissDecisionToast }) => dismissDecisionToast());
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

  // Register countdown badge refresh (runs ~4/sec to avoid aliasing with SLOW scheduler)
  registerUpdate(refreshCountdowns, FAST);
}

// === DASHBOARD FEED ===

// Track previous feed content for change detection
let previousFeedKey = '';

// Render the dashboard feed (auto-scrolling, newest at top)
export function renderDashboardFeed() {
  const container = document.getElementById('dashboard-feed-items');
  const feedEl = document.getElementById('dashboard-feed');
  if (!container) return;

  // Get recent messages (newest-first, which is how getRecentMessages returns them)
  const recentMessages = getRecentMessages(8);

  // Build a key from message IDs + read/action state to detect changes
  const feedKey = recentMessages.map(m =>
    `${m.id}:${m.read}:${m.actionTaken}`
  ).join(',');

  if (feedKey === previousFeedKey) return;

  const shouldAutoScroll = recentMessages.length > previousFeedKey.split(',').filter(Boolean).length;
  previousFeedKey = feedKey;

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

    // Extinction news gets urgent styling
    const isExtinction = msg.tags && msg.tags.includes('extinction');
    if (isExtinction) {
      item.classList.add('extinction');
    }

    // Unread state: actions use actionTaken, info/tutorial use read, news never unread
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

    // Tag — consistent with messages pane
    const tag = document.createElement('span');
    const isConsequence = msg.tags && msg.tags.includes('consequence');
    if (isTutorial) {
      tag.className = 'message-tag ref';
      tag.textContent = 'REF';
    } else if (isConsequence) {
      const isTier4 = msg.tags.includes('tier_4');
      const isTier3 = msg.tags.includes('tier_3');
      if (isTier4) {
        tag.className = 'message-tag incident-critical';
        tag.textContent = 'CRITICAL';
      } else if (isTier3) {
        tag.className = 'message-tag incident';
        tag.textContent = 'SEVERE';
      } else {
        tag.className = 'message-tag incident';
        tag.textContent = 'INCIDENT';
      }
    } else if (msg.type === 'info') {
      tag.className = 'message-tag note';
      tag.textContent = 'NOTE';
    } else {
      tag.className = `message-tag ${msg.type}`;
      tag.textContent = getTagLabelShort(msg.type);
    }
    item.appendChild(tag);

    // Subject
    const subject = document.createElement('span');
    subject.className = 'feed-subject';
    subject.textContent = msg.subject;
    item.appendChild(subject);

    // Countdown badge for timed action messages
    if (msg.type === 'action' && !msg.actionTaken && msg.deadline != null) {
      const countdown = document.createElement('span');
      countdown.className = 'message-countdown';
      countdown.dataset.deadline = msg.deadline;
      updateCountdownEl(countdown, msg.deadline);
      item.appendChild(countdown);
    }

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
