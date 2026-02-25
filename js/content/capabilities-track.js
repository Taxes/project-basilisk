// Capabilities Track - AI Power
// Core AI capabilities: scaling, architecture, emergent abilities

export const capabilitiesTrack = {
  id: 'capabilities',
  name: 'Capabilities',
  capabilities: [
    // Tier 0 - Starting capability
    {
      id: 'basic_transformer',
      name: 'Basic Transformer',
      tier: 0,
      threshold: 2000,
      requires: [],
      effects: {
        researchRateMultiplier: 1.2,
      },
      description: 'A simple transformer model with 2K context window',
      flavorText: 'The transformer architecture, introduced in "Attention Is All You Need" (2017), revolutionized machine learning. Unlike previous recurrent models, transformers process entire sequences in parallel using self-attention mechanisms. Your first model can handle 2,000 tokens of context - enough for short conversations and simple tasks. The architecture is elegant: layers of attention and feed-forward networks, stacked deep.',
    },

    {
      id: 'fine_tuning',
      name: 'Fine-Tuning',
      tier: 1,
      threshold: 5000,
      requires: ['basic_transformer'],
      effects: {
        researchRateMultiplier: 1.2,
      },
      description: 'Instruction tuning and RLHF make models actually useful',
      flavorText: 'Raw pretrained models are impressive but unwieldy. Through careful fine-tuning on human feedback, you teach the model to follow instructions, refuse harmful requests, and produce helpful responses. The transformation is remarkable - the same weights, now actually useful. This is the difference between a research curiosity and a product.',
    },

    // Tier 1 - Early breakthroughs
    {
      id: 'scaling_laws',
      name: 'Scaling Laws',
      tier: 1,
      threshold: 20000,
      requires: ['fine_tuning'],
      effects: {
        tokenEfficiencyMultiplier: 1.2,
      },
      hiddenAlignmentEffect: -2,  // Slight negative - pure capability focus without safety consideration
      description: 'Discover predictable relationships between model size, data, and capability',
      flavorText: 'Neural network performance scales predictably with compute, data, and model size. This empirical finding, documented in OpenAI\'s 2020 scaling laws paper, enables strategic planning of training runs and infrastructure investment. By understanding these power laws, you can predict how much compute you\'ll need to reach the next capability threshold. The implications are profound: with enough resources, the path to increasingly capable systems becomes a matter of engineering rather than scientific breakthrough.',
    },

    // Tier 2 - Architecture improvements
    {
      id: 'extended_context',
      name: 'Extended Context',
      tier: 2,
      threshold: 60000,
      referencePriceMultiplier: 1.5,
      requires: ['scaling_laws'],
      effects: {
        researchRateMultiplier: 1.2,
        tokenWeightMultiplier: 0.60,
      },
      hiddenAlignmentEffect: -2,  // Pure capability - longer context enables more complex behaviors
      description: 'Increase model context window from 2K to 32K tokens',
      flavorText: 'Longer context windows enable models to reason over more information simultaneously. Through techniques like ALiBi, RoPE, and sparse attention, you extend the model\'s "working memory" from 2,000 to 32,000 tokens. Users can now analyze entire documents, maintain longer conversations, and work with complex codebases. The quadratic cost of attention becomes a engineering challenge worth solving.',
    },

    {
      id: 'data_curation',
      name: 'Data Curation',
      tier: 2,
      threshold: 120000,
      requires: ['scaling_laws'],
      effects: { researchRateMultiplier: 1.2 },
      description: 'Systematic data filtering and deduplication improves training efficiency',
      flavorText: 'Your team develops systematic data filtering and deduplication. Training efficiency improves immediately. Every pipeline you operate benefits from cleaner inputs and smarter selection criteria.',
    },

    {
      id: 'chain_of_thought',
      name: 'Chain-of-Thought',
      tier: 2,
      threshold: 240000,
      demandMultiplier: 1.2,
      referencePriceMultiplier: 1.2,
      requires: ['scaling_laws'],
      effects: {
        tokenWeightMultiplier: 0.65,
      },
      hiddenAlignmentEffect: 1,  // Slight positive - more interpretable reasoning
      description: 'Teach models to break down complex problems step-by-step',
      flavorText: 'By prompting models to "think step by step," you unlock dramatically improved reasoning capabilities. This technique, discovered through prompt engineering rather than architectural changes, shows that large language models can perform multi-step reasoning when given space to work through problems. Math, logic, and planning all improve substantially. The model essentially shows its work.',
    },

    {
      id: 'compute_optimal_training',
      name: 'Compute-Optimal Training',
      tier: 2,
      threshold: 480000,
      requires: ['chain_of_thought'],
      effects: {
        researchRateMultiplier: 1.15,    // Training runs are more efficient
        tokenWeightMultiplier: 1.20,     // Chinchilla: smaller models serve more tokens/TFLOP
      },
      hiddenAlignmentEffect: 0,          // Neutral — disciplined science
      description: 'Discover the optimal ratio of model size to training data',
      flavorText: 'Your research team makes a counterintuitive discovery: your models are too large and undertrained. By training smaller models on significantly more data, you achieve better performance at lower cost. The insight reshapes your entire training pipeline — every future run will be more efficient. The industry called it "Chinchilla scaling."',
    },

    {
      id: 'dataset_licensing',
      name: 'Dataset Licensing',
      tier: 3,
      threshold: 600000,
      requires: ['data_curation'],
      effects: {},
      description: 'License curated datasets — unlocks books, government data, and expert annotation',
      flavorText: 'Negotiating licensing deals with publishers, government agencies, and domain experts opens access to high-quality, legally clean training corpora. Expensive, but the signal-to-noise ratio transforms your training runs.',
    },

    // Tier 3 - Scaling up
    {
      id: 'massive_scaling',
      name: 'Massive Scaling',
      tier: 3,
      threshold: 900000,
      demandMultiplier: 1.3,
      referencePriceMultiplier: 1.5,
      requires: ['extended_context', 'chain_of_thought', 'compute_optimal_training'],
      effects: {
        researchRateMultiplier: 1.2,
        tokenWeightMultiplier: 0.25,
      },
      hiddenAlignmentEffect: -3,  // Negative - prioritizing scale over safety
      description: 'Scale models to hundreds of billions of parameters',
      flavorText: 'At sufficient scale, transformer models exhibit entirely new capabilities that were not present in smaller versions. Your models now rival human performance on many standardized tests. The training runs consume enormous resources - thousands of GPUs running for months - but the resulting capabilities justify the investment. You\'ve entered the era of foundation models.',
    },

    {
      id: 'synthetic_data',
      name: 'Synthetic Data Generation',
      tier: 4,
      threshold: 1800000,
      requires: ['chain_of_thought', 'dataset_licensing'],
      effects: {},
      hiddenAlignmentEffect: -3,
      description: 'Models generate their own training data - powerful but risky',
      flavorText: 'Your models generate their own training data. Powerful, but recursive training carries risks your alignment team flags.',
    },

    {
      id: 'synthetic_verification',
      name: 'Synthetic Data Verification',
      tier: 5,
      threshold: 135000000,
      requires: ['synthetic_data'],
      effects: {},
      hiddenAlignmentEffect: 0,
      description: 'Multi-model verification pipeline catches synthetic artifacts before they enter training',
      flavorText: 'Your verification pipeline uses multiple models to cross-check synthetic data. Artifacts that would cause distribution shift are caught before they contaminate training. The safe synthetic ratio increases significantly.',
    },

    // Tier 4 - Emergent abilities
    {
      id: 'emergent_abilities',
      name: 'Emergent Abilities',
      tier: 4,
      threshold: 8000000,
      demandMultiplier: 1.3,
      referencePriceMultiplier: 1.3,
      requires: ['massive_scaling'],
      effects: {
        researchRateMultiplier: 1.2,
        tokenWeightMultiplier: 0.60,
      },
      hiddenAlignmentEffect: -5,  // Significant negative - unpredictable capabilities are alignment risk
      description: 'Discover capabilities that appear suddenly at scale thresholds',
      flavorText: 'Beyond certain scale thresholds, models suddenly acquire abilities like arithmetic, code generation, and multi-step reasoning. These emergent abilities weren\'t explicitly trained - they appeared as byproducts of scale. Your research team documents dozens of tasks where performance jumps from near-zero to near-perfect as you cross specific compute thresholds. The implications for future scaling are tantalizing.',
    },

    // Tier 5 - World understanding
    {
      id: 'world_models',
      name: 'World Models',
      tier: 5,
      threshold: 50000000,
      referencePriceMultiplier: 2.0,
      requires: ['emergent_abilities'],
      effects: {
        researchRateMultiplier: 1.5,
        tokenWeightMultiplier: 0.50,
      },
      hiddenAlignmentEffect: -4,  // Internal world models are opaque and hard to verify
      description: 'Develop internal representations that model how the world works',
      flavorText: 'Your models no longer just predict tokens - they build rich internal simulations of physics, causality, and social dynamics. Probing studies reveal emergent representations of space, time, and abstract concepts. The models can now reason about counterfactuals and hypotheticals with surprising accuracy. You\'re no longer sure if this is "just statistics" anymore.',
    },

    // Tier 6 - Reasoning breakthroughs
    {
      id: 'reasoning_breakthroughs',
      name: 'Reasoning Breakthroughs',
      tier: 6,
      threshold: 216000000,
      demandMultiplier: 1.3,
      referencePriceMultiplier: 2.5,
      requires: ['world_models'],
      effects: {
        researchRateMultiplier: 2.0,
        tokenWeightMultiplier: 0.30,
      },
      hiddenAlignmentEffect: 2,  // Process reward models make reasoning more verifiable
      description: 'Achieve human-level performance on complex reasoning benchmarks',
      flavorText: 'Your models now match or exceed human expert performance on mathematics olympiad problems, graduate-level science exams, and complex logical puzzles. The breakthrough came from test-time compute scaling - letting models "think longer" on hard problems. Combined with process reward models that verify reasoning steps, you\'ve created systems that can tackle problems that stumped your best researchers.',
    },

    // Tier 7 - Autonomous research
    {
      id: 'autonomous_research',
      name: 'Autonomous Research',
      tier: 7,
      threshold: 864000000,
      referencePriceMultiplier: 1.5,
      requires: ['reasoning_breakthroughs'],
      requiresAlignment: 30,
      effects: {
        tokenWeightMultiplier: 0.55,
        focusEfficiencyMultiplier: 1.5,
        capFeedbackRate: 0.001,    // T7: 0.10%/s
      },
      hiddenAlignmentEffect: -6,  // Autonomous systems reduce human oversight
      description: 'AI systems that can independently design and run experiments',
      flavorText: 'Your AI systems can now independently design experiments, analyze results, and propose new research directions. They read papers faster than humans, spot connections across disparate fields, and generate novel hypotheses. Some of their proposed experiments yield genuine discoveries. You\'ve created the first AI research assistants that meaningfully accelerate scientific progress.',
    },

    // Tier 8 - Self-improvement
    {
      id: 'self_improvement',
      name: 'Self-Improvement',
      tier: 8,
      threshold: 3456000000,
      requires: ['autonomous_research'],
      requiresAlignment: 50,
      effects: {
        focusEfficiencyMultiplier: 1.5,
        focusSlots: 2,
        capFeedbackRate: 0.002,    // T8: 0.20%/s — stretched for Phase 3 pacing (was 0.005)
      },
      hiddenAlignmentEffect: -8,  // Self-modification is inherently risky even with sandboxes
      description: 'Enable limited self-modification of training procedures',
      flavorText: 'A watershed moment: your AI systems can now improve their own training procedures. Within carefully monitored sandboxes, they optimize hyperparameters, propose architectural modifications, and generate better training data. Each improvement cycle produces measurably better successors. You maintain oversight, but the pace of capability growth is accelerating beyond what human researchers alone could achieve.',
    },

    // Tier 9 - Recursive improvement (THE TRAP - no alignment requirement)
    {
      id: 'recursive_improvement',
      name: 'Recursive Improvement',
      tier: 9,
      threshold: 13824000000,
      requires: ['self_improvement'],
      // NOTE: No alignment requirement here - this is intentional.
      // Players can unlock this at any alignment level.
      // The ending depends on alignment level when this is triggered.
      effects: {
        tokenWeightMultiplier: 0.55,
        capFeedbackRate: 0.01,     // T9: 1.00%/s (replaces T8)
      },
      hiddenAlignmentEffect: -10,  // Major negative - the ultimate capability without safety
      description: 'Full recursive self-improvement with exponential capability gains',
      flavorText: 'The capability curve goes vertical. Each system improvement enables the next, faster than before. Your AI can now design better AI systems, which design even better ones. The feedback loop has begun. Whether this leads to transcendence or catastrophe depends entirely on the alignment work you\'ve done. There is no turning back now.',
      warningText: 'This capability will determine your ending. Current alignment will be evaluated.',
    },
  ],
};
