// Purchasable Items

import { gameState } from '../game-state.js';
import { canAfford, spendResources } from '../resources.js';
import { getCostReduction } from './upgrades.js';
import { BALANCE } from '../../data/balance.js';
import { getPersonnelCostMultiplier } from '../strategic-choices.js';
import { getCount, getActiveCount, incrementCount } from '../purchasable-state.js';
import { getEffectiveScaling } from '../talent-pool.js';

export const purchasables = [
  // PERSONNEL (costs funding)
  {
    id: "grad_student",
    name: "Research Associate",
    description: "Does the grunt work that makes breakthroughs possible. You'll want a lot of them.",
    baseCost: { funding: 500 },
    effects: { trackRP: 1 },
    salary: 100,  // $/s
    category: "personnel",
    focusDuration: 2,
    flavorText: 'Every year, you get older, but they stay the same age.',
  },
  {
    id: "junior_researcher",
    name: "Research Scientist",
    description: "Publishes papers, builds models, and makes everyone under them better.",
    baseCost: { funding: 10000 },
    effects: { trackRP: 10 },
    salary: 1000,  // $/s
    category: "personnel",
    requires: { capability: 'basic_transformer' },
    focusDuration: 5,
    flavorText: 'Who is \'et al\' and how can we get them on our team?',
  },
  {
    id: "team_lead",
    name: "Research Team Lead",
    description: "Experienced enough to direct research and mentor the people doing it.",
    baseCost: { funding: 1000000 },
    effects: { trackRP: 100 },
    salary: 10000,  // $/s
    category: "personnel",
    requires: { capability: 'extended_context' },
    focusDuration: 15,
    flavorText: 'For some reason, everybody starts speaking in riddles at this level.',
  },
  {
    id: "elite_researcher",
    name: "Distinguished Researcher",
    description: "World-class. Their presence lifts the output of every researcher in the lab.",
    baseCost: { funding: 100000000 },
    effects: { trackRP: 1000 },
    salary: 200000,  // $/s
    category: "personnel",
    requires: { fundraise: 'series_c' },
    focusDuration: 30,
    flavorText: 'You proactively go into their phones and block Mark Zuckerberg on Whatsapp as part of the onboarding process.',
  },
  {
    id: "executive_team",
    name: "Executive Team",
    description: "A real org chart. With boxes and everything.",
    baseCost: { funding: 5000000 },
    maxPurchases: 1,
    effects: {
      focusSpeedMultiplier: 1.67,
    },
    salary: 10000,
    category: "personnel",
    uiCategory: "admin",
    requires: { capability: 'extended_context', fundraise: 'series_a' },
    focusDuration: 20,
    flavorText: 'More lines on the org chart = more gooder org structure. It\'s simple maths.',
  },

  // COMPUTE (costs funding)
  {
    id: "gpu_consumer",
    name: "Consumer GPU",
    description: "Off-the-shelf hardware. It's not much, but it's yours.",
    baseCost: { funding: 2000 },
    effects: { computeRate: 100 },
    runningCost: 20,
    category: "compute",
    focusDuration: 2,
    flavorText: 'Nobody would notice if you borrowed one of these for your gaming PC, right?',
  },
  {
    id: "gpu_datacenter",
    name: "GPU Cluster",
    description: "Professional server racks. More expensive to buy, but much more efficient in the long-run.",
    baseCost: { funding: 50000 },
    effects: { computeRate: 2000 },
    runningCost: 250,
    category: "compute",
    requires: { capability: 'basic_transformer' },
    focusDuration: 8,
    flavorText: 'People would probably notice if you borrowed one of these. Also it wouldn\'t fit in your gaming PC.',
  },
  {
    id: "cloud_compute",
    name: "Cloud Compute Contract",
    description: "Elastic capacity that's fast to spin up or down. Convenience comes at a cost.",
    baseCost: { funding: 500000 },
    effects: { computeRate: 50000 },
    runningCost: 15000,
    category: "compute",
    requires: { capability: 'scaling_laws' },
    focusDuration: 10,
    reactivateTime: 3,    // Fast spin-up: cloud's defining feature
    furloughTime: 2,      // Near-instant shutdown
    flavorText: 'An engineer noticed frequent connections to Steam servers at odd times of day. Now they\'re a team lead who\'s too busy to look at logs.',
  },
  {
    id: "build_datacenter",
    name: "Hyperscaler Data Center",
    description: "Your very own datacenter with custom-built infrastructure. Pricey but unbeatable in the long-term.",
    baseCost: { funding: 1000000000 },
    effects: { computeRate: 5000000 },
    runningCost: 500000,
    category: "compute",
    requires: { fundraise: 'series_c' },
    focusDuration: 180,
    flavorText: '"No, mom, I did not spend a billion dollars just to play games, I have no idea what you\'re talking about."',
  },
  // FOCUS MANAGEMENT
  {
    id: 'chief_of_staff',
    name: 'Chief of Staff',
    description: 'Somebody to do all the things you don\'t want to do yourself.',
    baseCost: { funding: 450000 },

    maxPurchases: 1,
    effects: {
      focusSpeedMultiplier: 1.8,
    },
    salary: 1000,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { capability: 'chatbot_assistant', track: 'applications' },
    focusDuration: 10,
    flavorText: '\'Hand of the King\' was a little too on-the-nose.',
  },

  // AUTOMATION (one-time purchases that provide passive background actions)
  {
    id: 'operations_dept',
    name: 'Operations Department',
    description: 'Unlocks HR and procurement teams for automated hiring and purchasing',
    baseCost: { funding: 250000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    uiCategory: 'admin',
    requires: { fundraise: 'series_a' },
    visibilityGate: { minPersonnelOrCompute: 100 },
    focusDuration: 10,
    flavorText: 'It\'s tough to no longer personally approve every hire and build every server rack, but at least it frees up your time for reviewing more PowerPoints.',
  },
  {
    id: 'executive_recruiter',
    name: 'Executive Recruiter',
    description: 'HR can auto-hire Research Team Leads',
    baseCost: { funding: 1000000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 15,
    flavorText: 'How are talented AI researchers and eggs alike? They both get poached.',
  },
  {
    id: 'headhunter',
    name: 'Headhunter',
    description: 'HR can auto-hire Distinguished Researchers',
    baseCost: { funding: 3000000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { purchasable: 'executive_recruiter' },
    focusDuration: 15,
    flavorText: 'The line between this team and your M&A team is growing increasingly blurry.',
  },
  // procurement_team merged into operations_dept
  {
    id: 'cloud_partnerships',
    name: 'Cloud Partnerships',
    description: 'Procurement can auto-buy Cloud Compute Contracts',
    baseCost: { funding: 1500000 },

    maxPurchases: 1,
    effects: {},
    runningCost: 0,
    category: 'compute',
    uiCategory: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 15,
    flavorText: 'Is your cloud provider\'s account management team constantly calling you? Now it\'s somebody else\'s problem. Sorry — opportunity.',
  },
  {
    id: 'construction_division',
    name: 'Construction Division',
    description: 'Procurement can auto-buy Hyperscaler Data Centers',
    baseCost: { funding: 5000000 },

    maxPurchases: 1,
    effects: {},
    runningCost: 0,
    category: 'compute',
    uiCategory: 'admin',
    requires: { purchasable: 'cloud_partnerships' },
    focusDuration: 20,
    flavorText: 'You mused about renaming this the Paperwork Division after finding out 80% of their work was dealing with permitting, zoning, and other regulatory approvals.',
  },
  {
    id: 'legal_team',
    name: 'Legal Team',
    description: '50% faster fundraising and data acquisition negotiations',
    baseCost: { funding: 500000 },

    maxPurchases: 1,
    effects: {},
    salary: 10000,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { fundraise: 'series_a' },
    focusDuration: 8,
    flavorText: 'Lawyers are surprisingly fun to work with - when they\'re on your side.',
  },
  {
    id: 'coo',
    name: 'Chief Operating Officer',
    description: 'Runs the machine so you can steer it. Every operation gets a little cheaper.',
    baseCost: { funding: 2000000 },

    maxPurchases: 1,
    effects: {},
    salary: 5000,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { fundraise: 'series_a' },
    focusDuration: 15,
    flavorText: 'Smells out process inefficiencies like a shark following blood in the water. Not your blood, hopefully.',
  },
  {
    id: 'hr_team',
    name: 'HR Team',
    description: 'Automatically recruits personnel over time',
    baseCost: { funding: 10000 },

    effects: {},
    salary: 2500,
    category: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 3,
    flavorText: 'Comes with an extremely impressive capacity for asking, "so, tell me about your background."',
  },
  {
    id: 'procurement_team_unit',
    name: 'Procurement Team',
    description: 'Automatically purchases compute over time',
    baseCost: { funding: 10000 },

    effects: {},
    salary: 2500,
    category: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 3,
    flavorText: "For when you've outgrown handing your assistant the company card and telling them to go wild.",
  },
  {
    id: 'institutional_growth',
    name: 'Institutional Growth',
    description: 'HR can auto-hire HR Teams and Procurement Teams',
    baseCost: { funding: 1000000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 15,
    flavorText: 'The bureaucracy is expanding to meet the needs of the expanding bureaucracy.',
  },
  {
    id: 'ai_recruiting_tools',
    name: 'AI Staffing & Sourcing',
    description: '2× HR and Procurement point generation',
    baseCost: { funding: 1000000 },
    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    requires: { capability: 'multimodal_products', track: 'applications' },
    focusDuration: 15,
    flavorText: 'It turns out that AI has unlimited capacity for asking, "so, tell me about your background."',
  },
  {
    id: 'dedicated_upskilling',
    name: 'Dedicated Upskilling',
    description: 'Talent pool grows 3×/min. Doubles HR point cost per hire.',
    baseCost: { funding: 5000000 },
    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    hidden: () => !BALANCE.TALENT_POOL_ENABLED,
    requires: { capability: 'predictive_scaling', track: 'applications' },
    focusDuration: 20,
    flavorText: 'Our job isn\'t done until every toddler\'s dream job is working at an AI lab.',
  },
  {
    id: 'automated_interviewing_system',
    name: 'Automated Screening & Vetting',
    description: '1.5× HR and Procurement point generation (stacks)',
    baseCost: { funding: 10000000 },
    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    requires: { capability: 'autonomous_agents', track: 'applications' },
    focusDuration: 15,
    flavorText: 'Tosses out half of all resumes and vendor questionnaires because we don\'t want to work with unlucky people.',
  },
  // DATA — Bulk Sources (one-time purchases, no running cost)
  {
    id: 'data_public_web',
    name: 'Public Web (Wikipedia & Commons)',
    description: 'Wikipedia, Commons, and anything else that\'s free. A starting point, not a destination.',
    baseCost: { funding: 0 },
    maxPurchases: 1,
    category: 'data',
    focusDuration: 0,
    flavorText: 'Equal rights means that LLMs are allowed to go down Wikipedia rabbitholes, too.',
  },
  {
    id: 'data_forum_social',
    name: 'Forum & Social Data',
    description: 'Reddit, StackOverflow, Twitter. Messy and opinionated, but that\'s what makes it real.',
    baseCost: { funding: 500000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'data_curation', track: 'capabilities' },
    focusDuration: 30,
    flavorText: 'Oh boy, enormous amounts of high-quality and nearly-free data to scrape! I sure hope nobody starts charging for these.',
  },
  {
    id: 'data_academic_corpora',
    name: 'Academic Corpora',
    description: 'Small corpus, high signal. Every sentence earned a peer review.',
    baseCost: { funding: 2000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'data_curation', track: 'capabilities' },
    focusDuration: 40,
    flavorText: 'Citing your sources is a lot easier when your sources were already citing each other.',
  },
  {
    id: 'data_broad_web',
    name: 'Broad Web Scraping',
    description: 'Billions of pages, mostly noise. But at this scale, even noise teaches patterns.',
    baseCost: { funding: 6000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'chain_of_thought', track: 'capabilities' },
    focusDuration: 50,
    flavorText: 'Unfortunately, this includes many recipes with 3,000 word preambles and broken "skip-to-recipe" links.',
  },
  {
    id: 'data_code_repos',
    name: 'Code Repositories',
    description: 'Open-source code with tests, reviews, and structure. Teaches reasoning, not just language.',
    baseCost: { funding: 15000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'chain_of_thought', track: 'capabilities' },
    focusDuration: 60,
    flavorText: '"Hey, do you know why our coding agent started adding \'TODO: fix this later\' to everything?"',
  },
  {
    id: 'data_licensed_books',
    name: 'Licensed Books & Media',
    description: 'Publisher deals and news archives. Expensive, but nothing else is this well-edited.',
    baseCost: { funding: 50000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'dataset_licensing', track: 'capabilities' },
    focusDuration: 90,
    flavorText: 'The summer interns\' project was to scrub all references to the Butlerian Jihad.',
  },
  {
    id: 'data_government_data',
    name: 'Government & Institutional',
    description: 'Census data, patents, court records. Slow to acquire, impossible to get any other way.',
    baseCost: { funding: 120000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'dataset_licensing', track: 'capabilities' },
    focusDuration: 120,
    flavorText: '[REDACTED]',
  },
  {
    id: 'data_enterprise_data',
    name: 'Enterprise Data Partnerships',
    description: 'Financial, medical, legal. Behind NDAs for a reason.',
    baseCost: { funding: 500000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'massive_scaling', track: 'capabilities' },
    focusDuration: 180,
    flavorText: 'You pay them for training data; they pay you for model access. We\'re officially back to the barter economy.',
  },

  // DATA — Renewable Sources (copies model, superlinear running cost)
  {
    id: 'data_human_annotation',
    name: 'Human Annotation',
    description: 'People labeling data by hand. Expensive and slow, but nothing beats human judgment.',
    baseCost: { funding: 50000 },
    runningCost: 15000,
    runningCostFormula: 'superlinear',
    costScalingMode: 'exponential',
    category: 'data',
    requires: { capability: 'data_curation', track: 'capabilities' },
    focusDuration: 3,
    flavorText: 'Somewhere, a very patient person is labeling their 10,000th image of a stop sign.',
  },
  {
    id: 'data_domain_expert_panel',
    name: 'Domain Expert Panel',
    description: 'PhDs and specialists producing expert-grade training data. Nothing else matches the depth.',
    baseCost: { funding: 1000000 },
    runningCost: 30000,
    runningCostFormula: 'superlinear',
    costScalingMode: 'exponential',
    category: 'data',
    requires: { capability: 'dataset_licensing', track: 'capabilities' },
    focusDuration: 3,
    flavorText: 'Somewhere, a very patient PhD is rating their 10,000th response on the impact of late 19th century Austrian-Hungarian business cycles on German expansionism.',
  },
  {
    id: 'data_user_interaction',
    name: 'User Interaction Pipeline',
    description: 'Every customer conversation becomes training data. Only works at scale.',
    baseCost: { funding: 2500000 },
    runningCost: 75000,
    runningCostFormula: 'superlinear',
    costScalingMode: 'exponential',
    category: 'data',
    requires: { capability: 'massive_scaling', track: 'capabilities' },
    focusDuration: 3,
    flavorText: 'Why are so many people trying to figure out how many R\'s are in \'strawberry\'? Are they stupid?',
  },

  // DATA — Synthetic Generator
  {
    id: 'synthetic_generator',
    name: 'Synthetic Generator',
    description: 'Your model writes its own training data. Cheaper than humans, but watch for drift.',
    baseCost: { funding: 50000 },
    runningCost: 1000,
    category: 'data',
    requires: { capability: 'synthetic_data', track: 'capabilities' },
    focusDuration: 3,
    flavorText: 'Unemployment among typewriting monkeys soars.',
  },

  // DATA — Generator Upgrades
  {
    id: 'generator_upgrade_verified',
    name: 'Verified Pipeline',
    description: 'A verification layer that catches the model reinforcing its own mistakes. Costs more, raises the floor.',
    baseCost: { funding: 500000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'synthetic_verification', track: 'capabilities' },
    focusDuration: 10,
    flavorText: '95% of survey participants are no longer able to tell the difference between synthetic data and Shakespeare.',
  },
  {
    id: 'generator_upgrade_autonomous',
    name: 'Autonomous Synthesis',
    description: 'Synthetic output that rivals human-curated data. The cost rivals it too.',
    baseCost: { funding: 2000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'autonomous_research', track: 'capabilities', purchasable: 'generator_upgrade_verified' },
    focusDuration: 15,
    flavorText: 'Generates billions of brand new sentences. Every meme that ever has been and ever will be created.',
  },
];

// Derived ID lists by category
export const PERSONNEL_IDS = purchasables.filter(p => p.category === 'personnel').map(p => p.id);
export const COMPUTE_IDS = purchasables.filter(p => p.category === 'compute').map(p => p.id);
export const ADMIN_IDS = purchasables
  .filter(p => p.category === 'admin' || p.uiCategory === 'admin')
  .map(p => p.id);
export const DATA_IDS = purchasables.filter(p => p.category === 'data').map(p => p.id);

// Get all purchasables
export function getAllPurchasables() {
  return purchasables;
}

// Get purchasable by ID
export function getPurchasableById(id) {
  return purchasables.find(p => p.id === id);
}

// Get current cost for a purchasable (with upgrade effects applied)
export function getPurchaseCost(purchasable) {
  const count = getCount(purchasable.id);
  const scalingFactor = getEffectiveScaling(purchasable.id);
  let scaling;
  if (purchasable.costScalingMode === 'exponential') {
    scaling = Math.pow(scalingFactor, count);
  } else {
    scaling = 1 + scalingFactor * count;
  }

  // Get cost reduction multiplier from upgrades
  const costReduction = getCostReduction(purchasable.id);

  // Get strategic choice cost multiplier (for personnel)
  const strategicCostMult = purchasable.category === 'personnel' ? getPersonnelCostMultiplier() : 1.0;

  const masteryDiscount = gameState.computed?.ceoFocus?.purchaseCostDiscount ?? 1;

  const cost = {};
  for (let resource in purchasable.baseCost) {
    cost[resource] = Math.floor(purchasable.baseCost[resource] * scaling * costReduction * strategicCostMult * masteryDiscount);
  }

  return cost;
}

// Check if player can purchase
export function canPurchase(purchasable) {
  const cost = getPurchaseCost(purchasable);

  // Check max purchases
  if (purchasable.maxPurchases) {
    if (getCount(purchasable.id) >= purchasable.maxPurchases) {
      return false;
    }
  }

  // Check capability requirements
  if (purchasable.requires?.capability) {
    const trackName = purchasable.requires.track || 'capabilities';
    const trackState = gameState.tracks?.[trackName];
    const hasCapability = trackState?.unlockedCapabilities?.includes(purchasable.requires.capability);
    if (!hasCapability) {
      return false;
    }
  }

  // Check purchasable requirements
  if (purchasable.requires?.purchasable) {
    if (getCount(purchasable.requires.purchasable) === 0) {
      return false;
    }
  }

  // Check fundraise requirements
  if (purchasable.requires?.fundraise) {
    const roundId = purchasable.requires.fundraise;
    if (!gameState.fundraiseRounds?.[roundId]?.raised) {
      return false;
    }
  }

  return canAfford(cost);
}

// Make a purchase
export function makePurchase(purchasableId) {
  const purchasable = getPurchasableById(purchasableId);
  if (!purchasable) {
    console.error(`Purchasable ${purchasableId} not found`);
    return false;
  }

  if (!canPurchase(purchasable)) {
    console.warn(`Cannot purchase ${purchasableId}`);
    return false;
  }

  // Spend resources
  const cost = getPurchaseCost(purchasable);
  spendResources(cost);

  // Increment purchase count
  incrementCount(purchasableId);

  console.log(`Purchased ${purchasable.name}`);
  return true;
}

// Check if a purchasable CAN be queued (capability gates, max purchases).
// Does NOT check affordability — that's checked at execution time.
export function canQueuePurchase(purchasableId) {
  const purchasable = purchasables.find(p => p.id === purchasableId);
  if (!purchasable) return false;
  if (purchasable.requires?.capability) {
    const track = gameState.tracks[purchasable.requires.track || 'capabilities'];
    if (!track.unlockedCapabilities.includes(purchasable.requires.capability)) {
      return false;
    }
  }
  if (purchasable.requires?.purchasable) {
    if (getCount(purchasable.requires.purchasable) === 0) {
      return false;
    }
  }
  if (purchasable.requires?.fundraise) {
    const roundId = purchasable.requires.fundraise;
    if (!gameState.fundraiseRounds?.[roundId]?.raised) {
      return false;
    }
  }
  if (purchasable.maxPurchases) {
    // Use active count so furloughed units can be unfurloughed via purchase queue
    const active = getActiveCount(purchasableId);
    // Also count items currently in the queue
    const queued = (gameState.focusQueue || [])
      .filter(item => item.type === 'purchase' && item.target === purchasableId)
      .reduce((sum, item) => sum + (item.quantity - item.completed), 0);
    if (active + queued >= purchasable.maxPurchases) return false;
  }
  return true;
}

// Called by queue engine when a single unit completes.
// Returns true if purchase succeeded, false if can't afford.
export function executeSinglePurchase(purchasableId) {
  const purchasable = purchasables.find(p => p.id === purchasableId);
  if (!purchasable) return false;

  const cost = getPurchaseCost(purchasable);
  if (!canAfford(cost)) return false;

  spendResources(cost);
  incrementCount(purchasableId);

  return true;
}

if (typeof window !== 'undefined') {
  window.makePurchase = makePurchase;
  window.canPurchase = canPurchase;
  window.getPurchaseCost = getPurchaseCost;
  window.getAllPurchasables = getAllPurchasables;
  window.getPurchasableById = getPurchasableById;
  window.canQueuePurchase = canQueuePurchase;
  window.executeSinglePurchase = executeSinglePurchase;
}
