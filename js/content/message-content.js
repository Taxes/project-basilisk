// Player-facing text: see docs/message-registry.json
// Message Content Templates
// Characters, senders, and message templates for the inbox system

import { ALIGNMENT } from '../../data/balance.js';

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

  // Institutional senders (not named characters)
  finance_office: { id: 'finance_office', name: 'Financial Services', role: 'University Admin' },

  // System sender (not a character — software vendor)
  ktech: { id: 'ktech', name: 'Ken', role: 'Dashboard Developer' },
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

// === ONBOARDING MESSAGE (sent every new playthrough as persistent reference) ===

export const onboardingMessage = {
  type: 'info',
  sender: senders.ktech,
  subject: 'KTech User Guide',
  body: `Promised user guide, as advertised.

## Stats Bar
Bar across the top. Your key metrics at a glance. These update in real time, and more show up as you unlock new systems.

## At-a-Glance (Left Column)
Left side of the dashboard is always visible regardless of what you're doing. From top to bottom:

- **Focus Queue** - This is your personal task list. When you decide to hire someone, buy equipment, shift priorities, whatever, it goes in here. Each task takes real time to complete and the queue has limited slots, so you can't just dump everything in at once. (You can clear pending items if you change your mind, though.)
- **CEO Focus** - What you're working on when the queue is empty. Think of it as your default activity. This has a real effect on your lab, so don't leave it idle.
- **Funding Summary** - Condensed version of the full funding ledger. Revenue, operating costs, cash flow. Quick financial picture without switching tabs.
- **Messages Feed** - Live feed of recent messages from your team. Click any of them to jump to the full Messages view.

## Operations
Where you manage the lab's resources. Organized into sub-tabs:

- **Finance** - Full funding ledger, line-by-line breakdown of where your money is going. This is also where pricing controls and fundraise rounds show up when they become available.
- **Personnel** - Hire researchers and staff. Also shows your research rate breakdown and allocation sliders, which control how effort gets split between different research tracks. There's a lot going on in this tab but it makes sense once you poke around.
- **Compute** - GPU infrastructure. Buy capacity, manage what you have. Once you have products, a compute slider lets you split capacity between internal research and external token generation.

More sub-tabs unlock as your lab grows.

## Research
Tracks your research milestones - the breakthroughs that open up new technologies, products, and strategic options. Each milestone shows its requirements and what it unlocks. Tabbed between Upcoming and Completed so you can see what you've done versus what's next.

I'm pretty happy with how the milestone tracking turned out, actually. That was the hardest part to get right.

## Messages
Your inbox. Accessed from the header tab. Your advisory team sends briefings, recommendations, and decisions that need your input. Some messages are informational, others need a response. Critical messages pause operations until you deal with them. (That's by design, not a bug.)

Priority filtering is automatic. Important stuff floats to the top. At least, it should. Let me know if it doesn't.

## Settings
Settings button in the header for additional options.

---

That should cover everything you'll see for a while. More systems unlock as you progress, but you'll get briefings from your team when they show up. Let me know if anything breaks.

P.S. If you ever get confused, try hovering over things — I've added a lot of tooltips to improve your experience.`,
  signature: '– Ken',
  tags: ['onboarding', 'tutorial', 'ktech'],
  triggeredBy: 'game_start',
};

// === STRATEGIC CHOICE MESSAGES ===

