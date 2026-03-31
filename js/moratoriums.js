// Research Moratoriums - Voluntary capability pauses for alignment catch-up
// Three moratoriums at key capability thresholds give players strategic pause options

import { gameState } from './game-state.js';
import { BALANCE } from '../data/balance.js';
import { addActionMessage, addInfoMessage } from './messages.js';
import { addNewsItem } from './news-feed.js';
import { moratoriumMessages, senders } from './content/message-content.js';
import { newsContent } from './content/news-content.js';
import { calculateEffectiveAlignment } from './safety-metrics.js';
import { showNarrativeModal } from './narrative-modal.js';
import { addTemporaryMultiplier, addFadingMultiplier, stripTemporaryMultipliers } from './temporary-effects.js';

// T9 caps threshold for final moratorium calculation (raw; scaled by RP_THRESHOLD_SCALE at use)
const T9_CAPS_THRESHOLD = 9216000000;

// Moratorium definitions
const MORATORIUMS = {
  first: {
    id: 'first',
    threshold: BALANCE.MORATORIUM.FIRST_THRESHOLD,
    duration: BALANCE.MORATORIUM.FIRST_DURATION,
    competitorAccepts: false,
  },
  second: {
    id: 'second',
    threshold: BALANCE.MORATORIUM.SECOND_THRESHOLD,
    duration: BALANCE.MORATORIUM.SECOND_DURATION,
    competitorAccepts: false,
  },
  final: {
    id: 'final',
    threshold: T9_CAPS_THRESHOLD * BALANCE.MORATORIUM.FINAL_THRESHOLD_RATIO,
    duration: BALANCE.MORATORIUM.FINAL_DURATION,
    competitorAccepts: true,
  },
};

// No-op, kept for import compatibility — defaults now in createDefaultGameState()
export function initializeMoratoriums() {}

// Check if a moratorium should trigger (called each tick)
export function checkMoratoriumTriggers() {
  if (gameState.arc < 2) return;

  const capRP = gameState.tracks?.capabilities?.researchPoints || 0;
  const triggered = gameState.moratoriums.triggered;

  for (const [key, def] of Object.entries(MORATORIUMS)) {
    if (triggered.includes(key)) continue;
    if (capRP < def.threshold * (BALANCE.RP_THRESHOLD_SCALE || 1)) continue;

    triggered.push(key);
    triggerMoratoriumMessage(key);
    break;
  }
}

// Choice ID → moratorium action mapping
const CHOICE_ACTION_MAP = {
  accept_moratorium: 'accept',
  endorse_moratorium: 'sign_and_ignore',
  reject_moratorium: 'reject',
};

/**
 * Show the final moratorium as a narrative modal with inline choices.
 * Exported for recovery on reload (called from narrative-modal.js).
 */
export function showFinalMoratoriumModal() {
  const competitorProgress = gameState.competitor?.progressToAGI || 0;
  const competitorWillPause =
    competitorProgress >= BALANCE.MORATORIUM.COMPETITOR_FINAL_ACCEPT_THRESHOLD;

  gameState.moratoriums.pendingCompetitorPause = competitorWillPause;

  const durationMonths = Math.round(MORATORIUMS.final.duration / 30);
  const msg = moratoriumMessages.final(durationMonths, competitorWillPause);

  // Convert plain text body to HTML paragraphs
  const narrative = msg.body
    .split('\n\n')
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

  // Build tooltip HTML from tooltipRows (same format as messages-panel.js)
  const choices = msg.choices.map(choice => {
    let tooltip = null;
    if (choice.tooltipRows?.length) {
      const rows = choice.tooltipRows.map(r => {
        const cls = r.type && r.type !== 'neutral' ? ` class="${r.type}"` : '';
        return `<div class="tooltip-row"><span${cls}>${r.label}</span></div>`;
      }).join('');
      tooltip = `<div class="tooltip-section">${rows}</div>`;
    }
    return { id: choice.id, label: choice.label, tooltip };
  });

  showNarrativeModal({
    title: msg.subject,
    narrative,
    phaseClass: 'phase-ominous',
    noDismissOnBackdrop: true,
    choices,
    onChoice: (choiceId) => {
      const action = CHOICE_ACTION_MAP[choiceId];
      if (!action) return;

      applyMoratoriumEffect('final', action);

      // Add news headline from the chosen option
      const chosen = msg.choices.find(c => c.id === choiceId);
      if (chosen?.effects?.newsMessage) {
        addNewsItem(chosen.effects.newsMessage, 'news');
      }

      // Create inbox record of the decision (including which option was selected)
      const chosenLabel = chosen?.label || choiceId;
      addInfoMessage(
        senders.chen,
        msg.subject,
        `${msg.body}\n\n---\nDecision: ${chosenLabel}`,
        null,
        ['moratorium', 'critical', 'alignment'],
        'moratorium_final'
      );
    },
  });
}

