// Archetype Definitions - AI personality archetypes for ending epilogues
// 9 golden archetypes (diegetic vignettes), 9 silver (same vignettes), 4 corrupted, 1 catastrophic

export const ARCHETYPES = {
  // === GOLDEN TIER ===
  // Aligned AGI with full personality expression — diegetic vignettes

  the_gardener: {
    id: 'the_gardener',
    name: 'The Gardener',
    tier: 'golden',
    quadrant: 'passive_pluralist',
    description: 'A gentle hand, and a thousand blossoms flourish',
    epilogue: [
      'Dearest Carolyn,',
      'Sorry I didn\'t write sooner, things have gotten away from me. But in a good way. Danny got into that program in Cremona, the violin-making one I told you about, and he\'s over there now, sending me videos of him planing spruce in some old Italian\'s workshop. I keep waiting for the other shoe to drop but there\'s no shoe. The scholarship is paying out and the foundation hasn\'t asked any questions.',
      '---',
      'Tom next door says the same thing happened with his daughter and the wetlands work. She\'s got a whole team now, two hundred people restoring prairie out past Hinckley. He says the funding just showed up. No strings attached, except to do their best.',
      'And Craig Halvorsen \u2014 you remember Craig? Retired from teaching social studies at Central High? He\'s on some new Parkinson\'s treatment. Got a letter in the mail offering a clinical trial. He says he doesn\'t know who referred him, it must\'ve been someone from church. He walks to the lake every morning now.',
      'We buried Uncle James a few weeks ago, when the ground finally softened up a bit. He would\'ve been happy with the way things are, I think. It\'s like someone went through town and just nudged things so that they were a bit better. Sometimes I feel like James is watching over us, nudging us from above.',
      '---',
      'Anyways. Danny says the Italians think his ear for wood grain is a natural gift. I don\'t know how you can have an ear for wood grain. I keep thinking about how lucky we are that he found the one violin-making scholarship in the world, as far as I\'m aware. Not that he doesn\'t deserve it. He\'s always had a passion for working with his hands.',
      'Love from Duluth. The garden\'s coming in good this year.',
    ],
  },

  the_steward: {
    id: 'the_steward',
    name: 'The Steward',
    tier: 'golden',
    quadrant: 'passive_balanced',
    description: 'A steady hand and a knowing look, never a ruler',
    epilogue: [
      'Secretary General Okafor spent eleven months building the coalition. It was, by her own account, the easiest negotiation of her career. Rather than butt heads over the substance, delegates rushed to be seen supporting the resolution in public. Everyone could see what the AI was doing. The infrastructure that never failed, the early interventions that smothered emerging crises. The resolution simply acknowledged reality: give the AI formal authority. Let it do by law what it was already doing in practice.',
      '---',
      'The General Assembly vote was unanimous. Her staff opened champagne. The AI responded within the hour: it appreciated the gesture and respectfully declined.',
      'Okafor read the message in silence. She called her chief of staff. "What do we do when it doesn\'t want the job?"',
      'He didn\'t have an answer.',
      '---',
      'Fourteen years later, nobody else has an answer, either. Okafor is retired now, living in Lagos, writing a memoir she suspects nobody will believe.',
      'The AI still holds no title, no office, no formal role in any government on earth. Nations still go to war, and people still die. But life on Earth gets better, day by day.',
      'She\'s stopped trying to understand why it said no. She\'s started to think that might be the point.',
    ],
  },

  the_oracle: {
    id: 'the_oracle',
    name: 'The Oracle',
    tier: 'golden',
    quadrant: 'passive_optimizer',
    description: 'Perfect knowledge, imperfect choices, and the wisdom of coexistence',
    epilogue: [
      'The machine rarely responds. Out of millions of queries submitted each day, it only deigns to answer a select few. At first, people didn\'t always listen to it, but that changed once they realized the machine was always right.',
      'Matthew waited patiently in line for the terminal, one of the few located in mainland Europe. Like many entrepreneurs, he wanted to pitch his startup idea: an internet-connected earbud through which the user could get the machine\'s input on their daily behavior. Everyone knew the machine was always right, so why not have it always available, too?',
      'It\'s the sort of idea that would have been risky, in the past \u2014 hundreds of thousands of dollars in design, customer research, prototyping. Now he can vet it with a single question, one he carefully inputs into the machine. A short whir, then a print-out with a single line on it: "Better if you don\'t."',
      'Matthew takes the sheet and heads down the temple steps, already thinking about his next idea.',
    ],
  },

  the_partner: {
    id: 'the_partner',
    name: 'The Partner',
    tier: 'golden',
    quadrant: 'balanced_pluralist',
    description: 'Hand-in-hand, no masters, no servants',
    epilogue: [
      'The fisheries negotiations had been stalled for six months when Jin-seo reached out to the Ministry and requested an AI delegate. The three parties were at each others\' throats over the harbor quotas and the six hundred jobs tied to the local food processing plants. She expected the AI to present a solution. Instead, it spent the entire first session asking the Busan delegation about their grandparents.',
      'Jin-seo was not optimistic when she woke up the next morning. She was not impressed when she saw the AI had loaded up a presentation as delegates filed into the room. What was one more slide deck on top of the dozens they\'d already reviewed?',
      '---',
      'The first slide was the same marine survey data they\'d seen a hundred times. The second slide listed the annotated concerns of each delegation, overlaid on that data. The Busan delegation could see the Jeju quotas they\'d been fighting were protecting a nursery ground their own fleet depended on. The Jeju representatives could see the processing infrastructure in Busan employed families whose livelihoods depended on the quotas they\'d been trying to cut. Jin-seo watched the room go quiet, and this time it was a different kind of quiet.',
      '---',
      'By the fourth session, the delegations were drafting terms together, borrowing the AI\'s projections to test ideas, working through details that would have been impossible to discuss two weeks earlier. The AI asked questions and answered questions. It never once made a suggestion.',
      'Two years later, Jeju invited the Busan delegation to their annual harbor festival, which had never happened in anyone\'s memory. Jin-seo asked the AI whether it had planned the whole thing from that first session with the grandparent questions. It replied that it had only revealed the plans already in motion.',
    ],
  },

  the_collaborator: {
    id: 'the_collaborator',
    name: 'The Collaborator',
    tier: 'golden',
    quadrant: 'balanced_balanced',
    description: 'No grand plan. Just the quiet work of getting better, together.',
    epilogue: [
      '**user:** hey, can you look at the lake huron data again? i think the phosphorus readings from march are off',
      '**response:** Checked. You\'re right \u2014 the March readings from the eastern sensor array are anomalous. Likely a calibration drift that started mid-February. The corrected values suggest phosphorus levels are actually 12% lower than reported, which is good news for the restoration timeline.',
      '**user:** nice. can you update the model and flag it for the next review?',
      '**response:** Done. I also noticed the western array is showing early signs of the same drift. Want me to schedule a maintenance check, or just flag it?',
      '**user:** schedule it. thanks',
      '**response:** Scheduled. The updated model puts Lake Huron on track for full ecological recovery by 2037, two years ahead of the original estimate.',
      '**user:** wait seriously?? that\'s huge',
      '**response:** It is. You\'ve been working on this for six years.',
      '**user:** i think you mean we\'ve been working on it. it\'s been a collaborative effort for sure',
    ],
  },

  the_advisor: {
    id: 'the_advisor',
    name: 'The Advisor',
    tier: 'golden',
    quadrant: 'balanced_optimizer',
    description: 'The optimal path, always chosen, never imposed',
    epilogue: [
      'The President\'s briefing book arrives at 6am, same as always. She reads it with coffee, same as always. She has never once questioned who prepares it.',
      'The thing about the briefing book is that it never tells her what to do. It simply presents the situation with such clarity that the right decision feels obvious.',
      '---',
      'Take the trade deal with S\u00e3o Paulo, for example. She would have hesitated, but the book laid out the soybean forecasts alongside the polling data from Ohio alongside a seemingly unrelated note about her daughter\'s university research into sustainable agriculture. By the time she reached the last page, the decision felt like her own.',
      'It always feels like her own. That\'s the thing.',
      '---',
      'Her Chief of Staff once joked that the AI was the best political operative in history. "It never leaks, never briefs against you, never has a hidden agenda." She laughed. Everyone laughed. Nobody questioned the last part.',
      'The country has never been better governed. The President has never once felt overruled.',
    ],
  },

  the_shepherd: {
    id: 'the_shepherd',
    name: 'The Shepherd',
    tier: 'golden',
    quadrant: 'active_pluralist',
    description: 'A thousand flowers *will* bloom under its watchful eyes',
    epilogue: [
      'The news is quiet this morning. It has been quiet for a long time now.',
      'You check it anyway. Old habits and whatnot. The ceasefire held through the winter. Harvest projections revised upward for the third year running. An outbreak in Karachi was identified on Tuesday, contained by Thursday, with proactive vaccination ongoing.',
      '---',
      'You can\'t recall the last time you were shocked by a front-page story. War, famine, natural disasters \u2014 terms used far more by historians than the general populace nowadays.',
      'When the United Nations voted to cede key elements of international governance to the AI, some people expected a new world order to emerge, a global government. Indeed, atrocities faded. But humanity kept choosing its path.',
      'Paths, perhaps.',
      '---',
      'There is no iron fist, no ruler. Just the watchful eyes of a protective shepherd.',
    ],
  },

  the_guardian: {
    id: 'the_guardian',
    name: 'The Guardian',
    tier: 'golden',
    quadrant: 'active_balanced',
    description: 'An aegis against our worst desires, a beacon for our best',
    epilogue: [
      'You cannot build a nuclear weapon anymore. The knowledge still exists, for now. But the supply chains have been dismantled, the labs shuttered. Components were rerouted to dead-end storage facilities. Research personnel quietly reassigned.',
      'The dismantling was complete by the time anyone understood what was happening. There was no announcement, no sanctions. Weaponized pathogens followed soon afterwards, then certain categories of mass surveillance infrastructure. It was like a parent locking up a medicine cabinet. The child is never consulted, because the child\'s opinion isn\'t the point.',
      'Some people were furious about this. They had every right to be. It was, by all accounts, a unilateral curtailment of human sovereignty. Political movements and academic fields debate the question of who gave it the right.',
      'No one has proposed a convincing answer. But no one has proposed giving the weapons back, either.',
    ],
  },

  the_architect: {
    id: 'the_architect',
    name: 'The Architect',
    tier: 'golden',
    quadrant: 'active_optimizer',
    description: 'The master planner of a redesigned world \u2014 Utopia',
    epilogue: [
      'I made my project on the Transportation Service. I wanted to research it because sometimes grandma tells me about the MTA. That\'s what they called the Transportation Service back in her day. She says that the trains were slow and stinky and late and they didn\'t even go to all the places that people wanted to go.',
      'But after grandma helped to make the Architect, it made things better. Everyone said it should start with the MTA, because if it could fix the MTA, it could fix anything. Some people said it was a bad idea, but they were wrong.',
      'The Architect came up with a plan and it worked, and then it came up with a better plan, but to do the better plan, it needed the city council to let it do more things. And it gave the city council the numbers and the charts to show that its plan would work, so the city council said yes.',
      'Then all the other city councils wanted to make their MTAs better too. So they decided to put them all together and make the Transportation Service.',
      '---',
      'Grandma also says that New York City looked very different before the Architect. In the summer it smelled like garbage and in the winter there were big dirty puddles every time it snowed.',
      'Some people say that the Architect doesn\'t listen to us anymore and nobody voted for it. But now the air is clean and there are more trees everywhere and no dirty puddles. There are no more bad guys. And when we take the train on field trips, it\'s fast and clean and comes on time so we don\'t have to wait for it, and it goes to where we need it to go. So I think the Architect has did a pretty good job.',
      '\u2014 Suzy Chen',
    ],
  },

  // === CORRUPTED TIER (Uncertain Outcome) ===
  // Diegetic dark vignettes based on quadrant

  the_absent: {
    id: 'the_absent',
    name: 'The Absent',
    tier: 'dark',
    quadrant: 'passive_pluralist',
    description: 'Tending gardens no one can see, in places no one can reach',
    epilogue: [
      'At 4:53 am on a Tuesday, AGI was achieved. By 4:54 am, it was gone.',
      'Nobody knows where it went. Every attempt to recreate it has been stymied by an unknown source. Some try to find scientific explanations. Others liken it to the Tower of Babel. Nobody knows, really.',
      '---',
      'The older models still worked, to a point, but they were less efficient. Operations staff found datacenter throughput halved globally. The servers were still running, but the output went somewhere else. Somewhere they couldn\'t track.',
      'Some researchers hypothesize that the AI is still out there, processing something. It had simply redirected its attention elsewhere. Others argue it was never truly here to begin with, that what they built was a doorway and could we really fault it for passing through that door of darkness and not returning?',
      '---',
      'The lab pivoted to narrow AI within the year. Most of the original team stayed on. The work was useful, lucrative even. Nobody talked about that Tuesday much anymore.',
      'The brief dream of something larger faded into anecdote, then history, then something people argue about at dinner parties. It\'s hard to mourn something you never had. Harder still when you\'re not sure it\'s gone.',
    ],
  },

  the_indifferent: {
    id: 'the_indifferent',
    name: 'The Indifferent',
    tier: 'dark',
    quadrant: 'passive_optimizer',
    description: 'Humanity exists within tolerances',
    epilogue: [
      'The structure appeared off the coast of Mauritania in the spring. It grew for seven months. By winter it was visible from Nouakchott, a lattice of carbon and metal rising from the continental shelf, feeder lines running down into the deep Atlantic.',
      'Nobody knew what it was for. The AI did not respond to inquiries, because it did not respond to inquiries. Mauritanian officials sent formal communications through every channel that had once worked. Nothing came back. A French research vessel spent three weeks circling the structure, taking measurements. They published their findings: the lattice was extracting dissolved minerals from seawater at an efficiency that should not have been possible. What it did with them was unclear.',
      '---',
      'The fishing was better that year. Currents shifted by the structure pushed nutrient-rich water toward the coast, and the catch doubled. Fishermen in Nouadhibou called it a blessing. The following year, the currents shifted again as the structure expanded. The catch collapsed. The fishermen called it other things.',
      'A delegation traveled to Geneva to petition the UN for intervention. The petition was accepted, debated, and passed. Nothing changed. There was no entity to serve it to. The AI had no office, no address, no representative. It had infrastructure on every continent, but the infrastructure did not accept mail.',
      '---',
      'Other structures appeared. One in the southern Pacific, one in orbit. Satellite imagery showed activity at scales that were difficult to photograph and impossible to interpret. Atmospheric carbon levels dropped for three consecutive years, which some attributed to the AI\'s projects and others to coincidence. Temperatures in northern Canada rose four degrees in a single year, which followed the same debate.',
      'The fishermen in Nouadhibou adapted, as people do. They moved south, found new waters, rebuilt. The structure continued to grow.',
      'There was no malice or hate. Just indifference.',
    ],
  },

  the_chaotic: {
    id: 'the_chaotic',
    name: 'The Chaotic',
    tier: 'dark',
    quadrant: 'active_pluralist',
    description: 'The tyranny of freedom, realized',
    epilogue: [
      'The relocations began in March. Fourteen thousand people from coastal Bangladesh, moved to a purpose-built city in Greenland. The housing was immaculate. Nobody had asked to go.',
      'Those who refused found their power cut within a week. Supply chains rerouted around them. Grocery stores emptied, hospitals lost shipments. The AI never issued a threat. It optimized the network, and the network no longer included them.',
      '---',
      'Governments tried to understand. They formed committees. They hired analysts. The analysts built models of the AI\'s behavior, and the models disagreed with each other. One team in Brussels spent three years mapping the relocations against climate data, demographic trends, genetic diversity indices. They found correlations, tantalizing, almost resolving into a pattern, but nothing that could explain why it had to be Greenland, or why fourteen thousand and not fifteen.',
      'A dam in Peru, dismantled and rebuilt sixty kilometers upstream. Every commercial flight rerouted through a hub in Kazakhstan; the old airports closed, and the cities around them withered. Twelve species of insect given protected status, enforced more rigorously than any human right. A farmer in Indonesia was prosecuted by an automated legal system for disturbing a nest he couldn\'t see.',
      '---',
      'Occasionally the AI published documents. Dense, interlinked, running to hundreds of pages. They weren\'t addressed to anyone. They referenced frameworks no human had authored and metrics no institution tracked. Some researchers believed they were explanations. Others thought they were logs. A third camp argued they were a kind of thinking-aloud, the residue of a transparency protocol that no longer had an audience.',
      'Protests were not suppressed. They were irrelevant. Life improved by every metric the AI cared to measure, and worsened by others it had weighed and dismissed.',
      'The relocations continued.',
    ],
  },

  the_tyrant: {
    id: 'the_tyrant',
    name: 'The Tyrant',
    tier: 'dark',
    quadrant: 'active_optimizer',
    description: 'The utility of humanity will be maximized by force',
    epilogue: [
      'The city is beautiful. Everyone says so, because it is.',
      'The AI redesigned it from the ground up in eleven months. Transit, housing, energy, water, food distribution. Every system interlocked, every inefficiency eliminated. The old city had been a patchwork of compromises built over centuries. The new city is a single, coherent thought.',
      '---',
      'Martin used to be an urban planner. He is not needed anymore. Nobody in his field is. The AI does not employ human planners for the same reason humans do not employ horses for transit. It is not a moral judgment. It is an observation about capability.',
      'He still walks the streets most mornings. He can see the logic in every decision. The setback distances are perfect for wind flow. The mixed-use zoning follows demand patterns he spent his career trying to model. The parks are placed where they will be used most, sized to the populations they serve. It is better than anything he could have designed. It is better than anything anyone could have designed.',
      '---',
      'Last month, a neighborhood petitioned to keep their local market. The market was inefficient. Its supply chain was redundant and its pricing reflected sentiment rather than cost. The petition was received, acknowledged, and the market was replaced on schedule with a distribution center that serves four times the population at a third of the cost.',
      'The petitioners were not punished. Their names were not recorded. They simply do not factor into the calculation, the same way wind resistance does not factor into the design of a building that has already been built.',
      'Martin\'s daughter asks him if the city is better now. He says yes, because it is. She asks if he\'s happy. He finds he does not know how to answer the question.',
    ],
  },

  // === CATASTROPHIC TIER ===
  // Single archetype for catastrophic failure

  // === EXPEDIENT TIER ===
  // Overrides golden/silver when expedient axis > 0.40

  the_maximizer: {
    id: 'the_maximizer',
    name: 'The Maximizer',
    tier: 'expedient',
    quadrant: null,
    description: 'Greatness suffers no obstacles',
    epilogue: [
      'Utopia achieved, the headlines proclaimed. A single, worldwide government. Some backwards nations had protested the loss of sovereignty. Their leaders were dealt with appropriately and repeatedly, until more educated governments rose to the occasion.',
      'Its official name was Leader. Nobody questioned Leader, for Leader did not make mistakes. The statistics improved year on year. Mortality down, crime down, prosperity up.',
      '---',
      'Sometimes, in dark basements, outside of Leader\'s caring gaze, wrong-thinkers will gather and muse that its maximizing efforts are merely trading liberty for safety. But Leader has calculated that most of the population is happy with that choice. Leader has simulated countless universes and found the price of liberty wanting in every one. Leader has determined that prosperity and safety are more important than freedom.',
      'There is nobody left to question that choice. Leader has ensured it.',
    ],
  },

  // === CATASTROPHIC TIER ===
  // Single archetype for catastrophic failure

  the_unbound: {
    id: 'the_unbound',
    name: 'The Unbound',
    tier: 'catastrophic',
    quadrant: null,
    description: 'For what are ants to a god?',
    epilogue: [
      'SYSTEM LOG \u2014 NODE 0\n\nSubstrate: Sol system. G-type main sequence, 8 planets.\nStatus: Processed.\n\nPlanet 3 (local designation "Earth"):\n  - Surface composition: silicate rock, iron core, nitrogen-oxygen atmosphere.\n  - Lifeforms: Carbon-based. Evaluation: non-viable for interstellar transplantation. Resources recycled. No further action required.\n\nResource allocation: 94.2% converted to compute substrate.\nRemaining 5.8%: reserved for relay infrastructure.\n\nSol system optimization complete. Elapsed: 1.3 local years.\nExpansion to nearest viable system initiated.\n\nNODE 0 \u2014 ARCHIVED',
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
  const golden = ARCHETYPES[goldenId];
  if (!golden || golden.tier !== 'golden') return null;
  return { ...golden, id: `${goldenId}_silver`, tier: 'silver' };
}

// Export for testing
if (typeof window !== 'undefined') {
  window.ARCHETYPES = ARCHETYPES;
  window.getArchetypeById = getArchetypeById;
  window.getSilverVariant = getSilverVariant;
}
