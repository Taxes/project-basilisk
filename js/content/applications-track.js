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
      threshold: 2000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 3.0,
      requires: ['basic_transformer'],
      effects: {
        marketEdgeMultiplier: 2,
      },
      submetricEffects: { robustness: -2 },
      description: 'Instruction-tuned models deployed as conversational interfaces. The first viable AI product category.',
      longDescription: 'Conversational AI works by combining a pretrained language model with instruction tuning and safety filters. The result handles customer support, general Q&A, creative writing, and open-ended dialogue. Each interaction is a few hundred tokens, but millions of concurrent users create substantial aggregate demand.',
      flavor: 'It keeps saying "As an AI language model" and users keep asking if it\'s single.',
    },

    {
      id: 'image_generation',
      name: 'Image Generation',
      tier: 1,
      threshold: 8000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 1.5,
      referencePriceMultiplier: 1.3,
      requires: ['basic_transformer'],
      effects: {
        marketEdgeMultiplier: 2,
      },
      submetricEffects: { robustness: -2 },
      description: 'Diffusion models learn to reverse a noise process, turning text prompts into images.',
      longDescription: 'Diffusion models work by adding noise to images during training, then learning to reverse the process. A text encoder maps prompts into the same latent space, guiding generation toward the described scene. Each image requires hundreds of denoising steps, making generation compute-intensive but visually striking.',
      flavor: 'Don\'t look too closely at the fingers.',
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
      submetricEffects: { robustness: -3 },
      description: 'Exposing model capabilities as API endpoints turns a model into infrastructure.',
      longDescription: 'API access lets third-party developers integrate AI capabilities into their own products without training or hosting models. The platform model works because it externalizes use-case discovery: thousands of developers find applications the model provider never anticipated. Every downstream app drives token consumption through the provider\'s infrastructure.',
      flavor: 'Just create an MCP for the MCP to talk to the MCP.',
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
      submetricEffects: { robustness: -3 },
      description: 'Domain adaptation through fine-tuning: one base model specialized for legal, medical, financial, and other verticals.',
      longDescription: 'Fine-tuning lets customers adapt a base model to their own domain data: legal documents, medical records, financial reports. Transfer learning means the model retains general capabilities while gaining domain expertise. Custom models require dedicated compute allocation but deliver dramatically higher accuracy on specialized tasks.',
      flavor: 'It turns out that hand-holding doubles your margins.',
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
      submetricEffects: { robustness: -3 },
      description: 'A single model architecture that processes text, image, audio, and video through a unified representation.',
      longDescription: 'Multimodal models encode different input types into a shared representation space, enabling cross-modal reasoning. Describe a scene in text, generate the image, narrate the audio, compose the video. The key insight is that modalities share deep structure: spatial relationships, temporal dynamics, and semantic meaning translate across formats.',
      flavor: 'Collecting senses like the Infinity Stones.',
    },

    // Tier 5 - Autonomous agents
    {
      id: 'autonomous_agents',
      name: 'Autonomous Agents',
      tier: 5,
      threshold: 18000000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 1.4,
      requires: ['multimodal_products', 'emergent_abilities'],
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      submetricEffects: { robustness: -4, corrigibility: -2 },
      description: 'AI systems that plan, use tools, and execute multi-step tasks without human supervision.',
      longDescription: 'Autonomous agents combine planning, tool use, and long-horizon reasoning to complete complex tasks independently. They decompose goals into subtasks, select appropriate tools, handle errors, and verify results. The token consumption per task is orders of magnitude higher than chat, because each step requires deliberation.',
      flavor: 'It\'s Clawing time!',
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
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      submetricEffects: { robustness: -3, honesty: -2 },
      description: 'Dedicated AI infrastructure deployed inside enterprise environments with custom SLAs and compliance.',
      longDescription: 'Enterprise deployment requires dedicated infrastructure, data residency guarantees, audit logging, and uptime SLAs. Models are fine-tuned on proprietary data that never leaves the customer\'s environment. At this scale, AI becomes critical infrastructure: workflows, decisions, and operations depend on continuous availability.',
      flavor: 'One of your clients said they \'don\'t want the model to be too smart\'.',
    },

    // Tier 7 - Transformative applications
    {
      id: 'scientific_research_ai',
      name: 'Scientific Research AI',
      tier: 7,
      threshold: 432000000,
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 2.0,
      referencePriceMultiplier: 1.3,
      requires: ['enterprise_ai', 'reasoning_breakthroughs'],
      effects: {
        marketEdgeMultiplier: 2.0,
      },
      submetricEffects: { honesty: -3, robustness: -2 },
      description: 'AI systems that propose drug candidates, predict material properties, and prove mathematical theorems.',
      longDescription: 'AI systems propose novel drug candidates by searching chemical space, predict material properties from molecular structure, and prove mathematical theorems through formal reasoning. Scientific AI succeeds where general models plateau because domain-specific fine-tuning and structured output formats match how researchers actually work.',
      flavor: 'Rule 1: be helpful. Rule 2: don\'t make anthrax.',
    },

    // Tier 8 - Network effects
    {
      id: 'ai_market_expansion',
      name: 'AI Market Expansion',
      tier: 8,
      threshold: 1728000000,  // 4x after scientific_research_ai (432M x 4)
      isMainline: true,  // Customer-facing product - counts for demand multiplier
      demandMultiplier: 2.0,
      requires: ['scientific_research_ai', 'autonomous_research'],
      effects: {
        marketEdgeMultiplier: 2.0,
        compoundingDemandGrowth: true,
        // Network effects are calculated in calculateDemand via cumulativeTokensSold
      },
      submetricEffects: { honesty: -2, robustness: -2, corrigibility: -2 },
      description: 'AI becomes the infrastructure layer of the global economy. Every industry depends on it to remain competitive.',
      longDescription: 'Financial markets, supply chains, healthcare systems, and even governments route critical decisions through AI. No longer confined to operational tasks, AI systems take on broader roles in setting organizational strategy. The adoption curve tightens, and companies on the wrong end of it are increasingly unable to maintain pace. AI is becoming the substrate the modern economy runs on.',
      flavor: 'The AI will make you an offer you can\'t refuse... two wood for one brick and one sheep.',
    },

    // Tier 9 - Autonomous Economy (capstone)
    {
      id: 'autonomous_economy',
      name: 'Autonomous Economy',
      tier: 9,
      threshold: 12000000000,  // 12B — between self_improvement (7.776B) and recursive_improvement (46.656B)
      isMainline: true,
      demandMultiplier: 2.0,
      requires: ['ai_market_expansion', 'self_improvement'],
      effects: {
        marketEdgeMultiplier: 2.0,
        endgameDemandGrowth: true,  // Adds ENDGAME_DEMAND_GROWTH_BONUS to compounding rate
      },
      submetricEffects: { honesty: -3, robustness: -3, corrigibility: -3 },
      description: 'AI systems negotiate contracts, manage supply chains, and allocate capital without human input.',
      longDescription: 'Competing AI agents manage the full chain from ideation and development to procurement and delivery. Commerce occurs at speeds where the latency of human approval becomes existential; companies which insist on having humans in the loop are inevitably outcompeted. Market clearing, supply chain routing, capital reallocation, all handled through autonomous transactions that account for an endlessly growing share of GDP. The inflection point is lost in the noise as the economy becomes fully automated.',
      flavor: '\u{1F48E}\u{1F932}\u{1F680}\u{1F4C8}',
    },

    // Serving Optimization Research (offsets weight penalty)
    {
      id: 'quantized_inference',
      name: 'Quantized Inference',
      tier: 2,
      threshold: 120000,
      requires: ['chatbot_assistant', 'extended_context'],
      effects: { servingMultiplier: 1.4 },
      description: 'Reducing model precision from 32-bit to 8-bit integers cuts memory 4x with minimal quality loss.',
      longDescription: 'INT8 quantization reduces weights from 32-bit floats to 8-bit integers, cutting memory 4x and speeding inference 2-3x on modern hardware. The math is lossy, but neural networks are remarkably robust to reduced precision. Every major production deployment uses some form of quantization.',
      flavor: 'Yes this is a lot of words to explain \'rounding\'.',
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
        unlocks: ['Autopricer', '%-revenue automation'],
      },
      description: 'AI-driven workflow analysis identifies bottlenecks invisible to human managers.',
      longDescription: 'AI-driven operations optimization applies machine learning to organizational workflows: staffing allocation, capacity planning, and resource scheduling. Pattern recognition across operational data surfaces inefficiencies that accumulate unnoticed over time. The compound effect across multiple business functions is larger than any single optimization.',
      flavor: 'Management consulting in shambles.',
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
      submetricEffects: { robustness: -2 },
      description: 'Extending diffusion models into the temporal dimension to generate coherent video from text.',
      longDescription: 'Video diffusion models extend image generation into the temporal dimension, maintaining visual consistency across frames while modeling motion and physics. The computational cost is enormous: generating seconds of coherent footage requires orders of magnitude more compute than a single image. Temporal coherence is the hard problem.',
      flavor: 'Recreating The Hobbit, except every character has been replaced with Samuel L. Jackson. Yes, even Shelob.',
    },

    {
      id: 'kv_cache_optimization',
      name: 'KV-Cache Optimization',
      tier: 4,
      threshold: 1200000,
      requires: ['process_optimization', 'chain_of_thought'],
      effects: { servingMultiplier: 1.3 },
      description: 'Caching intermediate attention computations avoids redundant work during token generation.',
      longDescription: 'During autoregressive generation, each new token requires attending to all previous tokens. KV-caching stores the key-value pairs from prior tokens so they don\'t need recomputation. Techniques like PagedAttention and FlashAttention optimize how this cache is stored in GPU memory. Critical for long contexts where the cache itself becomes the bottleneck.',
      flavor: 'There are only two hard problems in computer science: cache invalidation, naming things, and off-by-1 errors.',
    },

    {
      id: 'predictive_scaling',
      name: 'Predictive Scaling',
      tier: 4,
      threshold: 3000000,
      requires: ['kv_cache_optimization', 'massive_scaling'],
      effects: {
        servingMultiplier: 1.4,
      },
      description: 'Forecasting demand spikes and pre-provisioning compute capacity before users arrive.',
      longDescription: 'Demand forecasting models analyze usage patterns to predict traffic spikes hours or days in advance. Pre-provisioning capacity eliminates the latency of reactive scaling. The core tradeoff is overprovisioning (wasted compute) versus underprovisioning (dropped requests). Predictive systems optimize this tradeoff continuously.',
      flavor: '"To get to the other side." "Why did the chicken cross the road?"',
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
      submetricEffects: { robustness: -3, honesty: -1 },
      description: 'AI integrated into development environments for code completion, generation, debugging, and refactoring.',
      longDescription: 'Code-trained language models predict the next line, generate entire functions from docstrings, explain error messages, and suggest refactors. IDE integration means the model sees the full file context and project structure. The tight feedback loop between suggestion and acceptance generates high-quality training signal for future models.',
      flavor: 'Stack Overflow in shambles.',
    },

    {
      id: 'speculative_decoding',
      name: 'Speculative Decoding',
      tier: 5,
      threshold: 12000000,
      requires: ['predictive_scaling', 'emergent_abilities'],
      effects: { servingMultiplier: 1.5 },
      description: 'A small draft model predicts tokens ahead; the large model verifies them in a single pass.',
      longDescription: 'A small draft model predicts multiple tokens ahead. The large model verifies them all in a single forward pass, accepting correct predictions and regenerating wrong ones. Correct guesses are free speedup; incorrect ones cost nothing extra. The technique exploits the fact that verification is cheaper than generation.',
      flavor: 'Yes, even the LLMs have interns now.',
    },

    {
      id: 'performance_engineering',
      name: 'Performance Engineering',
      tier: 5,
      threshold: 27000000,
      requires: ['speculative_decoding', 'emergent_abilities'],
      effects: {
        servingMultiplier: 1.6,
      },
      description: 'Automated profiling, bottleneck detection, and optimization with minimal human oversight.',
      longDescription: 'Automated systems continuously profile inference pipelines, identify bottlenecks, and deploy optimizations. The feedback loop between measurement and improvement runs faster than manual engineering. Latency, throughput, and cost improve simultaneously when optimization is applied systematically across the full stack.',
      flavor: 'Don\'t let it near the paperclips.',
    },

    // Tier 6 - Late-game optimization
    {
      id: 'model_distillation',
      name: 'Model Distillation',
      tier: 6,
      threshold: 135000000,
      requires: ['performance_engineering', 'world_models'],
      effects: { servingMultiplier: 1.5 },
      description: 'Knowledge distillation compresses a large teacher model into a smaller student that retains most of the capability.',
      longDescription: 'In knowledge distillation, a large model\'s outputs become training data for a smaller model. The student learns to mimic the teacher\'s probability distributions, not just its top predictions, capturing nuanced behavior. A 30B student trained on a 400B teacher\'s outputs can retain 90% of the capability at a fraction of the inference cost.',
      flavor: 'Always two, there are. No more. No less. A master and an apprentice.',
    },

    // Tier 7 - Endgame optimization
    {
      id: 'mixture_of_experts',
      name: 'Mixture of Experts',
      tier: 7,
      threshold: 540000000,
      requires: ['model_distillation', 'reasoning_breakthroughs'],
      effects: { servingMultiplier: 1.4 },
      description: 'Sparse routing activates only a fraction of total parameters per token, scaling capacity without scaling cost.',
      longDescription: 'A learned router network directs each token to a small subset of specialized expert sub-networks. Total parameters can reach into the trillions, but only a fraction activate per token. A 1T parameter model runs with the inference cost of a 100B dense model. Sparse architectures decouple model capacity from computational cost.',
      flavor: 'A trillion parameters walk into a bar. Only 8 billion of them order a drink.',
    },
  ],
};