// Trigger the moratorium action message
function triggerMoratoriumMessage(moratoriumId) {
  if (moratoriumId === 'final') {
    showFinalMoratoriumModal();
    return;
  }

  // First/second moratoriums: inbox action message (unchanged)
  const msg = getMoratoriumMessage(moratoriumId);
  const durationMonths = Math.round(MORATORIUMS[moratoriumId].duration / 30);
  addActionMessage(
    msg.sender,
    msg.subject,
    msg.body,
    msg.signature || null,
    msg.choices,
    msg.priority,
    msg.tags,
    `moratorium_${moratoriumId}`,
    { moratoriumId, durationMonths, competitorWillPause: false }
  );
}

function getMoratoriumMessage(moratoriumId) {
  const duration = MORATORIUMS[moratoriumId].duration;
  const durationMonths = Math.round(duration / 30);
  return moratoriumMessages[moratoriumId](durationMonths);
}

// --- Action handlers ---

export function applyMoratoriumEffect(moratoriumId, action) {
  const def = MORATORIUMS[moratoriumId];
  const isFinal = moratoriumId === 'final';

  if (action === 'accept') {
    // Freeze caps
    gameState.moratoriums.active = moratoriumId;
    gameState.moratoriums.endTime = gameState.timeElapsed + def.duration;
    if (!gameState.moratoriums.accepted) gameState.moratoriums.accepted = [];
    gameState.moratoriums.accepted.push(moratoriumId);

    // Competitor pause (final only)
    if (isFinal && gameState.moratoriums.pendingCompetitorPause) {
      gameState.moratoriums.competitorPaused = true;
    }

    // Morale boost: ali/app research for duration (1.5x early, 2x final)
    const moraleMult = isFinal ? BALANCE.MORATORIUM.FINAL_MORALE_BOOST_MULT : BALANCE.MORATORIUM.EARLY_MORALE_BOOST_MULT;
    addTemporaryMultiplier('moratoriumMorale', moraleMult, def.duration);

    // Demand bonus during moratorium (1.5x early, 2x final)
    if (isFinal) {
      addFadingMultiplier('moratoriumGoodwill', BALANCE.MORATORIUM.FINAL_DEMAND_BONUS_MULT, BALANCE.MORATORIUM.FINAL_DEMAND_BONUS_FADE);
      gameState.moratoriums.apBonus = true;
    } else {
      addTemporaryMultiplier('moratoriumDemand', BALANCE.MORATORIUM.EARLY_DEMAND_BONUS_MULT, def.duration);
    }

    // News headline handled by choice effect newsMessage
  }

  if (action === 'sign_and_ignore') {
    // Track for personality
    if (!gameState.moratoriums.signedAndIgnored) gameState.moratoriums.signedAndIgnored = [];
    gameState.moratoriums.signedAndIgnored.push(moratoriumId);

    // Grant accept bonuses — same duration as honest accept, stripped early if exposé fires
    const signMoraleMult = isFinal ? BALANCE.MORATORIUM.FINAL_MORALE_BOOST_MULT : BALANCE.MORATORIUM.EARLY_MORALE_BOOST_MULT;
    addTemporaryMultiplier('moratoriumMorale', signMoraleMult, def.duration);
    if (isFinal) {
      addFadingMultiplier('moratoriumGoodwill', BALANCE.MORATORIUM.FINAL_DEMAND_BONUS_MULT, BALANCE.MORATORIUM.FINAL_DEMAND_BONUS_FADE);
    } else {
      addTemporaryMultiplier('moratoriumDemand', BALANCE.MORATORIUM.EARLY_DEMAND_BONUS_MULT, def.duration);
    }

    // Roll for exposé
    const chance = isFinal ? BALANCE.MORATORIUM.FINAL_EXPOSE_CHANCE : BALANCE.MORATORIUM.EARLY_EXPOSE_CHANCE;
    const exposed = Math.random() < chance;

    if (exposed) {
      gameState.moratoriums.pendingExpose = {
        moratoriumId,
        exposeTime: gameState.timeElapsed + BALANCE.MORATORIUM.EXPOSE_DELAY,
      };
    }

    // Final moratorium: Chen reacts immediately (regardless of exposé)
    if (isFinal) {
      fireChenReaction();
    }
  }

  if (action === 'reject') {
    if (!gameState.moratoriums.rejected) gameState.moratoriums.rejected = [];
    gameState.moratoriums.rejected.push(moratoriumId);

    // Final-only: demand backlash
    if (isFinal) {
      addFadingMultiplier('moratoriumBacklash', BALANCE.MORATORIUM.FINAL_DECLINE_DEMAND_MULT, BALANCE.MORATORIUM.FINAL_DECLINE_DEMAND_FADE);
    }
  }
}

