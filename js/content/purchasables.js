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
    name: "Research Intern",
    description: "Eager PhD student contributing to research",
    baseCost: { funding: 500 },
    effects: { trackRP: 1 },
    salary: 100,  // $/s
    category: "personnel",
    focusDuration: 2,
  },
  {
    id: "junior_researcher",
    name: "Research Scientist",
    description: "Full-time AI researcher building core systems",
    baseCost: { funding: 10000 },
    effects: { trackRP: 10 },
    salary: 1000,  // $/s
    category: "personnel",
    requires: { capability: 'basic_transformer' },
    focusDuration: 5,
  },
  {
    id: "team_lead",
    name: "Research Team Lead",
    description: "Experienced scientist leading research directions",
    baseCost: { funding: 1000000 },
    effects: { trackRP: 100 },
    salary: 10000,  // $/s
    category: "personnel",
    requires: { capability: 'extended_context' },
    focusDuration: 15,
  },
  {
    id: "elite_researcher",
    name: "Distinguished Researcher",
    description: "World-leading researcher assigned to lead an entire division",
    baseCost: { funding: 100000000 },
    effects: { trackRP: 1000 },
    salary: 200000,  // $/s
    category: "personnel",
    requires: { fundraise: 'series_c' },
    focusDuration: 30,
  },
  {
    id: "executive_team",
    name: "Executive Team",
    description: "+1 focus slot, ×1.67 focus efficiency",
    baseCost: { funding: 5000000 },
    maxPurchases: 1,
    effects: {
      focusSlots: 1,
      focusEfficiencyMultiplier: 1.67,
    },
    salary: 10000,
    category: "personnel",
    uiCategory: "admin",
    requires: { capability: 'extended_context', fundraise: 'series_a' },
    focusDuration: 20,
    flavorText: 'A real org chart. With boxes and everything.',
  },

  // COMPUTE (costs funding)
  {
    id: "gpu_consumer",
    name: "Consumer GPU",
    description: "A rack set up with off-the-shelf consumer GPUs",
    baseCost: { funding: 2000 },
    effects: { computeRate: 100 },
    runningCost: 20,
    category: "compute",
    focusDuration: 2,
  },
  {
    id: "gpu_datacenter",
    name: "GPU Cluster",
    description: "Professional GPU racks — better efficiency than consumer hardware",
    baseCost: { funding: 50000 },
    effects: { computeRate: 2000 },
    runningCost: 250,
    category: "compute",
    requires: { capability: 'basic_transformer' },
    focusDuration: 8,
  },
  {
    id: "cloud_compute",
    name: "Cloud Compute Contract",
    description: "Elastic cloud capacity — fast to spin up, expensive to sustain",
    baseCost: { funding: 500000 },
    effects: { computeRate: 50000 },
    runningCost: 15000,
    category: "compute",
    requires: { capability: 'scaling_laws' },
    focusDuration: 10,
    reactivateTime: 3,    // Fast spin-up: cloud's defining feature
    furloughTime: 2,      // Near-instant shutdown
  },
  {
    id: "build_datacenter",
    name: "Hyperscaler Data Center",
    description: "Your own infrastructure — long build, cheapest long-term compute",
    baseCost: { funding: 1000000000 },
    effects: { computeRate: 5000000 },
    runningCost: 500000,
    category: "compute",
    requires: { fundraise: 'series_c' },
    focusDuration: 180,
  },
  // FOCUS MANAGEMENT
  {
    id: 'chief_of_staff',
    name: 'Chief of Staff',
    description: '+1 focus slot, ×1.8 focus efficiency',
    baseCost: { funding: 450000 },

    maxPurchases: 1,
    effects: {
      focusSlots: 1,
      focusEfficiencyMultiplier: 1.8,
    },
    salary: 1000,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { capability: 'chatbot_assistant', track: 'applications' },
    focusDuration: 10,
    flavorText: 'Finally, someone to say \'let me handle that\' and actually mean it.',
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
    flavorText: 'Job postings now say \'fast-paced environment\' instead of \'we have no HR.\'',
  },
  {
    id: 'executive_recruiter',
    name: 'Executive Recruiter',
    description: 'Unlocks automation for team leads',
    baseCost: { funding: 1000000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 15,
    flavorText: 'Knows every senior researcher in the field by first name. And their salary expectations.',
  },
  {
    id: 'headhunter',
    name: 'Headhunter',
    description: 'Unlocks automation for elite researchers',
    baseCost: { funding: 3000000 },

    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { purchasable: 'executive_recruiter' },
    focusDuration: 15,
    flavorText: 'The kind of person who poaches your best people. Now they work for you.',
  },
  // procurement_team merged into operations_dept
  {
    id: 'cloud_partnerships',
    name: 'Cloud Partnerships',
    description: 'Unlocks automation for cloud compute',
    baseCost: { funding: 1500000 },

    maxPurchases: 1,
    effects: {},
    runningCost: 0,
    category: 'compute',
    uiCategory: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 15,
    flavorText: 'Preferred pricing, dedicated account manager, and an NDA thicker than your business plan.',
  },
  {
    id: 'construction_division',
    name: 'Construction Division',
    description: 'Unlocks automation for building datacenters',
    baseCost: { funding: 5000000 },

    maxPurchases: 1,
    effects: {},
    runningCost: 0,
    category: 'compute',
    uiCategory: 'admin',
    requires: { purchasable: 'cloud_partnerships' },
    focusDuration: 20,
    flavorText: 'Hard hats and server racks. An unusual combination, but it works.',
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
    flavorText: 'Term sheets, data licensing agreements, and vendor contracts all move faster with counsel on retainer.',
  },
  {
    id: 'coo',
    name: 'Chief Operating Officer',
    description: '+5% permanent cost reduction floor, Operations cap +5%',
    baseCost: { funding: 2000000 },

    maxPurchases: 1,
    effects: {},
    salary: 5000,
    category: 'personnel',
    uiCategory: 'admin',
    requires: { fundraise: 'series_a' },
    focusDuration: 15,
    flavorText: 'Turns out \'move fast and break things\' scales poorly. Who knew.',
  },
  {
    id: 'hr_team',
    name: 'HR Team',
    description: 'Automated hiring staff',
    baseCost: { funding: 10000 },

    effects: {},
    salary: 2500,
    category: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 3,
    flavorText: 'Screens resumes, runs background checks, and files the paperwork so you don\'t have to.',
  },
  {
    id: 'procurement_team_unit',
    name: 'Procurement Team',
    description: 'Automated purchasing staff',
    baseCost: { funding: 10000 },

    effects: {},
    salary: 2500,
    category: 'admin',
    requires: { purchasable: 'operations_dept' },
    focusDuration: 3,
    flavorText: 'Sources vendors, negotiates bulk pricing, and tracks every invoice.',
  },
  {
    id: 'institutional_growth',
    name: 'Institutional Growth',
    description: 'HR can hire HR and Procurement teams',
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
    requires: { capability: 'predictive_scaling', track: 'applications' },
    focusDuration: 15,
    flavorText: 'AI screens résumés and vendor proposals alike. HR and procurement teams spend 90% less time on unqualified candidates and overpriced bids.',
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
    flavorText: 'Internal training academies, bootcamps, university partnerships. Growing your own talent is slower but breaks the hiring ceiling.',
  },
  {
    id: 'automated_interviewing_system',
    name: 'Automated Screening & Vetting',
    description: '2× HR and Procurement point generation (stacks)',
    baseCost: { funding: 10000000 },
    maxPurchases: 1,
    effects: {},
    salary: 0,
    category: 'admin',
    requires: { capability: 'autonomous_agents', track: 'applications' },
    focusDuration: 15,
    flavorText: 'AI conducts initial interviews, vets vendor contracts, and flags risks. Human staff handle final approvals only.',
  },
  // DATA — Bulk Sources (one-time purchases, no running cost)
  {
    id: 'data_public_web',
    name: 'Public Web (Wikipedia & Commons)',
    description: 'The sum of human knowledge, neatly categorized.',
    baseCost: { funding: 0 },
    maxPurchases: 1,
    category: 'data',
    focusDuration: 0,
    flavorText: 'The sum of human knowledge, neatly categorized.',
  },
  {
    id: 'data_forum_social',
    name: 'Forum & Social Data',
    description: 'Reddit, StackOverflow, Twitter. Messy, opinionated, authentic.',
    baseCost: { funding: 500000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'data_curation', track: 'capabilities' },
    focusDuration: 30,
    flavorText: 'Reddit, StackOverflow, Twitter. Messy, opinionated, authentic.',
  },
  {
    id: 'data_academic_corpora',
    name: 'Academic Corpora',
    description: 'Peer-reviewed, well-structured. Small corpus, high signal.',
    baseCost: { funding: 2000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'data_curation', track: 'capabilities' },
    focusDuration: 40,
    flavorText: 'Peer-reviewed, well-structured. Small corpus, high signal.',
  },
  {
    id: 'data_broad_web',
    name: 'Broad Web Scraping',
    description: 'Billions of pages. Mostly noise, but scale has value.',
    baseCost: { funding: 6000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'chain_of_thought', track: 'capabilities' },
    focusDuration: 50,
    flavorText: 'Billions of pages. Mostly noise, but scale has value.',
  },
  {
    id: 'data_code_repos',
    name: 'Code Repositories',
    description: 'Open-source code with tests and reviews. Teaches reasoning through structure.',
    baseCost: { funding: 15000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'chain_of_thought', track: 'capabilities' },
    focusDuration: 60,
    flavorText: 'Open-source code with tests and reviews. Teaches reasoning through structure.',
  },
  {
    id: 'data_licensed_books',
    name: 'Licensed Books & Media',
    description: 'Publisher deals, news archives. Expensive, legally clean, well-edited.',
    baseCost: { funding: 50000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'dataset_licensing', track: 'capabilities' },
    focusDuration: 90,
    flavorText: 'Publisher deals, news archives. Expensive, legally clean, well-edited.',
  },
  {
    id: 'data_government_data',
    name: 'Government & Institutional',
    description: 'Census, patents, court records. Bureaucratic to acquire, uniquely comprehensive.',
    baseCost: { funding: 120000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'dataset_licensing', track: 'capabilities' },
    focusDuration: 120,
    flavorText: 'Census, patents, court records. Bureaucratic to acquire, uniquely comprehensive.',
  },
  {
    id: 'data_enterprise_data',
    name: 'Enterprise Data Partnerships',
    description: 'Financial, medical, legal datasets. NDA-locked and domain-rich.',
    baseCost: { funding: 500000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'massive_scaling', track: 'capabilities' },
    focusDuration: 180,
    flavorText: 'Financial, medical, legal datasets. NDA-locked and domain-rich.',
  },

  // DATA — Renewable Sources (copies model, superlinear running cost)
  {
    id: 'data_human_annotation',
    name: 'Human Annotation',
    description: 'Expert annotators label and curate training data.',
    baseCost: { funding: 50000 },
    runningCost: 15000,
    runningCostFormula: 'superlinear',
    costScalingMode: 'exponential',
    category: 'data',
    requires: { capability: 'data_curation', track: 'capabilities' },
    focusDuration: 3,
    flavorText: 'Expert annotators label and curate training data.',
  },
  {
    id: 'data_domain_expert_panel',
    name: 'Domain Expert Panel',
    description: 'PhDs and specialists. Nothing else matches the depth.',
    baseCost: { funding: 1000000 },
    runningCost: 30000,
    runningCostFormula: 'superlinear',
    costScalingMode: 'exponential',
    category: 'data',
    requires: { capability: 'dataset_licensing', track: 'capabilities' },
    focusDuration: 3,
    flavorText: 'PhDs and specialists. Nothing else matches the depth.',
  },
  {
    id: 'data_user_interaction',
    name: 'User Interaction Pipeline',
    description: 'Every conversation is training data. Requires scale to matter.',
    baseCost: { funding: 2500000 },
    runningCost: 75000,
    runningCostFormula: 'superlinear',
    costScalingMode: 'exponential',
    category: 'data',
    requires: { capability: 'massive_scaling', track: 'capabilities' },
    focusDuration: 3,
    flavorText: 'Every conversation is training data. Requires scale to matter.',
  },

  // DATA — Synthetic Generator
  {
    id: 'synthetic_generator',
    name: 'Synthetic Generator',
    description: 'Generates synthetic training data. Quality depends on upgrade level.',
    baseCost: { funding: 50000 },
    runningCost: 1000,
    category: 'data',
    requires: { capability: 'synthetic_data', track: 'capabilities' },
    focusDuration: 3,
    flavorText: 'Feed the model its own output. What could go wrong?',
  },

  // DATA — Generator Upgrades
  {
    id: 'generator_upgrade_verified',
    name: 'Verified Pipeline',
    description: 'Improves synthetic quality to 0.5, increases running cost ×2.5',
    baseCost: { funding: 500000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'synthetic_verification', track: 'capabilities' },
    focusDuration: 10,
    flavorText: 'Cross-reference, filter, verify. Slower, but the output actually teaches.',
  },
  {
    id: 'generator_upgrade_autonomous',
    name: 'Autonomous Synthesis',
    description: 'Improves synthetic quality to 0.7, increases running cost ×5',
    baseCost: { funding: 2000000 },
    maxPurchases: 1,
    category: 'data',
    requires: { capability: 'autonomous_research', track: 'capabilities', purchasable: 'generator_upgrade_verified' },
    focusDuration: 15,
    flavorText: 'The model designs its own curriculum. Teacher becomes student becomes teacher.',
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

  const cost = {};
  for (let resource in purchasable.baseCost) {
    cost[resource] = Math.floor(purchasable.baseCost[resource] * scaling * costReduction * strategicCostMult);
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
