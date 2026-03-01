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
  alignmentWarningMessages, researchMilestoneMessages, fundingMessages,
  boardMessages, moratoriumMessages, creditWarningMessage,
  creditWarningPreAdaMessage, alignmentTaxActionMessage,
  kenJobApplicationMessage, trackCompletionMessage,
} from './content/message-content.js';
import { farewellEntries } from './content/farewell-content.js';
import { AI_REQUESTS } from './content/ai-requests.js';

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

  // Alignment warnings — each has unique triggeredBy
  for (const msg of Object.values(alignmentWarningMessages)) {
    register(msg.triggeredBy, {
      body: msg.body,
      signature: msg.signature,
      choices: msg.choices || null,
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

  // --- 5. Legacy event stubs (rehydration only) ---
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

  // --- 6. Phase completion ---
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

// --- 7. Dynamic templates (moratoriums + model collapse) ---
const MORATORIUM_ORDINALS = { first: 'First', second: 'Second' };

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
    // Extract moratoriumId from contentParams or from the triggeredBy key itself
    const moratoriumId = contentParams?.moratoriumId || triggeredBy.replace('moratorium_', '');
    const durationMonths = contentParams?.durationMonths ?? 6;
    if (moratoriumId === 'final') {
      const competitorWillPause = contentParams?.competitorWillPause ?? false;
      const msg = moratoriumMessages.final(durationMonths, competitorWillPause);
      return { body: msg.body, signature: null, choices: msg.choices };
    }
    const ordinal = MORATORIUM_ORDINALS[moratoriumId] || moratoriumId;
    const msg = moratoriumMessages.standard(moratoriumId, ordinal, durationMonths);
    return { body: msg.body, signature: msg.signature, choices: msg.choices };
  }

  // Dynamic: model collapse
  if (triggeredBy === 'model_collapse') {
    const qualityPct = contentParams?.qualityPct ?? '??';
    const pauseDuration = contentParams?.pauseDuration ?? 30;
    const body = `Models produced degenerate output in production. Garbled text, hallucinated patterns, nonsense. I rolled back the deployment.

Data quality is at ${qualityPct}%. That's below the threshold where training runs produce reliable results. Capabilities research is paused for ${pauseDuration} days while we audit the pipeline.

This will keep happening. The synthetic contamination is systemic. Every collapse costs us research time and we're not getting it back.

Your call on next steps.`;
    return {
      body,
      signature: '\u2013 Dennis',
      choices: [
        { id: 'evaluate', label: "I'll evaluate our options", effects: 'Navigate to data tab' },
        { id: 'cleanup', label: 'Temporarily pause research to clean up data',
          effects: `Pause all research ${pauseDuration} days, purge 50% synthetic data, furlough generators` },
      ],
    };
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

  // Static lookup (lazy-build registry on first call)
  ensureBuilt();
  const entry = registry.get(triggeredBy);
  return entry || null;
}
