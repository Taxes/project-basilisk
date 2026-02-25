// Player-facing text: see docs/message-registry.json
// Message Content Templates
// Characters, senders, and message templates for the inbox system

import { STRATEGIC_CHOICES, ALIGNMENT } from '../../data/balance.js';

// === ALL SENDERS ===
// Tutorial characters use computing history references:
// Shannon = Claude Shannon, Babbage = Dennis Ritchie + Charles Babbage,
// Chen = ELIZA chatbot, Turing = Ada Lovelace + Alan Turing,
// Shapley = Alvin Roth + Lloyd Shapley (game theory)

export const senders = {
  // Tutorial characters (used for onboarding and educational messages)
  shannon: { id: 'shannon', name: 'Prof. Shannon', role: 'Advisor' },
  babbage: { id: 'babbage', name: 'Dennis Babbage', role: 'CTO' },
  chen: { id: 'chen', name: 'Dr. Eliza Chen', role: 'CSO' },
  turing: { id: 'turing', name: 'Ada Turing', role: 'CFO' },
  shapley: { id: 'shapley', name: 'Alvin Shapley', role: 'Board Chair' },

  // External senders
  press: { id: 'press', name: 'Press Report', role: null },
  regulator: { id: 'regulator', name: 'Regulatory Notice', role: null },
  competitor: { id: 'competitor', name: 'Competitor Intel', role: null },
};

// Legacy aliases for existing code
export const characters = {
  cso: senders.chen,
  cto: senders.babbage,
  cfo: senders.turing,
  board: senders.shapley,
  team: { id: 'team', name: 'The Team', role: null },
};
export const externalSenders = {
  press: senders.press,
  regulator: senders.regulator,
  competitor: senders.competitor,
};

// Get sender by ID
export function getSender(id) {
  return senders[id] || characters[id] || null;
}

// === WELCOME MESSAGE ===

export const welcomeMessage = {
  type: 'info',
  sender: characters.team,
  subject: 'Welcome to the Lab',
  body: `Congratulations on securing the startup grant. The lab is yours.

Build something that matters.`,
  signature: null,
  tags: ['welcome', 'tutorial'],
  triggeredBy: 'game_start',
};

// === STRATEGIC CHOICE MESSAGES ===

