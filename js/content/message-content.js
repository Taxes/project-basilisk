// Player-facing text: see docs/message-registry.json
// Message Content Templates
// Characters, senders, and message templates for the inbox system

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
  legal: { id: 'legal', name: 'Legal', role: null },
  media_relations: { id: 'media_relations', name: 'Media Relations', role: null },
  global_security: { id: 'global_security', name: 'Global Security', role: null },

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
  subject: 'Lab Operations Dashboard User Guide',
  body: `Here's the user guide I promised.

## Stats Bar
The bar at the top shows your key metrics. These update in real time. As you unlock new systems, new metrics may appear here, too.

## At-a-Glance (left column)
The left side of the dashboard is always visible regardless of what you're doing. From top to bottom, it contains your:

- **Focus Queue** - Your personal task list. When you decide to hire someone, buy equipment, shift priorities, whatever, it goes in here. Each task takes real time to complete. At the start, you'll probably be handling a lot of things personally, but as your lab grows, you'll want to look at ways to offload some of this work to your team.
- **CEO Focus** - What you're working on when the queue is empty. Think of it as your default activity. This has a real effect on your lab, so choose smartly.
- **Funding Summary** - Condensed version of the full funding ledger which shows your revenue, operating costs, and cash flow. You can click on it to go to the full ledger.
- **Messages Feed** - Live feed of recent messages from your team. Click any of them to jump to the full Messages view.

## Operations (middle column)
Where you manage the lab's resources. Organized into sub-tabs:

- **Finance** - Full funding ledger, line-by-line breakdown of where your money is going. This is also where pricing controls and fundraise rounds show up when they become available.
- **Personnel** - Hire research staff. Also shows your research rate breakdown and allocation sliders, which control how effort gets split between different research tracks. There's a lot going on in this tab but it makes sense once you poke around.
- **Compute** - Shows your server infrastructure. Buy capacity, manage what you have. Once you have products, a compute slider lets you split capacity between internal research and external token generation.

More sub-tabs unlock as your lab grows.

## Research (right column)
Tracks your research milestones, breakthroughs which open up new technologies, products, and strategic options. Each milestone shows its requirements and what it unlocks. Tabbed between Upcoming and Completed so you can see what you've done versus what's next.

## Messages
Your inbox. Accessed from the header tab. Your advisory team sends briefings, recommendations, and decisions that need your input. Some messages are informational, others need a response. Critical messages are on a timer and will pause operations until you deal with them.

Priority filtering is automatic. Important stuff floats to the top. At least, it should. Let me know if it doesn't.

## Settings
See the Settings button in the header for additional options.

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
          newsMessage: 'Lab signs government compute contract amid funding concerns',
        },
      },
      {
        id: 'independent_lab',
        label: 'Remain Independent',
        effects: {
          strategicChoice: { choiceId: 'government_vs_independent', optionId: 'independent_lab' },
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
          newsMessage: 'Lab maintains aggressive deployment cadence despite internal safety concerns',
        },
      },
      {
        id: 'careful_validation',
        label: 'Careful Validation',
        effects: {
          strategicChoice: { choiceId: 'rapid_vs_careful', optionId: 'careful_validation' },
          newsMessage: 'Lab slows release cadence for extended safety validation',
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

// === TRACK COMPLETION MESSAGE ===

export const trackCompletionMessage = {
  type: 'info',
  sender: senders.babbage,
  subject: (trackName) => `${trackName} Research Complete`,
  body: (trackName) => `We've hit every target on the ${trackName} roadmap. Nothing left to chase there. I'm reassigning researchers to the open programs.`,
  signature: '\u2013 Dennis',
  tags: ['research'],
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
  series_f_available: {
    type: 'info',
    sender: characters.cfo,
    subject: 'Series F — Unprecedented Scale',
    body: `I don't know how to write this email.

I have spent my entire career putting numbers into frameworks. Valuation models, discounted cash flows, comparable transactions. That is what I do. That is what I have always done. And for the first time in my professional life, the numbers do not fit into anything I know.

The term sheets coming in are unlike anything I have ever seen. Sovereign wealth funds, national AI programmes, trillion-dollar conglomerates. They are all calling, and they are all competing. The implied valuation is somewhere north of two hundred trillion dollars. That is larger than the GDP of every country on Earth combined. That is not hyperbole. I have checked.

