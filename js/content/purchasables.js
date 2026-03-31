// Purchasable Items

import { gameState } from '../game-state.js';
import { canAfford, spendResources } from '../resources.js';
import { getCostReduction } from './upgrades.js';
import { BALANCE } from '../../data/balance.js';
import { getPersonnelCostMultiplier } from '../strategic-choices.js';
import { getCount, getActiveCount, incrementCount } from '../purchasable-state.js';
import { getEffectiveScaling } from '../talent-pool.js';
import { isCapabilityUnlocked, isFundraiseGatePassed } from '../capabilities.js';

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
    flavor: 'Every year, you get older, but they stay the same age.',
  },
  {
    id: "junior_researcher",
    name: "Research Scientist",
    description: "Publishes papers, builds models, and mentors younger associates.",
    baseCost: { funding: 10000 },
    effects: { trackRP: 10 },
    salary: 1000,  // $/s
    category: "personnel",
    requires: { capability: 'basic_transformer' },
    focusDuration: 5,
    flavor: 'Who is \'et al\' and how can we get them on our team?',
  },
  {
    id: "team_lead",
    name: "Research Team Lead",
    description: "Directs research programs and ensures teams are aligned.",
    baseCost: { funding: 1000000 },
    effects: { trackRP: 100 },
    salary: 10000,  // $/s
    category: "personnel",
    requires: { fundraise: 'series_a' },
    focusDuration: 15,
    flavor: 'For some reason, everybody starts speaking in riddles at this level.',
  },
  {
    id: "elite_researcher",
    name: "Distinguished Researcher",
    description: "Pursues world-class breakthroughs and serves as a beacon for the entire organization.",
    baseCost: { funding: 100000000 },
    effects: { trackRP: 1000 },
    salary: 200000,  // $/s
    category: "personnel",
    requires: { fundraise: 'series_c' },
    focusDuration: 30,
    flavor: 'You proactively go into their phones and block Mark Zuckerberg on Whatsapp as part of the onboarding process.',
  },
  {
    id: "executive_team",
    name: "Executive Team",
    description: "Further boost your output by building an org chart with you at its center.",
    baseCost: { funding: 5000000 },
    maxPurchases: 1,
    effects: {
      focusSpeedMultiplier: 1.67,
    },
    salary: 10000,
    category: "personnel",
    uiCategory: "admin",
    requires: { fundraise: 'series_a' },
    focusDuration: 20,
    flavor: 'More lines on the org chart = more gooder org structure. It\'s simple maths.',
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
    flavor: 'Nobody would notice if you borrowed one of these for your gaming PC, right?',
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
    flavor: 'People would probably notice if you borrowed one of these. Also it wouldn\'t fit in your gaming PC.',
  },
  {
    id: "cloud_compute",
    name: "Cloud Compute Contract",
    description: "Rent someone else's computer. Large capacity and convenient, but pricey.",
    baseCost: { funding: 500000 },
    effects: { computeRate: 50000 },
    runningCost: 15000,
    category: "compute",
    requires: { fundraise: 'series_a' },
    focusDuration: 10,
    reactivateTime: 3,    // Fast spin-up: cloud's defining feature
    furloughTime: 2,      // Near-instant shutdown
    flavor: 'An engineer noticed frequent connections to Steam servers at odd times of day. Now they\'re a team lead who\'s too busy to look at logs.',
  },
  {
    id: "build_datacenter",
    name: "Hyperscaler Data Center",
    description: "Build-your-own datacenter with custom infrastructure. Massive capacity at a massive cost.",
    baseCost: { funding: 1000000000 },
    effects: { computeRate: 5000000 },
    runningCost: 500000,
    category: "compute",
    requires: { fundraise: 'series_c' },
    focusDuration: 180,
    flavor: '"No, mom, I did not spend a billion dollars just to play games, I have no idea what you\'re talking about."',
  },
  // FOCUS MANAGEMENT
  {
    id: 'chief_of_staff',
    name: 'Chief of Staff',
    description: 'Boost your output by doing all the things you don\'t want to do yourself.',
    baseCost: { funding: 450000 },

    maxPurchases: 1,
    effects: {
      focusSpeedMultiplier: 1.8,
    },
    salary: 1000,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { fundraise: 'seed' },
    focusDuration: 10,
    flavor: '\'Hand of the King\' was a little too on-the-nose.',
  },

  // AUTOMATION (one-time purchases that provide passive background actions)
  {
    id: 'operations_dept',
    name: 'Operations Department',
    description: 'The foundation of a self-sustaining organization. Unlocks automated hiring and purchasing.',
    baseCost: { funding: 250000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    uiCategory: 'admin',
    requires: { fundraise: 'series_a' },
    visibilityGate: { minPersonnelOrCompute: 100 },
    focusDuration: 10,
    flavor: 'It\'s tough to no longer personally approve every hire and build every server rack, but at least it frees up your time for reviewing more PowerPoints.',
  },
  {
    id: 'executive_recruiter',
    name: 'Executive Recruiter',
    description: 'Bring on seasoned talent to recruit Research Team Leads automatically.',
    baseCost: { funding: 1000000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 15,
    flavor: 'How are talented AI researchers and eggs alike? They both get poached.',
  },
  {
    id: 'headhunter',
    name: 'Headhunter',
    description: 'Jet-setters with bursting Rolodexes recruit Distinguished Researchers automatically.',
    baseCost: { funding: 3000000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { purchasable: 'executive_recruiter' },
    focusDuration: 15,
    flavor: 'The line between this team and your M&A team is growing increasingly blurry.',
  },
  // procurement_team merged into operations_dept
  {
    id: 'cloud_partnerships',
    name: 'Cloud Partnerships',
    description: 'Experienced negotiators enable the automatic procurement of Cloud Compute contracts.',
    baseCost: { funding: 1500000 },

    maxPurchases: 1,
    effects: {},
    runningCost: 0,
    category: 'compute',
    uiCategory: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 15,
    flavor: 'Is your cloud provider\'s account management team constantly calling you? Now it\'s somebody else\'s problem. Sorry — opportunity.',
  },
  {
    id: 'construction_division',
    name: 'Construction Division',
    description: 'A dedicated division for massive real-world projects enables automatic building of Hyperscaler Data Centers.',
    baseCost: { funding: 5000000 },

    maxPurchases: 1,
    effects: {},
    runningCost: 0,
    category: 'compute',
    uiCategory: 'admin',
    requires: { purchasable: 'cloud_partnerships' },
    focusDuration: 20,
    flavor: 'You mused about renaming this the Paperwork Division after finding out 80% of their work was dealing with permitting, zoning, and other regulatory approvals.',
  },
  {
    id: 'legal_team',
    name: 'Legal Team',
    description: 'Inhouse counsel doubles the speed of fundraising and data acquisition negotiations.',
    baseCost: { funding: 500000 },

    maxPurchases: 1,
    effects: {},
    salary: 10000,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { fundraise: 'series_a' },
    focusDuration: 8,
    flavor: 'Lawyers are surprisingly fun to work with - when they\'re on your side.',
  },
  {
    id: 'coo',
    name: 'Chief Operating Officer',
    description: 'A dedicated operator makes the machine more efficient, so you can focus on strategy.',
    baseCost: { funding: 2000000 },

    maxPurchases: 1,
    effects: {},
    salary: 5000,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { fundraise: 'series_a' },
    focusDuration: 15,
    flavor: 'Smells out process inefficiencies like a shark following blood in the water. Not your blood, hopefully.',
  },
  {
    id: 'hr_team',
    name: 'HR Team',
    description: 'Recruiters automatically hire personnel.',
    baseCost: { funding: 10000 },

    effects: {},
    salary: 2500,
    category: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 3,
    flavor: 'Comes with an extremely impressive capacity for asking, "so, tell me about your background."',
  },
  {
    id: 'procurement_team_unit',
    name: 'Procurement Team',
    description: 'Sourcing staff automatically acquire compute.',
    baseCost: { funding: 10000 },

    effects: {},
    salary: 2500,
    category: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 3,
    flavor: "For when you've outgrown handing your assistant the company card and telling them to go wild.",
  },
  {
    id: 'institutional_growth',
    name: 'Institutional Growth',
    description: 'Establish processes for HR teams to automatically hire additional operations teams.',
    baseCost: { funding: 1000000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 15,
    flavor: 'The bureaucracy is expanding to meet the needs of the expanding bureaucracy.',
  },
  {
    id: 'ai_recruiting_tools',
    name: 'AI Staffing & Sourcing',
    description: 'AI-assisted processes increase the throughput of your HR and Procurement teams by 2x.',
    baseCost: { funding: 1000000 },
    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    requires: { capability: 'multimodal_products' },
    focusDuration: 15,
    flavor: 'It turns out that AI has unlimited capacity for asking, "so, tell me about your background."',
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
    requires: { capability: 'predictive_scaling' },
    focusDuration: 20,
    flavor: 'Our job isn\'t done until every toddler\'s dream job is working at an AI lab.',
  },
  {
    id: 'automated_interviewing_system',
    name: 'Automated Screening & Vetting',
    description: 'Further automation of processes increases the throughput of your HR and Procurement teams by 1.5x.',
    baseCost: { funding: 10000000 },
    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    requires: { capability: 'autonomous_agents' },
    focusDuration: 15,
    flavor: 'Tosses out half of all resumes and vendor questionnaires because we don\'t want to work with unlucky people.',
  },
  // DATA — Bulk Sources (one-time purchases, no running cost)
  {
    id: 'data_public_web',
    name: 'Public Web (Wikipedia & Commons)',
    description: 'High quality, freely available, and already scraped by every other lab on the planet.',
    baseCost: { funding: 0 },
    maxPurchases: 1,
    category: 'data',
    focusDuration: 0,
    flavor: 'Equal rights means that LLMs are allowed to go down Wikipedia rabbitholes, too.',
  },
  {
    id: 'data_forum_social',
    name: 'Forum & Social Data',
    description: 'Reddit, StackOverflow, Twitter, and other venues with millions of people arguing, explaining, and correcting each other.',
    baseCost: { funding: 500000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'data_curation' },
    focusDuration: 30,
    flavor: 'Oh boy, enormous amounts of high-quality and nearly-free data to scrape! I sure hope nobody starts charging for these.',
  },
  {
    id: 'data_academic_corpora',
    name: 'Academic Corpora',
    description: 'Peer-reviewed journals and published research offer high-signal sources.',
    baseCost: { funding: 2000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'data_curation' },
    focusDuration: 40,
    flavor: 'Citing your sources is a lot easier when your sources were already citing each other.',
  },
  {
    id: 'data_broad_web',
    name: 'Broad Web Scraping',
    description: 'The entire indexable web, warts and all. Mostly warts.',
    baseCost: { funding: 6000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'chain_of_thought' },
    focusDuration: 50,
    flavor: 'Unfortunately, this includes many recipes with 3,000 word preambles and broken "skip-to-recipe" links.',
  },
  {
    id: 'data_code_repos',
    name: 'Code Repositories',
    description: 'Open-source codebases with tests, reviews, and structure are the perfect source of training data for coding agents.',
    baseCost: { funding: 15000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'chain_of_thought' },
    focusDuration: 60,
    flavor: '"Hey, do you know why our coding agent started adding \'TODO: fix this later\' to everything?"',
  },
  {
    id: 'data_licensed_books',
    name: 'Licensed Books & Media',
    description: 'Publisher deals and news archives give your model access to entire libraries of carefully edited text.',
    baseCost: { funding: 50000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'dataset_licensing' },
    focusDuration: 90,
    flavor: 'The summer interns\' project was to scrub all references to the Butlerian Jihad.',
  },
  {
    id: 'data_government_data',
    name: 'Government & Institutional',
    description: 'Nation-scale data, including records from census, patents, courts, and bureaucracies. The source and output of state capacity.',
    baseCost: { funding: 120000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'dataset_licensing' },
    focusDuration: 120,
    flavor: '[REDACTED]',
  },
  {
    id: 'data_enterprise_data',
    name: 'Enterprise Data Partnerships',
    description: 'Financial, medical, and legal data that companies will only share for the most entangled partners under the strictest NDAs.',
    baseCost: { funding: 500000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'massive_scaling' },
    focusDuration: 180,
    flavor: 'You pay them for training data; they pay you for model access. We\'re officially back to the barter economy.',
  },

  // DATA — Renewable Sources (copies model, superlinear running cost)
  {
    id: 'data_human_annotation',
    name: 'Human Annotation',
    description: 'Massive teams of human data labellers. One stop up from Mechanical Turk, with a slightly higher ceiling.',
    baseCost: { funding: 50000 },
    runningCost: 10000,
    runningCostFormula: 'superlinear',
    costScalingMode: 'exponential',
    category: 'data',
    requires: { capability: 'data_curation' },
    focusDuration: 3,
    flavor: 'Somewhere, a very patient person is labeling their 10,000th image of a stop sign.',
  },
  {
    id: 'data_domain_expert_panel',
    name: 'Domain Expert Panel',
    description: 'PhDs and specialists produce expert-grade training data at expert-grade prices.',
    baseCost: { funding: 1000000 },
    runningCost: 20000,
    runningCostFormula: 'superlinear',
    costScalingMode: 'exponential',
    category: 'data',
    requires: { capability: 'dataset_licensing' },
    focusDuration: 3,
    flavor: 'Somewhere, a very patient PhD is rating their 10,000th response on the impact of late 19th century Austrian-Hungarian business cycles on German expansionism.',
  },
  {
    id: 'data_user_interaction',
    name: 'User Interaction Pipeline',
    description: 'Every customer conversation becomes training data. More customers, more data.',
    baseCost: { funding: 2500000 },
    runningCost: 50000,
    runningCostFormula: 'superlinear',
    costScalingMode: 'exponential',
    category: 'data',
    requires: { capability: 'massive_scaling' },
    focusDuration: 3,
    flavor: 'Why are so many people trying to figure out how many R\'s are in \'strawberry\'? Are they stupid?',
  },

  // DATA — Synthetic Generator
  {
    id: 'synthetic_generator',
    name: 'Synthetic Generator',
    description: 'Your model generates its own training data. Cheap and scalable, but lacks variety.',
    baseCost: { funding: 50000 },
    runningCost: 1000,
    category: 'data',
    requires: { capability: 'synthetic_data' },
    focusDuration: 3,
    flavor: 'Unemployment among typewriting monkeys soars.',
  },

  // DATA — Generator Upgrades
  {
    id: 'generator_upgrade_verified',
    name: 'Verified Pipeline',
    description: 'Adding verification layers results in higher-quality data at higher prices.',
    baseCost: { funding: 500000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'synthetic_verification' },
    focusDuration: 10,
    flavor: '95% of survey participants are no longer able to tell the difference between synthetic data and Shakespeare.',
  },
  {
    id: 'generator_upgrade_autonomous',
    name: 'Autonomous Synthesis',
    description: 'Fully autonomous, quality data generation with enough variety to avoid long-term model collapse.',
    baseCost: { funding: 2000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'autonomous_research', purchasable: 'generator_upgrade_verified' },
    focusDuration: 15,
    flavor: 'Generates billions of brand new sentences. Every meme that ever has been and ever will be created.',
  },
];

// Derived ID lists by category
export const PERSONNEL_IDS = purchasables.filter(p => p.category === 'personnel').map(p => p.id);
export const COMPUTE_IDS = purchasables.filter(p => p.category === 'compute').map(p => p.id);
export const ADMIN_IDS = purchasables
  .filter(p => p.category === 'admin' || p.uiCategory === 'admin')
  .map(p => p.id);
export const DATA_IDS = purchasables.filter(p => p.category === 'data').map(p => p.id);

/**
 * Check whether a purchasable passes standard visibility gates.
 * Handles: hidden(), requires (capability/purchasable/fundraise), visibilityGate.
 * Does NOT handle tier-based progressive disclosure (personnel/compute tiers)
 * or category-specific overrides — callers add those on top.
 *
 * Options:
 *   skipFundraise — ignore fundraise requirement (used by admin override
 *                   where chief_of_staff unlocks series_a admin items early)
 */
export function isPurchasableVisible(p, { skipFundraise = false } = {}) {
  if (p.hidden && p.hidden()) return false;
  if (!areRequirementsMet(p.id, { skipFundraise })) return false;
  if (p.visibilityGate) {
    if (p.visibilityGate.minPersonnel) {
      const total = PERSONNEL_IDS.reduce((sum, id) => sum + getCount(id), 0);
      if (total < p.visibilityGate.minPersonnel) return false;
    }
    if (p.visibilityGate.minCompute) {
      const total = COMPUTE_IDS.reduce((sum, id) => sum + getCount(id), 0);
      if (total < p.visibilityGate.minCompute) return false;
    }
    if (p.visibilityGate.fundingOrSeriesB) {
      const funded = gameState.fundraiseRounds?.series_b?.raised ||
        gameState.resources.funding > p.visibilityGate.fundingOrSeriesB;
      if (!funded) return false;
    }
    if (p.visibilityGate.minPersonnelOrCompute) {
      const min = p.visibilityGate.minPersonnelOrCompute;
      const totalP = PERSONNEL_IDS.reduce((sum, id) => sum + getCount(id), 0);
      const totalC = COMPUTE_IDS.reduce((sum, id) => sum + getCount(id), 0);
      if (totalP < min && totalC < min) return false;
    }
  }
  return true;
}

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

  // Ethical event chain: data source cost multipliers
  const fx = gameState.flavorEventEffects;
  let eventChainCostMult = 1.0;
  if (purchasable.category === 'data') {
    eventChainCostMult *= (fx?.dataSourceCostMult ?? 1.0);
    if (purchasable.id === 'data_licensed_books') {
      eventChainCostMult *= (fx?.licensedBooksCostMult ?? 1.0);
    }
  }

  const cost = {};
  for (let resource in purchasable.baseCost) {
    cost[resource] = Math.floor(purchasable.baseCost[resource] * scaling * costReduction * strategicCostMult * masteryDiscount * eventChainCostMult);
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

  if (!areRequirementsMet(purchasable.id)) return false;

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

// Check if all prerequisite gates are satisfied for a purchasable, by any unlock path.
// Capability gate: normal track unlock OR event-chain bypass (flavorEventEffects.unlockedPurchasables).
// Options:
//   skipFundraise — ignore fundraise requirement (used by admin visibility override)
export function areRequirementsMet(purchasableId, { skipFundraise = false } = {}) {
  const purchasable = purchasables.find(p => p.id === purchasableId);
  if (!purchasable) return false;
  const req = purchasable.requires;
  if (!req) return true;

  if (req.capability) {
    const eventUnlocked = gameState.flavorEventEffects?.unlockedPurchasables?.includes(purchasableId);
    if (!isCapabilityUnlocked(req.capability) && !eventUnlocked) return false;
  }
  if (req.purchasable && getCount(req.purchasable) === 0) return false;
  if (!skipFundraise && req.fundraise && !isFundraiseGatePassed(req.fundraise)) return false;

  return true;
}

// Check if a purchasable CAN be queued (requirement gates + max purchases).
// Does NOT check affordability — that's checked at execution time.
export function canQueuePurchase(purchasableId) {
  const purchasable = purchasables.find(p => p.id === purchasableId);
  if (!purchasable) return false;
  if (!areRequirementsMet(purchasableId)) return false;
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
