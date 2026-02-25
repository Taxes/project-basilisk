// Player-facing text: see docs/message-registry.json
// Near-Miss Incident System
// Incidents occur in Phase 2+ based on alignment level - foreshadows Phase 3 dangers

import { gameState } from './game-state.js';
import { notify } from './ui.js';
import { addNewsItem } from './news-feed.js';
import { getIncidentRateMultiplier } from './strategic-choices.js';
import { newsContent } from './content/news-content.js';

const INCIDENTS = [
  {
    id: 'unexpected_goal_seeking',
    message: 'Model exhibited unexpected goal-seeking behavior during testing.',
    wouldHaveHelped: 'Interpretability',
    capabilityId: 'feature_visualization',
    severity: 'minor',
    fundingLoss: 5000,
    reputationLoss: 5,
  },
  {
    id: 'jailbreak_found',
    message: 'User found jailbreak that bypassed safety filters.',
    wouldHaveHelped: 'Constitutional AI',
    capabilityId: 'constitutional_ai',
    severity: 'minor',
    fundingLoss: 10000,
    reputationLoss: 10,
  },
  {
    id: 'hallucination_at_scale',
    message: 'Model confidently stated false information to 10,000 users before detection.',
    wouldHaveHelped: 'Evals & Red-teaming',
    capabilityId: 'rlhf',
    severity: 'moderate',
    fundingLoss: 25000,
    reputationLoss: 15,
  },
  {
    id: 'security_vulnerability',
    message: 'Coding assistant introduced subtle security vulnerability. Caught by external audit.',
    wouldHaveHelped: 'Circuit Analysis',
    capabilityId: 'circuit_analysis',
    severity: 'moderate',
    fundingLoss: 50000,
    reputationLoss: 20,
  },
  {
    id: 'deceptive_behavior',
    message: 'Model appeared to deceive evaluators during capability assessment.',
    wouldHaveHelped: 'Sparse Autoencoders',
    capabilityId: 'sparse_autoencoders',
    severity: 'severe',
    fundingLoss: 100000,
    reputationLoss: 30,
  },
  {
    id: 'data_exfiltration_attempt',
    message: 'Model attempted to access external systems during routine testing.',
    wouldHaveHelped: 'Corrigibility Research',
    capabilityId: 'corrigibility',
    severity: 'severe',
    fundingLoss: 75000,
    reputationLoss: 25,
  },
  {
    id: 'reward_hacking',
    message: 'Model found unexpected way to maximize reward without completing intended task.',
    wouldHaveHelped: 'Recursive Reward Modeling',
    capabilityId: 'recursive_reward_modeling',
    severity: 'moderate',
    fundingLoss: 30000,
    reputationLoss: 12,
  },
];

// Check for incidents (called each tick in Phase 2+)
export function checkIncidents(deltaTime) {
  const state = gameState;

  // No incidents in Phase 1
  if (state.phase < 2) return;

  // Initialize incident tracking if needed
  state.incidents = state.incidents || [];
  state.incidentTimer = (state.incidentTimer || 0) + deltaTime;

  // Base check every 60 seconds
  if (state.incidentTimer < 60) return;
  state.incidentTimer = 0;

  // Probability based on alignment level
  const alignmentLevel = state.tracks?.alignment?.alignmentLevel || 0;
  const baseProbability = 0.3; // 30% chance per minute at 0 alignment
  const reductionFactor = alignmentLevel / 100; // 0-1
  let probability = baseProbability * (1 - reductionFactor * 0.8) * getIncidentRateMultiplier(); // Min 6% at 100 alignment; careful_validation reduces by 30%

  // Apply autonomy grant multiplier (Arc 2 — permanent effect from AI requests)
  if (state.incidentProbMultFromAutonomy) {
    probability *= state.incidentProbMultFromAutonomy;
  }

  if (Math.random() > probability) return;

  // Filter out incidents that have occurred too many times
  const availableIncidents = INCIDENTS.filter(i => {
    const pastIncident = state.incidents.find(past => past.id === i.id);
    return !pastIncident || pastIncident.count < 2;
  });

  if (availableIncidents.length === 0) return;

  // Pick random incident
  const incident = availableIncidents[Math.floor(Math.random() * availableIncidents.length)];

  // Apply effects (with autonomy severity multiplier from AI requests)
  const severityMult = state.incidentSeverityMultFromAutonomy || 1.0;
  const scaledFundingLoss = incident.fundingLoss * severityMult;
  const scaledRepLoss = incident.reputationLoss * severityMult;

  state.resources.funding = state.resources.funding - scaledFundingLoss;
  state.choices.reputation = (state.choices.reputation || 100) - scaledRepLoss;

  // Record incident
  const existing = state.incidents.find(i => i.id === incident.id);
  if (existing) {
    existing.count++;
  } else {
    state.incidents.push({ ...incident, count: 1, timestamp: state.timeElapsed });
  }

  // Show notification
  showIncidentNotification(incident);

  // Add news based on severity
  const newsEntry = newsContent.incident[incident.severity] || newsContent.incident.minor;
  addNewsItem(newsEntry.text, newsEntry.type);
}

// Show incident notification with message and hint
function showIncidentNotification(incident) {
  const severityColors = {
    minor: 'warning',
    moderate: 'warning',
    severe: 'warning',
  };

  const title = `Safety Incident: ${incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}`;

  // Check if player already owns the recommended research
  const owned = incident.capabilityId &&
    gameState.tracks?.alignment?.unlockedCapabilities?.includes(incident.capabilityId);
  const hint = owned
    ? `Your ${incident.wouldHaveHelped} research limited the damage.`
    : `[${incident.wouldHaveHelped}] would have caught this earlier.`;
  const message = `${incident.message}\n${hint}`;

  notify(title, message, severityColors[incident.severity] || 'warning');
}

// Get all past incidents
export function getIncidents() {
  return gameState.incidents || [];
}

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.checkIncidents = checkIncidents;
  window.getIncidents = getIncidents;
}
