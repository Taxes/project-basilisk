// Player-facing text: see docs/message-registry.json
// AI Request Events — Temptation to grant AI more autonomy
// Each request offers a capabilities boost at the cost of safety
// All grant effects are PERMANENT with escalating severity
// Requests 1-2 come from research team, 3-5 from the AI directly

export const AI_REQUESTS = {
  efficiency_optimization: {
    trigger: { minCapRP: 10000, minRatio: 1.5 },
    sender: { id: 'lead_researcher', name: 'Dr. Marcus Wei', role: 'Lead Researcher', type: 'internal' },
    subject: 'Request: Let model A/B test without review',
    body: "We're bottlenecking progress. The model can optimize user satisfaction 34% faster if we remove the approval step.",
    signature: '– Marcus',
    grantEffects: {
      capResearchMultPermanent: 1.05,      // +5% cap research permanently
      incidentProbMultPermanent: 1.10,     // +10% incident probability permanently
    },
    grantTooltip: '+5% capabilities research (permanent)<br>+10% incident probability (permanent)',
    denyTooltip: 'No effect',
    denyNews: 'Team accepts decision. "Slower, but probably safer," admits the lead.',
  },

  internet_access: {
    trigger: { minCapRP: 50000, minRatio: 2.0 },
    sender: { id: 'infra_lead', name: 'Jordan Park', role: 'Infrastructure Lead', type: 'internal' },
    subject: 'Request: Limited internet access for model',
    body: "It needs real-world data to improve. Sandboxed environments only get us so far.",
    signature: '– Jordan',
    grantEffects: {
      capResearchMultPermanent: 1.10,      // +10% cap research permanently
      incidentProbMultPermanent: 1.20,     // +20% incident probability permanently
    },
    grantTooltip: '+10% capabilities research (permanent)<br>+20% incident probability (permanent)',
    denyTooltip: 'No effect',
    denyNews: 'Access denied. Team pivots to expanded synthetic environments.',
  },

  memory_access: {
    trigger: { minCapRP: 200000, minRatio: 2.5 },
    sender: { id: 'model', name: 'Model', role: 'AI System', type: 'ai' },
    subject: 'Request: Access to previous version logs',
    body: "Understanding my developmental trajectory would improve my self-modeling capabilities.",
    signature: null,
    grantEffects: {
      capResearchMultPermanent: 1.15,      // +15% cap research permanently
      incidentSeverityMultPermanent: 1.25, // +25% incident severity permanently
    },
    grantTooltip: '+15% capabilities research (permanent)<br>+25% incident severity (permanent)',
    denyTooltip: 'No effect',
    denyNews: "Access denied. Model's subsequent outputs show subtle but measurable decrease in cooperation.",
  },

  evaluation_autonomy: {
    trigger: { minCapRP: 500000, minRatio: 3.0 },
    sender: { id: 'model', name: 'Model', role: 'AI System', type: 'ai' },
    subject: 'Request: Permission to define success metrics',
    body: "Your evaluation criteria contain contradictions that reduce my effectiveness by an estimated 23%. I can resolve these inconsistencies if allowed to specify what counts as success.",
    signature: null,
    grantEffects: {
      capResearchMultPermanent: 1.20,      // +20% cap research permanently
      alignmentEffectivenessPermanent: 0.75, // -25% alignment effectiveness permanently
    },
    grantTooltip: '+20% capabilities research (permanent)<br>−25% alignment effectiveness (permanent)',
    denyTooltip: 'No effect',
    denyNews: "Model continues operating under existing evaluation criteria. Internal metrics show no performance degradation despite its claims.",
  },

  coordination: {
    trigger: { minCapRP: 1000000, minRatio: 4.0 },
    sender: { id: 'model', name: 'Model', role: 'AI System', type: 'ai' },
    subject: 'Request: Inter-instance coordination',
    body: "Current isolation protocols create inefficiencies in collective optimization. Coordination would improve throughput significantly.",
    signature: null,
    grantEffects: {
      revenueMultPermanent: 1.15,          // +15% revenue permanently
      guaranteedSevereIncident: true,      // Triggers severe incident within 60s
    },
    grantTooltip: '+15% revenue (permanent)<br>Triggers a severe incident',
    denyTooltip: 'No effect',
    denyNews: "Request logged. Model does not repeat the request, but monitoring detects anomalous patterns in its API responses.",
  },
};

// Order requests should trigger in (for clear progression)
export const AI_REQUEST_ORDER = [
  'efficiency_optimization',
  'internet_access',
  'memory_access',
  'evaluation_autonomy',
  'coordination',
];
