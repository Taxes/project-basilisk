// Strategic Choices - Content Definitions
// Each choice has two mutually exclusive options with permanent effects.

export const strategicChoiceDefinitions = [
  {
    id: 'open_vs_proprietary',
    enabled: false, // Disabled while iterating on design - see ai-game-strategic-choices worktree
    name: 'Open Research vs Proprietary Models',
    description: 'The defining AI lab decision. Do you share your breakthroughs with the world, or protect your competitive advantage?',
    unlock: {
      // Gate: Series A must be completed (ensures player has context)
      // Plus: extended_context researched (implicit from Series A gate, but explicit here)
      seriesCompleted: 'series_a',
      research: 'extended_context',
    },
    options: [
      {
        id: 'open_research',
        name: 'Open Research',
        description: 'Share breakthroughs with the world. Accelerates science but helps competitors.',
        effects: [
          { label: '+20% research rate', type: 'positive' },
          { label: '-30% researcher hiring costs', type: 'positive' },
        ],
        alignmentNote: null,
        bestWhen: 'Research-constrained, want faster capability progression',
      },
      {
        id: 'proprietary_models',
        name: 'Proprietary Models',
        description: 'Protect your competitive advantage. Stronger economic position but slower research.',
        effects: [
          { label: '+30% market edge', type: 'positive' },
          { label: '+15% token revenue', type: 'positive' },
          { label: '-10% research rate', type: 'negative' },
        ],
        alignmentNote: null,
        bestWhen: 'Funding-constrained, want stronger economic position',
      },
    ],
  },
  {
    id: 'government_vs_independent',
    enabled: false, // Disabled while iterating on design - see ai-game-strategic-choices worktree
    name: 'Government Partnership vs Independent Lab',
    description: 'The military money question. Real AI labs face this constantly.',
    unlock: {
      // Gate: Series B must be completed (government doesn't contract with tiny startups)
      // Plus: massive_scaling researched OR competitor ahead by 10% (pressure trigger)
      seriesCompleted: 'series_b',
      research: 'massive_scaling',
      competitorAhead: 10, // Pressure trigger: competitor ahead by this many percentage points
    },
    options: [
      {
        id: 'government_partnership',
        name: 'Government Partnership',
        description: 'Accept government compute and funding. Constraints come with the contract.',
        effects: [
          { label: '+40% compute capacity', type: 'positive' },
          { label: '+$500/s funding', type: 'positive' },
        ],
        alignmentNote: 'Your safety team notes government oversight may constrain future research directions',
        bestWhen: 'Funding-constrained, compute-bottlenecked',
      },
      {
        id: 'independent_lab',
        name: 'Independent Lab',
        description: 'Retain full autonomy over research priorities. No outside funding boost.',
        effects: [
          { label: '+15% research rate', type: 'positive' },
        ],
        alignmentNote: 'Your lab retains full autonomy over research priorities',
        bestWhen: 'Research-focused, alignment-conscious',
      },
    ],
  },
  {
    id: 'rapid_vs_careful',
    enabled: true,
    name: 'Rapid Deployment vs Careful Validation',
    description: 'Move fast and break things, or validate before shipping? Capabilities are getting powerful.',
    unlock: {
      // Gate: Series C completed OR competitor > 50% (racing creates pressure)
      // Plus: emergent_abilities researched
      seriesCompleted: 'series_c',
      seriesOrCompetitor: 50, // Alternative gate: competitor above this %
      research: 'emergent_abilities',
    },
    options: [
      {
        id: 'rapid_deployment',
        name: 'Rapid Deployment',
        description: 'Ship fast, capture market. More demand, faster growth, stronger edge.',
        effects: [
          { label: '+20% demand', type: 'positive' },
          { label: '+20% customer growth rate', type: 'positive' },
          { label: '-20% market edge decay rate', type: 'positive' },
        ],
        bestWhen: 'Market edge declining, need revenue boost',
      },
      {
        id: 'careful_validation',
        name: 'Careful Validation',
        description: 'Validate before shipping. Fewer incidents, clearer conscience.',
        effects: [
          { label: '-30% incident rate', type: 'positive', minPhase: 2 },
          { label: 'Sleep a bit better at night', type: 'positive' },
        ],
        bestWhen: 'Strong market position, playing for safety',
      },
    ],
  },
];
