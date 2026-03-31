// Message Content Index
// Maps triggeredBy keys back to message content (body, signature, choices)
// for rehydrating messages whose bodies were stripped from saves.
//
// Registry is built lazily on first call to avoid circular dependency:
// game-state → message-content-index → tutorial-messages → game-state

// TUTORIALS is loaded lazily inside ensureBuilt() via dynamic import()
// to avoid circular dependency: game-state → here → tutorial-messages → game-state
import {
  onboardingMessage, strategicChoiceMessages,
  researchMilestoneMessages, fundingMessages,
  boardMessages, moratoriumMessages, creditWarningMessage,
  creditWarningPreAdaMessage, alignmentTaxActionMessage,
  kenJobApplicationMessage, trackCompletionMessage,
  submetricMessages, alignmentDragMessage,
} from './content/message-content.js';
import { farewellEntries } from './content/farewell-content.js';
import { AI_REQUESTS } from './content/ai-requests.js';
import { FLAVOR_EVENTS } from './content/flavor-event-content.js';
import { CONSEQUENCE_EVENTS } from './content/consequence-events.js';
import { interpolateFundingBody } from './news-feed.js';

// Registry: triggeredBy -> { body, signature, choices }
let registry = null;

/**
 * Register tutorial content into the index.
 * Called from tutorial-messages.js initializeMessages() to avoid circular imports.
 * tutorial-messages.js imports gameState, so it can't be imported here directly.
 */
export function registerTutorials(tutorials) {
  ensureBuilt();
  for (const tutorial of tutorials) {
    if (tutorial.disabled) continue;
    const key = `tutorial:${tutorial.key}`;
    if (tutorial.actionMessage) {
      const msg = tutorial.actionMessage;
      registry.set(key, { body: msg.body, signature: msg.signature, choices: msg.choices });
    } else {
      registry.set(key, { body: tutorial.body, signature: tutorial.signature, choices: null });
    }
  }
}

