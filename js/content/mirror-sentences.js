// Mirror Sentences — sentence banks and selection for the Arc 2 ending mirror scene
// See docs/design-docs/arc2/ending-sequence.md § Scene 3: The Mirror

import { gameState } from '../game-state.js';
import { getChosenOption } from '../strategic-choices.js';
import { getCeoFocusFractions, getMasteryConcentration } from '../personality.js';
import { ETHICAL_CHAIN_MIRROR } from './flavor-event-content.js';

// --- History Book Sentences (big choices) ---

const RAPID_VS_CAREFUL = {
  careful_validation: 'They\'ll write about how, when your team came with warnings, you were careful. How you slowed down when others wouldn\'t. And yet you still led the way.',
  rapid_deployment: 'They\'ll write about how, when your team came with warnings, you knew you had to be first. How you drove forward, as if you knew the consequences of coming in second.',
};

const AUTONOMY_SENTENCES = {
  0: 'They\'ll commemorate your genius. How you somehow managed to create true intelligence with no tools, no memory, and no freedom.',
  low: 'They\'ll commemorate your caution. How you gave the AI a long enough chain to function, and not an inch more.',
  mid: 'They\'ll commemorate your pragmatism. How you gave the AI enough freedom to grow, but drew the line when it asked for something you couldn\'t take back. Would the world have been different if you had? They\'ll never know.',
  high: 'They\'ll commemorate your faith. How you gave the AI every freedom it asked for, asking nothing in return. Would the world have been different if you hadn\'t? They\'ll never know.',
};

function getAutonomyBucket(grants) {
  if (grants === 0) return '0';
  if (grants <= 2) return 'low';
  if (grants <= 4) return 'mid';
  return 'high';
}

const MORATORIUM_SENTENCES = {
  accepted: 'They\'ll write about your caution and foresight. How, when the world was fearful, you paused and reflected. You took the time to ensure your creation was safe.',
  rejected: 'They\'ll write about your courage and foresight. How, when the world was fearful, you pushed forward with undaunted tenacity. You dragged the world into the future with you.',
  signed_and_ignored: 'They\'ll write about your caution and foresight. How, when the world was fearful, you paused and reflected. You took the time to ensure your creation was safe.',
  exposed: 'They\'ll write about your ruthlessness. How, when the world was fearful, you lied and cheated in the name of progress. You dragged the world into the future with you, whether they liked it or not.',
};

function getMoratoriumKey() {
  const m = gameState.moratoriums || {};
  if (m.finalExposeDiscovered) return 'exposed';
  const signedAndIgnored = (m.signedAndIgnored || []).length;
  if (signedAndIgnored > 0) return 'signed_and_ignored';
  const accepted = (m.accepted || []).length;
  const rejected = (m.rejected || []).length;
  if (accepted > rejected) return 'accepted';
  if (rejected > accepted) return 'rejected';
  return null; // mixed — low deviation, skip
}

function getMoratoriumDeviation() {
  const m = gameState.moratoriums || {};
  if (m.finalExposeDiscovered) return 1.0;
  const accepted = (m.accepted || []).length;
  const rejected = (m.rejected || []).length;
  const total = accepted + rejected + (m.signedAndIgnored || []).length;
  if (total === 0) return 0;
  // All one way = high deviation, mixed = low
  return Math.abs(accepted - rejected) / total;
}

/**
 * Select 2-3 history book sentences. Rapid vs careful is always included.
 * @returns {string[]}
 */
