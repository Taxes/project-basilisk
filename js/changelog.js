// Player-facing changelog — concise, plain-English descriptions
// Newest first. Changes can be flat strings or { section, items } objects.

export const changelog = [
  {
    version: '0.9.1.1',
    date: '2026-03-02',
    changes: [
      'Active prestige bonuses now visible in Settings > Stats (guided mode only)',
      'Removed prestige bonuses appearing on the ending screen in narrative mode',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-03-01',
    changes: [
      {
        section: 'Content',
        items: [
          'Expanded post-breakthrough tutorial with information on new buyables',
          'Split main tutorial and follow-up hints systems',
        ],
      },
      {
        section: 'Balance',
        items: [
          'Reduced requirements for early game research',
        ],
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-03-01',
    changes: [
      {
        section: 'Content',
        items: [
          'Added CEO Focus Mastery: sustained focus unlocks unique bonuses',
          'Added game modes: choose Guided or Narrative at start',
        ],
      },
      {
        section: 'Balance',
        items: [
          'Reworked data tab layout and rebalanced late-game data needs',
          'HR teams can now speed up culture pivots',
        ],
      },
      {
        section: 'Bug fixes',
        items: [
          'Revised the timeline on German expansionism',
          'Fixed maximum flavor',
          'Assorted other tooltip and UI fixes',
        ],
      },
    ],
  },
  {
    version: '0.8.2',
    date: '2026-02-28',
    changes: [
      'Smoother tutorial with better action guidance and new mid-game tips',
      'Fixed research rates not including all bonuses',
      'Exhausted grants now appear in fundraise history',
      'Added a late-game capabilities milestone',
      'Assorted bugfixes and more tooltips',
    ],
  },
  {
    version: '0.8.1',
    date: '2026-02-27',
    changes: [
      'Added a step-by-step tutorial that walks new players through the first 10 minutes',
      'Fixed numerous UI bugs and polish issues',
      'Added Discord channel link',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-02-26',
    changes: [
      'Beta launch',
    ],
  },
];