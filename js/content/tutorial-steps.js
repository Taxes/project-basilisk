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
      body: `Your team has sent you some messages — read them when you're ready.\nFor a guided walkthrough, click below to get started.`,
      buttons: [
        { label: 'Go to Dashboard', action: 'go_dashboard' },
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
      body: `**Stats bar** — your key resources at a glance. Research fuels breakthroughs, Compute powers your models, Funding keeps the lights on.`,
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
      body: `**Funding** is your most important resource early on. Watch the rate — if it goes negative, you're burning cash.`,
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
      body: `**Sidebar** — at-a-glance overview that's always visible.\n**Focus Queue** — actions you've queued (hiring, purchases) process here.\n**CEO Focus** — set your personal priority for a passive bonus.\n**Funding Summary** — live income, expenses, and runway.\n**Messages Feed** — your team sends guidance as you hit milestones.`,
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
      body: `Queue up 5 **Research Associates** to get your lab running. They generate Research Points — you need those for breakthroughs.\n**Tip:** Ctrl+click to queue 5 at once. Shift+click for 10. Right-click to rush to front of queue.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => getCount('grad_student') >= 5,
  },
  navStep(7, 'nav_compute',
    'compute',
    `Now head to the **Compute** tab to get some hardware.`,
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
      body: `Queue up 10 **Consumer GPUs**.\nGPUs generate Compute for training models. Researchers without compute are just expensive overhead.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: () => getCount('gpu_consumer') >= 11,
  },
  navStep(9, 'nav_personnel_2',
    'personnel',
    `Good — head back to **Personnel** for more researchers.`,
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
      body: `Notice your funding rate is negative? Salaries and running costs add up.\n**Starting grants** are temporary — your Research Grant ($4,000/s) runs out after 10 minutes. Your Seed Grant ($750/s) runs out after 6 minutes.\nIf funding hits $0 you'll get a line of credit, but go too far into debt and it's game over.\nTo reduce costs: click the Furlough button on a position to suspend it, or switch CEO Focus to Grant Writing for extra income.`,
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
      body: `**Breakthroughs** advance your lab's capabilities. Your first target: Basic Transformer Architecture (2,000 RP).\nEach breakthrough unlocks new technology, personnel, and equipment.\nThe progress bar shows time remaining.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },

  // ===== Phase 3: Post-breakthrough =====
  navStep(13, 'nav_finance',
    'finance',
    `You've hit your first breakthrough! Click the **Finance** tab to learn about fundraising.`,
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
      body: `Your new Research Grant provides $4,000/s for 10 minutes.\n**Fundraising** is how you scale. Each round trades equity for capital. Your first target: Seed Round, which requires $500/s revenue.\nTo generate revenue, you'll need a product — which means researching Applications.`,
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
      body: `You can now split research between **Capabilities** and **Applications**.\nSet Applications to ~40% to start working toward your first product (Chatbot Assistant).\n**Culture shift:** Your team doesn't pivot instantly. The larger the lab, the slower the shift.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: (gs) => gs.tracks.applications.researcherAllocation >= 0.20,
  },
  navStep(16, 'nav_compute_2',
    'compute',
    `Your Chatbot is ready! Head to the **Compute** tab to allocate serving capacity.`,
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
      body: `**Compute allocation** splits your GPUs between training (internal) and serving (external).\nSet External to ~50%. Watch the trade-off: more serving means more revenue, but slower research.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
    advance: (gs) => gs.resources.computeAllocation <= 0.70,
  },
  navStep(18, 'nav_finance_2',
    'finance',
    `Check the **Finance** tab to set your pricing.`,
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
      body: `Every API call and chat response earns tokens. Price controls how much you charge.\n**Supply** = your serving compute capacity. **Demand** = customers wanting your product.\nSet your price so max demand stays under ~2× your supply. Too high: no customers. Too low: leaving money on the table.`,
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
      body: `You need **$500/s revenue** to unlock your Seed Round.\nYou can buy more compute to increase supply, or wait for your next Application unlock to boost demand.`,
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
      body: `The Seed Round is available! Click to begin the fundraise process.\n**Timing trade-off:** Raising now locks in current terms. Waiting lets revenue grow (potentially better valuation), but delays the capital infusion.`,
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
      body: `**Administration** is now available. As your lab grows, you'll need operational infrastructure to scale.\nThis is where you'll set up automation policies — hiring targets, procurement rules — so you're not approving every requisition individually.`,
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
      body: `**Tutorial complete.** Your lab is funded, profitable, and researching.\nFrom here, new capabilities unlock new systems — keep an eye on your **Messages** for guidance from your team.\nNew focus options, buyables, and decisions are now available. Explore at your own pace.`,
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
    trigger: (gs) => gs.data.dataTabRevealed,
    target: '#data-tab-content',
    position: 'right',
    pauseOnShow: true,
    unpauseOnDismiss: true,
    content: {
      body: `**Data** is now a bottleneck. Your models are outpacing what you have to feed them.\nThe Data tab shows your data sources and their effectiveness. **Bulk sources** are one-time purchases with fixed supply. **Renewable sources** grow over time.\nDennis's message has the full breakdown — check your inbox.`,
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
      body: `You're not alone. Competitors are racing toward the same goal.\nThe progress bar shows your position relative to theirs. If they reach AGI before you, it's game over.\nBalance speed against sustainability — rushing capabilities without funding or alignment is a losing strategy.`,
      buttons: [{ label: 'Got it', action: 'dismiss' }],
    },
  },
];