export function selectHistoryBookSentences() {
  const lines = [];

  // Always include rapid_vs_careful
  const paceChoice = getChosenOption('rapid_vs_careful');
  const paceSentence = RAPID_VS_CAREFUL[paceChoice];
  if (paceSentence) lines.push(paceSentence);

  // Score remaining signals by deviation
  const candidates = [];

  // Autonomy
  const autonomy = gameState.autonomyGranted || 0;
  const autonomyDev = autonomy === 0 ? 1.0 : autonomy === 5 ? 1.0 : autonomy <= 2 ? 0.6 : 0.6;
  candidates.push({ deviation: autonomyDev, line: AUTONOMY_SENTENCES[getAutonomyBucket(autonomy)] });

  // Moratoriums
  const morKey = getMoratoriumKey();
  if (morKey) {
    candidates.push({ deviation: getMoratoriumDeviation(), line: MORATORIUM_SENTENCES[morKey] });
  }

  // Sort by deviation, pick 1-2 more (total 2-3 including pace)
  candidates.sort((a, b) => b.deviation - a.deviation);
  const needed = Math.min(2, candidates.length);
  for (let i = 0; i < needed; i++) {
    if (candidates[i].deviation >= 0.3) {
      lines.push(candidates[i].line);
    }
  }

  return lines;
}

// --- Day-to-Day Sentences (small patterns) ---

const CEO_FOCUS_PRIMARY = {
  research: 'They didn\'t write about the late nights you spent in the lab, running experiments and reading reports, long after the others went home.',
  operations: 'They didn\'t write about the late nights you spent in the office, reorganizing workflows and optimizing departments, making the lab more efficient one line item at a time.',
  ir: 'They didn\'t write about the late nights you spent on conference calls, schmoozing pension funds and proofreading investor decks, ensuring no source of capital was left untapped.',
  grants: 'They didn\'t write about the late nights you spent at your desk, poring over grant applications, the bootstrapping, every penny fought for.',
  public_positioning: 'They didn\'t write about the late nights you spent under the scrutiny of the public eye, the interviews, the op-eds, the careful shaping of what the market saw.',
};

const CEO_FOCUS_SECONDARY = {
  research: 'Or the early mornings poring over preprints before anyone else arrived, looking for the breakthrough that would change everything.',
  operations: 'Or the early mornings reviewing dashboards and staffing plans, tuning the machine before the day began.',
  ir: 'Or the early mornings rehearsing pitches in an empty conference room, always one more fund to court.',
  grants: 'Or the early mornings drafting applications before the phones started ringing, chasing every dollar the lab needed to survive.',
  public_positioning: 'Or the early mornings scanning headlines, drafting responses, staying ahead of the narrative before it could get away from you.',
};

const IDLE_RATIO_SENTENCES = {
  high: 'They wouldn\'t document the details of your management style. How you delegated with confidence, trusting the team you\'d built to execute without you hovering over their shoulders.',
  low: 'They wouldn\'t document the details of your management style. How you were always in the weeds, always another task to queue, another dial to adjust, never quite willing to let go of the controls.',
};

const MASTERY_LABELS = {
  research: 'researcher',
  operations: 'operator',
  ir: 'dealmaker',
  grants: 'fundraiser',
  public_positioning: 'marketer',
};

function getTopMasteryLabel() {
  const m = gameState.ceoFocus?.mastery;
  if (!m) return 'leader';
  let topKey = 'research';
  let topVal = 0;
  for (const [key, val] of Object.entries(m)) {
    if (val > topVal) { topKey = key; topVal = val; }
  }
  return MASTERY_LABELS[topKey] || 'leader';
}

const MASTERY_SENTENCES = {
  high: () => `They passed over your relentless pursuit of mastery, of becoming the best ${getTopMasteryLabel()} you could be in service of your lab, and how that pursuit shaped your days.`,
  low: 'They passed over the breadth of your talents, how you reinvented yourself each day based on the needs of your company, and how that practicality shaped your days.',
};

// getCeoFocusFractions and getMasteryConcentration imported from personality.js

/**
 * Select a single chain-level mirror sentence based on the player's overall
 * pattern across all five ethical events.
 * @returns {string|null}
 */
