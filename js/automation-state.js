// js/automation-state.js
// Constants and utility functions for the policy-based automation system.
// State management has been consolidated into purchasable-state.js.

import { gameState } from './game-state.js';
import { BALANCE } from '../data/balance.js';
import { getCount, getActiveCount, getFurloughedCount, getPurchasableState } from './purchasable-state.js';
import { calculateTarget } from './automation-policies.js';

// Re-export state functions from purchasable-state.js for backwards compatibility
export { getActiveCount, getFurloughedCount };

// Items that can be automated (personnel)
export const AUTOMATABLE_PERSONNEL = [
  { id: 'grad_student', unlockPurchase: 'operations_dept' },
  { id: 'junior_researcher', unlockPurchase: 'operations_dept' },
  { id: 'team_lead', unlockPurchase: 'executive_recruiter' },
  { id: 'elite_researcher', unlockPurchase: 'headhunter' },
];

// Items that can be automated (compute)
export const AUTOMATABLE_COMPUTE = [
  { id: 'gpu_consumer', unlockPurchase: 'operations_dept' },
  { id: 'gpu_datacenter', unlockPurchase: 'operations_dept' },
  { id: 'cloud_compute', unlockPurchase: 'cloud_partnerships' },
  { id: 'build_datacenter', unlockPurchase: 'construction_division' },
];

// Admin items that can be furloughed (have ongoing salaries/effects)
export const FURLOUGHABLE_ADMIN = [
  'executive_team', 'chief_of_staff', 'coo', 'legal_team',
  'hr_team', 'procurement_team_unit',
];

// Items that can be automated (data — renewable sources + synthetic generators)
export const AUTOMATABLE_DATA = [
  { id: 'data_human_annotation', unlockPurchase: 'operations_dept' },
  { id: 'data_domain_expert_panel', unlockPurchase: 'operations_dept' },
  { id: 'data_user_interaction', unlockPurchase: 'operations_dept' },
  { id: 'synthetic_generator', unlockPurchase: 'operations_dept' },
];

// Policy types
export const POLICY_TYPES = {
  FIXED: 'fixed',           // Maintain N units
  PERCENT_REVENUE: 'percent_revenue',  // Spend X% of revenue
  PERCENT_ITEM: 'percent_item',        // Maintain at X% of another item
};

// Check if automation is unlocked for an item
export function isAutomationUnlocked(itemId) {
  const personnelItem = AUTOMATABLE_PERSONNEL.find(p => p.id === itemId);
  if (personnelItem) {
    return getCount(personnelItem.unlockPurchase) > 0;
  }
  const computeItem = AUTOMATABLE_COMPUTE.find(c => c.id === itemId);
  if (computeItem) {
    return getCount(computeItem.unlockPurchase) > 0;
  }
  const dataItem = AUTOMATABLE_DATA.find(d => d.id === itemId);
  if (dataItem) {
    return getCount(dataItem.unlockPurchase) > 0;
  }
  // Admin items (unlocked by institutional_growth)
  if (itemId === 'hr_team' || itemId === 'procurement_team_unit') {
    return getCount('institutional_growth') > 0;
  }
  return false;
}

// Check if percent_revenue policy is unlocked (process_optimization research)
export function isPercentRevenueUnlocked() {
  return gameState.tracks.applications.unlockedCapabilities.includes('process_optimization');
}

// Check if percent_item policy is unlocked (process_optimization research)
export function isPercentItemUnlocked() {
  return gameState.tracks.applications.unlockedCapabilities.includes('process_optimization');
}

// Get total HR points per second
export function getHRPointsPerSecond() {
  const hrTeams = getActiveCount('hr_team');
  const basePoints = hrTeams * BALANCE.HR_POINTS_PER_TEAM;
  return basePoints * getHRSpeedMultiplier();
}

// Get total Procurement points per second
export function getProcurementPointsPerSecond() {
  const procTeams = getActiveCount('procurement_team_unit');
  const basePoints = procTeams * BALANCE.PROCUREMENT_POINTS_PER_TEAM;
  return basePoints * getHRSpeedMultiplier(); // Same multiplier applies
}

// Get HR/Procurement speed multiplier from admin upgrades + ops bonus
export function getHRSpeedMultiplier() {
  let mult = 1.0;
  if (getCount('ai_recruiting_tools') > 0) mult *= 2;
  if (getCount('automated_interviewing_system') > 0) mult *= 2;
  // Operations CEO focus: up to +50% automation throughput
  const opsAutoBonus = gameState.computed?.ceoFocus?.opsAutomationBonus ?? 0;
  mult *= (1 + opsAutoBonus);
  return mult;
}