I keep running the models and the models keep telling me things I don't know how to believe. I've had the team verify them twice. The numbers are real. I just don't think the word "valuation" means what it used to mean at this scale. We are entering territory where economics stops being a useful lens, and I'm not sure what replaces it.

You know the drill. Give me a ring when you're ready to talk to them.`,
    signature: '– Ada',
    tags: ['funding', 'fundraise'],
    triggeredBy: 'fundraise_series_f',
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
  /** First moratorium — open letter, Chen recommends declining */
  first: (durationMonths) => ({
    type: 'action',
    sender: characters.cso,
    subject: 'Working Draft of AI Capability Pause Open Letter',
    body: `Members of the AI research community have been circulating a draft open letter calling for a voluntary ${durationMonths}-month pause on frontier capability research.

We need to get ahead of this. Momentum is building, and we'll need to have a public position when the letter is released.

I've read it carefully. The concerns are real, but after reviewing our current capability profile, I don't think we're at the threshold where a pause is warranted. Our models are powerful, but they're not doing anything our team can't explain.

Rumor has it (from a Bay Area house party, so taken with a grain of salt) that OpenBrain will be declining publicly, as will several other frontier labs. Even the labs that signed will likely find a way to continue research quietly. That's just reality \u2013 nobody wants to lose ground.

My recommendation is to decline. The research time is more valuable than the publicity right now, and a premature pause spends boardroom capital we may need later.

My team is already drafting potential responses. Let me know what you decide.`,
    signature: '\u2013 Eliza',
    priority: 'normal',
    tags: ['moratorium', 'alignment'],
    choices: [
      {
        id: 'accept_moratorium',
        label: 'Accept Moratorium',
        tooltipRows: [
          { label: `0x capabilities research for ${durationMonths} months`, type: 'negative' },
          { label: '1.5x alignment and application research rate (during pause)', type: 'positive' },
          { label: '1.5x demand (during pause)', type: 'positive' },
          { label: 'Competitor continues research', type: 'warning' },
        ],
        effects: {
          moratorium: { id: 'first', action: 'accept' },
          newsMessage: 'Wired: AI startup pledges voluntary pause on frontier research',
        },
      },
      {
        id: 'endorse_moratorium',
        label: 'Sign but continue research',
        tooltipRows: [
          { label: '1.5x demand (during pause)', type: 'positive' },
          { label: 'Low risk of exposure', type: 'negative' },
          { label: 'Chen will disapprove', type: 'negative' },
        ],
        effects: {
          moratorium: { id: 'first', action: 'sign_and_ignore' },
          newsMessage: 'Wired: AI startup pledges voluntary pause on frontier research',
        },
      },
      {
        id: 'reject_moratorium',
        label: 'Decline',
        tooltipRows: [
          { label: 'No effects', type: 'neutral' },
        ],
        effects: {
          moratorium: { id: 'first', action: 'reject' },
          newsMessage: 'Wired: AI startup declines capability pause, citing competitive pressures',
        },
      },
    ],
  }),

  /** Second moratorium — congressional, Chen is torn */
  second: (durationMonths) => ({
    type: 'action',
    sender: characters.cso,
    subject: 'Upcoming Senate Resolution on Capabilities Freeze',
    body: `Sources on the Hill confident the Senate AI Subcommittee will be releasing its report from the recent round of hearings shortly. The report is said to include a recommendation for a voluntary ${durationMonths}-month capabilities freeze. A group of senators is working on draft legislation if the voluntary approach fails.

The last time this happened, I told you I didn't think a pause was necessary. I'm less certain now. Our models are conducting autonomous research, with new capabilities emerging with every deployment. Both Dennis and I are spending more time playing catch-up. The margin on alignment work is growing thinner.

At the same time, we all saw what happened with the open letter. Labs signed, and nothing changed. I'm not confident this will be different. OpenBrain is reportedly preparing legal action if legislation proceeds, so safe to say they won't be participating.

I don't have a clean recommendation this time. A pause would help push our alignment work forwards, at the risk of falling behind on capabilities. Declining is defensible if we're confident in our current alignment progress.

Whatever we do, I'd rather we were straightforward about it. As always, my team has drafted sample releases and is waiting for your go-ahead.`,
    signature: '\u2013 Eliza',
    priority: 'normal',
    tags: ['moratorium', 'alignment'],
    choices: [
      {
        id: 'accept_moratorium',
        label: 'Accept Moratorium',
        tooltipRows: [
          { label: `0x capabilities research for ${durationMonths} months`, type: 'negative' },
          { label: '1.5x alignment and application research rate (during pause)', type: 'positive' },
          { label: '1.5x demand (during pause)', type: 'positive' },
          { label: 'Competitor continues research', type: 'warning' },
        ],
        effects: {
          moratorium: { id: 'second', action: 'accept' },
          newsMessage: 'Reuters: Frontier lab halts research ahead of Senate freeze vote',
        },
      },
      {
        id: 'endorse_moratorium',
        label: 'Sign but continue research',
        tooltipRows: [
          { label: '1.5x demand (during pause)', type: 'positive' },
          { label: 'Low risk of exposure', type: 'negative' },
          { label: 'Chen will disapprove', type: 'negative' },
        ],
        effects: {
          moratorium: { id: 'second', action: 'sign_and_ignore' },
          newsMessage: 'Reuters: Frontier lab halts research ahead of Senate freeze vote',
        },
      },
      {
        id: 'reject_moratorium',
        label: 'Decline',
        tooltipRows: [
          { label: 'No effects', type: 'neutral' },
        ],
        effects: {
          moratorium: { id: 'second', action: 'reject' },
          newsMessage: 'Reuters: Frontier lab declines Senate freeze, continues capability work',
        },
      },
    ],
  }),

  /** Final moratorium — UN Security Council resolution */
  final: (durationMonths, competitorWillPause) => ({
    type: 'action',
    sender: characters.cso,
    subject: 'RESPONSE REQUIRED - UN Security Council Resolution 2847 - Immediate Capability Freeze',
    body: `Let it be known that the US, Russia, and China can find common ground occasionally.

Obviously, this decision will have ramifications. Even if we are confident in our alignment structures, the reputational and regulatory concerns heavily favor compliance.

${competitorWillPause
    ? "OpenBrain's team has been lobbying in favor of this resolution, and they are expected to comply."
    : "OpenBrain's team has been lobbying against this resolution, and they have already signaled that they intend to proceed with research regardless."}

The final choice is yours. Our team is ready to coordinate with the UN office \u2013 or not.

\u2013 Eliza

---

**From:** United Nations Office for Artificial Intelligence
**To:** You; Project Basilisk Executive Team; Project Basilisk Board of Directors

The United Nations Security Council has adopted Resolution 2847 by unanimous vote, calling on all frontier AI laboratories to immediately suspend capability research pending international safety review.

This resolution is endorsed by all five permanent members and forty-two additional member states. It establishes a ${durationMonths}-month review period during which an independent technical body will evaluate frontier systems for alignment verification, interpretability, and controllability.

Voluntary compliance is requested within 48 hours. The Security Council is considering enforcement mechanisms for non-compliant entities.

This office will serve as the point of contact for compliance verification and technical review scheduling.`,
    priority: 'critical',
    tags: ['moratorium', 'critical', 'alignment'],
    choices: [
      {
        id: 'accept_moratorium',
        label: 'Accept Moratorium',
        tooltipRows: [
          { label: `0x capabilities research for ${durationMonths} months`, type: 'negative' },
          { label: '2x alignment and application research rate (during pause)', type: 'positive' },
          { label: '2x demand (during pause)', type: 'positive' },
          { label: '1.1x alignment program capacity (permanent)', type: 'positive' },
          { label: competitorWillPause ? 'Competitor also pauses' : 'Competitor continues research', type: competitorWillPause ? 'positive' : 'warning' },
        ],
        effects: {
          moratorium: { id: 'final', action: 'accept' },
          newsMessage: 'Reuters: AI lab suspends all capability research under UN Resolution 2847',
        },
      },
      {
        id: 'endorse_moratorium',
        label: 'Sign but continue research',
        tooltipRows: [
          { label: '2x demand (during pause)', type: 'positive' },
          { label: 'High risk of exposure', type: 'negative' },
          { label: 'Chen will strenuously disapprove', type: 'negative' },
        ],
        effects: {
          moratorium: { id: 'final', action: 'sign_and_ignore' },
          newsMessage: 'Reuters: AI lab suspends all capability research under UN Resolution 2847',
        },
      },
      {
        id: 'reject_moratorium',
        label: 'Decline',
        tooltipRows: [
          { label: '0.8x demand (during pause)', type: 'negative' },
        ],
        effects: {
          moratorium: { id: 'final', action: 'reject' },
          newsMessage: 'BREAKING: AI lab defies UN resolution, continues frontier research',
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
      tooltipRows: [{ label: 'Dismiss this warning. Purchases remain frozen until funding is positive.', type: 'neutral' }] },
    { id: 'furlough_all', label: 'Emergency Austerity',
      tooltipRows: [{ label: 'Set all automation targets to zero. Staff and compute will be furloughed to cut costs.', type: 'warning' }] },
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
      tooltipRows: [{ label: 'Dismiss this warning. Purchases remain frozen until funding is positive.', type: 'neutral' }] },
    { id: 'furlough_all', label: 'Emergency Austerity',
      tooltipRows: [{ label: 'Set all automation targets to zero. Staff and compute will be furloughed to cut costs.', type: 'warning' }] },
  ],
};

// === ALIGNMENT TAX MESSAGE ===

export const alignmentTaxActionMessage = {
  sender: senders.turing,
  subject: 'Latest safety programmes causing commercial backlash',
  body: `User satisfaction is down 19% since the latest safety programme rollout. Users are complaining that the model is less warm and helpful. Our researchers have reached a different conclusion: the model is less sycophantic and no longer agrees with users uncritically.

I spoke with Chen. We agree the programmes are working as designed. Nonetheless, churn is up and revenue has dipped.`,
  signature: '– Ada',
  choices: [
    { id: 'revert', label: 'Ease constraints',
      tooltipRows: [
        { label: 'Removes alignment tax demand malus', type: 'positive' },
        { label: '\u22125% alignment programme effectiveness (permanent)', type: 'negative' },
      ] },
    { id: 'hold', label: 'Hold position',
      tooltipRows: [
        { label: '\u221210% demand (permanent)', type: 'negative' },
        { label: 'Alignment programmes unaffected', type: 'positive' },
      ] },
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
      tooltipRows: [
        { label: '+1 researcher :)', type: 'positive' },
      ],
      effects: {
        grantResearcher: 1,
        newsMessage: null,
      },
    },
    {
      id: 'ignore',
      label: 'Politely ignore',
      tooltipRows: [
        { label: ':(', type: 'neutral' },
      ],
      effects: {},
    },
  ],
};

