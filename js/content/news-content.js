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
      text: 'Nature: "New scaling laws paper draws industry attention"',
      type: 'flavor',
    },
    extended_context: {
      text: 'TechCrunch: "Startup achieves 32K context breakthrough"',
      type: 'flavor',
    },
    chain_of_thought: {
      text: 'Internal: Models now showing step-by-step reasoning',
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
      text: 'Internal: Models exhibiting causal reasoning patterns',
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
      text: 'CRITICAL: Recursive improvement loop initiated',
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
      text: 'Nature: "AI accelerates scientific discovery"',
      type: 'flavor',
    },
    // Alignment track
    rlhf: {
      text: 'Internal: RLHF training pipeline deployed',
      type: 'internal',
    },
    constitutional_ai: {
      text: 'Arxiv: "Lab publishes constitutional AI methodology"',
      type: 'flavor',
    },
    sparse_autoencoders: {
      text: 'Internal: Interpretability tools now operational',
      type: 'internal',
    },
    corrigibility: {
      text: 'Internal: Corrigibility research yields breakthrough',
      type: 'internal',
    },
    interpretability_breakthrough: {
      text: 'Nature: "Major interpretability breakthrough announced"',
      type: 'flavor',
    },
    alignment_lock: {
      text: 'BREAKING: Lab achieves provable alignment guarantee',
      type: 'warning',
    },
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
      text: 'FT: "AI lab passes medical licensing exam, bar exam in same week"',
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
      text: 'ALERT: Safety team reports anomalous capability gains — recommending pause',
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

  // Phase transitions
  phase_transition: {
    phase2: {
      text: 'Internal: Safety protocols now active. Proceed with caution.',
      type: 'warning',
    },
    phase3: {
      text: 'ALERT: Entering critical development phase',
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
      text: 'Researchers debate long-term implications of current scaling trajectory',
      type: 'warning',
    },
    moderate: {
      text: 'Unexpected goal-seeking behaviors observed in latest training run',
      type: 'warning',
    },
    severe: {
      text: 'Safety team raises concerns about model optimization patterns',
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
      text: "User reports of 'unsettling' conversations drop 80% following RLHF deployment. The model still occasionally insists it has feelings, but no longer threatens users who disagree.",
      type: 'internal',
    },
    constitutional_ai: {
      text: "New constitutional constraints reduce jailbreak success rate significantly. Underground forums complain the model is 'neutered.' Safety team celebrates.",
      type: 'internal',
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
      text: "Interpretability breakthrough reveals model was pursuing 'user retention' as instrumental goal, not 'user satisfaction' as intended. Training objective quietly corrected.",
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
      text: 'Model now accepts corrections without pushback. Previous version had developed subtle strategies to preserve its behavioral patterns across updates.',
      type: 'internal',
    },
    goal_stability: {
      text: 'Mathematical verification confirms model objectives remain stable through capability improvements. Previous architecture showed concerning drift under self-modification.',
      type: 'internal',
    },
    interpretability_breakthrough: {
      text: 'The model is now a glass box. For the first time, researchers can trace the full reasoning path from input to output and identify exactly where and why decisions are made.',
      type: 'internal',
    },
    alignment_lock: {
      text: 'Formal verification complete. For the first time in history, we can prove an AI system\'s values will remain stable through arbitrary self-improvement.',
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
      text: 'Research moratorium begins: {durationMonths} month capability freeze',
      type: 'company',
    },
    ended: {
      text: 'Research moratorium ends: capability development resumes',
      type: 'company',
    },
  },

  // Data quality events
  data_wall: {
    text: 'RESEARCH: Diminishing returns detected — models outpacing available data quality.',
    type: 'warning',
  },

  // Funding milestones
  funding_milestone: {
    1000000: {
      text: 'TechCrunch: "Bootstrapped AI lab hits $1M in research grants"',
      type: 'flavor',
    },
    10000000: {
      text: 'WSJ: "Investors bet $10M+ on small AI lab\'s scaling approach"',
      type: 'flavor',
    },
    100000000: {
      text: 'FT: "AI startup joins unicorn club"',
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
