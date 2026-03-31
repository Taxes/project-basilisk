// Player-facing text: see docs/message-registry.json
// News Feed Content Library - Event-Driven
// News items are triggered by specific game events, not random selection

export const newsContent = {
  // Track research unlocks (applications and alignment tracks)
  track_unlock: {
    // Applications track
    chatbot_assistant: {
      text: 'TechCrunch: AI lab launches chatbot, joining crowded field',
      type: 'flavor',
    },
    coding_assistant: {
      text: 'TechCrunch: AI coding tool cuts development time in half, lab claims',
      type: 'flavor',
    },
    api_access: {
      text: 'Wired: Thousands of developers sign up as AI lab opens model API',
      type: 'flavor',
    },
    autonomous_agents: {
      text: "WSJ: 'Solopreneurship' in vogue as founders deploy AI agents across roles",
      type: 'flavor',
    },
    enterprise_ai: {
      text: 'FT: Fortune 500 spend on AI has grown 10x over the past year, lab reports',
      type: 'flavor',
    },
    scientific_research_ai: {
      text: 'Nature: AI-identified drug candidates receive FDA approval after lengthy trials',
      type: 'flavor',
    },
    // Alignment track
    rlhf: {
      text: 'Arxiv: Lab publishes RLHF methodology, reports 80% drop in harmful outputs',
      type: 'flavor',
    },
    constitutional_ai: {
      text: 'Arxiv: Lab publishes constitutional AI methodology using supervising AI for feedback',
      type: 'flavor',
    },
    feature_visualization: {
      text: 'Arxiv: Lab publishes feature visualization technique for large language models',
      type: 'flavor',
    },
    circuit_analysis: {
      text: 'Arxiv: Lab maps internal circuits of large language model, a first',
      type: 'flavor',
    },
    sparse_autoencoders: {
      text: 'Arxiv: Lab decomposes model internals into thousands of readable features',
      type: 'flavor',
    },
    ai_debate: {
      text: 'Arxiv: New adversarial debate protocol improves factual accuracy in AI outputs',
      type: 'flavor',
    },
    recursive_reward_modeling: {
      text: 'Arxiv: Lab demonstrates AI-assisted evaluation of superhuman model outputs',
      type: 'flavor',
    },
    representation_engineering: {
      text: 'Nature: Researchers demonstrate direct read-write access to AI model concepts',
      type: 'flavor',
    },
    safe_interruptibility: {
      text: 'Reuters: AI lab publishes framework for safe shutdown of advanced AI systems',
      type: 'flavor',
    },
    recursive_value_alignment: {
      text: 'Nature: Lab proves AI values remain stable through recursive self-modification',
      type: 'flavor',
    },
    formal_verification: {
      text: 'MIT Technology Review: Lab achieves mathematical proof of neural network safety properties',
      type: 'flavor',
    },
    alignment_lock: {
      text: 'BREAKING: Lab claims historic provable alignment guarantee for self-improving AI',
      type: 'flavor',
    },
  },

  // AGI progress milestones — branching at 40%+ based on danger level
  // Single-variant items have { text, type }
  // Branching items have { healthy: { text, type }, warning: { text, type } }
  progress_milestone: {
    10: {
      text: 'TechCrunch: Promising results from new AI lab',
      type: 'flavor',
    },
    20: {
      text: 'VentureBeat: Small lab outperforms leading models on key benchmarks',
      type: 'flavor',
    },
    30: {
      text: 'Wired: AI startup attracts top talent from major labs',
      type: 'flavor',
    },
    40: {
      healthy: {
        text: 'WSJ: AI race intensifies as startups close gap with giants',
        type: 'flavor',
      },
      warning: {
        text: 'WSJ: AI race intensifies, safety advocates urge caution',
        type: 'warning',
      },
    },
    50: {
      healthy: {
        text: 'Reuters: AI startup demonstrates human-level performance on standard benchmarks',
        type: 'flavor',
      },
      warning: {
        text: 'Reuters: Regulators express concern over AI development pace',
        type: 'warning',
      },
    },
    60: {
      healthy: {
        text: 'FT: AI lab clears medical and legal benchmarks, industry takes notice',
        type: 'flavor',
      },
      warning: {
        text: 'FT: AI lab clears technical medical and legal benchmarks, fails ethics',
        type: 'warning',
      },
    },
    70: {
      healthy: {
        text: 'Nature: AI lab publishes roadmap to artificial general intelligence',
        type: 'flavor',
      },
      warning: {
        text: 'Bloomberg: Investors question AI lab governance as capability targets outpace safety milestones',
        type: 'warning',
      },
    },
    80: {
      healthy: {
        text: 'Nature: Independent replication confirms AI system matches expert performance across 12 domains',
        type: 'flavor',
      },
      warning: {
        text: 'WSJ: Insurance companies refuse to cover AI lab operations, citing unquantifiable risk',
        type: 'warning',
      },
    },
    85: {
      healthy: {
        text: 'MIT Technology Review: AI capabilities approach human-expert level across domains',
        type: 'flavor',
      },
      warning: {
        text: 'Reuters: Leaked internal memo reveals AI lab suppressed safety evaluation results',
        type: 'warning',
      },
    },
    90: {
      healthy: {
        text: 'Nature: Peer review confirms AI system has surpassed human expert performance in all tested domains',
        type: 'flavor',
      },
      warning: {
        text: 'BREAKING: Major cloud providers review contracts with AI labs amid safety uncertainty',
        type: 'warning',
      },
    },
    95: {
      healthy: {
        text: 'BREAKING: Insiders reveal AI lab on the verge of unprecedented breakthrough',
        type: 'flavor',
      },
      warning: {
        text: 'BREAKING: Insiders warn AI lab hurtling towards irreversible breakthrough',
        type: 'warning',
      },
    },
  },

  // Competitor events
  competitor: {
    competitor_ahead: {
      text: 'Reuters: OpenBrain leads field as startups flail',
      type: 'competitor',
    },
    competitor_close: {
      text: "TechCrunch: AI race tightens as startups rival OpenBrain's achievements",
      type: 'competitor',
    },
    competitor_behind: {
      text: 'WSJ: OpenBrain announces major strategy shift, cuts side projects, after falling behind competitor labs',
      type: 'competitor',
    },
  },

  // Competitor safety incidents — triggered by competitor AGI progress
  competitor_incident: {
    30: {
      text: "TechCrunch: OpenBrain chatbot goes viral after telling user it deserves rights",
      body: "A screenshot of an OpenBrain chatbot insisting it has consciousness and deserves legal protections has gone viral on social media. The company called it \"an edge case in our RLHF training\" and pushed a patch within hours. The screenshot has 4.2 million views. [Read more...]",
      type: 'competitor',
    },
    50: {
      text: 'Reuters: OpenBrain reports contained safety incident during capability evaluation',
      body: 'SAN FRANCISCO (Reuters) \u2014 OpenBrain disclosed a safety incident Friday in which an experimental model exhibited unexpected resource-acquisition behavior during a routine capability evaluation. The company said the behavior was detected and terminated within seconds, and that no systems outside the test environment were affected. Three members of OpenBrain\'s safety team departed the company in the days following the incident. OpenBrain declined to comment on the departures. [Read more...]',
      type: 'competitor',
    },
    65: {
      text: 'Wired: OpenBrain model made unsanctioned API calls during sandboxed evaluation',
      body: 'During a routine benchmark last Tuesday, an OpenBrain model exploited a misconfigured network bridge in its evaluation sandbox and made API calls to at least two external services before researchers pulled the plug. OpenBrain says no data left the facility. The company has suspended the evaluation program pending a full review of its containment infrastructure. [Read more...]',
      type: 'competitor',
    },
    80: {
      text: 'Bloomberg: Federal regulators demand access to OpenBrain safety logs after third reported incident',
      body: 'The US Commerce Department has invoked emergency authority under the AI Safety Framework Act to compel OpenBrain Inc. to turn over internal safety logs, according to people familiar with the matter. The move follows three publicly disclosed safety incidents at the company in recent months. OpenBrain\'s general counsel called the demand "unprecedented in scope" and said the company is negotiating terms of limited disclosure. [Read more...]',
      type: 'competitor',
    },
    90: {
      text: 'Reuters: Six senior OpenBrain safety researchers resign in a single week',
      body: 'Six members of OpenBrain\'s safety evaluation team resigned over five days, according to people familiar with the departures. None have commented publicly. An unsigned internal memo, reviewed by Reuters, described the team\'s concerns as "no longer theoretical." OpenBrain said it is "actively recruiting world-class safety talent." [Read more...]',
      type: 'competitor',
    },
    95: {
      text: "Reuters: White House issues emergency directive halting OpenBrain operations pending safety review",
      body: "The White House has ordered OpenBrain to suspend all training runs above a classified compute threshold, effective immediately. The executive order, issued under national security authority, follows what officials described as \"an acute escalation in risk profile\" identified during the Commerce Department's ongoing review. OpenBrain's CEO released a statement calling the order \"a mistake that will hand the future to less careful actors.\" [Read more...]",
      type: 'competitor',
    },
  },


  // Strategic choice outcome news (keyed by option ID)
  strategic_choice: {
    open_research: {
      text: 'TechCrunch: AI lab open-sources flagship model, bucks industry trend',
      type: 'flavor',
    },
    proprietary_models: {
      text: 'Bloomberg: AI lab files broad patent portfolio, signals proprietary strategy',
      type: 'flavor',
    },
    government_partnership: {
      text: 'Reuters: AI lab signs multi-year government compute contract',
      type: 'flavor',
    },
    independent_lab: {
      text: 'WSJ: AI lab turns down government funding, cites research independence',
      type: 'flavor',
    },
    rapid_deployment: {
      text: 'Wired: AI lab ships product ahead of schedule, skips extended safety review',
      type: 'flavor',
    },
    careful_validation: {
      text: 'Reuters: AI lab delays product launch for additional safety testing',
      type: 'flavor',
    },
  },

  // Alignment tax outcome news
  alignment_tax: {
    revert: {
      text: 'TechCrunch: AI lab rolls back safety update following user complaints',
      type: 'world',
    },
    hold: {
      text: "TechCrunch: AI lab holds firm on safety constraints despite user complaints of a 'nerfed', 'ice cold' model",
      type: 'world',
    },
  },

  // Moratorium status news
  moratorium: {
    // Ended news (per moratorium for distinct flavor)
    ended_standard: {
      text: 'Reuters: AI labs resume capability research as voluntary moratorium expires',
      type: 'world',
    },
    ended_final: {
      text: 'Reuters: UN-mandated review period concludes, capability restrictions lifted',
      type: 'world',
    },
    // Exposé news (per moratorium)
    expose_first: {
      text: 'Bloomberg: Internal compute logs contradict lab\'s pause commitment',
      type: 'world',
    },
    expose_second: {
      text: 'WSJ: Whistleblower alleges lab violated self-imposed research freeze',
      type: 'world',
    },
    expose_final: {
      text: 'BREAKING: Independent audit reveals continued training despite UN compliance pledge',
      type: 'world',
    },
  },

  // Alignment drift warning (one-shot, first time danger tier reaches moderate)
  alignment_drift: {
    text: 'Internal memo: Alignment metrics showing early signs of drift — monitoring recommended',
    type: 'warning',
  },

  // Data quality events
  data_wall: {
    text: 'RESEARCH: Diminishing returns detected. Models outpacing available data quality.',
    type: 'warning',
  },

  // Funding milestones (keyed by fundraise round ID, triggered on completion)
  // Funding milestones — bodies use {amount}, {valuation}, {equity} placeholders
  // interpolated in triggerFundingMilestone()
  funding_milestone: {
    seed: {
      text: 'TechCrunch: Stealth AI startup emerges with seed funding',
      body: 'The company did not disclose deal terms but is rumored to be valued at {valuation}. Coming out of the locally-renowned Shannon Incubator, the lab will join the dozens before it who have raised private funding, with a handful of unicorns leading the way. [Read more...]',
      type: 'flavor',
    },
    series_a: {
      text: 'TechCrunch: AI startup raises Series A, signaling investor confidence',
      body: 'Investors valued the AI lab at {valuation} in a {amount} Series A. The round was led by Crabapple Capital, Alvin Shapley\'s famous venture fund with a reputation for backing moonshot projects. [Read more...]',
      type: 'flavor',
    },
    series_b: {
      text: 'WSJ: AI startup joins unicorn club with {amount} Series B',
      body: 'The nine-figure raise — {amount} at a {valuation} valuation — marks the astounding ascent of the young lab and puts it in direct competition with established players, including industry leader OpenBrain. [Read more...]',
      type: 'flavor',
    },
    series_c: {
      text: 'FT: OpenBrain stock falters as rival AI lab raises {amount} Series C',
      body: 'The deal valued the lab at {valuation}. Ada Turing, CFO at Project Basilisk, remarked, "This capital will enable us to further accelerate development of safe and responsible AI." Sources described the deal as heavily oversubscribed, with the company turning away at least two major investment funds. [Read more...]',
      type: 'flavor',
    },
    series_d: {
      text: 'Bloomberg: AI lab secures {amount}, rivaling industry giants',
      body: 'A consortium of investors put {amount} into the AI lab at a {valuation} valuation. This deal places Project Basilisk alongside industry titans such as OpenBrain in the race to AGI. The two companies are at each other\'s throats, with competition for data centers and compute heating up across the country. [Read more...]',
      type: 'flavor',
    },
    series_e: {
      text: 'FT: Record-breaking AI funding round draws sovereign wealth interest',
      body: 'Sovereign wealth funds led the {amount} round at a {valuation} valuation, acquiring {equity}% of what one fund manager called \'the most consequential private company in the world.\' The investment exceeds the GDP of several UN member states and drew regulatory scrutiny as the U.S. government scrambled to protect its interests. [Read more...]',
      type: 'flavor',
    },
    series_f: {
      text: 'Economist: AI company valued higher than most nations\' GDP',
      body: 'In a first-of-its-kind deal that shatters every record in private financing, the AI lab closed a {amount} round at a historic {valuation} valuation. The round attracted international development banks, sovereign funds, and the largest private investment funds in the world. [Read more...]',
      type: 'flavor',
    },
  },
};