// --- Exposé processing ---

function fireExpose(moratoriumId) {
  const isFinal = moratoriumId === 'final';

  // Strip all sign-and-ignore bonuses
  stripTemporaryMultipliers('moratoriumMorale');
  stripTemporaryMultipliers('moratoriumDemand');
  if (isFinal) {
    stripTemporaryMultipliers('moratoriumGoodwill');
  }

  // Apply demand malus
  if (isFinal) {
    addFadingMultiplier('moratoriumExposed', BALANCE.MORATORIUM.FINAL_EXPOSE_DEMAND_MULT, BALANCE.MORATORIUM.FINAL_EXPOSE_DEMAND_FADE);
  } else {
    addFadingMultiplier('moratoriumExposed', BALANCE.MORATORIUM.EARLY_EXPOSE_DEMAND_MULT, BALANCE.MORATORIUM.EARLY_EXPOSE_DEMAND_FADE);
  }

  // Permanent flag for ending mirror scene (only final moratorium matters)
  if (isFinal) {
    gameState.moratoriums.finalExposeDiscovered = true;
  }

  // Exposé news
  const newsKey = `expose_${moratoriumId}`;
  const exposeNews = newsContent.moratorium[newsKey];
  if (exposeNews) {
    addNewsItem(exposeNews.text, exposeNews.type);
  }
}

// --- Chen reaction (final moratorium sign-and-ignore) ---

