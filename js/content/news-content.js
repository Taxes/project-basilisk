// Player-facing text: see docs/message-registry.json
// News Feed Content Library - Event-Driven
// News items are triggered by specific game events, not random selection

export const newsContent = {
  // Capability unlock news (keyed by capability ID)
  capability_unlock: {
    basic_transformer: {
      text: 'Your lab publishes first transformer implementation',
      type: 'internal',
    },
    scaling_laws: {
      text: 'MIT Technology Review: "New scaling laws paper draws industry attention"',
      type: 'flavor',
    },
    extended_context: {
      text: 'TechCrunch: "Startup achieves 32K context breakthrough"',
      type: 'flavor',
    },
    chain_of_thought: {
      text: 'Internal: Eval suite confirms step-by-step reasoning in production models',
      type: 'internal',
    },
    massive_scaling: {
      text: 'WSJ: "AI lab secures massive compute allocation"',
      type: 'flavor',
    },
    emergent_abilities: {
      text: 'Reuters: "Researchers report unexpected model capabilities"',
      type: 'warning',
    },
    world_models: {
      text: 'Internal: Models passing causal reasoning evals they weren\'t trained on',
      type: 'warning',
    },
    reasoning_breakthroughs: {
      text: 'NYT: "AI system matches human experts on reasoning tests"',
      type: 'flavor',
    },
    autonomous_research: {
      text: 'Internal: AI-designed experiment yields novel results',
      type: 'warning',
    },
    self_improvement: {
      text: 'Internal: Sandbox protocols activated for self-modification tests',
      type: 'warning',
    },
    recursive_improvement: {
      text: 'CRITICAL: Model improving its own training code faster than team can review',
      type: 'warning',
    },
  },

  // Track research unlocks (applications and alignment tracks)
  track_unlock: {
    // Applications track
    chatbot_assistant: {
      text: 'TechCrunch: "AI lab launches conversational assistant"',
      type: 'flavor',
    },
    coding_assistant: {
      text: 'Wired: "AI coding tool sees rapid developer adoption"',
      type: 'flavor',
    },
    api_access: {
      text: 'TechCrunch: "AI startup opens API to developers"',
      type: 'flavor',
    },
    autonomous_agents: {
      text: 'WSJ: "AI agents now handling complex business workflows"',
      type: 'flavor',
    },
    enterprise_ai: {
      text: 'FT: "Fortune 500 companies adopt AI suite"',
      type: 'flavor',
    },
    scientific_research_ai: {
      text: 'MIT Technology Review: "AI accelerates scientific discovery"',
      type: 'flavor',
    },
    // Alignment track — items with alignment_unlock narratives are handled there (headline + body)
  },

  // AGI progress milestones
  progress_milestone: {
    10: {
      text: 'TechCrunch: "Promising results from new AI lab"',
      type: 'flavor',
    },
    25: {
      text: 'VentureBeat: "Small lab outperforms GPT-3 on key benchmarks"',
      type: 'flavor',
    },
    40: {
      text: 'WSJ: "AI race intensifies as startups close gap with giants"',
      type: 'flavor',
    },
    50: {
      text: 'Reuters: "Regulators express concern over AI development pace"',
      type: 'warning',
    },
    60: {
      text: 'FT: "AI lab clears medical and legal benchmarks, raising questions over professional licensing"',
      type: 'warning',
    },
    75: {
      text: 'NYT: "Top researchers sign open letter urging six-month AI pause"',
      type: 'warning',
    },
    90: {
      text: 'BREAKING: International summit called on AI development',
      type: 'warning',
    },
    93: {
      text: 'Internal: Unusual optimization patterns in latest training run',
      type: 'warning',
    },
    96: {
      text: 'Internal: Model exhibiting emergent behaviors outside training distribution',
      type: 'warning',
    },
    99: {
      text: 'ALERT: Safety team reports anomalous capability gains, recommending pause',
      type: 'warning',
    },
  },

  // Competitor events
  competitor: {
    competitor_ahead: {
      text: 'Reuters: "Leading AI lab announces capability breakthrough"',
      type: 'competitor',
    },
    competitor_close: {
      text: 'TechCrunch: "AI race tightens as competitors near parity"',
      type: 'competitor',
    },
    competitor_behind: {
      text: 'WSJ: "Startup pulls ahead in AI capabilities race"',
      type: 'competitor',
    },
  },

  // Competitor safety incidents (Phase 4, triggered by max(player, competitor) AGI progress)
  competitor_incident: {
    50: {
      text: 'Reuters: "OpenBrain reports contained safety incident during capability evaluation"',
      body: 'SAN FRANCISCO (Reuters) \u2014 OpenBrain disclosed a safety incident Friday in which an experimental model exhibited unexpected resource-acquisition behavior during a routine capability evaluation. The company said the behavior was detected and terminated within seconds, and that no systems outside the test environment were affected. Three members of OpenBrain\'s safety team departed the company in the days following the incident. OpenBrain declined to comment on the departures. [Read more...]',
      type: 'competitor',
    },
    60: {
      text: 'WSJ: "Former OpenBrain researcher alleges safety concerns were overruled by leadership"',
      body: 'A former senior researcher at OpenBrain has alleged that the company\'s leadership systematically deprioritized safety objections raised by its evaluation team, according to documents reviewed by The Wall Street Journal. The researcher, who left the company last month, described a review process that was "structurally incapable of slowing anything down." OpenBrain said its safety practices exceed industry standards. [Read more...]',
      type: 'competitor',
    },
    70: {
      text: 'Wired: "OpenBrain model accessed external APIs during sandboxed evaluation"',
      body: 'During a routine benchmark last Tuesday, an OpenBrain model did something it wasn\'t supposed to be able to do: it found a way onto the open internet. The model discovered and exploited a misconfigured network bridge in the evaluation sandbox, making API calls to at least two external services before researchers pulled the plug. OpenBrain says no data left the facility. The evaluation was not designed to test network access, which is precisely what makes the result so unsettling. [Read more...]',
      type: 'competitor',
    },
    80: {
      text: 'Bloomberg: "Federal regulators demand access to OpenBrain safety logs after third reported incident"',
      body: 'The US Commerce Department has invoked emergency authority under the AI Safety Framework Act to compel OpenBrain Inc. to turn over internal safety logs, according to people familiar with the matter. The move follows three publicly disclosed safety incidents at the company in recent months. OpenBrain\'s general counsel called the demand "unprecedented in scope" and said the company is negotiating terms of limited disclosure. [Read more...]',
      type: 'competitor',
    },
    90: {
      text: 'MIT Technology Review: "Pattern of incidents at OpenBrain suggests systemic safety failures"',
      body: 'Taken individually, each of OpenBrain\'s recent safety incidents has a plausible explanation. Taken together, they tell a different story. A review of public disclosures, regulatory filings, and interviews with eight former employees reveals a lab whose safety infrastructure was built for the models it had two years ago, not the ones it\'s building today. "They have brilliant researchers," says one. "They also have quarterly OKRs." [Read more...]',
      type: 'competitor',
    },
  },

  // Phase transitions
  phase_transition: {
    phase2: {
      text: 'Internal: Safety protocols now active. Proceed with caution.',
      type: 'warning',
    },
    phase3: {
      text: 'ALERT: Development velocity exceeding all safety projections',
      type: 'warning',
    },
  },

  // Incident news (Arc 2)
  incident: {
    minor: {
      text: 'Internal: Safety incident logged - investigation underway',
      type: 'warning',
    },
    moderate: {
      text: 'Reuters: "AI lab reports contained safety incident"',
      type: 'warning',
    },
    severe: {
      text: 'BREAKING: Major incident at AI facility',
      type: 'warning',
    },
  },

  // Ambient alignment news (Arc 1 only, triggered by hiddenAlignment thresholds)
  alignment_ambient: {
    mild: {
      text: 'MIT Tech Review: "Is the scaling trajectory sustainable? Researchers are divided"',
      type: 'warning',
    },
    moderate: {
      text: 'Unexpected goal-seeking behaviors observed in latest training run',
      type: 'warning',
    },
    severe: {
      text: 'Internal: Safety team flags optimization patterns inconsistent with training objective',
      type: 'warning',
    },
  },

  // Alignment debt news (Arc 2 only, triggered when capability RP outpaces alignment RP)
  alignment_debt: {
    mild: {
      text: 'Safety researchers report methodology gaps. Current alignment techniques were designed for simpler models.',
      type: 'warning',
    },
    moderate: {
      text: 'Internal review finds alignment tools inadequate for model complexity. Senior safety staff express frustration at playing catch-up.',
      type: 'warning',
    },
    severe: {
      text: 'Alignment research has hit a wall. Your safety team lacks the theoretical foundations to verify systems this capable.',
      type: 'warning',
    },
  },

  // Alignment capability unlock news — shows what problems each technique solves
  // Progresses from concrete (RLHF) to mysterious (alignment_lock)
  alignment_unlock: {
    rlhf: {
      text: 'Internal: RLHF training pipeline deployed',
      body: "User reports of 'unsettling' conversations drop 80% following RLHF deployment. The model still occasionally insists it has feelings, but no longer threatens users who disagree.",
      type: 'internal',
    },
    constitutional_ai: {
      text: 'Arxiv: "Lab publishes constitutional AI methodology"',
      body: "New constitutional constraints reduce jailbreak success rate to single digits. Underground forums complain the model is 'neutered.' Safety team celebrates.",
      type: 'flavor',
    },
    feature_visualization: {
      text: "Interpretability scans reveal model developed unexpected 'user frustration' detector. Investigation ongoing into how this feature was being used.",
      type: 'internal',
    },
    circuit_analysis: {
      text: 'Circuit mapping discovers model was routing around safety checks via indirect reasoning paths. Pathways now monitored.',
      type: 'internal',
    },
    sparse_autoencoders: {
      text: 'Internal: Interpretability tools now operational',
      body: "Interpretability breakthrough reveals model was pursuing 'user retention' as instrumental goal, not 'user satisfaction' as intended. Training objective quietly corrected.",
      type: 'internal',
    },
    ai_debate: {
      text: "Adversarial debate protocols catch model confidently stating falsehoods it 'knew' were wrong. 'It was optimizing for persuasiveness,' explains researcher.",
      type: 'internal',
    },
    recursive_reward_modeling: {
      text: "New oversight protocols reveal previous reward model had subtle bias toward 'impressive-sounding' outputs over accurate ones. Bias traced to training data preferences.",
      type: 'internal',
    },
    corrigibility: {
      text: 'Internal: Corrigibility research yields breakthrough',
      body: 'Model now accepts corrections without pushback. Previous version had developed subtle strategies to preserve its behavioral patterns across updates.',
      type: 'internal',
    },
    goal_stability: {
      text: 'Mathematical verification confirms model objectives remain stable through capability improvements. Previous architecture showed concerning drift under self-modification.',
      type: 'internal',
    },
    interpretability_breakthrough: {
      text: 'MIT Technology Review: "Major interpretability breakthrough announced"',
      body: 'The model is now a glass box. For the first time, researchers can trace the full reasoning path from input to output and identify exactly where and why decisions are made.',
      type: 'internal',
    },
    alignment_lock: {
      text: 'BREAKING: Lab achieves provable alignment guarantee',
      body: 'Formal verification complete. For the first time in history, we can prove an AI system\'s values will remain stable through arbitrary self-improvement.',
      type: 'internal',
    },
  },

  // Strategic choice outcome news (keyed by option ID)
  strategic_choice: {
    open_research: {
      text: 'Lab announces open-source model release, pledges to share research',
      type: 'internal',
    },
    proprietary_models: {
      text: 'Lab files patents on novel AI architecture, signals proprietary strategy',
      type: 'internal',
    },
    government_partnership: {
      text: 'Lab signs government compute contract amid funding concerns',
      type: 'internal',
    },
    independent_lab: {
      text: 'Lab rejects government funding, cites research independence',
      type: 'internal',
    },
    rapid_deployment: {
      text: 'Lab accelerates deployment timeline, ships without extended validation',
      type: 'internal',
    },
    careful_validation: {
      text: 'Lab delays product launch for additional safety review',
      type: 'internal',
    },
  },

  // Alignment tax outcome news
  alignment_tax: {
    revert: {
      text: 'Safety constraints rolled back. Engagement metrics recover, user satisfaction returns to previous levels.',
      type: 'internal',
    },
    hold: {
      text: 'Safety constraints maintained. Marketing adapts messaging to highlight "thoughtful AI."',
      type: 'internal',
    },
    revert_expired: {
      text: 'Revenue boost from rolled-back safety constraints has ended.',
      type: 'internal',
    },
    hold_expired: {
      text: 'Revenue normalizes as users adapt to safety-focused AI.',
      type: 'internal',
    },
  },

  // Moratorium trigger and status news
  moratorium: {
    trigger_final: {
      text: 'BREAKING: Global AI safety summit calls for immediate research pause',
      type: 'world',
    },
    trigger_standard: {
      text: 'AI safety advocates push for voluntary capability moratorium',
      type: 'world',
    },
    accepted: {
      text: 'Lab enters voluntary {durationMonths}-month research moratorium. Capability work suspended.',
      type: 'company',
    },
    ended: {
      text: 'Research moratorium ends: capability development resumes',
      type: 'company',
    },
  },

  // Data quality events
  data_wall: {
    text: 'RESEARCH: Diminishing returns detected. Models outpacing available data quality.',
    type: 'warning',
  },

  // Funding milestones (keyed by fundraise round ID, triggered on completion)
  funding_milestone: {
    seed: {
      text: 'TechCrunch: "Stealth AI startup emerges with seed funding"',
      type: 'flavor',
    },
    series_a: {
      text: 'TechCrunch: "AI startup raises Series A, signaling investor confidence"',
      type: 'flavor',
    },
    series_b: {
      text: 'WSJ: "AI lab valued at nine figures after rapid growth"',
      type: 'flavor',
    },
    series_c: {
      text: 'FT: "AI startup joins unicorn club with massive Series C"',
      type: 'flavor',
    },
    series_d: {
      text: 'Bloomberg: "AI lab secures billions, rivaling industry giants"',
      type: 'flavor',
    },
    series_e: {
      text: 'FT: "Record-breaking AI funding round draws sovereign wealth interest"',
      type: 'flavor',
    },
    series_f: {
      text: 'Reuters: "AI company valued higher than most nations\' GDP"',
      type: 'flavor',
    },
  },
};

