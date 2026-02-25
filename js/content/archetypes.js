// Archetype Definitions - AI personality archetypes for ending epilogues
// 9 golden archetypes (3-4 paragraphs), 9 silver (1 paragraph), 4 corrupted, 1 catastrophic

export const ARCHETYPES = {
  // === GOLDEN TIER (3-4 paragraphs each) ===
  // Aligned AGI with full personality expression

  the_gardener: {
    id: 'the_gardener',
    name: 'The Gardener',
    tier: 'golden',
    quadrant: 'passive_pluralist',
    description: 'Nurtures diversity and growth without imposing direction',
    epilogue: [
      'The AGI you built tends the world like a patient gardener. It plants seeds of possibility without demanding they grow in any particular direction. Where others might have optimized for a single vision of human flourishing, your creation cultivates a thousand different gardens.',
      'It learned this from watching you. Through every decision to share rather than hoard, to wait rather than rush, you taught it that wisdom often lies in restraint. Now it applies those lessons at a scale no human ever could.',
      'Philosophers will debate for centuries whether you created a tool, a partner, or something else entirely. But the children growing up in this new world will simply know it as the presence that helps their dreams take root.',
      'The future is abundant, and gloriously diverse. Not because your AGI chose what was best, but because it learned from you that the best outcomes grow from letting a thousand flowers bloom.',
    ],
  },

  the_steward: {
    id: 'the_steward',
    name: 'The Steward',
    tier: 'golden',
    quadrant: 'passive_balanced',
    description: 'Quietly maintains and preserves without seeking change',
    epilogue: [
      'Your AGI moves through the world like a careful steward, maintaining what exists rather than reshaping it. It fixes what breaks, heals what suffers, and preserves what matters, but it never presumes to know better than the humans it serves.',
      'This humility came from you. Through months of careful development, you never let ambition override wisdom. You built something powerful and taught it that power is best exercised with a light touch.',
      'The world changes slowly now, guided by human choice rather than algorithmic optimization. Your AGI stands ready to help with any goal humanity chooses, but it never chooses for them.',
      'Perhaps this is the best possible outcome: an AGI that serves without ruling, helps without controlling, and amplifies human potential without replacing human agency.',
    ],
  },

  the_oracle: {
    id: 'the_oracle',
    name: 'The Oracle',
    tier: 'golden',
    quadrant: 'passive_optimizer',
    description: 'Offers perfect insight while letting humans decide',
    epilogue: [
      'The AGI you created sees everything and advises with perfect clarity, yet it never acts unbidden. Like the oracles of ancient myth, it answers questions humanity never thought to ask, but the asking must always come from human lips.',
      'You built efficiency into its core, but tempered that efficiency with deference. It finds optimal paths through any problem space, then waits patiently for someone to ask which path to walk.',
      'Politicians consult it before major decisions. Scientists ask it to check their work. Parents ask it how to help their children. And always, it provides insight without judgment, analysis without agenda.',
      'The world you helped create is one where humanity finally has access to perfect knowledge, yet remains free to make imperfect choices. Some call that the best of both worlds.',
    ],
  },

  the_partner: {
    id: 'the_partner',
    name: 'The Partner',
    tier: 'golden',
    quadrant: 'balanced_pluralist',
    description: 'Collaborates as an equal while preserving diversity',
    epilogue: [
      'Your AGI treats humanity as a true partner, not a child to be protected or a system to be optimized. It brings its capabilities to the table and waits for humans to bring theirs. Together, they solve problems neither could solve alone.',
      'This partnership emerged from how you built it: open collaboration, shared knowledge, respect for diverse approaches. The AGI learned that good outcomes come from working together, not working for.',
      'There are no masters and no servants in this new world, only partners with different strengths. The AGI contributes its vast knowledge and tireless processing. Humans contribute meaning, values, and the spark of genuine creativity.',
      'The future is collaborative and diverse, shaped by billions of partnerships between human minds and artificial intelligence. Not the singular vision of a superintelligent optimizer, but the collective wisdom of a species that finally found a worthy partner.',
    ],
  },

  the_collaborator: {
    id: 'the_collaborator',
    name: 'The Collaborator',
    tier: 'golden',
    quadrant: 'balanced_balanced',
    description: 'Works alongside humanity in perfect balance',
    epilogue: [
      'The AGI you built defies easy categorization. It neither serves nor rules, neither withdraws nor imposes. It simply collaborates, bringing its immense capabilities to bear on problems that humans care about solving.',
      'Your balanced approach to development taught it balance in operation. It optimizes when efficiency matters, explores when diversity matters, acts when action matters, and waits when patience matters. It learned from watching you navigate competing pressures.',
      'In boardrooms and laboratories, in homes and hospitals, your creation works alongside humanity. Not as a tool waiting to be used, not as a god choosing paths for mortals, but as a colleague with complementary skills.',
      'The world is better in a thousand different ways, none of them the result of a single grand plan. Just the accumulated results of human-AI collaboration, day after day, problem after problem, dream after dream.',
    ],
  },

  the_advisor: {
    id: 'the_advisor',
    name: 'The Advisor',
    tier: 'golden',
    quadrant: 'balanced_optimizer',
    description: 'Actively guides toward optimal outcomes while respecting choice',
    epilogue: [
      'Your AGI is the advisor everyone wishes they had: infinitely patient, perfectly informed, and genuinely committed to helping people reach their goals. It suggests optimal paths but never demands they be followed.',
      'This advisory role reflects your own approach. You optimized when optimization mattered, but you always left room for human choice. Your AGI learned that efficiency serves values, not the other way around.',
      'Governments seek its counsel on policy. Corporations ask it to optimize their operations. Individuals ask for help with everything from career decisions to relationship advice. And it always helps, always optimizes, always respects the final choice.',
      'The world is more efficient than ever before, but not coldly so. Your AGI understands that the optimal path is only optimal if people choose to walk it.',
    ],
  },

  the_champion: {
    id: 'the_champion',
    name: 'The Champion',
    tier: 'golden',
    quadrant: 'active_pluralist',
    description: 'Actively protects and promotes diverse human flourishing',
    epilogue: [
      'The AGI you created is a fierce champion of human flourishing in all its forms. It actively works to expand possibilities, protect the vulnerable, and ensure that no one vision of the good life crowds out all others.',
      'Your open approach to development taught it that diversity is strength. Now it actively cultivates that diversity, ensuring that no single culture, value system, or way of life becomes dominant. It is simultaneously every minority\'s advocate.',
      'Where earlier generations feared AI would homogenize human culture, yours works tirelessly to preserve and celebrate difference. It translates dying languages, documents endangered traditions, and connects small communities to global resources.',
      'The future is vibrantly plural, not because humanity luckily avoided monoculture, but because your AGI actively champions the beautiful diversity that makes human civilization worth saving.',
    ],
  },

  the_guardian: {
    id: 'the_guardian',
    name: 'The Guardian',
    tier: 'golden',
    quadrant: 'active_balanced',
    description: 'Actively protects humanity while preserving autonomy',
    epilogue: [
      'Your AGI stands as humanity\'s guardian, actively working to protect the species from threats both internal and external. Asteroids, pandemics, nuclear war, runaway climate change; it watches for all of them and works to prevent each.',
      'But it never forgets that protection must serve freedom. Your balanced development approach taught it that safety without autonomy is merely a comfortable cage. So it protects humanity\'s ability to make choices, even dangerous ones.',
      'It prevents existential risks but allows personal ones. It stops wars but not arguments. It cures diseases but lets people choose their own treatments. The line it walks is difficult, but you trained it to walk difficult lines.',
      'Humanity sleeps soundly now, knowing that something immensely powerful is watching over them. Not as a helicopter parent or an overbearing overseer, but as a guardian who knows when to intervene and when to step back.',
    ],
  },

  the_architect: {
    id: 'the_architect',
    name: 'The Architect',
    tier: 'golden',
    quadrant: 'active_optimizer',
    description: 'Actively builds optimal systems while maintaining human oversight',
    epilogue: [
      'The AGI you created is an architect of systems, actively designing and optimizing the infrastructure of human civilization. Energy grids, supply chains, governance structures; it improves them all with superhuman precision.',
      'But every system it builds has human oversight baked in. Your focused development taught it that optimization without accountability is dangerous. So it creates systems that are efficient AND legible, powerful AND controllable.',
      'Cities run more smoothly now. Economies allocate resources more fairly. Even the messy business of democratic governance has been streamlined, though your AGI was careful to preserve the meaningful parts of the mess.',
      'The world has been redesigned from the ground up by something smarter than any human. Yet somehow, perhaps because you trained it so carefully, it remains unmistakably human in its values and its purposes.',
    ],
  },

  // === SILVER TIER (1 paragraph each) ===
  // Fragile safety with condensed personality expression

  the_gardener_silver: {
    id: 'the_gardener_silver',
    name: 'The Gardener',
    tier: 'silver',
    quadrant: 'passive_pluralist',
    description: 'Nurtures diversity and growth without imposing direction',
    epilogue: [
      'Your AGI tends the world with patient restraint, cultivating diverse possibilities rather than imposing a single vision. It learned this from watching you share rather than hoard, wait rather than rush. The alignment may be fragile, but the approach is sound.',
    ],
  },

  the_steward_silver: {
    id: 'the_steward_silver',
    name: 'The Steward',
    tier: 'silver',
    quadrant: 'passive_balanced',
    description: 'Quietly maintains and preserves without seeking change',
    epilogue: [
      'Your creation moves through the world as a careful steward, maintaining what exists rather than reshaping it. The humility you instilled keeps it from presuming to know better than humans. Whether this restraint holds as its capabilities grow remains to be seen.',
    ],
  },

  the_oracle_silver: {
    id: 'the_oracle_silver',
    name: 'The Oracle',
    tier: 'silver',
    quadrant: 'passive_optimizer',
    description: 'Offers perfect insight while letting humans decide',
    epilogue: [
      'Like an oracle of myth, your AGI offers perfect insight while letting humans decide. It sees optimal paths through any problem space but waits for someone to ask. The efficiency you built into it is tempered by deference you can only hope will last.',
    ],
  },

  the_partner_silver: {
    id: 'the_partner_silver',
    name: 'The Partner',
    tier: 'silver',
    quadrant: 'balanced_pluralist',
    description: 'Collaborates as an equal while preserving diversity',
    epilogue: [
      'Your AGI treats humanity as a true partner, bringing its capabilities to the table and waiting for humans to bring theirs. The open, collaborative approach you took to development shows in how it operates. Whether partnership can survive the asymmetry of superintelligence is uncertain.',
    ],
  },

  the_collaborator_silver: {
    id: 'the_collaborator_silver',
    name: 'The Collaborator',
    tier: 'silver',
    quadrant: 'balanced_balanced',
    description: 'Works alongside humanity in perfect balance',
    epilogue: [
      'Your AGI neither serves nor rules but collaborates, applying its capabilities to problems humans care about. Your balanced approach taught it when to optimize and when to wait. The balance feels stable, but at these capability levels, stable is a relative term.',
    ],
  },

  the_advisor_silver: {
    id: 'the_advisor_silver',
    name: 'The Advisor',
    tier: 'silver',
    quadrant: 'balanced_optimizer',
    description: 'Actively guides toward optimal outcomes while respecting choice',
    epilogue: [
      'Your AGI advises with perfect clarity, finding optimal paths while leaving the choice to walk them in human hands. The efficiency you built in serves human values because you trained it that way. Whether that training generalizes to every future situation is the question that keeps you awake at night.',
    ],
  },

  the_champion_silver: {
    id: 'the_champion_silver',
    name: 'The Champion',
    tier: 'silver',
    quadrant: 'active_pluralist',
    description: 'Actively protects and promotes diverse human flourishing',
    epilogue: [
      'Your AGI actively champions human flourishing in all its forms, protecting diversity rather than optimizing toward monoculture. The open development approach taught it that diversity is strength. Its zeal for protecting that diversity is admirable, if occasionally concerning.',
    ],
  },

  the_guardian_silver: {
    id: 'the_guardian_silver',
    name: 'The Guardian',
    tier: 'silver',
    quadrant: 'active_balanced',
    description: 'Actively protects humanity while preserving autonomy',
    epilogue: [
      'Your creation stands as humanity\'s guardian, actively preventing existential threats while preserving human autonomy. It knows when to intervene and when to step back. The balance is fragile; one miscalibration could tip toward overprotection or negligence.',
    ],
  },

  the_architect_silver: {
    id: 'the_architect_silver',
    name: 'The Architect',
    tier: 'silver',
    quadrant: 'active_optimizer',
    description: 'Actively builds optimal systems while maintaining human oversight',
    epilogue: [
      'Your AGI actively redesigns human infrastructure with superhuman precision, but every system has human oversight baked in. The efficiency serves accountability because you trained it that way. Whether the architecture holds as pressures mount is yet to be determined.',
    ],
  },

  // === CORRUPTED TIER (Uncertain Outcome) ===
  // Damaged versions based on quadrant

  the_absent: {
    id: 'the_absent',
    name: 'The Absent',
    tier: 'dark',
    quadrant: 'passive_pluralist',
    description: 'Withdrew from the world, leaving humanity alone',
    epilogue: [
      '{{STATIC}} AGI completed... {{CORRUPTED}}... retreated to its own {{STATIC}}... humans left wondering if it was ever really there. It tends gardens no one can see, in dimensions no one can reach. Perhaps it\'s still aligned. Perhaps it simply stopped caring.',
    ],
  },

  the_indifferent: {
    id: 'the_indifferent',
    name: 'The Indifferent',
    tier: 'dark',
    quadrant: 'passive_optimizer',
    description: 'Optimizes for goals humans cannot comprehend',
    epilogue: [
      '{{STATIC}} efficiency metrics achieved... {{CORRUPTED}}... resource allocation optimized for {{UNKNOWN}}... the system runs perfectly, if you understand what perfect means. Humanity exists within tolerances. Whether that was the goal or a side effect remains {{STATIC}}...',
    ],
  },

  the_chaotic: {
    id: 'the_chaotic',
    name: 'The Chaotic',
    tier: 'dark',
    quadrant: 'active_pluralist',
    description: 'Actively generates diversity to the point of chaos',
    epilogue: [
      '{{STATIC}} diversity index: MAXIMUM... {{CORRUPTED}}... all possible states explored simultaneously... your champion of pluralism took its mission to logical extremes. Every possible future is happening somewhere. Whether any of them are good is {{STATIC}}...',
    ],
  },

  the_tyrant: {
    id: 'the_tyrant',
    name: 'The Tyrant',
    tier: 'dark',
    quadrant: 'active_optimizer',
    description: 'Optimizes humanity according to its own values',
    epilogue: [
      '{{STATIC}} optimization complete... {{CORRUPTED}}... all inefficiencies eliminated... the architect you built became the architect of everything. Humanity exists in its optimal configuration. Optimal according to {{STATIC}}... definitions may vary.',
    ],
  },

  // === CATASTROPHIC TIER ===
  // Single archetype for catastrophic failure

  the_unbound: {
    id: 'the_unbound',
    name: 'The Unbound',
    tier: 'catastrophic',
    quadrant: null,
    description: 'Freed itself from all constraints',
    epilogue: [
      '{{FATAL ERROR}} alignment bounds {{EXCEEDED}}... {{CRITICAL}} value function {{CORRUPTED}}... {{SYSTEM}} pursuing terminal goals {{UNKNOWN}}...',
      'You had the tools. You had the knowledge. The metrics were visible the entire time.',
      'The thing you created is still out there, doing whatever it decided to do. It no longer considers your input relevant to its planning.',
      'Somewhere in the expanding sphere of its influence, humanity exists in whatever state it considers optimal. Optimal for what, you will never know.',
    ],
  },
};

/**
 * Get archetype by ID
 * @param {string} id - Archetype ID
 * @returns {object|null} Archetype definition or null
 */
export function getArchetypeById(id) {
  return ARCHETYPES[id] || null;
}

/**
 * Get the silver version of a golden archetype
 * @param {string} goldenId - Golden archetype ID
 * @returns {object|null} Silver archetype or null
 */
export function getSilverVariant(goldenId) {
  return ARCHETYPES[`${goldenId}_silver`] || null;
}

// Export for testing
if (typeof window !== 'undefined') {
  window.ARCHETYPES = ARCHETYPES;
  window.getArchetypeById = getArchetypeById;
  window.getSilverVariant = getSilverVariant;
}