export const strategicChoiceMessages = {
  open_vs_proprietary: {
    type: 'action',
    sender: characters.cto,
    subject: 'Research Policy Decision',
    body: `We need to make a call on our research policy. This will define us as a company.

The open approach means publishing papers, sharing weights, contributing to the commons. We'll attract idealistic talent and accelerate the field - but we're also accelerating our competitors.

Going proprietary means patents, trade secrets, competitive moats. Stronger market position, higher margins, but slower research progress and we'll pay more for top talent.

This decision is permanent. Choose carefully.`,
    signature: '– Dennis',
    priority: 'normal',
    tags: ['strategic', 'research'],
    triggeredBy: 'strategic_choice_unlock',
    choices: [
      {
        id: 'open_research',
        label: 'Open Research',
        effects: {
          strategicChoice: { choiceId: 'open_vs_proprietary', optionId: 'open_research' },
          newsMessage: 'Lab announces open-source model release, pledges to share research',
        },
      },
      {
        id: 'proprietary_models',
        label: 'Proprietary Models',
        effects: {
          strategicChoice: { choiceId: 'open_vs_proprietary', optionId: 'proprietary_models' },
          newsMessage: 'Lab files patents on novel AI architecture, signals proprietary strategy',
        },
      },
    ],
  },

  government_vs_independent: {
    type: 'action',
    sender: externalSenders.regulator,
    subject: "Senator Walsh's Office - Partnership Inquiry",
    body: `The Senate AI Subcommittee has been following your progress with interest. Senator Walsh's office has reached out about a potential government partnership.

The offer: subsidized compute access and direct funding, in exchange for priority access to capabilities and adherence to certain research guidelines.

Your CFO notes this would stabilize our runway significantly. Your safety officer has concerns about research autonomy.

How do you respond?`,
    signature: null,
    priority: 'normal',
    tags: ['strategic', 'government'],
    triggeredBy: 'strategic_choice_unlock',
    choices: [
      {
        id: 'government_partnership',
        label: 'Accept Partnership',
        effects: {
          strategicChoice: { choiceId: 'government_vs_independent', optionId: 'government_partnership' },
          hiddenAlignment: ALIGNMENT.GOVERNMENT_ALIGNMENT_EFFECT,
          newsMessage: 'Lab signs government compute contract amid funding concerns',
        },
      },
      {
        id: 'independent_lab',
        label: 'Remain Independent',
        effects: {
          strategicChoice: { choiceId: 'government_vs_independent', optionId: 'independent_lab' },
          hiddenAlignment: ALIGNMENT.INDEPENDENT_ALIGNMENT_EFFECT,
          newsMessage: 'Lab rejects government funding, cites research independence',
        },
      },
    ],
  },

  rapid_vs_careful: {
    type: 'action',
    sender: characters.cso,
    subject: 'Deployment Philosophy',
    body: `We need to align on our deployment philosophy. Our capabilities are getting powerful enough that this matters.

The industry standard is "move fast." Ship early, iterate quickly, capture market share before competitors. Revenue flows, market edge stays strong, but we're deploying systems we don't fully understand.

The alternative: thorough validation before every deployment. Slower time-to-market, but we catch failure modes early. Fewer incidents, better safety track record.

This is a defining choice. What kind of lab do we want to be?`,
    signature: '– Eliza',
    priority: 'normal',
    tags: ['strategic', 'safety', 'deployment'],
    triggeredBy: 'strategic_choice_unlock',
    choices: [
      {
        id: 'rapid_deployment',
        label: 'Rapid Deployment',
        effects: {
          strategicChoice: { choiceId: 'rapid_vs_careful', optionId: 'rapid_deployment' },
          hiddenAlignment: ALIGNMENT.RAPID_ALIGNMENT_EFFECT,
          newsMessage: 'Lab accelerates deployment timeline, ships without extended validation',
        },
      },
      {
        id: 'careful_validation',
        label: 'Careful Validation',
        effects: {
          strategicChoice: { choiceId: 'rapid_vs_careful', optionId: 'careful_validation' },
          hiddenAlignment: ALIGNMENT.CAREFUL_ALIGNMENT_EFFECT,
          newsMessage: 'Lab delays product launch for additional safety review',
        },
      },
    ],
  },
};

// === ALIGNMENT WARNING MESSAGES ===

export const alignmentWarningMessages = {
  mild: {
    type: 'info',
    sender: characters.cso,
    subject: 'Alignment Gap Widening',
    body: `I've been reviewing our research metrics. Capabilities work is outpacing alignment research by a significant margin.

This isn't critical yet, but I've seen this pattern before. The gap compounds faster than you'd expect.

Something to keep an eye on.`,
    signature: '– Eliza',
    tags: ['alignment', 'warning'],
    triggeredBy: 'alignment_threshold_mild',
  },
  moderate: {
    type: 'info',
    sender: characters.cso,
    subject: 'Safety Team Concerns',
    body: `The alignment gap is getting uncomfortable. Our capabilities are advancing faster than our ability to understand and control them.

I'm not saying we need to stop capabilities research entirely, but we should seriously consider rebalancing our allocation.

This is entering territory where I start losing sleep.`,
    signature: '– Eliza',
    tags: ['alignment', 'warning'],
    triggeredBy: 'alignment_threshold_moderate',
  },
  severe: {
    type: 'action',
    sender: characters.cso,
    subject: 'Urgent: Alignment Crisis',
    body: `We have a serious problem. The gap between our capabilities and our alignment work has reached a critical level.

I've documented multiple concerning behaviors in our latest models that we don't have the tools to properly evaluate. We're building systems more powerful than we can verify.

I'm formally recommending we pause capabilities research until alignment catches up. This isn't optional anymore.`,
    signature: '– Eliza',
    priority: 'normal',
    tags: ['alignment', 'warning', 'critical'],
    triggeredBy: 'alignment_threshold_severe',
    choices: [
      {
        id: 'pause_caps',
        label: 'Pause Capabilities',
        effects: {
          pauseCapabilities: { duration: 60000 }, // 60 seconds
          hiddenAlignment: 5,
          choices: { alignmentInvestment: 1 },
        },
      },
      {
        id: 'continue',
        label: 'Continue Research',
        effects: {
          hiddenAlignment: -5,
          choices: { conservativeApproach: -1 },
          newsMessage: 'Lab continues capabilities push despite safety concerns',
        },
      },
    ],
  },
};

