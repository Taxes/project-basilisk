// Tab Navigation Controller
// Handles top-level tab switching between Dashboard and Messages

import { gameState } from '../game-state.js';
import { getUnreadCount, getActionCount, hasOverdueMessages } from '../messages.js';
// Note: renderMessagesPanel and selectMessage imported dynamically to break circular dependency

let currentTab = 'dashboard';

// Get current active tab
export function getCurrentTab() {
  return currentTab;
}

// Switch to a specific tab
export function switchTab(tabId) {
  if (currentTab === tabId) return;

  currentTab = tabId;

  // Update tab button states
  const tabs = document.querySelectorAll('.header-tab');
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update view panel visibility
  const dashboardPanel = document.getElementById('dashboard-panel');
  const messagesPanel = document.getElementById('messages-panel-wrapper');

  if (tabId === 'dashboard') {
    dashboardPanel.classList.remove('hidden');
    dashboardPanel.classList.add('active');
    messagesPanel.classList.add('hidden');
    messagesPanel.classList.remove('active');
  } else if (tabId === 'messages') {
    messagesPanel.classList.remove('hidden');
    messagesPanel.classList.add('active');
    dashboardPanel.classList.add('hidden');
    dashboardPanel.classList.remove('active');
    import('./messages-panel.js').then(({ renderMessagesPanel }) => renderMessagesPanel());
  }
}

// Update the Messages tab badge
export function updateTabBadge() {
  const badge = document.getElementById('messages-badge');
  if (!badge) return;

  const actionCount = getActionCount();
  const unreadCount = getUnreadCount();

  if (actionCount > 0) {
    badge.textContent = actionCount;
    badge.classList.remove('hidden');
    badge.classList.add('has-actions');
    badge.classList.toggle('has-overdue', hasOverdueMessages());
  } else if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.classList.remove('hidden');
    badge.classList.remove('has-actions');
    badge.classList.remove('has-overdue');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('has-overdue');
  }
}

// Navigate to Messages tab and select a specific message
export function navigateToMessage(messageId) {
  switchTab('messages');

  // Small delay to ensure panel is rendered, then select message
  requestAnimationFrame(() => {
    import('./messages-panel.js').then(({ selectMessage }) => selectMessage(messageId));
  });
}

// Handle pause overlay "Go to Messages" button — navigate to the blocking message
function handlePauseOverlayClick() {
  const blockingId = gameState.pauseMessageId || gameState.pauseMessageIds?.[0];
  if (blockingId) {
    navigateToMessage(blockingId);
  } else {
    switchTab('messages');
  }
}

// Initialize tab navigation
export function initializeTabNavigation() {
  // Tab button click handlers
  const tabs = document.querySelectorAll('.header-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Pause overlay button
  const pauseOverlayBtn = document.getElementById('pause-overlay-button');
  if (pauseOverlayBtn) {
    pauseOverlayBtn.addEventListener('click', handlePauseOverlayClick);
  }

  // Start on dashboard
  switchTab('dashboard');
  updateTabBadge();
}

// Export for testing
if (typeof window !== 'undefined') {
  window.switchTab = switchTab;
  window.navigateToMessage = navigateToMessage;
  window.updateTabBadge = updateTabBadge;
}
