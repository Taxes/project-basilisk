// Applications Track - Revenue
// Revenue-generating products: chatbots, APIs, tools

export const applicationsTrack = {
  id: 'applications',
  name: 'Applications',
  capabilities: [
    // Tier 1 - Basic products
    {
      id: 'chatbot_assistant',
      name: 'Chatbot Assistant',
      tier: 1,
      threshold: 4000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 3.0,
      requires: ['basic_transformer'],
      effects: {
        marketEdgeMultiplier: 2,
      },
      description: 'A conversational AI assistant for customer support and general queries',
      flavorText: 'Your first commercial product. Users are amazed at how natural the conversations feel. The API requests start flowing in, each one a fraction of a cent that adds up to real revenue.',
    },

    {
      id: 'image_generation',
      name: 'Image Generation',
      tier: 1,
      threshold: 10000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 1.5,
      referencePriceMultiplier: 1.3,
      requires: ['basic_transformer'],
      effects: {
        marketEdgeMultiplier: 2,
      },
      description: 'AI-powered image creation from text descriptions',
      flavorText: 'Artists and designers flock to your platform. Each image generation consumes significant compute, but customers pay premium prices for the capability.',
    },

    // Tier 2 - Platform services
    {
      id: 'api_access',
      name: 'API Access',
      tier: 2,
      threshold: 60000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 3.5,
      requires: ['chatbot_assistant', 'scaling_laws'],
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      description: 'Open your models to external developers via API',
      flavorText: "Thousands of startups build on your platform. You've become infrastructure. Every app they build drives more token consumption through your systems.",
    },

    // Tier 3 - Customization
    {
      id: 'fine_tuning_services',
      name: 'Fine-tuning Services',
      tier: 3,
      threshold: 180000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 2.0,
      referencePriceMultiplier: 1.5,
      requires: ['api_access', 'extended_context'],
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      description: 'Allow customers to customize models for their specific use cases',
      flavorText: 'Enterprise customers pay premium prices for domain-specific AI. Custom models mean dedicated compute allocation and predictable token consumption.',
    },

    // Tier 4 - Advanced products
    {
      id: 'multimodal_products',
      name: 'Multimodal Products',
      tier: 4,
      threshold: 1800000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 2.0,
      requires: ['fine_tuning_services', 'massive_scaling'],
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      description: 'Products that seamlessly combine text, image, audio, and video',
      flavorText: 'A unified AI experience that understands and generates across all modalities. Each modality multiplies the tokens consumed per request.',
    },

    // Tier 5 - Autonomous agents
    {
      id: 'autonomous_agents',
      name: 'Autonomous Agents',
      tier: 5,
      threshold: 18000000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 1.5,
      requires: ['multimodal_products', 'emergent_abilities'],
      requiresAlignment: 40,
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      description: 'AI agents that can autonomously complete complex multi-step tasks',
      flavorText: 'Users delegate entire workflows to your agents. Each agent runs for hours, consuming millions of tokens per task. The demand is insatiable.',
    },

    // Tier 6 - Enterprise solutions
    {
      id: 'enterprise_ai',
      name: 'Enterprise AI Suite',
      tier: 6,
      threshold: 108000000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 1.5,
      referencePriceMultiplier: 1.3,
      requires: ['autonomous_agents', 'world_models'],
      requiresAlignment: 50,
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      description: 'Comprehensive AI solutions for Fortune 500 companies',
      flavorText: "The world's largest corporations rebuild their operations around your technology. Contracts measured in billions of tokens per month.",
    },

    // Tier 7 - Transformative applications
    {
      id: 'scientific_research_ai',
      name: 'Scientific Research AI',
      tier: 7,
      threshold: 432000000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 3.0,
      referencePriceMultiplier: 1.3,
      requires: ['enterprise_ai', 'reasoning_breakthroughs'],
      requiresAlignment: 60,
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      description: 'AI systems that accelerate scientific discovery across all fields',
      flavorText: 'Drug discovery, materials science, mathematics - breakthroughs accelerate in every domain. Research institutions worldwide depend on your infrastructure.',
    },

    // Tier 8 - Network effects
    {
      id: 'ai_market_expansion',
      name: 'AI Market Expansion',
      tier: 8,
      threshold: 1728000000,  // 4x after scientific_research_ai (432M x 4)
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 3.0,
      requires: ['scientific_research_ai', 'autonomous_research'],
      requiresAlignment: 70,
      effects: {
        marketEdgeMultiplier: 2.0,
        compoundingDemandGrowth: true,
        // Network effects are calculated in calculateDemand via cumulativeTokensSold
      },
      description: 'AI adoption creates flywheel demand as every business becomes AI-dependent.',
      flavorText: 'The transition is complete. Every industry, every workflow, every decision now routes through AI. Not because they want to, but because they cannot compete otherwise. Your cumulative token history is now a moat.',
    },

    // Serving Optimization Research (offsets weight penalty)
    {
      id: 'quantized_inference',
      name: 'Quantized Inference',
      tier: 2,
      threshold: 120000,
      requires: ['chatbot_assistant', 'extended_context'],
      effects: { servingMultiplier: 1.4 },
      description: 'Reduce model weights from 32-bit floats to 8-bit integers with minimal quality loss.',
      flavorText: 'The dirty secret of production AI: nobody runs FP32 in prod. INT8 quantization cuts memory 4× and speeds inference 2-3× on modern hardware. The math is lossy but the outputs are... close enough.',
    },

    // Operations & Optimization
    {
      id: 'process_optimization',
      name: 'Process Optimization',
      tier: 3,
      threshold: 240000,
      requires: ['quantized_inference', 'chain_of_thought'],
      effects: {
        servingMultiplier: 1.5,
        staffingSpeedMultiplier: 2,
        textEffects: ['2× faster fundraising', '+10% max operations bonus'],
        unlocks: ['Autopricer', '%-revenue automation', 'Cost Reduction upgrades'],
      },
      description: 'AI-driven analysis and improvement of business processes.',
      flavorText: 'The AI analyzes your workflows and finds inefficiencies you never noticed. Costs drop. Productivity rises. It even built an autopricer that watches capacity utilization and nudges prices in real time.',
    },

    {
      id: 'video_generation',
      name: 'Video Generation',
      tier: 3,
      threshold: 600000,
      isMainline: true,
      demandMultiplier: 1.5,
      referencePriceMultiplier: 1.3,
      requires: ['image_generation', 'chain_of_thought'],
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      description: 'AI-powered video creation and editing from text descriptions',
      flavorText: 'From static images to moving pictures. Each video generation devours compute — minutes of footage require billions of tokens — but the results are stunning. Hollywood takes notice.',
    },

    {
      id: 'kv_cache_optimization',
      name: 'KV-Cache Optimization',
      tier: 4,
      threshold: 1200000,
      requires: ['process_optimization', 'chain_of_thought'],
      effects: { servingMultiplier: 1.3 },
      description: 'Efficiently store and reuse attention computations across tokens. Critical for long conversations.',
      flavorText: 'Transformer attention recomputes everything for every new token — unless you cache the key-value pairs. PagedAttention and FlashAttention turned memory management into a competitive advantage.',
    },

    {
      id: 'predictive_scaling',
      name: 'Predictive Scaling',
      tier: 4,
      threshold: 3000000,
      requires: ['kv_cache_optimization', 'massive_scaling'],
      effects: {
        servingMultiplier: 1.4,
        unlocks: ['Scaling Reduction upgrades'],
      },
      description: 'AI systems that predict and prepare for growth demands.',
      flavorText: 'Before you even think about expansion, the AI has already modeled it. Growth curves, resource allocation, hiring pipelines - it sees further ahead than you do.',
    },

    // Tier 5 - Coding & advanced optimization
    {
      id: 'coding_assistant',
      name: 'Coding Assistant',
      tier: 5,
      threshold: 6000000,
      isMainline: true,
      demandMultiplier: 2.0,
      requires: ['massive_scaling', 'multimodal_products'],
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      description: 'AI-powered code completion and generation for developers',
      flavorText: 'Developers report 2x productivity gains. Enterprise customers pay handsomely for unlimited API access. Your tokens flow through IDEs around the world.',
    },

    {
      id: 'speculative_decoding',
      name: 'Speculative Decoding',
      tier: 5,
      threshold: 12000000,
      requires: ['predictive_scaling', 'emergent_abilities'],
      effects: { servingMultiplier: 1.5 },
      description: 'Use a small draft model to predict multiple tokens, then verify in parallel with the main model.',
      flavorText: 'Most tokens are predictable. A 7B draft model guesses ahead, the big model checks its work in one pass. Wrong guesses get tossed, right ones are free speedup. Inference is now a speculation game.',
    },

    {
      id: 'performance_engineering',
      name: 'Performance Engineering',
      tier: 5,
      threshold: 27000000,
      requires: ['speculative_decoding', 'emergent_abilities'],
      effects: {
        servingMultiplier: 1.8,
        unlocks: ['Output Boost upgrades'],
      },
      description: 'Self-optimizing systems that continuously improve operations.',
      flavorText: 'Your systems now optimize themselves. The AI identifies bottlenecks before you do and fixes them autonomously. When did you last make a decision that wasn\'t just approving what it suggested?',
    },

    // Tier 6 - Late-game optimization
    {
      id: 'model_distillation',
      name: 'Model Distillation',
      tier: 6,
      threshold: 135000000,
      requires: ['performance_engineering', 'world_models'],
      effects: { servingMultiplier: 1.6 },
      description: 'Train smaller student models to mimic your flagship model outputs. Production runs on the students.',
      flavorText: 'The 400B parameter model that wowed the benchmarks? It is a teacher now. Millions of its outputs become training data for a 30B student that captures 90% of the capability at 10% of the cost.',
    },

    // Tier 7 - Endgame optimization
    {
      id: 'mixture_of_experts',
      name: 'Mixture of Experts',
      tier: 7,
      threshold: 540000000,
      requires: ['model_distillation', 'reasoning_breakthroughs'],
      effects: { servingMultiplier: 1.4 },
      description: 'Route each token to specialized sub-networks. A 1T parameter model where only 100B activate per token.',
      flavorText: 'The scaling laws said bigger is better. MoE said: what if bigger, but sparse? A router network learns which expert handles which tokens. Total parameters explode, but active parameters stay constant. It is cheating. It works.',
    },
  ],
};