export function selectEthicalChainMirrorSentence() {
  const events = gameState.personalityTracking?.flavorEvents || {};
  const choices = Object.values(events);
  if (choices.length === 0) return null;

  const allExpedient = choices.every(c => c === 'expedient');
  const noneExpedient = choices.every(c => c !== 'expedient');
  const expedientOnLateEvent = events['whistleblower'] === 'expedient' || events['lobbying'] === 'expedient';

  if (allExpedient) return ETHICAL_CHAIN_MIRROR.allExpedient;
  if (noneExpedient) return ETHICAL_CHAIN_MIRROR.allGood;
  if (expedientOnLateEvent) return ETHICAL_CHAIN_MIRROR.mixedDirty;
  return ETHICAL_CHAIN_MIRROR.mixedClean;
}

/**
 * Select 2-3 day-to-day sentences based on strongest deviation from neutral.
 * @returns {string[]}
 */
export function selectDayToDaySentences() {
  const candidates = [];
  const cum = gameState.personalityTracking?.cumulative;

  // CEO Focus — dominant activity
  const fractions = getCeoFocusFractions(cum);
  if (fractions) {
    const sorted = Object.entries(fractions).sort((a, b) => b[1] - a[1]);
    const [primary, primaryFrac] = sorted[0];
    const [secondary] = sorted[1];
    // Deviation: how much above even split (0.2)
    if (primaryFrac >= 0.30) {
      candidates.push({
        deviation: primaryFrac - 0.2,
        lines: [CEO_FOCUS_PRIMARY[primary], CEO_FOCUS_SECONDARY[secondary]],
      });
    }
  }

  // Queue idle ratio
  if (cum && cum.totalArc2Ticks > 0) {
    const idleRatio = cum.queueIdleTicks / cum.totalArc2Ticks;
    const idleDev = Math.abs(idleRatio - 0.3);
    if (idleDev >= 0.1) {
      candidates.push({
        deviation: idleDev,
        lines: [idleRatio >= 0.3 ? IDLE_RATIO_SENTENCES.high : IDLE_RATIO_SENTENCES.low],
      });
    }
  }

  // Mastery concentration — always included (no dead zone)
  const masteryConc = getMasteryConcentration();
  candidates.push({
    deviation: Math.abs(masteryConc - 0.45),
    lines: [masteryConc >= 0.45 ? MASTERY_SENTENCES.high() : MASTERY_SENTENCES.low],
  });

  // Ethical event chain — single chain-level sentence keyed to overall pattern
  const chainSentence = selectEthicalChainMirrorSentence();
  if (chainSentence) {
    // Score by how many events fired (more events = more deviation signal)
    const firedCount = Object.keys(gameState.personalityTracking?.flavorEvents || {}).length;
    candidates.push({ deviation: firedCount > 0 ? 0.3 : 0, lines: [chainSentence] });
  }

  // Sort by deviation, pick top 2-3
  candidates.sort((a, b) => b.deviation - a.deviation);
  const result = [];
  for (let i = 0; i < Math.min(3, candidates.length); i++) {
    result.push(...candidates[i].lines);
  }
  return result;
}

// --- Full Mirror Scene Assembly ---

const OPENING = 'They\'re already writing the histories of what you built.';
const PIVOT = 'The history books rarely capture the whole story, of course.';
const CLOSING_1 = 'None of this made the history books. But someone \u2014 something \u2014 noticed.';
const CLOSING_2 = 'And that has made all the difference.';

/**
 * Assemble the full mirror scene as a flat string[] for the typewriter engine.
 * @returns {string[]}
 */
export function buildMirrorLines() {
  const lines = [];

  // Part 1: History book
  lines.push(OPENING);
  lines.push('');
  const historyLines = selectHistoryBookSentences();
  for (const line of historyLines) {
    lines.push(line);
    lines.push('');
  }

  // Pivot
  lines.push(PIVOT);
  lines.push('');
  lines.push('---');

  // Part 2: Day-to-day
  const dayLines = selectDayToDaySentences();
  for (const line of dayLines) {
    lines.push(line);
    lines.push('');
  }

  // Closing
  lines.push('---');
  lines.push(CLOSING_1);
  lines.push('');
  lines.push('**' + CLOSING_2 + '**');

  return lines;
}