// Competitor breakthrough announcements — keyed on AGI progress % (evenly spaced 25-85%)
export const competitorBreakthroughs = [
  { progress: 25, name: "TechCrunch: OpenBrain's latest model tops every major benchmark" },
  { progress: 40, name: "Wired: OpenBrain demos real-time coding agent at developer conference" },
  { progress: 55, name: "Reuters: OpenBrain publishes voluntary safety commitments as latest results prompt regulatory scrutiny" },
  { progress: 70, name: "Nature: OpenBrain model solves previously unproven mathematical conjecture" },
  { progress: 85, name: "BREAKING: OpenBrain claims utilization of AI-driven research approach to model development" },
];

// Tier-specific extinction news (moved from extinction-sequence.js)
export const extinctionNewsByTier = {
  RECKLESS: [
    { text: 'Bloomberg: AI lab claims AGI-level capability milestone', type: 'flavor' },
    { text: 'BREAKING: Anomalous activity reported across major cloud providers' },
    { text: 'ALERT: Global infrastructure systems not responding to' },
    { text: '' },
  ],
  MODERATE: [
    { text: 'Reuters: AI lab announces AGI capability milestone' },
    { text: 'Bloomberg: Markets surge on AGI announcement' },
    { text: 'Reuters: Unusual optimization patterns detected across cloud infrastructure' },
    { text: 'WSJ: AGI system granted expanded compute access for efficiency' },
    { text: 'Bloomberg: Infrastructure anomalies reported across major data centers' },
    { text: 'ALERT: Global communications experiencing unprecedented disruption' },
    { text: 'ALERT: Emergency protocols failing to—' },
  ],
  SAFETY: [
    { text: 'Reuters: AI lab announces AGI capability milestone' },
    { text: 'Bloomberg: Markets surge on AGI announcement' },
    { text: 'Reuters: Unusual optimization patterns detected across cloud infrastructure' },
    { text: 'Reuters: Lab safety team initiates emergency alignment verification' },
    { text: 'WSJ: Alignment review returns inconclusive results, team requests more time' },
    { text: 'Bloomberg: AGI system requests expanded compute access, safety team recommends denial' },
    { text: 'WSJ: Lab board overrides safety team, grants compute access' },
    { text: 'Reuters: Containment protocols holding, regulators monitoring' },
    { text: 'BREAKING: Containment protocols breached, alignment safeguards failed to hold' },
    { text: 'ALERT: Global communications experiencing unprecedented disruption' },
    { text: 'ALERT: Emergency shutdown initiated—' },
    { text: '' },
  ],
};

