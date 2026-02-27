// Tutorial Step Definitions
// 26-step sequential cue card tutorial for first-10-minutes onboarding.
// Steps are either "major" (player-facing, counted in "Step N of M") or
// "nav" (tab-navigation, skipped if player is already on the correct tab).
// See docs/design-docs/onboarding-spike.md for full design.

import { getCount } from '../purchasable-state.js';

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
  15: 'research_allocation',
  16: 'nav_compute_2',
  17: 'compute_allocation',
  18: 'nav_finance_2',
  19: 'token_pricing',
  20: 'revenue_target',
  21: 'seed_fundraise',
  22: 'admin_tab',
  23: 'tutorial_complete',
  24: 'nav_data',
  25: 'data_explain',
  26: 'competitor_awareness',
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
      body: `Queue up 5 **Research Associates** to get your lab running. They generate Research Points, which is how you reach breakthroughs.\n**Tip:** Ctrl+click queues 5 at once. Shift+click for 10. Right-click to rush something to the front of the queue.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => getCount('grad_student') >= 5,
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
      body: `Queue up 10 **Consumer GPUs**. These generate Compute for training models. Researchers without compute are just expensive overhead.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => getCount('gpu_consumer') >= 11,
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
      body: `More researchers means faster breakthroughs. Queue up 5 more **Research Associates**.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => getCount('grad_student') >= 10,
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
  {
    id: 15,
    name: 'research_allocation',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 14,
    target: '#research-allocation-section',
    position: 'left',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `You can now split research between **Capabilities** and **Applications**.\nSet Applications to around 40% to start working toward your first product (Chatbot Assistant).\nYour team doesn't pivot instantly, by the way. The larger the lab, the slower the culture shift. You can focus on Culture Shift to speed it up.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: (gs) => gs.tracks.applications.researcherAllocation >= 0.20,
  },
  navStep(16, 'nav_compute_2',
    'compute',
    `Your Chatbot is ready. Head to **Compute** to start serving it to customers.`,
    (gs) => hasCapability(gs, 'applications', 'chatbot_assistant'),
  ),
  {
    id: 17,
    name: 'compute_allocation',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 16,
    target: '#compute-allocation-section',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `**Compute allocation** splits your GPUs between training (internal) and serving (external).\nSet External to around 50%. More serving means more revenue, but slower research. You may need to adjust this depending on your lab's situation.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: (gs) => gs.resources.computeAllocation <= 0.70,
  },
  navStep(18, 'nav_finance_2',
    'finance',
    `Time to set your pricing. Click **Finance**.`,
  ),
  {
    id: 19,
    name: 'token_pricing',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 18,
    target: '#pricing-panel',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `Every API call and chat response earns tokens. The price slider controls how much you charge per token.\n**Supply** is your serving compute capacity. **Demand** is how many customers want your product.\nSet your price so max demand stays under 1-2x your supply. Too high and nobody buys. Too low and you're leaving money on the table.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  {
    id: 20,
    name: 'revenue_target',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 19,
    target: '#fundraise-section',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `You need **$500/d revenue** to unlock your Seed Round.\nIf you have extra funding, you can buy more compute to increase supply, or wait for your next Application unlock to boost demand. (Each new Application changes demand, so revisit your pricing after every unlock.)`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  {
    id: 21,
    name: 'seed_fundraise',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 20 && gs.fundraiseRounds?.seed?.available,
    target: '#fundraise-section',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: false,
    content: {
      body: `The Seed Round is available. Click to begin the fundraise.\nThere's a timing trade-off here. Raising now locks in current terms. Waiting lets revenue grow (potentially better valuation), but delays the capital.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: (gs) => gs.fundraiseRounds?.seed?.raised,
  },
  {
    id: 22,
    name: 'admin_tab',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 21 && gs.fundraiseRounds?.seed?.raised,
    target: '#admin-sub-tab',
    position: 'below',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `**Administration** is now available. As your lab grows, you'll need operational infrastructure to scale.\nThis is where you set up automation policies (hiring targets, procurement rules) so you're not approving every requisition individually.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
  {
    id: 23,
    name: 'tutorial_complete',
    phase: 'main',
    trigger: (gs) => gs.tutorial.currentStep >= 22,
    target: null,
    position: 'center',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `That's the basics. Your lab is funded and researching, on the long road to profitability.\nFrom here, new capabilities unlock new systems. Keep an eye on your **Messages** for guidance from your team.\nNew equipment, personnel, and decisions will show up as you progress. Explore at your own pace. (Just not too slowly, or someone else will beat you to the punch.)`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },

  // ===== Post-tutorial (standalone triggers) =====
  {
    id: 24,
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
    id: 25,
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
    id: 26,
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
];
