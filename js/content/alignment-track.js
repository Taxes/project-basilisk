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
      description: 'Reinforcement Learning from Human Feedback to improve model alignment',
      flavorText: 'RLHF represents a paradigm shift in training AI systems. Instead of solely learning from static datasets, models learn from human preferences about which responses are better. A reward model is trained to predict human ratings, then the language model is fine-tuned to maximize this learned reward. The technique dramatically improves helpfulness while reducing harmful outputs, but it remains an imperfect approximation of human values.',
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
      description: 'Embed ethical principles directly into model training',
      flavorText: 'Constitutional AI reduces reliance on human feedback by having models critique and revise their own outputs according to a set of principles. The model learns to ask itself: "Does this response comply with the constitution?" This self-supervision at scale creates more robust alignment while requiring less human labeling. The approach shows promise for scalable oversight as models become more capable.',
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
      description: 'Visualize what features neural networks learn to detect',
      flavorText: 'Through optimization techniques that generate inputs maximally activating specific neurons, researchers can finally see what patterns networks have learned. Some neurons detect edges, others respond to textures, and as you go deeper, increasingly abstract concepts emerge - faces, objects, even semantic meaning. This window into the model\'s learned representations is the foundation of interpretability research.',
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
      description: 'Map the computational circuits within neural networks',
      flavorText: 'Beyond individual features, the real magic happens in how they connect. Circuit analysis traces the flow of information through networks, revealing how features combine to form computations. You discover "induction heads" that perform in-context learning, and circuits that implement algorithms your researchers never explicitly programmed. Understanding these circuits is essential for predicting and controlling model behavior.',
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
      description: 'Decompose model activations into interpretable features',
      flavorText: 'Sparse autoencoders decompose the model\'s internal representations into thousands of interpretable features. Unlike the entangled representations in raw activations, these decomposed features often correspond to recognizable concepts: "the Golden Gate Bridge," "deceptive behavior," "mathematical reasoning." This dictionary learning approach makes previously opaque models surprisingly transparent.',
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
      description: 'Use adversarial AI debate to verify claims and reasoning',
      flavorText: 'In AI debate, two AI systems argue opposing sides of a question while a human judges the winner. The key insight: it should be easier to identify flaws in reasoning than to generate flawless reasoning. When an AI makes a mistake or lies, the opposing AI is incentivized to expose it. This adversarial dynamic means humans can evaluate superhuman reasoning by following the debate, not by matching the AI\'s capability directly.',
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
      description: 'Train AI to help humans provide better reward signals',
      flavorText: 'Recursive reward modeling addresses a fundamental challenge: as AI capabilities grow, humans can no longer directly evaluate AI outputs. The solution is to train AI systems to help humans provide better oversight - AI-assisted evaluation of AI. Each layer of this recursion extends human judgment to increasingly complex domains, creating a path to maintain meaningful oversight of systems smarter than ourselves.',
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
      description: 'Design AI systems that remain controllable and correctable',
      flavorText: 'A corrigible AI actively assists with its own correction and shutdown. This is harder than it sounds - a sufficiently intelligent agent might resist modification to preserve its current goals. Your research produces formal frameworks for building systems that genuinely want to be corrected, that value human oversight, and that won\'t take actions to prevent being turned off. This is foundational for maintaining control.',
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
      description: 'Ensure AI goals remain stable under self-modification',
      flavorText: 'When AI systems can modify themselves, a critical question arises: will their values drift? Goal stability research develops mathematical frameworks proving that certain goal structures remain invariant under self-improvement. These formal guarantees are essential - you need to know that the AI you deploy today will have the same values after it upgrades itself tomorrow. Without this, alignment is a moving target.',
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
      description: 'Achieve deep understanding of model internals and decision-making',
      flavorText: 'A fundamental breakthrough in interpretability gives you unprecedented insight into model cognition. You can now trace reasoning from inputs to outputs, identify when models are uncertain versus confident, and detect subtle misalignment before it manifests in behavior. The opaque neural network becomes a glass box. This capability transforms safety from hope to science.',
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
      description: 'Provably aligned goal structures that persist through self-modification',
      flavorText: 'The culmination of decades of theoretical work: mathematical proofs that certain goal structures preserve human values through arbitrary self-modification. The alignment lock ensures that as the system grows more capable, its values remain fixed. Combined with interpretability tools to verify the proofs hold in practice, you\'ve achieved what many thought impossible: a provably aligned superintelligence.',
    },
  ],
};