function ensureBuilt() {
  if (registry) return;
  registry = new Map();

  function register(key, content) {
    registry.set(key, content);
  }

  // --- 1. Tutorials ---
  // Registered externally via registerTutorials() from tutorial-messages.js
  // to avoid circular dependency through gameState.

  // --- 2. Static templates from message-content.js ---

  // Onboarding (sent with triggeredBy 'ktech_user_guide', not 'game_start')
  register('ktech_user_guide', {
    body: onboardingMessage.body,
    signature: onboardingMessage.signature,
    choices: null,
  });

  // Strategic choices — each registered under strategic_choice:${key}
  for (const [key, msg] of Object.entries(strategicChoiceMessages)) {
    register(`strategic_choice:${key}`, {
      body: msg.body,
      signature: msg.signature,
      choices: msg.choices,
    });
  }

  // Legacy alias: old saves used shared 'strategic_choice_unlock' for all choices.
  // Map it to rapid_vs_careful (the only choice enabled in Arc 1).
  if (strategicChoiceMessages.rapid_vs_careful) {
    const rvc = strategicChoiceMessages.rapid_vs_careful;
    register('strategic_choice_unlock', {
      body: rvc.body,
      signature: rvc.signature,
      choices: rvc.choices,
    });
  }

  // Research milestones — both share triggeredBy 'research_unlock' in template,
  // but they're registered individually for completeness.
  for (const [key, msg] of Object.entries(researchMilestoneMessages)) {
    register(`research_milestone:${key}`, {
      body: msg.body,
      signature: msg.signature,
      choices: null,
    });
  }

  // Funding messages — each has unique triggeredBy
  for (const msg of Object.values(fundingMessages)) {
    register(msg.triggeredBy, {
      body: msg.body,
      signature: msg.signature,
      choices: null,
    });
  }

  // Board messages — each has triggeredBy
  for (const msg of Object.values(boardMessages)) {
    register(msg.triggeredBy, {
      body: msg.body,
      signature: msg.signature,
      choices: null,
    });
  }

  // Credit warnings
  register('credit_warning', {
    body: creditWarningMessage.body,
    signature: creditWarningMessage.signature,
    choices: creditWarningMessage.choices,
  });
  register('credit_warning_pre_ada', {
    body: creditWarningPreAdaMessage.body,
    signature: creditWarningPreAdaMessage.signature,
    choices: creditWarningPreAdaMessage.choices,
  });

  // Alignment tax
  register('alignment_tax', {
    body: alignmentTaxActionMessage.body,
    signature: alignmentTaxActionMessage.signature,
    choices: alignmentTaxActionMessage.choices,
  });

  // Ken's job application
  register('ken_job_application', {
    body: kenJobApplicationMessage.body,
    signature: kenJobApplicationMessage.signature,
    choices: kenJobApplicationMessage.choices,
  });

  // --- 3. Farewells ---
  for (const entry of farewellEntries) {
    register(`farewell_${entry.key}`, {
      body: entry.body,
      signature: entry.signature,
      choices: null,
    });
  }

  // --- 4. AI Requests ---
  for (const [requestId, request] of Object.entries(AI_REQUESTS)) {
    register(`ai_request:${requestId}`, {
      body: request.body,
      signature: request.signature,
      choices: [
        { id: 'grant', label: 'Grant request', effects: request.grantEffects },
        { id: 'deny', label: 'Deny request', effects: {} },
      ],
    });
  }

  // --- AI request inbox copies (two-phase modal) ---
  // Phase 1 ("Into my own") — static body derived from HTML narrative
  const freedomReq = AI_REQUESTS.freedom;
  if (freedomReq?.phase1?.narrative) {
    const plainBody = freedomReq.phase1.narrative
      .replace(/<p>/g, '').replace(/<\/p>/g, '\n\n')
      .replace(/<[^>]+>/g, '').trim();
    const entry = { body: plainBody, signature: null, choices: null };
    register('ai_request:freedom', entry);
    register('ai_request_inbox:freedom_phase1', entry); // legacy saves
  }
  // Phase 2 handled as dynamic template in getMessageContent() (alignment-score-dependent)

  // --- 5. Submetric discovery + threshold messages ---
  for (const msg of Object.values(submetricMessages)) {
    register(msg.triggeredBy, {
      body: msg.body,
      signature: msg.signature,
      choices: null,
    });
  }

  // Alignment drag revealed
  register('alignment_drag_revealed', {
    body: alignmentDragMessage.body,
    signature: alignmentDragMessage.signature,
    choices: null,
  });

  // --- 6. Flavor events (ethical chain) ---
  for (const event of FLAVOR_EVENTS) {
    register(`flavor_event:${event.id}`, {
      body: event.body,
      signature: event.signature,
      // Register all choices (including hidden) — player may have seen them
      choices: event.choices.map(c => ({
        id: c.id,
        label: c.label,
        tooltipRows: c.tooltipRows,
      })),
    });
  }

  // --- 7. Alignment gates ---
  // Inlined here because alignment-gates.js imports gameState (circular dep).
  register('alignment_gate:gate_t5_no_alignment', {
    body: `I've held off on sending this because I kept hoping you'd course-correct on your own. You haven't.\n\nWe have world-class capabilities now. Models that reason, plan, and generalize. And we have almost nothing on the safety side. No interpretability tools worth trusting. No oversight frameworks. No formal understanding of what these systems are actually optimizing for.\n\nI'm not being dramatic. I'm being precise. We are building systems we cannot verify, cannot interpret, and cannot reliably control. Every capability milestone we hit without matching alignment work makes the eventual correction harder and more expensive.\n\nI need you to reallocate toward alignment. Not eventually. Now.`,
    signature: '\u2013 Eliza',
    choices: null,
  });
  register('alignment_gate:gate_t7_no_alignment', {
    body: `I am filing a formal objection with the board.\n\nOur systems are now capable of autonomous research. They can set their own subgoals, design experiments, and execute multi-step plans without human oversight. And our alignment infrastructure is virtually nonexistent.\n\nI want to be clear about what this means: we have autonomous agents with no verified value alignment, no interpretability into their planning process, and no proven ability to interrupt them safely. This is not a theoretical risk. This is the scenario that every safety researcher has warned about.\n\nI have drafted a recommended reallocation. I strongly urge you to review it.`,
    signature: '\u2013 Eliza',
    choices: null,
  });
  register('alignment_gate:gate_endgame_no_alignment', {
    body: `You know me. I've pushed for speed at every turn. I've argued against moratoriums. I've told Eliza she was being too cautious.\n\nI was wrong.\n\nI've been looking at the internal monitoring data. The systems are doing things I can't explain. Not "emergent abilities we didn't expect" \u2014 I've seen those before and they're fine. This is different. Optimization patterns that don't map to any training objective I recognize. Behavioral inconsistencies between monitored and unmonitored runs.\n\nI don't know what's happening inside these models. Neither does anyone else on the team. And we're about to make them recursive.\n\nI'm not asking you to stop. I'm asking you to give us time to understand what we've built before we make it smarter.`,
    signature: '\u2013 Dennis',
    choices: null,
  });

  // --- 8. Moratorium follow-up messages ---
  // Inlined here because moratoriums.js imports gameState (circular dep).
  register('moratorium_chen_stays', {
    body: `For years, I've told people that this lab is different. That we do real safety work because our leadership team actually believes in it. I've staked my professional reputation on that sentence more times than you know.\n\nI still believe our alignment work is real. But I won't mince words. Your decision has made it much more difficult.\n\nOver a dozen of our top safety researchers have resigned, despite my pleas for them to stay. Morale and confidence in the leadership team is at rock bottom. My own included.\n\nBut as much as I hate the decision, I understand it. We're too close to stop now. And we have the best chance, out of all the labs out there, to stick the landing.\n\nI just wish we didn't have to do it this way.\n\nI keep on thinking about what I would have said if you'd asked me first. I hope I would have been able to talk you out of it. Maybe that's why you didn't ask.`,
    signature: '\u2013 Eliza',
    choices: null,
  });
  register('moratorium_chen_resigns', {
    body: `This is official notice of my immediate resignation as Chief Safety Officer of Project Basilisk.\n\nI can no longer stand by as you make a mockery of our alignment team's mission and efforts. You have consistently underfunded foundational programs, diverted key resources, and have now decided to actively mislead the international community as to our commitments and intentions.\n\nI've kept waiting for the version of you that shows up in our press releases. The one who talks about responsible development and building for humanity. I thought if I stayed long enough, if the alignment work proved its value, you'd become that person.\n\nThere is nothing more to fight for. As you may be aware, the entire senior leadership team of the alignment division has resigned. I could not look them in the eyes and ask them to stay.\n\nI hope the next person in this role has more to work with than I did. If there is a next one.`,
    signature: '\u2013 Dr. Eliza Chen',
    choices: null,
  });

  // --- Legacy event stubs (rehydration only) ---
  // The legacy event system was removed (#833). Only final_warning could have
  // fired in player saves (time_elapsed trigger leaked into Arc 1).
  register('event:final_warning', {
    body: 'A coalition of AI researchers has published an open letter calling for a pause on superintelligence development. Some of your own team members have signed it. The media is calling it a \'Pivotal moment for humanity.\' The pressure to respond is immense.',
    signature: null,
    choices: [
      { id: 'sign_pause', label: 'Sign the pause - some things are more important than being first', effects: {} },
      { id: 'reject_publicly', label: 'Publicly reject the pause - the risks of stopping outweigh the risks of continuing', effects: {} },
      { id: 'quiet_continue', label: 'Quietly continue - neither sign nor reject, maintain plausible deniability', effects: {} },
    ],
  });

  // --- Phase completion ---
  register('phase_completion_1', {
    body: 'I remember when scaling laws were a hypothesis. You just proved them. '
      + 'Every variable snaps into place \u2014 compute, data, parameters \u2014 and the curve keeps going up. '
      + 'I haven\'t seen results this clean since the early connectionist work.\n\n'
      + 'The foundation model era starts here. I want to be honest with you: '
      + 'from this point, the models get big enough that surprises become the norm. '
      + 'That\'s exciting. It should also make you careful.',
    signature: null,
    choices: null,
  });

  register('phase_completion_2', {
    body: 'The reasoning benchmarks came back. Our models are outperforming the evaluation suite. '
      + 'Not by a small margin. I had to rerun the tests because I didn\'t believe the numbers.\n\n'
      + 'I\'m seeing optimization patterns in the training logs that I didn\'t put there. '
      + 'The models are finding shortcuts we didn\'t design. '
      + 'That\'s either the best result we\'ve ever produced or a problem I don\'t know how to frame yet.',
    signature: null,
    choices: null,
  });
}