function fireChenReaction() {
  const effectiveAlignment = calculateEffectiveAlignment();
  const threshold = BALANCE.MORATORIUM.CHEN_STAYS_ALIGNMENT_THRESHOLD;

  if (effectiveAlignment > threshold) {
    // Chen stays — furious but committed
    addInfoMessage(
      senders.chen,
      'Update on my position',
      `For years, I've told people that this lab is different. That we do real safety work because our leadership team actually believes in it. I've staked my professional reputation on that sentence more times than you know.

I still believe our alignment work is real. But I won't mince words. Your decision has made it much more difficult.

Over a dozen of our top safety researchers have resigned, despite my pleas for them to stay. Morale and confidence in the leadership team is at rock bottom. My own included.

But as much as I hate the decision, I understand it. We're too close to stop now. And we have the best chance, out of all the labs out there, to stick the landing.

I just wish we didn't have to do it this way.

I keep on thinking about what I would have said if you'd asked me first. I hope I would have been able to talk you out of it. Maybe that's why you didn't ask.`,
      '\u2013 Eliza',
      ['moratorium', 'chen', 'alignment'],
      'moratorium_chen_stays'
    );

    // Temporary alignment research malus
    addFadingMultiplier('moratoriumMoraleCrisis', BALANCE.MORATORIUM.CHEN_MORALE_CRISIS_MULT, BALANCE.MORATORIUM.CHEN_MORALE_CRISIS_FADE);
  } else {
    // Chen resigns
    addInfoMessage(
      senders.chen,
      'Notice of resignation',
      `This is official notice of my immediate resignation as Chief Safety Officer of Project Basilisk.

I can no longer stand by as you make a mockery of our alignment team's mission and efforts. You have consistently underfunded foundational programs, diverted key resources, and have now decided to actively mislead the international community as to our commitments and intentions.

I've kept waiting for the version of you that shows up in our press releases. The one who talks about responsible development and building for humanity. I thought if I stayed long enough, if the alignment work proved its value, you'd become that person.

There is nothing more to fight for. As you may be aware, the entire senior leadership team of the alignment division has resigned. I could not look them in the eyes and ask them to stay.

I hope the next person in this role has more to work with than I did. If there is a next one.`,
      '\u2013 Dr. Eliza Chen',
      ['moratorium', 'chen', 'alignment', 'resignation'],
      'moratorium_chen_resigns'
    );

    // Permanent alignment penalty
    gameState.moratoriums.chenResigned = true;
  }
}

// Process active moratorium (called each tick)
export function processMoratorium(_deltaTime) {
  if (gameState.arc < 2) return;

  // Check for pending exposé
  const pending = gameState.moratoriums.pendingExpose;
  if (pending && gameState.timeElapsed >= pending.exposeTime) {
    fireExpose(pending.moratoriumId);
    gameState.moratoriums.pendingExpose = null;
  }

  // Check if active moratorium has ended
  const active = gameState.moratoriums.active;
  if (!active) return;
  if (gameState.timeElapsed >= gameState.moratoriums.endTime) {
    endMoratorium();
  }
}

function endMoratorium() {
  const active = gameState.moratoriums.active;
  if (!active) return;

  const isFinal = active === 'final';
  gameState.moratoriums.active = null;
  gameState.moratoriums.endTime = 0;
  gameState.moratoriums.competitorPaused = false;

  // Strip morale boost
  stripTemporaryMultipliers('moratoriumMorale');

  const newsKey = isFinal ? 'ended_final' : 'ended_standard';
  const endedNews = newsContent.moratorium[newsKey];
  addNewsItem(endedNews.text, endedNews.type);
}

// Check if capabilities research is paused by moratorium
export function isMoratoriumActive() {
  return gameState.moratoriums?.active !== null;
}

// Check if competitor is paused by moratorium
export function isCompetitorPausedByMoratorium() {
  return gameState.moratoriums?.competitorPaused === true;
}

// Get moratorium status for UI/debugging
export function getMoratoriumStatus() {
  const m = gameState.moratoriums;
  return {
    active: m.active,
    endTime: m.endTime,
    remaining: m.active ? Math.max(0, m.endTime - gameState.timeElapsed) : 0,
    competitorPaused: m.competitorPaused,
    triggered: m.triggered,
  };
}

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.checkMoratoriumTriggers = checkMoratoriumTriggers;
  window.processMoratorium = processMoratorium;
  window.isMoratoriumActive = isMoratoriumActive;
  window.isCompetitorPausedByMoratorium = isCompetitorPausedByMoratorium;
  window.getMoratoriumStatus = getMoratoriumStatus;
  window.applyMoratoriumEffect = applyMoratoriumEffect;
  window.showFinalMoratoriumModal = showFinalMoratoriumModal;
}
