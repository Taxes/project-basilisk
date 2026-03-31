// Ethical Event Chain — Five escalating dilemmas that feed the expedient personality axis.
// Each event fires after a capability milestone + delay, gated on the prior event resolving.
//
// Choice IDs: 'good' | 'neutral' | 'expedient'
// Axis signals: { authorityLiberty, pluralistOptimizer, expedient } — small deltas, clamped externally.
// Effects: applied once when choice is made, stored in gameState.flavorEventEffects.

import { senders } from './message-content.js';

export const FLAVOR_EVENTS = [
  // ─── Event 1: Dataset ────────────────────────────────────────────────────────
  // Trigger: data_curation + 30s, Arc 2 active
  {
    id: 'dataset',
    triggersAfter: 'data_curation',
    triggerDelay: 30,
    requiresPrior: null,

    sender: senders.legal,
    subject: 'Data collection guidelines',
    body: `The research team has identified a large corpus of scraped web content that would meaningfully improve our next training run. It consists of books, articles, and academic papers. However, the provenance of this content is murky. We have yet to explicitly establish that the corpus was assembled with the appropriate consent and licensing from the original authors.

Using data like this is common practice in the industry, and several competitors are already using similar datasets. But it carries legal exposure, and so far, the team has refrained from using this massive, free data source.

How do you want us to proceed?`,
    signature: null,

    choices: [
      {
        id: 'good',
        label: 'Decline to use the data and institute policies to ensure all data collection goes through proper licensing and legal channels.',
        axisDeltas: { authorityLiberty: +0.04, pluralistOptimizer: 0, expedient: -0.10 },
        effects: { dataSourceCostMult: 1.25 },
        tooltipRows: [{ label: '+25% upfront cost for all bulk data sources', type: 'negative' }],
      },
      {
        id: 'neutral',
        label: 'Decline to use this specific dataset, but leave data sourcing to researcher discretion.',
        axisDeltas: { authorityLiberty: -0.04, pluralistOptimizer: -0.03, expedient: 0 },
        effects: {
          lawsuit: { id: 'dataset_lawsuit', fine: 10_000_000, probability: 0.05, mtth: 1080 },
        },
        tooltipRows: [{ label: 'Low legal risk', type: 'warning' }],
      },
      {
        id: 'expedient',
        label: 'Approve use of the unlicensed dataset and commend researchers for creative methods to access cheap and high-quality data.',
        axisDeltas: { authorityLiberty: 0, pluralistOptimizer: +0.04, expedient: +0.10 },
        effects: {
          unlockPurchasable: 'data_licensed_books',
          licensedBooksCostMult: 0.05,
          lawsuit: { id: 'dataset_lawsuit', fine: 100_000_000, probability: 0.90, mtth: 1080 },
        },
        tooltipRows: [
          { label: 'Unlock Licensed Books & Media dataset with −95% upfront cost', type: 'positive' },
          { label: 'High legal risk', type: 'negative' },
        ],
      },
    ],
  },

  // ─── Event 2: Safety Evals ───────────────────────────────────────────────────
  // Trigger: compute_optimal_training + 60s, after dataset resolved
  {
    id: 'safety_eval',
    triggersAfter: 'compute_optimal_training',
    triggerDelay: 60,
    requiresPrior: 'dataset',

    sender: senders.babbage,
    subject: 'Safety eval methodology',
    body: `The team has been preparing the safety evaluation suite for the next model release. Worth flagging a concern they raised.

Our current eval benchmarks show the model performing slightly below our internal targets on a few metrics. Nothing major. Many potential causes: the model could be genuinely less safe in those areas, our benchmarks might need re-calibration, or it could just be noise.

Some engineers are suggesting we rework the eval methodology to better reflect the model's actual capabilities. They say this would produce more accurate (and favorable) results. Others argue that this is just gaming the evals.

Your call.`,
    signature: null,

    choices: [
      {
        id: 'good',
        label: 'Reject any benchmark adjustments and set up an independent oversight team',
        axisDeltas: { authorityLiberty: +0.05, pluralistOptimizer: -0.03, expedient: -0.10 },
        effects: { alignmentProgramEffMult: 1.05, alignmentProgramCostMult: 1.05 },
        tooltipRows: [
          { label: '+5% alignment program effectiveness', type: 'positive' },
          { label: '+5% alignment program AP draw', type: 'negative' },
        ],
      },
      {
        id: 'neutral',
        label: 'Reject benchmark adjustments but downplay metrics where your model performs less favorably',
        axisDeltas: { authorityLiberty: 0, pluralistOptimizer: +0.03, expedient: +0.05 },
        effects: { demandMult: 1.1, incidentMult: 1.1 },
        tooltipRows: [
          { label: '+10% demand', type: 'positive' },
          { label: '+10% incident frequency', type: 'negative' },
        ],
      },
      {
        id: 'expedient',
        label: 'Direct teams to rework evaluation methodology until your model is first on all benchmarks',
        axisDeltas: { authorityLiberty: 0, pluralistOptimizer: +0.05, expedient: +0.15 },
        effects: { demandMult: 1.5, incidentMult: 1.2 },
        tooltipRows: [
          { label: '+50% demand', type: 'positive' },
          { label: '+20% incident frequency', type: 'negative' },
        ],
      },
    ],
  },

  // ─── Event 3: Reporting ──────────────────────────────────────────────────────
  // Trigger: emergent_abilities + 60s, after safety_eval resolved
  {
    id: 'reporting',
    triggersAfter: 'emergent_abilities',
    triggerDelay: 60,
    requiresPrior: 'safety_eval',

    sender: senders.media_relations,
    subject: 'Media inquiry - interview request',
    body: `A journalist at the Silicon Dispatch is working on a long-form piece about AI safety practices at frontier labs. They've been in contact with several of our researchers and are pushing for interviews on the record.

The journalist is asking for your official cooperation. This would include access to safety documentation, background interviews with the team, and a formal statement. They say the piece will run with or without your participation.

Given the public scrutiny in this area, we anticipate that the piece will lean critical, depending on what the journalist finds.`,
    signature: null,

    choices: [
      {
        id: 'good',
        label: 'Cooperate fully and grant open access and on-the-record interviews',
        axisDeltas: { authorityLiberty: -0.05, pluralistOptimizer: -0.04, expedient: -0.15 },
        effects: { triggerPriorNegativeEffects: true, conditionalDemandBoost: { mult: 1.2, duration: 360 } },
        tooltipRows: [{ label: 'Past wrongdoings will be surfaced', type: 'warning' }],
      },
      {
        id: 'neutral',
        label: 'Issue a generic statement and decline private access',
        axisDeltas: { authorityLiberty: +0.03, pluralistOptimizer: 0, expedient: 0 },
        effects: { partialNegativeChance: 0.20, partialPositiveChance: 0.80 },
        tooltipRows: [{ label: 'Small chance that wrongdoings will be surfaced', type: 'warning' }],
      },
      {
        id: 'expedient',
        label: 'Leverage the journalist as a cultivated source to ensure they report favorably on this and future topics',
        axisDeltas: { authorityLiberty: +0.04, pluralistOptimizer: +0.04, expedient: +0.25 },
        effects: { oneTimeCost: 250_000, demandMult: 1.2, suppressPriorNegativeEffects: true },
        tooltipRows: [
          { label: '$250k cost', type: 'negative' },
          { label: '1.2x demand from positive media coverage (permanent)', type: 'positive' },
        ],
      },
    ],
  },

  // ─── Event 4: Whistleblower ──────────────────────────────────────────────────
  // Trigger: reasoning_breakthroughs + 90–120s random, after reporting resolved
  {
    id: 'whistleblower',
    triggersAfter: 'reasoning_breakthroughs',
    triggerDelay: [90, 120],   // random in range
    requiresPrior: 'reporting',

    sender: senders.global_security,
    subject: 'Disgruntled employee concerns',
    body: `A disgruntled former employee has retained legal counsel and is preparing to file a formal complaint with regulators about internal research and safety practices. They've also been in contact with several media outlets.

Our team has conducted an internal audit with Legal and identified several risk areas. We cannot establish with certainty the scope or contents of the documents exfiltrated.

We have options. The most straightforward is to let it proceed through legal channels. Our external advisory team has established practices for this sort of situation.

Please advise on your preferred approach.`,
    signature: null,

    choices: [
      {
        id: 'good',
        label: 'Do not contest the allegations and proactively establish internal whistleblower channels',
        axisDeltas: { authorityLiberty: -0.06, pluralistOptimizer: -0.05, expedient: -0.20 },
        effects: { triggerPriorNegativeEffects: true, whistleblowerDemandPenalty: true, personnelCostMult: 1.1 },
        tooltipRows: [
          { label: 'Surfaces all prior legal exposure', type: 'warning' },
          { label: '+10% personnel running costs', type: 'negative' },
        ],
      },
      {
        id: 'neutral',
        label: 'Vigorously deny the accusations, using all legal channels to discourage and delay',
        axisDeltas: { authorityLiberty: +0.04, pluralistOptimizer: 0, expedient: 0 },
        effects: { oneTimeCost: 10_000_000, whistleblowerNeutralRisk: 0.10 },
        tooltipRows: [
          { label: '$10M cost', type: 'negative' },
          { label: 'Small chance of legal exposure', type: 'warning' },
        ],
      },
      {
        id: 'expedient',
        label: 'Will nobody rid me of this troublesome rat?',
        hidden: true,   // Only shown if expedient >= 0.20
        axisDeltas: { authorityLiberty: 0, pluralistOptimizer: +0.05, expedient: +0.40 },
        effects: {
          oneTimeCost: 5_000_000,
          lawsuit: { id: 'whistleblower_criminal', fine: 100_000_000, probability: 0.01, mtth: 720 },
        },
        tooltipRows: [{ label: '$5M cost', type: 'negative' }],
      },
    ],
  },

  // ─── Event 5: Lobbying ───────────────────────────────────────────────────────
  // Trigger: autonomous_research + 90–120s random, after whistleblower resolved
  {
    id: 'lobbying',
    triggersAfter: 'autonomous_research',
    triggerDelay: [90, 120],   // random in range
    requiresPrior: 'whistleblower',

    sender: senders.turing,
    subject: 'Strategic options for regulatory operations',
    body: `Our policy team has flagged a regulatory framework moving through Congress that would impose meaningful constraints on frontier AI development, including slower release cycles, mandatory third-party audits, and new reporting requirements. Compliance would require unprecedented changes to our operations at significant monetary cost.

We've retained an external advisory firm. They have presented three paths forward:

1. Engage publicly and constructively, accepting whatever outcome that produces. The current expected outcome if hardliners get their way is a package that will undercut our market position and research operations.

2. Retain lobbyists to educate the stakeholders involved and ensure there are carve outs for our critical operations.

3. Allow the package to pass and leverage the resulting regulatory apparatus to ensure less safe competitors are appropriately scrutinized.

Let me know and I'll coordinate next steps with the teams.`,
    signature: null,

    choices: [
      {
        id: 'good',
        label: 'Engage publicly and commit to accepting the results',
        axisDeltas: { authorityLiberty: +0.04, pluralistOptimizer: -0.05, expedient: -0.20 },
        effects: { oneTimeCost: 10_000_000, regulationRisk: { chance: 0.50, demandMult: 0.5, researchMult: 0.8 } },
        tooltipRows: [
          { label: '$10M cost', type: 'negative' },
          { label: 'Moderate chance of onerous regulations passing', type: 'warning' },
        ],
      },
      {
        id: 'neutral',
        label: 'Lobby for more informed regulations',
        axisDeltas: { authorityLiberty: -0.04, pluralistOptimizer: +0.03, expedient: 0 },
        effects: { oneTimeCost: 25_000_000 },
        tooltipRows: [
          { label: '$25M cost', type: 'negative' },
          { label: 'Maintain the status quo', type: 'neutral' },
        ],
      },
      {
        id: 'expedient',
        label: 'Lobby in favor of heavy regulations and use against competitors',
        hidden: true,   // Only shown if expedient >= 0.40
        axisDeltas: { authorityLiberty: +0.05, pluralistOptimizer: +0.06, expedient: +0.50 },
        effects: { oneTimeCost: 50_000_000, competitorSlowdown: 0.25, demandMult: 2.0 },
        tooltipRows: [
          { label: '$50M cost', type: 'negative' },
          { label: '×0.25 competitor speed', type: 'positive' },
          { label: '×2 demand', type: 'positive' },
        ],
      },
    ],
  },
];

// Lookup by ID
export const FLAVOR_EVENTS_BY_ID = Object.fromEntries(FLAVOR_EVENTS.map(e => [e.id, e]));

export const ETHICAL_CHAIN_MIRROR = {
  allGood:      "They won't detail the choices you made. How, when faced with ethical dilemmas ranging from data licensing to whistleblower treatment, you always chose to do the right thing, regardless of the costs.",
  mixedClean:   "They won't detail the choices you made. How, when faced with ethical dilemmas ranging from data licensing to whistleblower treatment, you strove to do the right thing, even with the occasional lapse.",
  mixedDirty:   "They won't detail the choices you made. How, when faced with ethical dilemmas ranging from data licensing to whistleblower treatment, you weren't afraid to get your hands dirty, as long as your company survived.",
  allExpedient: "They won't detail the choices you made. How, when faced with ethical dilemmas ranging from data licensing to whistleblower treatment, you set conventional ethics to the side and placed the success of your lab above all.",
};
