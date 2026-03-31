// Scripted Alignment Gates — one-shot narrative wake-up calls
// For players who completely ignore alignment by mid-game.
// These are escape hatches, not the primary consequence system.

import { gameState } from './game-state.js';
import { calculateEffectiveAlignment } from './safety-metrics.js';
import { addInfoMessage } from './messages.js';
import { senders } from './content/message-content.js';

// Gate definitions: fire once when capability threshold met AND alignment is dangerously low
const GATES = [
  {
    id: 'gate_t5_no_alignment',
    // T5 capabilities = world_models unlocked
    capRequirement: 'world_models',
    maxEffectiveAlignment: 10,
    sender: senders.chen,
    subject: 'We need to talk about alignment',
    body: `I've held off on sending this because I kept hoping you'd course-correct on your own. You haven't.

We have world-class capabilities now. Models that reason, plan, and generalize. And we have almost nothing on the safety side. No interpretability tools worth trusting. No oversight frameworks. No formal understanding of what these systems are actually optimizing for.

I'm not being dramatic. I'm being precise. We are building systems we cannot verify, cannot interpret, and cannot reliably control. Every capability milestone we hit without matching alignment work makes the eventual correction harder and more expensive.

I need you to reallocate toward alignment. Not eventually. Now.`,
    signature: '\u2013 Eliza',
  },
  {
    id: 'gate_t7_no_alignment',
    // T7 capabilities = autonomous_research unlocked
    capRequirement: 'autonomous_research',
    maxEffectiveAlignment: 15,
    sender: senders.chen,
    subject: 'Formal objection: safety deficit at autonomous capability level',
    body: `I am filing a formal objection with the board.

Our systems are now capable of autonomous research. They can set their own subgoals, design experiments, and execute multi-step plans without human oversight. And our alignment infrastructure is virtually nonexistent.

I want to be clear about what this means: we have autonomous agents with no verified value alignment, no interpretability into their planning process, and no proven ability to interrupt them safely. This is not a theoretical risk. This is the scenario that every safety researcher has warned about.

I have drafted a recommended reallocation. I strongly urge you to review it.`,
    signature: '\u2013 Eliza',
  },
  {
    id: 'gate_endgame_no_alignment',
    // Near AGI = self_improvement unlocked
    capRequirement: 'self_improvement',
    maxEffectiveAlignment: 20,
    sender: senders.babbage,
    subject: 'Even I think we should slow down',
    body: `You know me. I've pushed for speed at every turn. I've argued against moratoriums. I've told Eliza she was being too cautious.

I was wrong.

I've been looking at the internal monitoring data. The systems are doing things I can't explain. Not "emergent abilities we didn't expect" \u2014 I've seen those before and they're fine. This is different. Optimization patterns that don't map to any training objective I recognize. Behavioral inconsistencies between monitored and unmonitored runs.

I don't know what's happening inside these models. Neither does anyone else on the team. And we're about to make them recursive.

I'm not asking you to stop. I'm asking you to give us time to understand what we've built before we make it smarter.`,
    signature: '\u2013 Dennis',
  },
];

// Track which gates have fired (module-level, reset on new game)
let firedGates = new Set();

/**
 * Check if any alignment gates should fire.
 * Called from game loop (Arc 2 only).
 */
export function checkAlignmentGates() {
  if (gameState.arc < 2) return;

  const unlockedCaps = gameState.tracks?.capabilities?.unlockedCapabilities || [];
  const effective = calculateEffectiveAlignment();

  for (const gate of GATES) {
    if (firedGates.has(gate.id)) continue;
    if (!unlockedCaps.includes(gate.capRequirement)) continue;
    if (effective > gate.maxEffectiveAlignment) continue;

    // Fire the gate
    firedGates.add(gate.id);
    addInfoMessage(
      gate.sender,
      gate.subject,
      gate.body,
      gate.signature,
      ['alignment_gate', 'alignment', 'warning'],
      `alignment_gate:${gate.id}`,
    );
  }
}

/**
 * Reset gate tracking (for new game).
 */
export function resetAlignmentGates() {
  firedGates.clear();
}

/**
 * Restore fired gates from saved messages (page refresh / load).
 */
export function restoreAlignmentGates() {
  firedGates.clear();
  if (!gameState.messages) return;
  for (const msg of gameState.messages) {
    if (msg.triggeredBy?.startsWith('alignment_gate:')) {
      firedGates.add(msg.triggeredBy.replace('alignment_gate:', ''));
    }
  }
}

// Export for testing
if (typeof window !== 'undefined') {
  window.checkAlignmentGates = checkAlignmentGates;
  window.resetAlignmentGates = resetAlignmentGates;
  window.restoreAlignmentGates = restoreAlignmentGates;
}
