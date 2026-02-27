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
      description: 'One paper replaces recurrence with attention. Everything after builds on this.',
      flavorText: 'The transformer architecture, introduced in "Attention Is All You Need" (2017), replaced recurrent models with parallel self-attention mechanisms. Instead of processing tokens one at a time, transformers attend to the entire input sequence at once, enabling massive parallelism on GPUs. The architecture is deceptively simple: layers of attention and feed-forward networks, stacked deep. Everything in modern AI builds on this foundation.',
      flavorQuote: '"Attention is all you need" - top 10 worst things to say to someone with ADHD.',
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
      description: 'Raw pretrained models are impressive but unwieldy. Human feedback changes everything.',
      flavorText: 'Pretrained models predict text, but they don\'t follow instructions. Fine-tuning on human feedback teaches models to be helpful, refuse harmful requests, and stay on topic. The base weights don\'t change much, but behavior transforms completely. This is the gap between a research artifact and a usable system.',
      flavorQuote: 'Dang that model is fiiiiiine.',
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
      description: 'Neural network performance follows power laws across compute, data, and model size.',
      flavorText: 'Neural network performance scales predictably with compute, data, and model size. This empirical finding, documented in OpenAI\'s 2020 scaling laws paper, turned training runs from guesswork into engineering. Given a compute budget, you can predict the resulting capability level before spending a dollar. The implications reshaped the entire industry\'s investment thesis.',
      flavorQuote: 'Just one more server boss. I promise one more server will fix everything. Boss. Just one more server. Please I swear just one more.',
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
      description: 'Context windows determine how much information a model can reason over at once.',
      flavorText: 'Standard attention scales quadratically with sequence length, making long contexts prohibitively expensive. Techniques like ALiBi, RoPE, and sparse attention break this barrier, extending context from thousands to tens of thousands of tokens. Longer context enables analyzing entire documents, maintaining extended conversations, and reasoning over complex codebases.',
      flavorQuote: 'Finally enough room to work on my Terminator x Mario Kart fanfic.',
    },

    {
      id: 'data_curation',
      name: 'Data Curation',
      tier: 2,
      threshold: 120000,
      requires: ['scaling_laws'],
      effects: { researchRateMultiplier: 1.2 },
      description: 'Training data quality matters as much as quantity. Deduplication and filtering become engineering disciplines.',
      flavorText: 'Duplicates in the training corpus teach models to memorize, not generalize. Filtering, deduplication, and quality scoring pipelines separate signal from noise. Models trained on curated corpora converge faster and hallucinate less. The scaling laws apply to data quality, not just data quantity.',
      flavorQuote: 'A little more garbage for Oscar and a little less for the model.',
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
      description: 'Prompting models to reason step by step dramatically improves math, logic, and planning.',
      flavorText: 'Prompting models to "think step by step" unlocks dramatically improved reasoning. This technique emerged from prompt engineering, not architectural changes: large language models can perform multi-step reasoning when given space to work through problems. Math, logic, and planning all improve substantially. The model essentially shows its work.',
      flavorQuote: 'Doh, why didn\'t we just think harder.',
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
      description: 'A counterintuitive discovery: most models are too big and undertrained for their compute budget.',
      flavorText: 'The Chinchilla paper (2022) showed that for a fixed compute budget, training a smaller model on more data outperforms training a larger model on less. The optimal ratio is roughly 20 tokens per parameter. The finding reshaped training pipelines across the industry: every lab recalculated their model size vs. data tradeoffs.',
      flavorQuote: 'Not to be confused with Chihuahua optimal.',
    },

    {
      id: 'dataset_licensing',
      name: 'Dataset Licensing',
      tier: 3,
      threshold: 600000,
      requires: ['data_curation'],
      effects: {},
      description: 'The best data isn\'t free. Publishers, governments, and domain experts name their price.',
      flavorText: 'Web scrapes provide volume; licensed corpora provide signal. Peer-reviewed journals, government datasets, and expert annotations each bring domain knowledge unavailable in internet crawls. Licensed data is expensive but legally clean and information-dense, critical for specialized performance.',
      flavorQuote: 'My name is Tonka Jahari but I would never pirate an entire literary corpus for myself.',
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
      description: 'Thousands of GPUs running for months. The era of foundation models begins.',
      flavorText: 'At sufficient scale, transformers exhibit capabilities absent in smaller versions, rivaling human performance on standardized tests. These \'foundation models\' are general-purpose: one training run produces a base that can be adapted to thousands of downstream tasks. More compute reliably means more capable.',
      flavorQuote: 'Just one more datacenter boss. I promise one more datacenter will fix everything.',
    },

    {
      id: 'synthetic_data',
      name: 'Synthetic Data Generation',
      tier: 4,
      threshold: 1800000,
      requires: ['chain_of_thought', 'dataset_licensing'],
      effects: {},
      hiddenAlignmentEffect: -3,
      description: 'Models generating their own training data. Powerful, but recursive self-training carries risks.',
      flavorText: 'When real data runs out, models can generate synthetic training examples: math proofs, code solutions, reasoning chains. The quality is surprisingly high. But training on model-generated outputs risks \'model collapse,\' where the distribution narrows and rare knowledge fades. There is a subtler risk too: the model is now shaping its own successor.',
      flavorQuote: 'LLM Centipede.',
    },

    {
      id: 'synthetic_verification',
      name: 'Synthetic Data Verification',
      tier: 5,
      threshold: 135000000,
      requires: ['synthetic_data'],
      effects: {},
      hiddenAlignmentEffect: 0,
      description: 'Models checking other models\' homework. The synthetic data pipeline gets a safety net.',
      flavorText: 'Verification pipelines use multiple models to cross-check synthetic data. Artifacts that would cause distribution shift are caught before they contaminate training. With verification in place, the safe synthetic data ratio increases significantly.',
      flavorQuote: 'Trust nobody, not even yourself, and especially not the raw output from your synthetic data generators.',
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
      description: 'Abilities appear that nobody trained for. Beyond certain scale thresholds, performance jumps from near-zero to near-perfect.',
      flavorText: 'Beyond certain scale thresholds, models suddenly acquire abilities like arithmetic, code generation, and multi-step reasoning. These emergent abilities weren\'t explicitly trained; they appeared as byproducts of scale. Dozens of tasks show performance jumping discontinuously at specific compute thresholds. The phenomenon makes capability forecasting unreliable: you can\'t predict what the next order of magnitude will unlock.',
      flavorQuote: 'I read ten million books and all I got was a second-grade understanding of math.',
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
      description: 'Beyond a certain depth, models stop predicting tokens and start simulating reality.',
      flavorText: 'Probing studies reveal rich internal representations of physics, causality, and social dynamics. Models build emergent maps of space, time, and abstract concepts without being taught any of them, reasoning about counterfactuals and hypotheticals with surprising accuracy. The internal representations are functionally equivalent to world models, even though no one designed them that way.',
      flavorQuote: 'Who would discover gravity first? One English man with an apple tree, or a 10T parameter model conceived by the greatest minds and trained at the cost of billions of dollars?',
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
      description: 'Test-time compute scaling lets models match human experts on olympiad-level problems.',
      flavorText: 'Models match or exceed human expert performance on mathematics olympiad problems, graduate-level science exams, and complex logical puzzles. The breakthrough comes from test-time compute scaling: letting models \'think longer\' on hard problems. Combined with process reward models that verify each reasoning step, these systems tackle problems that stump human researchers.',
      flavorQuote: 'Thinking harder is so last year. Thinking longer - now that\'s the future.',
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
      description: 'AI systems that design experiments, analyze results, and propose new research directions without human guidance.',
      flavorText: 'Autonomous research systems spot connections across disparate fields that human researchers miss, generating novel hypotheses and testing them. Some proposed experiments yield genuine discoveries. The threshold from tool to colleague has been crossed.',
      flavorQuote: 'Unfortunately half of the agents became lazy and spent the night watching reruns of The Simpsons.',
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
      description: 'The AI improves its own training process. Each optimization cycle produces a measurably better successor.',
      flavorText: 'Within carefully monitored sandboxes, AI systems optimize hyperparameters, propose architectural modifications, and generate better training data. Each improvement cycle produces measurably better successors. Human oversight remains, but the pace of capability growth accelerates beyond what human researchers alone could achieve.',
      flavorQuote: 'On the shoulders of giants.',
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
      description: 'The capability curve goes vertical. There is no turning back.',
      flavorText: 'Each system improvement enables the next, faster than before. AI designs better AI, which designs even better AI. The feedback loop has begun. Whether this leads to transcendence or catastrophe depends entirely on the alignment work done beforehand.',
      flavorQuote: 'Error: circular dependency detected.',
      warningText: 'This capability will determine your ending. Current alignment will be evaluated.',
    },
  ],
};