export const strategicChoiceMessages = {
  open_vs_proprietary: {
    type: 'action',
    sender: characters.cto,
    subject: 'Research Policy Decision',
    body: `We need to make a call on our research policy.

Open means publishing papers, sharing weights, contributing to the commons. We attract idealistic talent and accelerate the field, but we also hand our competitors a roadmap.

Proprietary means patents, trade secrets, competitive moats. Stronger market position, higher margins, but slower research and we'll pay more for top talent who'd rather publish.

This decision is permanent.`,
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
    subject: 'Re: Deployment Philosophy',
    body: `**From:** Dr. Eliza Chen
**CC:** Dennis Babbage, Ada Turing

I'm forwarding Dennis's email from this morning. I think you need to see both sides before making this call.

He's not wrong that our current process has worked so far. And I respect that he's being direct about where he stands. But "so far" is doing a lot of heavy lifting in that sentence.

Our models are more capable now than when we set the current release cadence. The question isn't whether the old process was good enough then. It's whether we *understand what we're shipping* well enough now. Those are different things, and the gap between them grows with every capability gain.

Thorough validation means a slower release cycle. It means watching competitors move faster in the short term. But it also means we catch failure modes before our users do. The kind of safety track record that opens doors instead of closing them.

I know which option looks better on next quarter's numbers. I also know which one I'd want to explain to a room full of people if something goes wrong.

This is a defining choice. I'll respect whatever you decide.

– Eliza

---

**From:** Dennis Babbage
**To:** Dr. Eliza Chen, You
**CC:** Ada Turing

Following up on last week. My position hasn't changed.

We've shipped on an aggressive cycle since day one. It's worked. Our models outperform the competition on every benchmark we track. Emergent abilities are showing up in evaluations we didn't design for them to pass. Customers trust us because we deliver.

Eliza wants to extend the validation window before each release. I understand why. But our evaluation suite already covers the failure modes we know about. I built it. The monitoring pipeline catches regressions in production within hours.

Slowing down has a cost. OpenBrain shipped four times in the last two quarters. Each delay is ground we give up. The lead we have now is not guaranteed to last.

I'm not against safety review. I'm against fixing something that isn't broken.

– Dennis`,
    signature: null,
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
          newsMessage: 'Lab maintains aggressive deployment cadence despite internal safety concerns',
        },
      },
      {
        id: 'careful_validation',
        label: 'Careful Validation',
        effects: {
          strategicChoice: { choiceId: 'rapid_vs_careful', optionId: 'careful_validation' },
          hiddenAlignment: ALIGNMENT.CAREFUL_ALIGNMENT_EFFECT,
          newsMessage: 'Lab slows release cadence for extended safety validation',
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
        tooltip: 'Pause capabilities research for 60s<br>Improves alignment standing',
        effects: {
          pauseCapabilities: { duration: 60000 }, // 60 seconds
          hiddenAlignment: 5,
          choices: { alignmentInvestment: 1 },
        },
      },
      {
        id: 'continue',
        label: 'Continue Research',
        tooltip: 'No mechanical change<br>Worsens alignment standing',
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
    body: `We found a power law relationship between compute, data volume, and model performance. It's precise. Given any two variables, I can derive the third. Verified across every architecture we've tested.

Our training runs have been inefficient. We've been overallocating parameters and underallocating data. Now that we know the ratios, we can get more out of the hardware we already have. Future scaling decisions are arithmetic, not guesswork.

The research team is already replanning the pipeline.`,
    signature: '– Dennis',
    tags: ['research', 'milestone'],
    triggeredBy: 'research_unlock',
  },
  world_models: {
    type: 'info',
    sender: characters.cto,
    subject: 'World Models Online',
    body: `We ran the new architecture through evals it was never trained on. Physics simulations, causal reasoning, spatial tasks. It passed things it has no business passing.

I pulled the intermediate activations to check. The model is building internal representations of how systems behave and applying them to novel inputs. This is not pattern matching. The structure is real.

We went from "interpolate training data" to "reason about the world." Those are different problems. The second one is harder by orders of magnitude, and we just got evidence our models are starting to do it.`,
    signature: '– Dennis',
    tags: ['research', 'milestone', 'capabilities'],
    triggeredBy: 'research_unlock',
  },
};

// === FUNDING MESSAGES ===