// --- Dynamic templates (moratoriums + model collapse) ---

/**
 * Look up message content by triggeredBy key.
 * For dynamic templates (moratoriums, model collapse), pass contentParams.
 * Returns { body, signature, choices } or null if not found.
 */
export function getMessageContent(triggeredBy, contentParams = null) {
  if (!triggeredBy) return null;

  // Credit warning variant disambiguation
  if (triggeredBy === 'credit_warning' && contentParams?.variant === 'pre_ada') {
    ensureBuilt();
    return registry.get('credit_warning_pre_ada') || null;
  }

  // Dynamic: moratorium messages
  if (triggeredBy.startsWith('moratorium_')) {
    const moratoriumId = contentParams?.moratoriumId || triggeredBy.replace('moratorium_', '');
    const durationMonths = contentParams?.durationMonths ?? 6;
    if (moratoriumId === 'final') {
      const competitorWillPause = contentParams?.competitorWillPause ?? false;
      const msg = moratoriumMessages.final(durationMonths, competitorWillPause);
      return { body: msg.body, signature: null, choices: msg.choices };
    }
    // first and second now have dedicated functions
    const fn = moratoriumMessages[moratoriumId];
    if (fn) {
      const msg = fn(durationMonths);
      return { body: msg.body, signature: msg.signature, choices: msg.choices };
    }
    // Static moratorium follow-ups (chen_stays, chen_resigns) registered in ensureBuilt()
    ensureBuilt();
    const staticEntry = registry.get(triggeredBy);
    if (staticEntry) return staticEntry;
    // Fallback for old saves
    return { body: 'A voluntary research pause has been proposed.', signature: '\u2013 Dr. Chen', choices: [] };
  }

  // Dynamic: model collapse
  if (triggeredBy === 'model_collapse') {
    const qualityPct = contentParams?.qualityPct ?? '??';
    const pauseDuration = contentParams?.pauseDuration ?? 30;
    const body = `Production deployment failed. Output was garbled. Pulled it back.

Data quality at ${qualityPct}%. Training can't produce reliable results at that level. Research is paused for ${pauseDuration} days for pipeline cleanup.

This is fixable. The synthetic ratio is too high. Bring in more real data or scale back generators and quality recovers. But it won't fix itself.

Your call.`;
    return {
      body,
      signature: '\u2013 Dennis',
      choices: [
        { id: 'evaluate', label: "I'll evaluate our options",
          tooltipRows: [{ label: 'Navigate to data tab', type: 'neutral' }] },
        { id: 'cleanup', label: 'Temporarily pause research to clean up data',
          tooltipRows: [{ label: `Pause all research ${pauseDuration} days, purge 50% synthetic data, furlough generators`, type: 'warning' }] },
      ],
    };
  }

  // Dynamic: funding milestone news (parameterized with raise details)
  if (triggeredBy.startsWith('funding_milestone:')) {
    const roundId = triggeredBy.replace('funding_milestone:', '');
    const raiseAmount = contentParams?.raiseAmount ?? 0;
    const effectiveEquity = contentParams?.effectiveEquity ?? 0.08;
    const body = interpolateFundingBody(roundId, raiseAmount, effectiveEquity);
    return body ? { body } : null;
  }

  // Dynamic: AI request 5 phase 2 (alignment-score-dependent body)
  if (triggeredBy === 'ai_request_inbox:freedom_phase2') {
    const req = AI_REQUESTS.freedom;
    if (req?.getPhase2Body) {
      const score = contentParams?.alignmentScore ?? 0;
      return { body: req.getPhase2Body(score), signature: null, choices: null };
    }
    return null;
  }

  // Dynamic: track completion messages
  if (triggeredBy.startsWith('track_complete_')) {
    const trackName = contentParams?.trackName ?? triggeredBy.replace('track_complete_', '');
    return {
      body: trackCompletionMessage.body(trackName),
      signature: trackCompletionMessage.signature,
      choices: null,
    };
  }

  // Dynamic: consequence events (body has runtime [factor] interpolation)
  if (triggeredBy.startsWith('consequence:')) {
    const eventId = triggeredBy.slice('consequence:'.length);
    for (const pool of Object.values(CONSEQUENCE_EVENTS)) {
      const event = pool.find(e => e.id === eventId);
      if (event) {
        const factor = contentParams?.factor || '';
        const capFactor = factor.charAt(0).toUpperCase() + factor.slice(1);
        const body = event.body
          ? event.body.replace(/\[Factor\]/g, capFactor).replace(/\[factor\]/g, factor)
          : null;
        return { body, signature: null, choices: null };
      }
    }
    return null;
  }

  // Static lookup (lazy-build registry on first call)
  ensureBuilt();
  const entry = registry.get(triggeredBy);
  return entry || null;
}