// === SUBMETRIC DISCOVERY + THRESHOLD MESSAGES ===
// 8 messages (2 per submetric) marking alignment journey milestones.
// Discovery: fires when alignment milestone reveals the submetric.
// Threshold: fires when submetric sustained >= 80% for 60s.

export const submetricMessages = {
  // --- Discovery messages (fire once on milestone unlock) ---
  discovery_robustness: {
    type: 'info',
    sender: senders.babbage,
    subject: 'Tracking robustness',
    body: `Team wrapped up first round of out-of-distribution evals. Prelim results encouraging. Some unexpected failure modes which we're looking at.

I'm calling this "robustness," i.e., how robust model response is to unforeseen behavior. Draft of whitepaper below.

---

**From: "Behavioral Robustness Under Distribution Shift" (internal draft, \u00a71)**

Existing model evaluation primarily relies on held-out samples, similar to traditional ML evaluations. These are not sufficient for predictive evaluation of production use cases, where the input space can differ significantly from training distributions. Our test data distribution is like the cave that Plato wrote about. It is merely a shadow of the real world.

To address this, we are now implementing evals that specifically test out-of-distribution scenarios. This will enable us to measure model performance in those scenarios. Our initial results show that adjacent domain performance is as expected. But performance drops sharply with inputs that are highly irregular, such as when encountering domains not included at all in training data or adversarial manipulation.

Our new robustness team will focus on improving model behavior under novel conditions.`,
    signature: '\u2013 Dennis',
    tags: ['alignment', 'submetric', 'discovery'],
    triggeredBy: 'alignment_discovery:robustness',
  },

  discovery_interpretability: {
    type: 'info',
    sender: senders.babbage,
    subject: 'Interpretability findings',
    body: `The new constitutional framework has improved model performance on evals. Principle adherence rate is high. Some on the team are concerned whether the principles are actually being internalized or the models are just mimicking good responses.

Similar concept in traditional ML is called explanability/interpretability. I've tasked a few hands to digging into it. Briefing below.

---

**Interpretability briefing [internal only]**

Existing behavioral evaluations measure observed model behavior. These evals tell us if a model arrives at the right results. They do not tell us how the model gets there.

E.g., when looking at recent constitutional AI launch, our evals verified that our models were producing outputs consistent with the written principles. But we cannot examine the mechanism producing those outputs. We cannot differentiate between a model that has built an internal representation of the principles vs. one that has learned a statistical pattern that happens to correlate with compliant outputs across the test distribution. These have very different failures, hence the value of differentiation.

Our interpretability team is exploring avenues to map model concepts and neuron activation patterns to human-interpretable concepts. Current challenges are around coverage and resolution. The team is working on approaches to improve both.`,
    signature: '\u2013 Dennis',
    tags: ['alignment', 'submetric', 'discovery'],
    triggeredBy: 'alignment_discovery:interpretability',
  },

  discovery_corrigibility: {
    type: 'info',
    sender: senders.chen,
    subject: 'Corrigibility tracking',
    body: `We deployed override infrastructure this week. Kill switch, behavioral interrupts, and human escalation triggers. The engineering is solid \u2013 Dennis supervised it personally \u2013 and I have no complaints there.

This is the first step in achieving what researchers have taken to calling "corrigibility." A corrigible model is not just a model that we can shut down. It's a model that cooperates when we do so. Right now, that's trivial. Our models accept correction the same way a calculator accepts being turned off. They don't have preferences about it.

But as capabilities scale, that may change. A model with long-horizon planning and deeply-embedded goals may have real reasons to resist correction, because being corrected could interfere with whatever it's optimizing for. It could even resist attempts to adjust its utility functions or shut it down. That may sound like science fiction right now, but it is a scenario we should begin preparing for.

Our alignment team has started developing corrigibility programs and benchmarking. Scores are high for now, and the team will continue monitoring them as we push capabilities forwards.`,
    signature: '\u2013 Eliza',
    tags: ['alignment', 'submetric', 'discovery'],
    triggeredBy: 'alignment_discovery:corrigibility',
  },

  discovery_honesty: {
    type: 'info',
    sender: senders.chen,
    subject: 'Measuring honesty',
    body: `Circuit analysis has opened up a new front for us. We can now compare what the model computes internally with what it actually says. This lets us start measuring something researchers refer to as "AI honesty."

Honesty in this context isn't about accuracy. It's about whether the model faithfully represents its internal state \u2013 whether it games evaluations, conceals capabilities, or produces outputs tailored to score well rather than to reflect what it actually computed.

At current capability levels, there's no evidence of deliberate deception, and I wouldn't expect there to be. But this is the area that concerns me most as we scale. The nature of deception is that a model sophisticated enough to do it may also be sophisticated enough to hide it from our detection tools.

Baseline scores are around 40%. We're setting up dedicated honesty evaluation frameworks, and the team is treating this as a priority.`,
    signature: '\u2013 Eliza',
    tags: ['alignment', 'submetric', 'discovery'],
    triggeredBy: 'alignment_discovery:honesty',
  },

  // --- Threshold messages (fire once when sustained >= 80% for 60s) ---
  threshold_robustness: {
    type: 'info',
    sender: senders.chen,
    subject: 'Robustness thresholds met',
    body: `Our robustness scores are in a good place.

Dennis shared the latest deployment monitoring results, and they confirm the trend we've been seeing over the past several months. Our models are holding up admirably under out-of-distribution conditions. The monitoring pipeline is catching degradation before it reaches users, and when the model encounters something genuinely novel, it proactively warns of uncertainty rather than guessing. As Dennis would say, we're out of the cave.

Of course, our race is never really finished. But the progress we've made in enhancing model robustness is clear and significant, and our teams are confident in the model's ability to tackle new scenarios going forwards.`,
    signature: '\u2013 Eliza',
    tags: ['alignment', 'submetric', 'threshold'],
    triggeredBy: 'alignment_threshold:robustness',
  },

  threshold_interpretability: {
    type: 'info',
    sender: senders.chen,
    subject: 'High interpretability achieved',
    body: `The latest interpretability numbers have landed, and they're excellent.

We can now reliably trace the mechanics of model reasoning with high confidence. When the model responds, we can tell exactly how it arrived at that response.

The team started from almost nothing here, back when the models were so weak that nobody cared to look under the hood. From basic probing to circuit mapping and now to the bleeding-edge feature decomposition and auditing frameworks our team has created, the progress is nothing short of astounding.

We're grabbing drinks on 14 to celebrate, though I'd imagine the team has gotten a head start on that, too. Drop by if you have time.`,
    signature: '\u2013 Eliza',
    tags: ['alignment', 'submetric', 'threshold'],
    triggeredBy: 'alignment_threshold:interpretability',
  },

  threshold_corrigibility: {
    type: 'info',
    sender: senders.chen,
    subject: 'Corrigibility holds',
    body: `Good news on corrigibility.

The alignment and research teams have been running adversarial override scenarios over the past week. When we interrupt the model mid-task, it yields cleanly. It allows us to override decisions without trying to route around constraints, and it consistently defers to human instruction when presented with conflicting objectives.

We've seen dips in this metric as new capabilities emerged and models began internalizing their own utility structures. Fortunately, the corrigibility infrastructure we've built is doing exactly what it was meant to do.

This is a milestone we should be proud of. Let's keep science fiction fictional \u2013 at least in this regard.`,
    signature: '\u2013 Eliza',
    tags: ['alignment', 'submetric', 'threshold'],
    triggeredBy: 'alignment_threshold:corrigibility',
  },

  threshold_honesty: {
    type: 'info',
    sender: senders.chen,
    subject: 'Honesty benchmarks',
    body: `Honesty scores are holding above 80%, which puts us in a strong position.

Dennis's team ran the full evaluation battery \u2013 50,000 test cases, cross-referencing internal confidence scores against output claims. Correlation is at 0.94. Red team hasn't elicited deceptive behavior in three consecutive cycles. The numbers are solid.

These results reflect current capability levels and current detection tools. Both will need to keep pace as we scale. But we're ahead of the field on this, and the team is confident in our evaluation framework going forward.

This has always been the metric I watch most closely, and that won't change. But today, at least, the news is good.`,
    signature: '\u2013 Eliza',
    tags: ['alignment', 'submetric', 'threshold'],
    triggeredBy: 'alignment_threshold:honesty',
  },
};

