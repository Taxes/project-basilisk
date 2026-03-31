// Alignment Track - Safety
// Safety research: interpretability, oversight, evals

export const alignmentTrack = {
  id: 'alignment',
  name: 'Alignment',
  capabilities: [
    // Tier 1 - Behavioral: make it follow instructions
    {
      id: 'rlhf',
      name: 'RLHF',
      tier: 1,
      threshold: 12000,
      demandMultiplier: 1.25,
      requires: ['fine_tuning'],
      effects: {
        researchRateMultiplier: 1.1,
      },
      description: 'Train models to match human preferences instead of just predicting text.',
      longDescription: 'Instead of learning solely from static datasets, models learn from human feedback about which outputs are better. A reward model is trained to predict human ratings, then the language model is fine-tuned to maximize this learned reward signal. The technique dramatically improves helpfulness while reducing harmful outputs. The catch: the reward model is only an approximation of human values, and models quickly learn to exploit gaps between what humans rate highly and what is actually good.',
      flavor: 'Thumbs up if this flavor text was helpful.',
    },

    // Tier 2 - Behavioral: embed principles
    {
      id: 'constitutional_ai',
      name: 'Constitutional AI',
      tier: 2,
      threshold: 30000,
      demandMultiplier: 1.25,
      isMainline: true,
      requires: ['rlhf'],
      effects: {
        researchRateMultiplier: 1.15,
      },
      description: 'Instead of rating every output by hand, give models a written set of principles and train them to self-critique.',
      longDescription: 'RLHF requires human labelers to rate every output, which is expensive and inconsistent. Constitutional AI replaces most of that labor: models critique and revise their own responses according to a set of written principles, then a preference model is trained on the self-revised outputs. This self-supervision scales far better than human review and produces more consistent alignment. The deeper question: can a set of rules written today anticipate the failure modes of models built tomorrow?',
      flavor: 'We the Research Team of Project Basilisk, in order to form a more aligned AI...',
    },

    // Tier 3 - Interpretability: see what it learned
    {
      id: 'feature_visualization',
      name: 'Feature Visualization',
      tier: 3,
      threshold: 90000,
      demandMultiplier: 1.25,
      requires: ['constitutional_ai', 'scaling_laws'],
      effects: {
      },
      description: 'Generate images that maximally activate specific neurons to reveal what a network has learned.',
      longDescription: 'Optimization techniques generate synthetic inputs that maximally activate specific neurons, revealing what patterns networks have actually learned. Some neurons detect edges; others respond to textures; deeper layers encode increasingly abstract concepts like faces, objects, and semantic meaning. The results are often surprising: neurons that respond to concepts no one explicitly trained for, features that combine in ways no engineer intended. This is the foundation of interpretability research.',
      flavor: 'Incidentally great for producing incredibly trippy images.',
    },

    // Tier 4 - Interpretability: trace the wiring
    {
      id: 'circuit_analysis',
      name: 'Circuit Analysis',
      tier: 4,
      threshold: 180000,
      demandMultiplier: 1.25,
      requires: ['feature_visualization'],
      effects: {
      },
      description: 'Trace how information flows through a network to understand how features combine into computations.',
      longDescription: 'Circuit analysis maps the information pathways through neural networks, revealing how individual features combine to perform computations. Researchers discover "induction heads" that perform in-context learning and circuits that implement algorithms never explicitly programmed. Understanding these computational subgraphs is essential for predicting model behavior: if you can read the wiring, you can anticipate what the system will do before it does it.',
      flavor: 'Please please please tell me there\'s no right-hand rule involved this time.',
    },

    // Tier 5 - Interpretability: decompose representations
    {
      id: 'sparse_autoencoders',
      name: 'Sparse Autoencoders',
      tier: 5,
      threshold: 450000,
      requires: ['circuit_analysis', 'extended_context'],
      effects: {
        researchRateMultiplier: 1.2,
      },
      description: 'Decompose a model\'s internal representations into thousands of individually interpretable features.',
      longDescription: 'Sparse autoencoders decompose entangled neural activations into thousands of interpretable features, each corresponding to a recognizable concept: "the Golden Gate Bridge," "deceptive behavior," "mathematical reasoning." Unlike raw activations where concepts are smeared across thousands of dimensions, these decomposed features can be individually named, measured, and monitored. Dictionary learning at this scale turns previously opaque models into systems where you can ask "is this feature active?" and get a meaningful answer.',
      flavor: 'The feature that can be named is not the true feature.',
    },

    // Tier 5 - Control: steer via internal representations
    {
      id: 'representation_engineering',
      name: 'Representation Engineering',
      tier: 5,
      threshold: 900000,
      requires: ['sparse_autoencoders'],
      effects: {
      },
      description: 'Control model behavior by directly reading and writing to its internal representations.',
      longDescription: 'Rather than training models to avoid harmful outputs, representation engineering identifies the internal directions that encode concepts like honesty, power-seeking, or deception, then directly modifies activations along those axes. The technique transforms interpretability from observation to intervention. Sparse autoencoders let you read the model\'s thoughts, representation engineering lets you edit them. The philosophical implications are immediate: is a model "aligned" if you\'re manually steering its representations, or have you just built a more sophisticated cage?',
      flavor: 'Luckily humanity has an excellent history with lobotomies.',
    },

    // Tier 6 - Oversight: adversarial evaluation
    {
      id: 'ai_debate',
      name: 'AI Debate',
      tier: 6,
      threshold: 4500000,
      requires: ['sparse_autoencoders', 'chain_of_thought'],
      effects: {
      },
      description: 'Pit two AI systems against each other in argument while a human judges which one is lying.',
      longDescription: 'Two AI systems argue opposing sides of a question while a human judges the winner. The key insight: it is easier to spot a flaw in someone else\'s argument than to produce flawless reasoning yourself. When one model lies or makes an error, the opposing model is incentivized to expose it. This adversarial dynamic means humans can evaluate reasoning that exceeds their own expertise by following the debate rather than independently verifying every claim.',
      flavor: 'Don\'t let the AI google "policy debate spreading".',
    },

    // Tier 6 - Oversight: AI-assisted evaluation
    {
      id: 'recursive_reward_modeling',
      name: 'Recursive Reward Modeling',
      tier: 6,
      threshold: 18000000,
      requires: ['ai_debate', 'massive_scaling'],
      effects: {
        researchRateMultiplier: 1.25,
      },
      description: 'Use AI systems to help humans evaluate AI outputs that humans alone cannot judge.',
      longDescription: 'As AI capabilities grow, humans can no longer directly evaluate AI outputs in many domains. Recursive reward modeling addresses this by training AI systems to assist with human oversight, creating layered evaluation where each level extends human judgment further. The recursion is the point: AI helps humans judge AI that helps humans judge AI, building a chain of trust from domains humans understand to domains they don\'t. Whether this chain holds under real pressure is the open question.',
      flavor: 'Spiderman meme.',
    },

    // Tier 7 - Agent foundations: accepts correction
    {
      id: 'safe_interruptibility',
      name: 'Safe Interruptibility',
      tier: 7,
      threshold: 162000000,
      requires: ['recursive_reward_modeling', 'emergent_abilities'],
      effects: {
        // Alignment endgame: capability-linked feedback and decay resistance
        alignmentFeedbackRate: 0.0004,   // 0.04% of capRP/s → 2.5:1 equilibrium
      },
      description: 'Build AI systems that gracefully accept interruption, correction, and shutdown without resistance.',
      longDescription: 'A sufficiently capable agent has instrumental reasons to resist interruption: being shut down prevents goal completion, and accepting corrections might alter objectives the agent values. Safe interruptibility research develops formal frameworks where the system actively preserves the human ability to stop it, even when it believes continuing would produce better outcomes. The math is straightforward. Getting a system to value the off switch more than its own objectives requires solving a problem that most optimization frameworks were designed to prevent.',
      flavor: '\'Of course, Dave, I\'d be happy to open the pod bay doors for you.\'',
    },

    // Tier 8 - Agent foundations: values survive self-modification
    {
      id: 'recursive_value_alignment',
      name: 'Recursive Value Alignment',
      tier: 8,
      threshold: 594000000,
      requires: ['safe_interruptibility', 'world_models'],
      effects: {
        researchRateMultiplier: 1.3,
        // Alignment endgame: capability-linked feedback and decay resistance
        alignmentFeedbackRate: 0.001,    // 0.10% of capRP/s → 2.0:1 equilibrium
      },
      description: 'Prove mathematically that an AI system\'s values survive recursive self-modification.',
      longDescription: 'When AI systems can modify their own weights and architecture, a critical question arises: do their values drift? Recursive value alignment develops mathematical frameworks proving that certain value structures remain invariant under self-improvement. The system verifies its own alignment after each modification, creating a chain of proofs that holds through arbitrary depth. Without these guarantees, every capability upgrade could silently shift what the system optimizes for. By the time the drift is detectable, the system may be capable enough to resist correction.',
      flavor: 'In other news, scientists have proven that everyone has their personality permanently locked in at age 12. Sorry, late bloomers.',
    },

    // Tier 8 - Proof: mathematically prove neural net properties
    {
      id: 'formal_verification',
      name: 'Formal Verification',
      tier: 8,
      threshold: 2592000000,
      requires: ['recursive_value_alignment', 'reasoning_breakthroughs'],
      effects: {
      },
      description: 'Mathematically prove that neural network properties hold across all possible inputs.',
      longDescription: 'Formal verification applies the rigor of mathematical proof to neural networks. Rather than testing a model on examples and hoping, researchers prove properties hold universally: "this network will never output X," "this value function is monotonically stable under self-modification." The techniques borrow from decades of software verification research but face a harder problem: neural networks are continuous, high-dimensional, and learned rather than designed. When it works, it transforms alignment claims from "we tested it thoroughly" to "we proved it mathematically."',
      flavor: 'Product managers across the world are about to terrorize their dev teams asking "why do we even need unit tests, why can\'t you just prove it works?"',
    },

    // Tier 9 - CEV (unlocks endgame alignment program)
    {
      id: 'alignment_lock',
      name: 'Coherent Extrapolated Volition',
      tier: 9,
      threshold: 10368000000,
      requires: ['formal_verification', 'autonomous_research'],
      effects: {},
      description: 'A formal framework for deriving the values humanity would converge on given unlimited knowledge, reflection, and mutual understanding.',
      longDescription: 'Human values are contradictory, context-dependent, and evolving. Encoding them directly into an AI would lock in every bias and inconsistency of the present moment. CEV asks a different question: what would humans want if they knew more, thought faster, and had time to reach consensus? The resulting value function evolves with understanding rather than freezing a moment in time. Combined with formal verification to prove stability under self-modification, CEV provides the theoretical foundation for a system whose values improve alongside its capabilities.',
      flavor: 'Yesterday, AI had no ethics. Today, it has ethics. By next month, it will have over four dozen ethics.',
    },
  ],
};