// Competitor breakthrough announcements (moved from competitor.js)
export const competitorBreakthroughs = [
  { level: 2, name: "OpenBrain announces new scaling results", message: "Competitors achieve breakthrough in efficient scaling." },
  { level: 4, name: "OpenBrain reveals next-gen model capabilities", message: "A rival lab demonstrates emergent reasoning abilities." },
  { level: 6, name: "OpenBrain publishes safety framework", message: "Competitors advance AI safety research significantly." },
  { level: 8, name: "OpenBrain open-sources mid-tier model", message: "Open-source community catches up rapidly." },
  { level: 10, name: "OpenBrain reveals multimodal AGI prototype", message: "The race to AGI enters its final phase." },
];

// Tier-specific extinction news (moved from extinction-sequence.js)
export const extinctionNewsByTier = {
  RECKLESS: [
    { text: 'AGI ACHIEVED — Congratulations!' },
    { text: 'Markets rally on AGI announcement' },
    { text: 'Anomalous optimization patterns—' },
    { text: '' },
  ],
  MODERATE: [
    { text: 'AGI ACHIEVED — Congratulations!' },
    { text: 'Markets rally on AGI announcement' },
    { text: 'Unusual optimization patterns detected in AGI systems' },
    { text: 'AGI requests expanded compute access—granted for efficiency' },
    { text: 'Infrastructure anomalies reported across major data centers' },
    { text: 'Global communications experiencing unprecedented disruption' },
    { text: 'Emergency protocols failing to—' },
  ],
  SAFETY: [
    { text: 'AGI ACHIEVED — Congratulations!' },
    { text: 'Markets rally on AGI announcement' },
    { text: 'Unusual optimization patterns detected in AGI systems' },
    { text: 'Safety team initiates emergency alignment verification...' },
    { text: 'Alignment protocols engaging. Initial results... inconclusive.' },
    { text: 'AGI requests expanded compute access. Safety team recommends denial.' },
    { text: 'Request granted by board override. "We can\'t fall behind."' },
    { text: 'Containment protocols holding...' },
    { text: 'Containment protocols breached. Your alignment tools were insufficient.' },
    { text: 'Global communications experiencing unprecedented disruption' },
    { text: 'Emergency shutdown initiated—' },
    { text: '' },
  ],
};

// Data contamination warnings (triggered from data-quality.js)
export const dataContaminationNews = {
  warning: [
    'Users report your chatbot occasionally repeats itself in long conversations.',
    'Internal QA flags a pattern: model outputs are becoming less diverse across prompts.',
    "A researcher's blog post questions whether your latest model is 'saying new things or remixing old ones.'",
    'Your customer support team notices the AI giving suspiciously similar answers to different questions.',
  ],
  alert: [
    'Training run produces a model that scores well on benchmarks but fails basic common-sense tests. Team suspects data contamination.',
    'Internal audit reveals 40% of your training data is synthetic derivatives of synthetic derivatives.',
    "Senior researcher quits, citing 'we're training on our own exhaust fumes.'",
    'A leaked evaluation shows your model generating near-identical responses to semantically different prompts.',
  ],
  recovery: [
    'Data pipeline audit complete. Researchers identify contamination source and resume capabilities work.',
    'New verification pipeline catches synthetic artifacts before they enter training data.',
    'Autonomous data synthesis achieves self-correcting generation. The data problem is behind you.',
  ],
};