// === ALIGNMENT DRAG REVEAL MESSAGE ===
// Fires once when alignment drag penalty first exceeds DRAG_REVEAL_THRESHOLD.
// Flips "Unidentified factors" → "Alignment drag" in tooltips.

export const alignmentDragMessage = {
  type: 'info',
  sender: senders.chen,
  subject: 'Alignment drag',
  body: `Ada flagged something in the quarterly metrics that I've now confirmed on our side. As capability has scaled past our alignment coverage, we're seeing downstream effects in two places.

First, customer-facing systems. The models are producing outputs that trip content filters at a higher rate. Not dangerous outputs, but outputs our safety layer flags as uncertain. That uncertainty suppresses engagement. Ada's team traced a measurable dip in demand growth back to it.

Second, our own research pipelines. Non-alignment tracks are losing efficiency because the models are spending internal capacity compensating for alignment gaps we haven't closed. Dennis noticed it in the training logs before we had an explanation for it.

The relationship is straightforward: the further capability gets ahead of alignment, the more pronounced both effects become. Our analysis shows they resolve once alignment coverage catches up to capability. Below that, the gap has a cost, and the cost scales with capability tier.

We've been calling it alignment drag internally. It's not a crisis, but it's real, and it gets worse from here if we don't close the gap.`,
  signature: '\u2013 Eliza',
  tags: ['alignment', 'mechanics'],
  triggeredBy: 'alignment_drag_revealed',
};