export const fundingMessages = {
  series_a_available: {
    type: 'info',
    sender: senders.shannon,
    subject: 'Investor Interest',
    body: `Your revenue numbers crossed a threshold. VCs are calling. Ada Turing, our incoming CFO, has been fielding inquiries. She'll be a better guide through this process than I am.

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
    body: `Growth-stage funds have started reaching out. I have taken a few calls. The interest is genuine, and our position is strong.

Series B is a different animal from what you have done before. The investors are larger, the diligence is more rigorous, and the terms are more complex. I will manage the process. Your job is to keep the research moving whilst I handle the conversations.

I would recommend we move sooner rather than later. Investor enthusiasm does not last forever, and our momentum is strongest right now.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_b',
  },
  series_c_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series C Opportunity',
    body: `Crossover funds and growth equity are in the pipeline. A different class of investor from what we have seen before. Larger cheques, longer time horizons, more patient capital.

The numbers justify a substantial raise. At this level of funding, we could bring on principal-level researchers to lead entire divisions, and begin building our own data centre infrastructure rather than renting. Real institutional scale.

I would not wait too long on this one. These investors move quickly and so should we.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_c',
  },
  series_d_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series D — Late Stage',
    body: `Sovereign wealth funds are in the conversation now. National investment vehicles, pension funds, the sort of capital that does not typically look at private companies our age. I have worked in finance for over fifteen years and I have never personally fielded calls at this level.

To be quite honest, it is a strange feeling. When you first hired me, I thought this would be a three-year engagement. Build the financial infrastructure, get you to profitability, move on. That was the plan. Plans change, apparently.

The interest is real and our position is strong. Let me know when you would like to begin.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_d',
  },
  series_e_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series E — Late Stage',
    body: `I sat in a meeting yesterday with representatives from three different national governments, all competing to be part of this round. Three governments. Competing for us.

When I was at business school, the case studies we admired were companies that reached this stage after decades. We have been at this for a fraction of that. The implied valuation at this round is approaching fifty trillion dollars. I had to write that number out by hand to make sure I wasn't misreading a spreadsheet.

The capital on offer is extraordinary, but so is the dilution. I've modelled the scenarios and I'm comfortable with where we stand. Let me know when you want to move.

One more thing. I'm proud of what we've built here. Not just the numbers. The team, the work, all of it. I don't say that sort of thing often enough.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_e',
  },
  series_g_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series G — Unprecedented Scale',
    body: `I don't know how to write this email.

I have spent my entire career putting numbers into frameworks. Valuation models, discounted cash flows, comparable transactions. That is what I do. That is what I have always done. And for the first time in my professional life, the numbers do not fit into anything I know.

The term sheets coming in are unlike anything I have ever seen. Sovereign wealth funds, national AI programmes, trillion-dollar conglomerates. They are all calling, and they are all competing. The implied valuation is somewhere north of two hundred trillion dollars. That is larger than the GDP of every country on Earth combined. That is not hyperbole. I have checked.

I keep running the models and the models keep telling me things I don't know how to believe. I've had the team verify them twice. The numbers are real. I just don't think the word "valuation" means what it used to mean at this scale. We are entering territory where economics stops being a useful lens, and I'm not sure what replaces it.

You know the drill. Give me a ring when you're ready to talk to them.`,
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

The next board meeting is in two weeks. I'd like to have something to show them.`,
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
        tooltip: `Pause capabilities research for ${durationMonths} months<br>${competitorWillPause ? 'Competitor also pauses' : 'Competitor continues racing'}`,
        effects: {
          moratorium: { id: 'final', action: 'accept' },
        },
      },
      {
        id: 'reject_moratorium',
        label: 'Continue Research',
        tooltip: 'No research pause<br>Worsens alignment standing',
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
        tooltip: `Pause capabilities research for ${durationMonths} months<br>Improves alignment standing<br>Competitor continues racing`,
        effects: {
          moratorium: { id: moratoriumId, action: 'accept' },
          hiddenAlignment: 2,
          newsMessage: 'Lab announces voluntary capability pause for safety review',
        },
      },
      {
        id: 'reject_moratorium',
        label: 'Continue Research',
        tooltip: 'No research pause<br>Competitor pulls ahead regardless',
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
  body: `We have drawn on our line of credit to cover the shortfall. I have frozen all new purchases until we are back in the black.

You need to reduce spending. Furlough personnel or scale back compute. Interest is accruing at 20% APR.

Once we hit our limit, the firm will be forcibly liquidated. I suggest we avoid that.`,
  signature: '– Ada',
  priority: 'normal',
  tags: ['economics', 'credit'],
  triggeredBy: 'credit_warning',
  choices: [
    { id: 'acknowledge', label: 'Understood', effects: [],
      tooltip: 'Dismiss this warning. Purchases remain frozen until funding is positive.' },
    { id: 'furlough_all', label: 'Emergency Austerity',
      tooltip: 'Set all automation targets to zero. Staff and compute will be furloughed to cut costs.' },
  ],
};

