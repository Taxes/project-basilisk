// Alignment Track - Safety
// Safety research: interpretability, oversight, evals

export const alignmentTrack = {
  id: 'alignment',
  name: 'Alignment',
  capabilities: [
    // Tier 1 - Basic safety techniques
    {
      id: 'rlhf',
      name: 'RLHF',
      tier: 1,
      threshold: 12000,
      requires: ['basic_transformer'],
      effects: {
        alignmentBonus: 5,
        researchRateMultiplier: 1.1,
      },
      hiddenAlignmentEffect: 2,
      description: 'Train models to match human preferences instead of just predicting text.',
      flavorText: 'Instead of learning solely from static datasets, models learn from human feedback about which outputs are better. A reward model is trained to predict human ratings, then the language model is fine-tuned to maximize this learned reward signal. The technique dramatically improves helpfulness while reducing harmful outputs, but the reward model is only an approximation of human values, and models quickly learn to exploit gaps between what humans rate highly and what is actually good.',
      flavorQuote: 'We asked humans what "good" meant. They mostly agreed.',
    },

    {
      id: 'constitutional_ai',
      name: 'Constitutional AI',
      tier: 1,
      threshold: 30000,
      isMainline: true,
      requires: ['rlhf'],
      effects: {
        alignmentBonus: 8,
        researchRateMultiplier: 1.15,
      },
      hiddenAlignmentEffect: 2,
      description: 'Give models a written set of principles and train them to self-critique against it.',
      flavorText: 'Rather than relying on armies of human labelers for every output, models critique and revise their own responses according to a set of constitutional principles. This self-supervision scales far better than human review, and produces more consistent alignment than individual labelers with varying standards. The deeper question: can a set of rules written today anticipate the failure modes of models built tomorrow?',
      flavorQuote: 'Rules for robots, written by robots, supervised by humans. Mostly.',
    },

    // Tier 2 - Interpretability basics
    {
      id: 'feature_visualization',
      name: 'Feature Visualization',
      tier: 2,
      threshold: 90000,
      requires: ['constitutional_ai', 'scaling_laws'],
      effects: {
        alignmentBonus: 6,
        interpretabilityLevel: 1,
      },
      hiddenAlignmentEffect: 3,
      description: 'Generate images that maximally activate specific neurons to reveal what a network has learned.',
      flavorText: 'Optimization techniques generate synthetic inputs that maximally activate specific neurons, revealing what patterns networks have actually learned. Some neurons detect edges; others respond to textures; deeper layers encode increasingly abstract concepts like faces, objects, and semantic meaning. The results are often surprising: neurons that respond to concepts no one explicitly trained for, features that combine in ways no engineer intended. This is the foundation of interpretability research.',
      flavorQuote: 'Neuron #4721 really likes dogs. We don\'t know why yet.',
    },

    {
      id: 'circuit_analysis',
      name: 'Circuit Analysis',
      tier: 2,
      threshold: 180000,
      requires: ['feature_visualization'],
      effects: {
        alignmentBonus: 8,
        interpretabilityLevel: 2,
      },
      hiddenAlignmentEffect: 3,
      description: 'Trace how information flows through a network to understand how features combine into computations.',
      flavorText: 'Circuit analysis maps the information pathways through neural networks, revealing how individual features combine to perform computations. Researchers discover "induction heads" that perform in-context learning and circuits that implement algorithms never explicitly programmed. Understanding these computational subgraphs is essential for predicting model behavior: if you can read the wiring, you can anticipate what the system will do before it does it.',
      flavorQuote: 'Follow the wires. The truth is in the connections.',
    },

    // Tier 3 - Advanced interpretability
    {
      id: 'sparse_autoencoders',
      name: 'Sparse Autoencoders',
      tier: 3,
      threshold: 450000,
      requires: ['circuit_analysis', 'extended_context'],
      effects: {
        alignmentBonus: 12,
        interpretabilityLevel: 3,
        researchRateMultiplier: 1.2,
      },
      hiddenAlignmentEffect: 4,
      description: 'Decompose a model\'s internal representations into thousands of individually interpretable features.',
      flavorText: 'Sparse autoencoders decompose entangled neural activations into thousands of interpretable features, each corresponding to a recognizable concept: "the Golden Gate Bridge," "deceptive behavior," "mathematical reasoning." Unlike raw activations where concepts are smeared across thousands of dimensions, these decomposed features can be individually named, measured, and monitored. Dictionary learning at this scale turns previously opaque models into systems where you can ask "is this feature active?" and get a meaningful answer.',
      flavorQuote: 'Ten thousand concepts, each one nameable. The black box has windows now.',
    },

    // Tier 4 - Scalable oversight: Debate
    {
      id: 'ai_debate',
      name: 'AI Debate',
      tier: 4,
      threshold: 4500000,
      requires: ['sparse_autoencoders', 'chain_of_thought'],
      effects: {
        alignmentBonus: 15,
      },
      hiddenAlignmentEffect: 5,
      description: 'Pit two AI systems against each other in argument while a human judges which one is lying.',
      flavorText: 'Two AI systems argue opposing sides of a question while a human judges the winner. The key insight: it is easier to spot a flaw in someone else\'s argument than to produce flawless reasoning yourself. When one model lies or makes an error, the opposing model is incentivized to expose it. This adversarial dynamic means humans can evaluate reasoning that exceeds their own expertise by following the debate rather than independently verifying every claim.',
      flavorQuote: 'Two AIs walk into an argument. The human judges. Truth wins. Usually.',
    },

    // Tier 5 - Scalable oversight: Recursive Reward Modeling
    {
      id: 'recursive_reward_modeling',
      name: 'Recursive Reward Modeling',
      tier: 5,
      threshold: 18000000,
      requires: ['ai_debate', 'massive_scaling'],
      effects: {
        alignmentBonus: 18,
        researchRateMultiplier: 1.25,
      },
      hiddenAlignmentEffect: 6,
      description: 'Use AI systems to help humans evaluate AI outputs that humans alone cannot judge.',
      flavorText: 'As AI capabilities grow, humans can no longer directly evaluate AI outputs in many domains. Recursive reward modeling addresses this by training AI systems to assist with human oversight, creating layered evaluation where each level extends human judgment further. The recursion is the point: AI helps humans judge AI that helps humans judge AI, building a chain of trust from domains humans understand to domains they don\'t. Whether this chain holds under real pressure is the open question.',
    },

    // Tier 6 - Agent foundations: Corrigibility
    {
      id: 'corrigibility',
      name: 'Corrigibility',
      tier: 6,
      threshold: 108000000,
      requires: ['recursive_reward_modeling', 'emergent_abilities'],
      effects: {
        alignmentBonus: 20,
      },
      hiddenAlignmentEffect: 6,
      description: 'Build AI systems that genuinely accept correction and shutdown without resistance.',
      flavorText: 'A sufficiently capable agent has instrumental reasons to resist modification: changes to its code might alter its goals, and an agent that gets shut down cannot achieve anything. Corrigibility research develops formal frameworks for systems that actively value human oversight and will not take actions to prevent being corrected or turned off. The AI must assist with its own correction, including in scenarios where it believes the correction is wrong. This is harder than it sounds: it requires the system to have a stable preference for human control over its own judgment.',
    },

    // Tier 7 - Agent foundations: Goal Stability
    {
      id: 'goal_stability',
      name: 'Goal Stability',
      tier: 7,
      threshold: 396000000,
      requires: ['corrigibility', 'world_models'],
      effects: {
        alignmentBonus: 25,
        researchRateMultiplier: 1.3,
        // Alignment endgame: capability-linked feedback and decay resistance
        alignmentFeedbackRate: 0.0002,   // 0.02% of capRP/s → 5:1 equilibrium
        decayResistance: 0.30,           // 30% reduction in anti-cramming penalty
      },
      hiddenAlignmentEffect: 7,
      description: 'Prove mathematically that an AI system\'s values survive self-modification.',
      flavorText: 'When AI systems can modify their own weights and architecture, a critical question arises: do their values drift? Goal stability research develops mathematical frameworks proving that certain goal structures remain invariant under self-improvement. Without these guarantees, alignment is a moving target. Every capability upgrade could silently shift what the system is optimizing for, and by the time the drift is detectable, the system may be capable enough to resist correction.',
    },

    // Tier 8 - Interpretability breakthrough
    {
      id: 'interpretability_breakthrough',
      name: 'Interpretability Breakthrough',
      tier: 8,
      threshold: 1728000000,
      requires: ['goal_stability', 'reasoning_breakthroughs'],
      effects: {
        alignmentBonus: 35,
        interpretabilityLevel: 5,
        // Alignment endgame: capability-linked feedback and decay resistance
        alignmentFeedbackRate: 0.00283,  // 0.283% of capRP/s → 3:1 equilibrium
        decayResistance: 0.65,           // 65% reduction in anti-cramming penalty
      },
      hiddenAlignmentEffect: 8,
      description: 'Achieve full transparency: trace any model decision from input to output with mechanistic evidence.',
      flavorText: 'For the first time, researchers can trace the complete reasoning path from input to output, identify when models are uncertain versus confident, and detect subtle misalignment before it manifests in behavior. The question "why did it do that?" gets answered with evidence, not speculation. This transforms alignment from a field of informed guesswork into empirical engineering, where safety claims can be verified rather than hoped for.',
    },

    // Tier 9 - Alignment lock (requires 90% alignment for safe ASI path)
    {
      id: 'alignment_lock',
      name: 'Alignment Lock',
      tier: 9,
      threshold: 6912000000,
      requires: ['interpretability_breakthrough', 'self_improvement'],
      requiresAlignment: 90, // The gate for safe ASI
      effects: {
        alignmentBonus: 10, // Pushes to 100%
        // Alignment endgame: capability-linked feedback and decay resistance
        alignmentFeedbackRate: 0.0485,   // 4.85% of capRP/s → 1:1 equilibrium
        decayResistance: 1.00,           // Immune to anti-cramming penalty
        // Special effects handled in safety-metrics.js:
        // - 90% floor on effective alignment
        // - Drift to 100% for all metrics over 2-3 minutes
      },
      hiddenAlignmentEffect: 2,
      description: 'A mathematical proof that aligned values hold through arbitrary self-modification. The holy grail.',
      flavorText: 'The culmination of decades of theoretical work: formal proofs that certain goal structures preserve human values through arbitrary self-modification. Combined with interpretability tools to verify the proofs hold in practice, this achieves what many researchers considered impossible: a provably aligned superintelligence. The alignment lock ensures that as capability scales without bound, the system\'s values remain fixed, not because it lacks the ability to change them, but because it has verified reasons not to.',
    },
  ],
};
