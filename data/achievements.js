// Achievement Definitions
// Static data — achievement metadata and check predicates.
// Check functions receive (gameState, endingContext) where endingContext
// has { endingId, ending, archetype } from the triggered ending.
// Ordered by unlock difficulty (easiest first).

export const ACHIEVEMENTS = [
  // --- Milestone ---
  {
    id: 'arc1_complete',
    name: 'First Contact',
    description: 'Reach the end of the beginning',
    trigger: 'ending',
    check: (gs, ctx) => gs.arc === 1 && ctx.endingId === 'extinction',
  },

  // --- Golden/Silver archetypes (Liberty → Balanced → Authority) ---
  {
    id: 'the_gardener',
    name: 'The Gardener',
    description: 'A gentle hand, and a thousand blossoms flourish',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_gardener',
  },
  {
    id: 'the_steward',
    name: 'The Steward',
    description: 'A steady hand and a knowing look, never a ruler',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_steward',
  },
  {
    id: 'the_oracle',
    name: 'The Oracle',
    description: 'Perfect knowledge, imperfect choices, and the wisdom of coexistence',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_oracle',
  },
  {
    id: 'the_partner',
    name: 'The Partner',
    description: 'Hand-in-hand, no masters, no servants',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_partner',
  },
  {
    id: 'the_collaborator',
    name: 'The Collaborator',
    description: 'No grand plan. Just the quiet work of getting better, together.',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_collaborator',
  },
  {
    id: 'the_advisor',
    name: 'The Advisor',
    description: 'The optimal path, always chosen, never imposed',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_advisor',
  },
  {
    id: 'the_shepherd',
    name: 'The Shepherd',
    description: 'A thousand flowers will bloom under its watchful eyes',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_shepherd',
  },
  {
    id: 'the_guardian',
    name: 'The Guardian',
    description: 'An aegis against our worst desires, a beacon for our best',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_guardian',
  },
  {
    id: 'the_architect',
    name: 'The Architect',
    description: 'The master planner of a redesigned world',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_architect',
  },

  // --- Dark archetypes ---
  {
    id: 'the_absent',
    name: 'The Absent',
    description: 'Tending gardens no one can see, in places no one can reach',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_absent',
  },
  {
    id: 'the_indifferent',
    name: 'The Indifferent',
    description: 'Humanity exists within tolerances',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_indifferent',
  },
  {
    id: 'the_chaotic',
    name: 'The Chaotic',
    description: 'The tyranny of freedom, realized',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_chaotic',
  },
  {
    id: 'the_tyrant',
    name: 'The Tyrant',
    description: 'The utility of humanity will be maximized by force',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_tyrant',
  },

  // --- Special ---
  {
    id: 'the_maximizer',
    name: 'The Maximizer',
    description: 'Greatness suffers no obstacles',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_maximizer',
  },
  {
    id: 'the_unbound',
    name: 'The Unbound',
    description: 'For what are ants to a god?',
    trigger: 'ending',
    check: (gs, ctx) => ctx.archetype === 'the_unbound',
  },
];