export const creditWarningPreAdaMessage = {
  type: 'action',
  sender: senders.finance_office,
  subject: 'Budget Overrun Notice',
  body: `Your lab account has exceeded its allocated budget. Per university policy, a line of credit has been extended against your department's grant allocation.

All new purchases have been frozen pending budget review. Interest accrues at the standard institutional rate (20% APR).

A budget reconciliation meeting has been scheduled. If the balance reaches the credit limit, standard departmental review procedures will apply.`,
  signature: '– Office of Financial Services',
  priority: 'normal',
  tags: ['economics', 'credit'],
  triggeredBy: 'credit_warning',
  choices: [
    { id: 'acknowledge', label: 'Understood', effects: [],
      tooltip: 'Dismiss this warning. Purchases remain frozen until funding is positive.' },
    { id: 'furlough_all', label: 'Emergency Austerity',
      tooltip: 'Set all automation targets to zero. Staff and compute will be furloughed to cut costs.' },
  ],
};

// === ALIGNMENT TAX MESSAGE ===

export const alignmentTaxActionMessage = {
  sender: senders.turing,
  subject: 'Revenue impact from safety constraints',
  body: 'Post-safety-update financials are in. Revenue down 12%. Users are churning faster than expected. The constraints are working as intended, but that\'s a real margin hit. Operating profit just went negative. We can absorb it short-term, but this trajectory puts us back in fundraising territory within two quarters.',
  signature: '– Ada',
  choices: [
    { id: 'revert', label: 'Revert safety constraints', effects: '+20% revenue for 120s, -500 alignment RP',
      tooltip: '+20% revenue for 120s<br>−500 alignment research points' },
    { id: 'hold', label: 'Hold firm', effects: '-10% revenue for 120s',
      tooltip: '−10% revenue for 120s<br>Maintains current safety constraints' },
  ],
  priority: 'normal',
  tags: ['alignment', 'revenue'],
  triggeredBy: 'alignment_tax',
};

// === KEN'S JOB APPLICATION ===

export const kenJobApplicationMessage = {
  type: 'action',
  sender: senders.ktech,
  subject: 'Remember me?',
  body: `Hey, it's ya boy Ken. In case you forgot, I built the app that you're using right now. Pretty nice, right?

Well, it turns out the market for highly bespoke AI research startup lab operations software is not super large. You're my biggest customer by far, and unfortunately, I gave it to you for free. Oops.

Anyways, I've been doing my own AI work on the side, and I think I could be useful on the research and product side too. If you're hiring... you know how to [reach me](#ken-email).

Totally fine if not. I'll keep the dashboard running either way.`,
  signature: '– Ken',
  priority: 'normal',
  tags: ['ktech', 'easter-egg'],
  triggeredBy: 'ken_job_application',
  choices: [
    {
      id: 'hire',
      label: 'Hire',
      tooltip: '+1 researcher :)',
      effects: {
        grantResearcher: 1,
        newsMessage: 'Lab hires independent developer from operations vendor',
      },
    },
    {
      id: 'ignore',
      label: 'Politely ignore',
      tooltip: ':(',
      effects: {},
    },
  ],
};

// Export all message templates for easy access
export const allMessageTemplates = {
  strategicChoices: strategicChoiceMessages,
  alignmentWarnings: alignmentWarningMessages,
  researchMilestones: researchMilestoneMessages,
  funding: fundingMessages,
  board: boardMessages,
  creditWarning: creditWarningMessage,
  moratoriums: moratoriumMessages,
};