// === RESEARCH MILESTONE MESSAGES ===

export const researchMilestoneMessages = {
  scaling_laws: {
    type: 'info',
    sender: characters.cto,
    subject: 'Scaling Laws Breakthrough',
    body: `We cracked it. The scaling laws predict model performance with surprising accuracy. We now have a roadmap for exactly how much compute and data we need for the next capability level.

The team is buzzing. This changes everything about how we plan our research.`,
    signature: '– Dennis',
    tags: ['research', 'milestone'],
    triggeredBy: 'research_unlock',
  },
  world_models: {
    type: 'info',
    sender: characters.cto,
    subject: 'World Models Online',
    body: `The new architecture just passed a threshold I didn't expect to see this year. It generalizes across domains in ways we didn't predict. The model isn't just pattern matching — it's building internal representations of how the world works.

This is qualitatively different from scaling laws. We're not just predicting performance curves anymore. We're watching something learn physics, causation, spatial reasoning — without being told to. Team's already talking about next steps.`,
    signature: '– Dennis',
    tags: ['research', 'milestone', 'capabilities'],
    triggeredBy: 'research_unlock',
  },
};

// === FUNDING MESSAGES ===

export const fundingMessages = {
  runway_warning: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Runway Check',
    body: `At current burn rate, we have limited runway remaining. Series B conversations need to start now, not next month.

I've attached the latest projections. We should talk.`,
    signature: '– Ada',
    tags: ['funding', 'warning'],
    triggeredBy: 'runway_threshold',
  },
  seed_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Seed Round Interest',
    body: `We've caught the attention of some early-stage investors. Our fine-tuning results are promising enough that a few angels and micro-VCs want to talk.

It won't be a huge raise — seed rounds never are — but it'll extend our runway past the grant period. That matters.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_seed',
  },
  series_a_available: {
    type: 'info',
    sender: senders.shannon,
    subject: 'Investor Interest',
    body: `Your revenue numbers crossed a threshold. VCs are calling — Ada Turing, our incoming CFO, has been fielding inquiries. She'll be a better guide through this process than I am.

Series A is a different animal from grants. You're trading equity for capital, and the clock speeds up once you take it. But you've built something real here, and the market can see it.

I'd recommend moving while momentum is strong. Investor enthusiasm has a half-life.

This is probably my last piece of unsolicited advice. You've outgrown the mentor phase. Trust your team.`,
    signature: '– Prof. Shannon',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_a',
  },
  series_b_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series B Timing',
    body: `We're fielding calls from growth-stage funds. Our metrics justify a Series B at favorable terms.

I'd recommend moving soon — the valuation multiple decays over time and market windows don't stay open forever.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_b',
  },
  series_c_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series C Opportunity',
    body: `Crossover funds and growth equity are in our pipeline. The revenue run-rate justifies a significant raise — I'm seeing term sheets north of anything we've done before.

We should move while the valuation multiple holds. These windows compress fast at our scale.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_c',
  },
  series_d_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series D — Late Stage',
    body: `Sovereign wealth funds and mega-cap investors are interested. This is late-stage territory — the numbers are significant.

We should discuss timing. The multiplier advantage won't last.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_d',
  },
  series_e_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series E — Late Stage',
    body: `This is likely our last private round before any exit event. The capital available is substantial, but so is the dilution.

Your call on timing. I've modeled the scenarios.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_e',
  },
  series_g_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series G — Unprecedented Scale',
    body: `I've never seen term sheets like these. Sovereign wealth funds, national AI initiatives, trillion-dollar conglomerates — they're all calling.

The numbers are staggering, but at this stage, so is the burn rate. Move when you're ready.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_g',
  },
};

// === BOARD MESSAGES ===

export const boardMessages = {
  competitor_pressure: {
    type: 'info',
    sender: characters.board,
    subject: 'Board Concerns',
    body: `The board is watching OpenBrain's progress closely. We didn't invest $50M to come in second.

Expect a call Thursday.`,
    signature: '– Alvin',
    tags: ['board', 'pressure'],
    triggeredBy: 'competitor_milestone',
  },
};

// === MORATORIUM MESSAGES ===

export const moratoriumMessages = {
  /** Final moratorium — from UN AI Safety Council */
  final: (durationMonths, competitorWillPause) => ({
    type: 'action',
    sender: externalSenders.regulator,
    subject: 'CRITICAL: Final Moratorium Decision',
    body: `The international community has reached a critical consensus. With AGI-level capabilities now within reach, major powers are calling for an immediate research pause.