// Get point cost for an item (6x manual focus duration)
export function getItemPointCost(itemId) {
  let cost = BALANCE.AUTOMATION_POINT_COSTS[itemId] || 90;
  // Dedicated Upskilling doubles HR point cost for personnel hires
  const PERSONNEL = ['grad_student', 'junior_researcher', 'team_lead', 'elite_researcher'];
  if (gameState.purchases?.dedicated_upskilling > 0 && PERSONNEL.includes(itemId)) {
    cost *= 2;
  }
  return cost;
}

// Check if HR can hire a specific item type
export function canHRHire(itemId) {
  // Personnel tiers
  if (itemId === 'grad_student') return getCount('operations_dept') > 0;
  if (itemId === 'junior_researcher') return getCount('operations_dept') > 0;
  if (itemId === 'team_lead') return getCount('executive_recruiter') > 0;
  if (itemId === 'elite_researcher') return getCount('headhunter') > 0;

  // Admin items (HR hires procurement teams and itself)
  if (itemId === 'hr_team' || itemId === 'procurement_team_unit') {
    return getCount('institutional_growth') > 0;
  }

  return false;
}

// Check if Procurement can buy a specific item type
export function canProcurementBuy(itemId) {
  if (itemId === 'gpu_consumer') return getCount('operations_dept') > 0;
  if (itemId === 'gpu_datacenter') return getCount('operations_dept') > 0;
  if (itemId === 'cloud_compute') return getCount('cloud_partnerships') > 0;
  if (itemId === 'build_datacenter') return getCount('construction_division') > 0;

  // Data renewable sources (same unlock as base procurement)
  const dataItem = AUTOMATABLE_DATA.find(d => d.id === itemId);
  if (dataItem) return getCount('operations_dept') > 0;

  return false;
}

// Get the effective hire/furlough rate for an item (items per second)
export function getItemRate(itemId) {
  const state = getPurchasableState(itemId);
  if (!state.automation.enabled) return 0;

  const active = getActiveCount(itemId);
  const target = calculateTarget(itemId);
  if (active === target) return 0;

  const pointCost = getItemPointCost(itemId);
  if (pointCost <= 0) return 0;

  // Determine which pool this item draws from
  const isHR = canHRHire(itemId);
  const isProc = canProcurementBuy(itemId);
  const totalPoints = isHR ? getHRPointsPerSecond() : (isProc ? getProcurementPointsPerSecond() : 0);
  if (totalPoints <= 0) return 0;

  // Get all items in the same pool
  const poolItems = isHR
    ? [...AUTOMATABLE_PERSONNEL.map(p => p.id), 'hr_team', 'procurement_team_unit']
    : [...AUTOMATABLE_COMPUTE.map(p => p.id), ...AUTOMATABLE_DATA.map(d => d.id)];

  const myPriority = state.automation.priority || 1;

  // Check if any higher-priority items still need points
  for (const id of poolItems) {
    const s = getPurchasableState(id);
    if (!s.automation.enabled) continue;
    const p = s.automation.priority || 1;
    if (p >= myPriority) continue; // Same or lower priority — skip
    const a = getActiveCount(id);
    const t = calculateTarget(id);
    if (a !== t) return 0; // Higher priority item still consuming points
  }

  // Count items at same priority that still need points
  let samePriorityCount = 0;
  for (const id of poolItems) {
    const s = getPurchasableState(id);
    if (!s.automation.enabled) continue;
    const p = s.automation.priority || 1;
    if (p !== myPriority) continue;
    const a = getActiveCount(id);
    const t = calculateTarget(id);
    if (a === t) continue;
    samePriorityCount++;
  }

  const pointsForThisItem = totalPoints / Math.max(1, samePriorityCount);
  const rate = pointsForThisItem / pointCost;

  return active > target ? -rate : rate;
}

// Expose functions to window for playtester harness
if (typeof window !== 'undefined') {
  window.getHRPointsPerSecond = getHRPointsPerSecond;
  window.getProcurementPointsPerSecond = getProcurementPointsPerSecond;
  window.getHRSpeedMultiplier = getHRSpeedMultiplier;
  window.getItemPointCost = getItemPointCost;
  window.canHRHire = canHRHire;
  window.canProcurementBuy = canProcurementBuy;
  window.getItemRate = getItemRate;
}
