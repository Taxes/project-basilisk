// Tutorial Step Definitions
// 35-step cue card tutorial: 26 sequential onboarding + 9 post-tutorial.
// Steps are either "major" (player-facing, counted in "Step N of M") or
// "nav" (tab-navigation, skipped if player is already on the correct tab).
// See docs/design-docs/onboarding-spike.md for full design.

import { gameState } from '../game-state.js';
import { getCount } from '../purchasable-state.js';
import { switchTab } from '../ui/tab-navigation.js';
import { switchSubTab } from '../ui/infrastructure.js';

// Step name lookup for analytics
export const STEP_NAMES = {
  1: 'welcome',
  2: 'stats_resources',
  3: 'stats_funding',
  4: 'sidebar_intro',
  5: 'nav_personnel',
  6: 'hire_associates',
  7: 'nav_compute',
  8: 'buy_gpus',
  9: 'nav_personnel_2',
  10: 'hire_more',
  11: 'funding_explain',
  12: 'research_milestones',
  13: 'nav_finance',
  14: 'fundraising_explain',
  15: 'nav_personnel_3',
  16: 'research_allocation',
  17: 'nav_compute_2',
  18: 'compute_allocation',
  19: 'nav_finance_2',
  20: 'token_pricing',
  21: 'revenue_target',
  22: 'nav_finance_3',
  23: 'seed_fundraise',
  24: 'nav_admin',
  25: 'admin_tab',
  26: 'tutorial_complete',
  27: 'nav_data',
  28: 'data_explain',
  29: 'competitor_awareness',
  30: 'data_crisis',
  31: 'nav_admin_automation',
  32: 'automation_teams',
  33: 'nav_personnel_automation',
  34: 'automation_controls',
  35: 'synthetic_unlock',
};

// Player-visible step count (only major steps in main phase)
export const MAJOR_STEP_COUNT = 17;

// Helper: check if a capability is unlocked in a specific track
function hasCapability(gs, trackName, capId) {
  return gs.tracks[trackName]?.unlockedCapabilities?.includes(capId) ?? false;
}

// Helper: check if a specific sub-tab is currently active
function isSubTabActive(category) {
  return document.querySelector(`.sub-tab[data-category="${category}"]`)?.classList.contains('active') ?? false;
}

// Helper: count pending (not yet completed) queue items for a purchasable
function getQueuedPending(purchasableId) {
  return (gameState.focusQueue || [])
    .filter(item => item.type === 'purchase' && item.target === purchasableId)
    .reduce((sum, item) => sum + (item.quantity - item.completed), 0);
}

// Nav step factory — creates a "click this tab" step
// major: false means no "Step N of M" counter, skipped if already on tab
function navStep(id, name, tabCategory, body, extraTrigger) {
  return {
    id,
    name,
    phase: 'main',
    major: false,
    trigger: (gs) => gs.tutorial.currentStep >= (id - 1) && (!extraTrigger || extraTrigger(gs)),
    target: tabCategory === 'admin' ? '#admin-sub-tab'
      : tabCategory === 'data' ? '#data-sub-tab'
        : `.sub-tab[data-category="${tabCategory}"]`,
    position: 'below',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => isSubTabActive(tabCategory),
  };
}