${competitorWillPause
  ? 'Intelligence reports confirm: OpenBrain and other major labs have agreed to pause. The competitive pressure is off - for now.'
  : 'However, some labs have refused to commit. OpenBrain continues to race ahead.'}

This may be your last opportunity to ensure alignment keeps pace with capabilities. A ${durationMonths}-month pause would allow your safety research to catch up.

The world is watching. What do you decide?`,
    priority: 'critical',
    tags: ['moratorium', 'critical', 'alignment'],
    choices: [
      {
        id: 'accept_moratorium',
        label: 'Accept Moratorium',
        effects: {
          moratorium: { id: 'final', action: 'accept' },
        },
      },
      {
        id: 'reject_moratorium',
        label: 'Continue Research',
        effects: {
          moratorium: { id: 'final', action: 'reject' },
          hiddenAlignment: -3,
          newsMessage: 'Lab defies international pause, continues capabilities research',
        },
      },
    ],
  }),

  /** First or second moratorium — from Dr. Chen (CSO) */
  standard: (moratoriumId, ordinal, durationMonths) => ({
    type: 'action',
    sender: characters.cso,
    subject: `${ordinal} Moratorium Proposal`,
    body: `There's growing pressure from the AI safety community for a voluntary research pause. Several researchers have signed an open letter calling for a ${durationMonths}-month moratorium on capability advances.

Our intelligence suggests OpenBrain has no intention of pausing. They see this as an opportunity to pull ahead.

A pause would let us focus on alignment research, but we'd fall behind competitively. The choice is yours.`,
    signature: '– Eliza',
    priority: 'normal',
    tags: ['moratorium', 'alignment'],
    choices: [
      {
        id: 'accept_moratorium',
        label: 'Accept Moratorium',
        effects: {
          moratorium: { id: moratoriumId, action: 'accept' },
          hiddenAlignment: 2,
          newsMessage: 'Lab announces voluntary capability pause for safety review',
        },
      },
      {
        id: 'reject_moratorium',
        label: 'Continue Research',
        effects: {
          moratorium: { id: moratoriumId, action: 'reject' },
          newsMessage: 'Lab declines moratorium call, cites competitive pressures',
        },
      },
    ],
  }),
};

// === CREDIT WARNING MESSAGE ===

export const creditWarningMessage = {
  type: 'action',
  sender: characters.cfo,
  subject: 'Line of Credit Activated',
  body: `We've drawn on our line of credit to cover the shortfall. I've frozen all new purchases until we're back in the black.

You'll need to reduce spending — furlough personnel or scale back compute. Interest is accruing at 20% APR.

If we hit our credit limit, it's over.`,
  signature: '– Ada',
  priority: 'normal',
  tags: ['economics', 'credit'],
  triggeredBy: 'credit_warning',
  choices: [
    { id: 'acknowledge', label: 'Understood', effects: [] },
  ],
};

// === ALIGNMENT TAX MESSAGE ===

export const alignmentTaxActionMessage = {
  sender: senders.turing,
  subject: 'Revenue impact from safety constraints',
  body: 'Post-safety-update financials are in. Revenue down 12% — users are churning faster than expected. The constraints are working as intended, but that\'s a real margin hit. Operating profit just went negative. We can absorb it short-term, but this trajectory puts us back in fundraising territory within two quarters.',
  signature: '– Ada',
  choices: [
    { id: 'revert', label: 'Revert safety constraints', effects: '+20% revenue for 120s, -500 alignment RP' },
    { id: 'hold', label: 'Hold firm', effects: '-10% revenue for 120s' },
  ],
  priority: 'normal',
  tags: ['alignment', 'revenue'],
  triggeredBy: 'alignment_tax',
};

// Export all message templates for easy access
export const allMessageTemplates = {
  welcome: welcomeMessage,
  strategicChoices: strategicChoiceMessages,
  alignmentWarnings: alignmentWarningMessages,
  researchMilestones: researchMilestoneMessages,
  funding: fundingMessages,
  board: boardMessages,
  creditWarning: creditWarningMessage,
  moratoriums: moratoriumMessages,
};
