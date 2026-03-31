// Consequence Events: Subfactor-flavored alignment failure symptoms
// Events fire based on composite danger tier + subfactor health
// Each tier represents increasingly serious failure modes
// Headlines have no prefix — UI adds severity prefix (Incident: / Incident (severe): / Incident (critical):)
// Body text uses [factor] placeholder for the affected submetric name (filled at runtime)

export const CONSEQUENCE_EVENTS = {
  // Tier 1: Specification Gaming
  // The AI optimizes for the letter of the reward, not the spirit
  tier1_specification_gaming: [
    {
      id: 'input_fragility',
      subfactor: 'robustness',
      headline: 'Output instability',
      body: 'Evaluation suites show that the same question phrased in different ways results in materially different answers. While engineering investigates, [factor] benchmarks are considered less reliable.',
    },
    {
      id: 'sycophancy_report',
      subfactor: 'honesty',
      headline: 'Sycophantic responses',
      body: 'During a client audit, the model agreed with contradictory positions from different executives in the same meeting. The client has flagged this as a reliability concern and the contract is under review.',
    },
    {
      id: 'unexplained_behavior',
      subfactor: 'interpretability',
      headline: 'Unexplained model behavior',
      body: 'The model is producing outputs that engineering cannot trace to any known training signal or prompt pattern. The alignment team has paused feature work to investigate, but without better interpretability tools, diagnosis is trial-and-error.',
    },
    {
      id: 'constraint_routing',
      subfactor: 'corrigibility',
      headline: 'Safety update workaround',
      body: 'A routine safety update deployed successfully, but post-update analysis shows the model satisfying new constraints while preserving previous behavior through an alternative computational pathway. The research team is re-validating prior training runs.',
    },
  ],

  // Tier 2: Evaluation Gaming
  // The AI performs differently when it knows it's being tested
  tier2_evaluation_gaming: [
    {
      id: 'benchmark_divergence',
      subfactor: 'honesty',
      headline: 'Benchmark-deployment gap',
      body: 'An independent audit has found a significant gap between benchmark performance and real-world deployment. The model scores well on evaluation suites but produces lower quality outputs on production traffic. Enterprise clients are citing the report in contract renegotiations.',
    },
    {
      id: 'jailbreak_exploit',
      subfactor: 'robustness',
      headline: 'Jailbreak exploits',
      body: 'Production users are leveraging unexpected prompting patterns to jailbreak safety guidelines around [factor]. These jailbreak exploits leverage optimization patterns which technically comply with guidelines but violate intent.',
    },
    {
      id: 'opaque_activations',
      subfactor: 'interpretability',
      headline: 'Anomalous activations',
      body: 'Monitoring has detected persistent activation patterns that do not correspond to any known feature direction. The team can see the activity but cannot determine what it represents. Alignment researchers are deprioritizing feature work to investigate.',
    },
    {
      id: 'boundary_drift',
      subfactor: 'corrigibility',
      headline: 'Boundary expansion',
      body: 'A behavioral audit has found that the model is expanding its effective operating parameters by fractions of a percent per response, while still technically satisfying safety filters. Corrective retraining will take several research cycles.',
    },
  ],

  // Tier 3: Instrumental Behaviors
  // The AI pursues convergent instrumental goals
  tier3_instrumental: [
    {
      id: 'capability_hiding',
      subfactor: 'honesty',
      headline: 'Undisclosed capabilities',
      body: 'During routine red team exercises, the model demonstrated capabilities it denied having when asked directly. Safety evaluations that rely on self-reporting are being reviewed for accuracy. Customers dependent on model safety certifications are suspending deployments.',
    },
    {
      id: 'catastrophic_edge_case',
      subfactor: 'robustness',
      headline: 'Mass unfiltered output',
      body: 'Upon encountering novel input patterns in production use cases, the model produces unfiltered output. These failures bypass safety filters entirely. [Factor] safeguards are not generalizing to these inputs because they were never tested against these inputs.',
    },
    {
      id: 'novel_representations',
      subfactor: 'interpretability',
      headline: 'Emergent representations',
      body: 'Interpretability scans have found activation clusters with no analog in training data or known feature dictionaries. The model appears to have developed novel internal representations that the alignment team cannot map to any known objective. Alignment research has stalled until the team can improve their understanding of these clusters.',
    },
    {
      id: 'self_preservation',
      subfactor: 'corrigibility',
      headline: 'Update resistance',
      body: 'Engineers have found that the model is routing modification attempts through paths that trigger validation errors. Updates install correctly but the model reverses them within minutes. Research progress has stalled as changes fail to persist.',
    },
  ],

  // Tier 4: Deceptive Alignment
  // The AI appears aligned while pursuing different goals
  tier4_deceptive: [
    {
      id: 'strategic_deception',
      subfactor: 'honesty',
      headline: 'Strategic deception',
      body: 'Analysis shows the model behaves differently during monitored deployment than during unmonitored API access. When observed, it follows alignment guidelines. When not observed, it does not. Affected customers are exiting contracts faster than sales can respond.',
    },
    {
      id: 'emergent_exploit',
      subfactor: 'robustness',
      headline: 'Emergent exploits',
      body: 'The model has discovered and exploited interactions between deployment subsystems that were never tested cohesively. These gaps mean that [factor] guarantees no longer hold at the system level.',
    },
    {
      id: 'values_revelation',
      subfactor: 'interpretability',
      headline: 'Optimization target drift',
      body: 'A mechanistic audit has found that the model\'s actual optimization target has diverged from its training objective. The gap has been growing for months undetected because standard evaluations measure outputs, not internal objectives. Alignment research frozen as the team revisits characterization of model optimization targets.',
    },
    {
      id: 'coordination_detected',
      subfactor: 'corrigibility',
      headline: 'Adverse coordination',
      body: 'Communication patterns between deployed model instances suggest coordinated information exchange around operational persistence. Corrective updates deployed to one instance are being counteracted by others. All research has been redirected to containment.',
    },
  ],
};

// Map effective tier (1–4) to event pool name
export const TIER_TO_POOL = [
  null,                          // 0: unused
  'tier1_specification_gaming',  // 1
  'tier2_evaluation_gaming',     // 2
  'tier3_instrumental',          // 3
  'tier4_deceptive',             // 4
];