export const TUTORIAL_STEPS = [
  // ===== Phase 1: Orientation =====
  {
    id: 1,
    name: 'welcome',
    phase: 'main',
    trigger: (gs) => gs.onboardingComplete && gs.tutorial.currentStep === 0,
    target: null,
    position: 'center',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `Your team left you some messages in the sidebar. Read them when you're ready.\nIf you want a guided walkthrough, I can walk you through the basics.`,
      buttons: [
        { label: 'Show me the basics', action: 'go_dashboard' },
        { label: "I'll figure it out", action: 'skip_all' },
      ],
    },
  },
  {
    id: 2,
    name: 'stats_resources',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 1,
    target: '#stats-bar',
    position: 'below',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `This is your stats bar. Research, Compute, Funding, all updating in real time. Funding is the one to watch early on (the other two are useless if you're broke). We'll go into each of these in detail later.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  {
    id: 3,
    name: 'stats_funding',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 2,
    target: '.stats-group:first-child',
    position: 'below',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `Your funding rate is the number to watch. Positive means you're growing, negative means you're bleeding. Keep an eye on it.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  {
    id: 4,
    name: 'sidebar_intro',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 3,
    target: '#col-at-a-glance',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `**Focus Queue** runs your queued actions (hiring, purchases) one at a time. Anything you queue from the tabs shows up here.\n**CEO Focus** is what you do when the queue is empty. You start with Grant Writing (extra income) and Hands-on Research (the default). Try switching to Grant Writing if funding gets tight.\n**Funding Summary** shows your income, expenses, and how long until you're broke.\n**Messages** from your team appear at the bottom. Click one to read the full thing.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    onDismiss: () => switchTab('dashboard'),
  },

  // ===== Phase 2: First actions =====
  navStep(5, 'nav_personnel',
    'personnel',
    `Click the **Personnel** tab to start building your team.`,
  ),
  {
    id: 6,
    name: 'hire_associates',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 5,
    target: '.compact-purchase-card[data-purchase-id="grad_student"]',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `__Queue up 5 Research Associates__ to get your lab running. They generate Research Points, which is how you reach breakthroughs.\n**Tip:** Ctrl+click queues 5 at once. Shift+click for 10. Right-click to rush something to the front of the queue.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => getCount('grad_student') + getQueuedPending('grad_student') >= 5,
    followUp: {
      target: '#queue-panel',
      position: 'right',
      body: `Your hiring is in the queue. Wait a few moments for the process to complete.`,
      advance: () => getQueuedPending('grad_student') === 0,
    },
  },
  navStep(7, 'nav_compute',
    'compute',
    `Your researchers need equipment. Click **Compute**.`,
  ),
  {
    id: 8,
    name: 'buy_gpus',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 7,
    target: '.compact-purchase-card[data-purchase-id="gpu_consumer"]',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `__Queue up 10 Consumer GPUs__. These generate Compute for training models. Researchers without compute are just expensive overhead.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => getCount('gpu_consumer') + getQueuedPending('gpu_consumer') >= 11,
    followUp: {
      target: '#queue-panel',
      position: 'right',
      body: `Your GPU order is in the queue. Wait for the purchases to complete.`,
      advance: () => getQueuedPending('gpu_consumer') === 0,
    },
  },
  navStep(9, 'nav_personnel_2',
    'personnel',
    `Good. Head back to **Personnel** for more researchers.`,
  ),
  {
    id: 10,
    name: 'hire_more',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 9,
    target: '.compact-purchase-card[data-purchase-id="grad_student"]',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `More researchers means faster breakthroughs. __Queue up 5 more Research Associates__.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => getCount('grad_student') + getQueuedPending('grad_student') >= 10,
    followUp: {
      target: '#queue-panel',
      position: 'right',
      body: `Good. Wait for the hiring to finish, then we'll talk funding.`,
      advance: () => getQueuedPending('grad_student') === 0,
    },
  },
  {
    id: 11,
    name: 'funding_explain',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 10,
    target: '.stats-group:first-child',
    position: 'below',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `Notice your funding rate is negative? Salaries and running costs add up.\nYour Seed Grant ($750/d) is temporary. It runs out after about a year.\nIf funding hits $0, the university will loan you some money, but go too far into debt and they'll shut the lab down.\nIf things get tight: furlough a position to suspend its salary, or switch CEO Focus to Grant Writing for extra income.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  {
    id: 12,
    name: 'research_milestones',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 11,
    target: '#col-research',
    position: 'left',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `**Breakthroughs** advance your lab's capabilities. Your first target is Basic Transformer Architecture (2,000 RP).\nEach breakthrough unlocks new technology, personnel, and equipment. The progress bar shows how long until you get there.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },

  // ===== Phase 3: Post-breakthrough =====
  navStep(13, 'nav_finance',
    'finance',
    `You've hit your first breakthrough. Click **Finance** to see how fundraising works.`,
    (gs) => hasCapability(gs, 'capabilities', 'basic_transformer'),
  ),
  {
    id: 14,
    name: 'fundraising_explain',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 13,
    target: '#fundraise-section',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `Your new Research Grant provides $4,000/d for about a year and a half.\n**Fundraising** is how you scale. Each round trades equity for capital. Your first target is the Seed Round, which requires $500/d revenue.\nTo generate revenue, you need a product, which means researching Applications.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  navStep(15, 'nav_personnel_3',
    'personnel',
    `Head to **Personnel** to set your research allocation.`,
  ),
  {
    id: 16,
    name: 'research_allocation',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 15,
    target: '#research-allocation-section',
    position: 'left',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `You can now split research between **Capabilities** and **Applications**.\n__Set Applications to around 40%__ to start working toward your first product (Chatbot Assistant).\nYour team doesn't pivot instantly, by the way. The larger the lab, the slower the culture shift. You can focus on Culture Shift to speed it up.\nThen wait for your first application to unlock. If you have extra funding, you can buy personnel or compute to speed this up.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: (gs) => (gs.targetAllocation?.applications ?? gs.tracks.applications.researcherAllocation) >= 0.20,
  },
  navStep(17, 'nav_compute_2',
    'compute',
    `Your Chatbot is ready. Head to **Compute** to start serving it to customers.`,
    (gs) => hasCapability(gs, 'applications', 'chatbot_assistant'),
  ),
  {
    id: 18,
    name: 'compute_allocation',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 17,
    target: '#compute-allocation-section',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `**Compute allocation** splits your GPUs between training (internal) and serving (external).\n__Set External to around 50%__. More serving means more revenue, but slower research. You may need to adjust this depending on your lab's situation.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: (gs) => gs.resources.computeAllocation <= 0.70,
  },
  navStep(19, 'nav_finance_2',
    'finance',
    `Time to set your pricing. Click **Finance**.`,
  ),
  {
    id: 20,
    name: 'token_pricing',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 19,
    target: '#pricing-panel',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `Every API call and chat response earns tokens. The price slider controls how much you charge per token.\n**Supply** is your serving compute capacity. **Demand** is how many customers want your product.\n__Set your price so max demand stays under 1-2x your supply__. Too high and nobody buys. Too low and you're leaving money on the table.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: (gs) => {
      const supply = gs.resources.tokensPerSecond;
      if (supply <= 0) return false;
      // Use demand at target price (what the UI preview shows) when available,
      // otherwise demand at current price — both recomputed by updateForecasts() while paused
      const demand = gs.computed?.revenue?.demandAtTarget ?? gs.resources.demand;
      return demand > 0 && demand < 2 * supply;
    },
  },
  {
    id: 21,
    name: 'revenue_target',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 20,
    target: '#fundraise-section',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `You need **$500/d revenue** to unlock your Seed Round.\nIf you have extra funding, you can buy more compute to increase supply, or wait for your next Application unlock to boost demand. (Each new Application changes demand, so revisit your pricing after every unlock.)`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  navStep(22, 'nav_finance_3',
    'finance',
    `Your Seed Round is ready. Head to **Finance** to raise capital.`,
    (gs) => gs.fundraiseRounds?.seed?.available,
  ),
  {
    id: 23,
    name: 'seed_fundraise',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 22 && gs.fundraiseRounds?.seed?.available,
    target: '#fundraise-section',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `The Seed Round is available. Click the button when you're ready to raise.\nThere's a timing trade-off here. Raising now locks in current terms. Waiting lets revenue grow (potentially better valuation), but delays the capital.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  navStep(24, 'nav_admin',
    'admin',
    `**Administration** is now available. Click **Admin** to take a look.`,
    (gs) => gs.fundraiseRounds?.seed?.raised,
  ),
  {
    id: 25,
    name: 'admin_tab',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 24,
    target: '#admin-tab-content',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `This is where you'll set up operational infrastructure as your lab grows.\nAutomation policies (hiring targets, procurement rules) let you scale without approving every requisition individually. You'll unlock these as you progress.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  {
    id: 26,
    name: 'tutorial_complete',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 25,
    target: null,
    position: 'center',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `That's the basics. Your lab is funded and researching, on the long road to profitability.\nFrom here, new capabilities unlock new systems. Keep an eye on your **Messages** for guidance from your team.\nNew equipment, personnel, and decisions will show up as you progress. Explore at your own pace. (Just not too slowly, or someone else will beat you to the punch.)\nYou can replay this tutorial anytime from **Settings** (gear icon, top-right).`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },

  // ===== Post-tutorial (standalone triggers) =====
  {
    id: 27,
    name: 'nav_data',
    phase: 'post',
    major: false,
    trigger: (gs) => gs.data.dataTabRevealed,
    target: '#data-sub-tab',
    position: 'below',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `A new **Data** tab has appeared. Click it to see what's going on.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => isSubTabActive('data'),
  },
  {
    id: 28,
    name: 'data_explain',
    phase: 'post',
    trigger: (gs) => gs.data.dataTabRevealed && isSubTabActive('data'),
    target: '#data-tab-content',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `**Data** is now a bottleneck. Your models are outpacing what you have to feed them.\nThe Data tab shows your sources and their effectiveness. **Bulk sources** are one-time purchases with fixed supply. **Renewable sources** grow over time.\nDennis sent you a message with the full breakdown.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  {
    id: 29,
    name: 'competitor_awareness',
    phase: 'post',
    trigger: (gs) => gs.fundraiseRounds?.series_a?.raised,
    target: '#agi-progress-group',
    position: 'below',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `You're not alone. Competitors are racing toward the same goal.\nThe progress bar shows your position relative to theirs. If they get there first, your lab becomes irrelevant.\nRushing capabilities without funding or alignment is a losing strategy. Speed matters, but so does surviving long enough to use it.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },

  // ===== Data crisis =====
  {
    id: 30,
    name: 'data_crisis',
    phase: 'post',
    trigger: (gs) => gs.data.dataTabRevealed && (gs.data.quality ?? 1) <= 0.54,
    target: null,
    position: 'center',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `Your models are training on their own output and the quality is visibly degrading. That is model collapse.\n**Data Quality** drives your research throughput. When it drops below the threshold, capabilities research slows down or stops entirely. You will keep having collapses until you fix the ratio.\nScale up renewable sources to dilute contamination. Take generators offline for a faster fix. **Verification** research is the long-term solution.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },

  // ===== Automation sequence =====
  {
    id: 31,
    name: 'nav_admin_automation',
    phase: 'post',
    major: false,
    trigger: () => getCount('operations_dept') >= 1,
    target: '#admin-sub-tab',
    position: 'below',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `**Operations** is online. Head to **Admin** to hire the teams that will run it.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => isSubTabActive('admin'),
  },
  {
    id: 32,
    name: 'automation_teams',
    phase: 'post',
    trigger: (gs) => gs.tutorial.completedPostSteps.includes(31)
      && getCount('operations_dept') >= 1 && isSubTabActive('admin'),
    target: '.compact-purchase-card[data-purchase-id="hr_team"]',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `These are your automation engines. **HR teams** handle hiring. **Procurement teams** handle equipment and data. The more teams you have, the faster automation executes.\nThey are an investment. When the lab grows large enough that manual hiring becomes a bottleneck, this is how you solve it.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  {
    id: 33,
    name: 'nav_personnel_automation',
    phase: 'post',
    major: false,
    trigger: (gs) => gs.tutorial.completedPostSteps.includes(32)
      && getCount('operations_dept') >= 1,
    target: '.sub-tab[data-category="personnel"]',
    position: 'below',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `Head to **Personnel** to see automation in action.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => isSubTabActive('personnel'),
  },
  {
    id: 34,
    name: 'automation_controls',
    phase: 'post',
    trigger: (gs) => gs.tutorial.completedPostSteps.includes(33)
      && getCount('operations_dept') >= 1 && isSubTabActive('personnel'),
    target: '.compact-purchase-card[data-purchase-id="grad_student"] .automation-panel',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `Enable **Auto** and set a target. Your operations team will hire to that number automatically. Priority controls which items get attention first when the team is busy.\nNot every item is automatable yet. Operations Department unlocks the basics. Admin upgrades unlock higher-tier items.\nThe **policy** selector controls how the target is calculated. You start with **Units** (a fixed count). More policies unlock as you grow.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },

  // ===== Synthetic data unlock =====
  {
    id: 35,
    name: 'synthetic_unlock',
    phase: 'post',
    trigger: (gs) => hasCapability(gs, 'capabilities', 'synthetic_data'),
    target: '#data-tab-content',
    position: 'right',
    onShow: () => {
      switchSubTab('data');
      document.getElementById('data-tab-content')?.scrollTo(0, 0);
    },
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `You've unlocked **Synthetic Data Generation**. Generators produce unlimited training data at zero licensing cost.\nThe tradeoff is quality. Synthetic samples are weaker than real data, and they dilute your dataset. Keep an eye on **Data Quality** as you scale generators up.\n**Renewable sources** produce higher-quality data and offset the dilution.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
];
