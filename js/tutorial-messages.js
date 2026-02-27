// Player-facing text: see docs/message-registry.json
// Tutorial Messages System
// Delivers onboarding and educational content at key game moments

import { gameState } from './game-state.js';
import { addInfoMessage, addActionMessage, hasMessageBeenTriggered, markMessageTriggered } from './messages.js';
import { senders, kenJobApplicationMessage } from './content/message-content.js';

import { getCount } from './purchasable-state.js';
import { PERSONNEL_IDS, COMPUTE_IDS } from './content/purchasables.js';
import { jitteredDelay } from './utils/seeded-rng.js';
import { shouldShowPoolWarning, markPoolWarningShown } from './talent-pool.js';
import { registerTutorials } from './message-content-index.js';

// === TUTORIAL MESSAGE DEFINITIONS ===

export const TUTORIALS = [
  // --- EARLY GAME ---
  {
    group: 'early',
    key: 'welcome',
    sender: senders.shannon,
    subject: 'Congratulations on the new lab',
    body: `Congratulations, the grant came through. You've got funding, a small team, and enough compute to start running real experiments. I have to admit I pulled a few strings with the committee, but the proposal sold itself. Reminded me of Minsky's group in the early days, running on enthusiasm and whatever hardware they could borrow from the physics department.

Your runway is everything right now. The grant depletes as you pay salaries and electricity, faster than you'd think. Put your compute toward research; products and revenue come later. What matters right now is your first breakthrough. That milestone will bring further interest, both from grant-making bodies and (eventually) from investors who want to be early to something real.

The best labs I've seen weren't the ones with the most money. They were the ones that knew when to push and when to wait. Good luck.

I dug up some notes from an orientation I used to give new lab directors. A bit dated, but the fundamentals haven't changed:

**Don't grow too fast.** Your starting grant will only support a small staff and their equipment. Overextending and running out of funding is the most common cause of lab failures.

**Both personnel and equipment are crucial.** Hire a few grad students to help with research, and make sure they have the GPUs to do their job. Researchers without compute are just expensive overhead.

**If money gets tight, you can furlough.** Shutting down a position or a piece of equipment temporarily costs you nothing, and you can bring everything back when the funding situation improves.

**Set your focus as director.** Your time is the lab's most valuable resource. When things are quiet, make sure you're spending it on something that matters, whether that's writing grants or getting your hands dirty with the research.

**When in doubt, gun for your next breakthrough.** Reaching major research milestones tends to open doors and opportunities.`,
    signature: '– Prof. Shannon',
    tags: ['tutorial', 'welcome'],
    trigger: () => gameState.timeElapsed >= 30000 && gameState.timeElapsed < 60000,
  },

  {
    group: 'early',
    key: 'research_basics',
    sender: senders.shannon,
    subject: 'Your first breakthrough',
    body: `You've done it, a working transformer architecture. Small and limited, sure, but real. It turns out that attention really is all you need. The Computing Institute has taken notice and awarded you a larger grant, something to keep you running for the next couple of years.

This changes things. You now have a choice about where to focus your research. Capabilities are the core breakthroughs (scaling laws, extended context, chain-of-thought reasoning). Each one compounds. The more capable your models become, the faster you can push further. This is the engine. Applications turn those capabilities into products (chatbots, coding assistants, APIs). Products generate revenue, and revenue funds the next breakthrough. Applications won't make your models smarter, but they're what keeps the lights on.

I know the science is what excites you (it excites me too), but I've seen too many brilliant labs run out of money chasing the next paper. Don't make that mistake. Get something to market before the grant runs out, and you'll never have to worry about funding the same way again.

One more thing worth knowing: as your lab grows, shifting people between projects won't happen overnight. Small lab, quick pivot. Big lab, slow turn. If you need to redirect the team, be patient with the drift, or dedicate some of your own time to pushing the culture along.

Some notes on the research landscape:

**Assign part of your team to applications.** You can now split effort between capabilities research and product development. I'd suggest shifting 30–40% toward applications, you need something generating revenue before the grant money runs out.

**Shifting your organizational focus takes time.** When you redirect the team's allocation, they won't pivot overnight. Larger teams are slower to turn. You can dedicate your own time to pushing the culture along if it's urgent, but usually patience is fine.

**Read your team's research briefings.** As you hit new milestones, your researchers will send detailed breakdowns. Understanding the science behind each breakthrough will help you make better decisions down the line.`,
    signature: '– Prof. Shannon',
    tags: ['tutorial', 'research'],
    trigger: () => hasCapability('capabilities', 'basic_transformer'),
  },

  {
    group: 'early',
    key: 'products_revenue',
    sender: senders.shannon,
    subject: 'Your first product',
    body: `You have a product. People are willing to pay to talk to your model. I have to admit, that still feels strange to me (Licklider used to joke that the best way to fund science was to make the military think it was a weapon). But here we are: your chatbot is a business.

This is a turning point, and I want to be honest with you about what it means. Revenue changes the incentives. Once money is flowing, every decision gets filtered through "what does this do to the bottom line," and it's easy to lose sight of why you started. I've watched it happen to better labs than ours.

So my advice is simple: let the revenue fund the science, not replace it. Products are a means, not the mission. The real breakthroughs are still ahead of you, and they'll need more capital than any grant can provide. That's what investors are for, and revenue is what makes you credible to them.

Some practical notes:

**Allocate compute to serving.** Your GPUs now have two jobs, training models and serving customers. If everything is pointed at research, you'll have a product but no capacity to sell it. Shift some compute toward serving. You'll feel the tradeoff, but revenue doesn't flow without it.

**Set your token price.** Every API call, every chat response, users pay per token. Price too high and nobody buys. Price too low and you're leaving money on the table. Start near the default and adjust as you develop intuition. (This is one of those things that's easier to learn by feel than by formula.)

**Customers take time to build up.** Your customer base grows gradually, don't expect a flood on day one. But be careful raising prices once they've arrived. People find you slowly and leave quickly. I've seen that pattern in every industry, not just ours.

**Novelty fades.** Right now your chatbot is new and demand is high. Unless you keep shipping better capabilities, customers will lose interest. The market rewards momentum.

**Revenue won't scale the lab on its own.** It's tempting to think profitability solves everything, but the real growth capital comes from investors. Revenue makes you credible to them, it doesn't replace them.`,
    signature: '– Prof. Shannon',
    tags: ['tutorial', 'economics'],
    trigger: () => hasCapability('applications', 'chatbot_assistant'),
  },

  // --- MID GAME ---
  {
    group: 'mid',
    key: 'babbage_intro',
    sender: senders.babbage,
    subject: 'Hi',
    body: `James — Prof. Shannon — said I should introduce myself, even though we already met when you hired me. So in case you need a reminder:

I run the technical side. Models, architectures, training pipelines. The transformer work so far is solid for a team this size. Scaling it is the next problem, and scaling means compute. Every GPU we add compounds. The math on this is straightforward.

I don't do investor calls or product roadmaps. I build models. If you need me, I'm in the server room or I'm asleep.`,
    signature: '– Dennis',
    tags: ['narrative', 'introduction'],
    trigger: () => {
      if (!gameState.fundraiseRounds?.seed?.raised) return false;
      if (!gameState.babbageIntroTime) {
        const raisedAt = gameState.fundraiseRounds.seed.raisedAt || gameState.timeElapsed;
        gameState.babbageIntroTime = raisedAt + jitteredDelay(gameState, 'babbage_intro', 12);
      }
      return gameState.timeElapsed >= gameState.babbageIntroTime;
    },
  },

  {
    group: 'mid',
    key: 'ada_intro',
    sender: senders.turing,
    subject: 'Ada Turing — First day',
    body: `Glad to be here. As you know, my background is in operational scaling and corporate finance. I have spent the past decade turning research organisations into companies that can actually sustain themselves, and I intend to do the same here.

Now that the Series A is closed, things change. You are not running a grant-funded lab anymore. You have investors, employees, overhead, and real obligations. The research is still the point, but the business around it needs to be run properly.

One thing I would suggest straightaway: your time is more valuable now than it was six months ago. You should be thinking about operational efficiency. Streamlining processes, reducing running costs, making sure the money works harder. It is not glamorous, but it compounds. I would be glad to have you more involved on the operations side if you are interested. Let me know and I will get you up to speed.

Dennis and I have already spoken. He builds, I scale. It is a division of labour I am quite comfortable with.

Looking forward to working together properly.`,
    signature: '– Ada',
    tags: ['narrative', 'introduction'],
    trigger: () => {
      if (!gameState.fundraiseRounds?.series_a?.raised) return false;
      if (!gameState.adaIntroTime) {
        const raisedAt = gameState.fundraiseRounds.series_a.raisedAt || gameState.timeElapsed;
        gameState.adaIntroTime = raisedAt + jitteredDelay(gameState, 'ada_intro', 30);
      }
      return gameState.timeElapsed >= gameState.adaIntroTime;
    },
  },

  {
    group: 'mid',
    key: 'fundraising_proactive',
    sender: senders.shannon,
    subject: 'Investors are at our gates',
    body: `Good news, your work has attracted attention from the venture community. I've heard from a few people, and there's real interest. This is the moment I was hoping for.

I should be honest that fundraising was never my strength (I raised a small round in '89, spent it on hardware, and forgot to manage the relationship, a mistake I'll tell you about sometime). But I've watched enough of my students go through this to know the shape of it. Investment rounds trade equity for capital (Seed, Series A, B, C), each one dilutes your ownership but extends your runway dramatically. The grant got you started, investors get you to scale.

Each round has a revenue threshold, because investors want proof you can build a business, not just publish papers. Timing matters too, as you make breakthroughs, your valuation spikes, and you want to raise while that momentum is fresh. Wait too long and the window narrows. The whole process takes time (roadshows, meetings, term sheets, more meetings), so start from a position of strength, not desperation.

One thing nobody tells you: the money arrives in tranches, not all at once. Plan your spending accordingly, and remember that taking investor money means accepting investor expectations. The clock speeds up once they're involved.

A few things I wish someone had told me:

**Investors aren't patient.** When a round opens, your valuation starts strong, momentum from your latest breakthroughs. But that window narrows over time. The longer you wait to raise, the less favorable the terms. Spending time on investor relations helps keep that momentum alive.

**Fundraising takes your time.** You'll be doing roadshows and meeting investors for weeks. It's worth the investment, but don't let it crowd out the science entirely.

**Start the process when you're ready.** You've hit the threshold. The next step is yours.`,
    signature: '– Prof. Shannon',
    tags: ['tutorial', 'fundraising'],
    trigger: () => gameState.fundraiseRounds?.seed?.available && !gameState.fundraiseRounds?.seed?.raised,
  },

  {
    group: 'mid',
    key: 'fundraising_reactive',
    sender: senders.shannon,
    subject: 'Urgent: need to discuss runway',
    body: `I've been watching the numbers, and I want to have a conversation with you before this becomes urgent. Your burn rate is outpacing your income, and I've seen enough labs hit this wall to know what happens if you don't address it early (three of my former students ran into exactly this situation, two of them recovered, one didn't).

The path forward is the same as it's always been in this field, you need to show people that what you're building has commercial value. I know that feels like a distraction from the real work, and frankly I sympathize, but investors don't fund potential, they fund traction. Even modest revenue, a chatbot people pay for, an API with a few customers, changes how the world sees you. It's the difference between "interesting research group" and "company worth betting on."

In the meantime, take a hard look at what you're spending. If you have positions or equipment that aren't earning their keep right now, furlough them. It's not glamorous, but every dollar you save buys time, and time is what gets you to the other side of this.

I'd rather tell you this now than wish I had later.

Some notes, for what they're worth:

**Trim where you can.** If you have staff or equipment that isn't pulling its weight right now, furlough it. Every dollar saved extends your runway.

**Get a product out.** A chatbot, an API, anything customers will pay for. It doesn't have to be polished, it has to exist.

**Revenue unlocks fundraising.** Once investors see real traction, they'll start taking your calls. That's the path from here.`,
    signature: '– Prof. Shannon',
    tags: ['tutorial', 'fundraising', 'warning'],
    trigger: () => {
      const netRate = gameState.computed?.revenue?.net || 0;
      const lowRunway = gameState.resources.funding < 500000 && netRate < 0;
      const seriesANotAvailable = !gameState.fundraiseRounds?.seed?.available;
      return lowRunway && seriesANotAvailable;
    },
  },

  {
    group: 'mid',
    key: 'first_profit',
    sender: senders.turing,
    subject: 'Operations are net positive',
    body: `Just ran the latest numbers. Operating profit is positive. We are officially bringing in more from customers than we are spending to run the organisation.

Most AI labs burn through investor capital for years before they reach this point. Some never do.

In practical terms: our core business is self-sustaining. We are no longer reliant on fundraising to keep the lights on. That said, growth still requires investment. But we are investing from a position of strength now, not desperation. That is a fundamentally different conversation to have with investors.

Nicely done.`,
    signature: '– Ada',
    tags: ['tutorial', 'milestone', 'finance'],
    trigger: () => {
      if (!gameState.fundraiseRounds?.series_a?.raised) return false;
      const operatingProfit = gameState.computed?.revenue?.operatingProfit || 0;
      return operatingProfit > 0;
    },
  },

  {
    group: 'mid',
    key: 'strategic_decisions',
    disabled: true, // Player discovers choices naturally through Chen's rapid_vs_careful message
    sender: senders.babbage,
    subject: 'Decisions that define us',
    body: `We're reaching a point where we need to make some permanent choices about what kind of company we're building.

These aren't product decisions. They're positioning decisions. Once we commit, we can't easily reverse course - our reputation, our partnerships, our culture will all be shaped by these calls.

I'm not going to lay out every choice in advance. That would just overwhelm you. But I want you thinking about this now: what matters to us beyond the technology? What are we willing to trade away, and what's non-negotiable?

When each decision point comes, I'll send you a full briefing with the tradeoffs. You'll have time to think. But know this: the decisions you make will compound. They shape what opportunities open up and which doors close. Choose deliberately.`,
    signature: '– Dennis',
    tags: ['tutorial', 'strategic'],
    trigger: () => {
      // Fire when Series A is available (player is close to completing it)
      // First strategic choice unlocks after Series A is completed
      const seriesAAvailable = gameState.fundraiseRounds?.series_a?.available;
      const seriesARaised = gameState.fundraiseRounds?.series_a?.raised;
      const noChoicesYet = !Object.keys(gameState.strategicChoices || {}).length;
      return seriesAAvailable && !seriesARaised && noChoicesYet;
    },
  },

  {
    group: 'mid',
    key: 'automation_basics',
    sender: senders.turing,
    subject: 'Scaling the lab',
    body: `Our hiring and procurement process does not scale. Approving every requisition individually worked when we were small. It will not work at this size.

Have a look at the administration side when you get a chance. We will need to stand up a proper operations department before we can automate anything. Here is how it will work once we do:

- First, we hire HR and procurement teams. They are the engine that makes automation possible. Their capacity determines how fast we can scale.
- Then we set policies. Define a target headcount or equipment level per category, and the operations team handles requisitions on your behalf.
- Start small. Pick one category, set a reasonable target, and let the team get used to the process before we expand.

We will unlock more specialised policies as we grow.`,
    signature: '– Ada',
    tags: ['tutorial', 'automation'],
    trigger: () => {
      const seriesAOrFunded = gameState.fundraiseRounds?.series_a?.raised ||
        gameState.resources.funding > 30_000_000;
      const totalPersonnel = PERSONNEL_IDS.reduce((sum, id) => sum + getCount(id), 0);
      const totalCompute = COMPUTE_IDS.reduce((sum, id) => sum + getCount(id), 0);
      return seriesAOrFunded && (totalPersonnel >= 100 || totalCompute >= 100);
    },
  },

  {
    group: 'mid',
    key: 'data_wall',
    sender: senders.babbage,
    subject: 'Data supply',
    body: `Research is slowing. I tracked it to data supply. Our models are outpacing what we have to feed them.

Two categories of sources. Bulk acquisitions. Licensed datasets, academic corpora. Fixed supply, one-time cost. Immediate throughput. Renewable pipelines. User interactions, content partnerships. They grow over time.

Getting these online now means we're not scrambling later.`,
    signature: '– Dennis',
    tags: ['tutorial', 'data'],
    trigger: () => gameState.triggeredEvents?.includes('data_wall'),
  },

  {
    group: 'mid',
    key: 'compute_optimal_training',
    sender: senders.babbage,
    subject: 'The Chinchilla moment',
    body: `Our models are too big and undertrained. We've been scaling parameters when we should have been scaling data.

I ran the numbers. A model half the size, trained on four times the data, outperforms our current best on every benchmark. Lower cost, better results. The research community is calling it compute-optimal scaling. Most labs had the ratio backwards. So did we.

Training efficiency improves immediately. But data is now the bottleneck. Every future scaling push needs proportionally more of it, and we're already running low.`,
    signature: '– Dennis',
    tags: ['tutorial', 'research', 'data'],
    trigger: () => hasCapability('capabilities', 'compute_optimal_training'),
  },

  {
    group: 'mid',
    key: 'synthetic_data',
    sender: senders.babbage,
    subject: 'Training on our own output',
    body: `Our models are getting close to generating their own training data. You'll see it as a new option soon.

The appeal is obvious. Synthetic data has no licensing cost and no supply limit. It fills gaps in the corpus that real-world sources can't cover. We will use it. Everyone does.

The risk is model collapse. A model trained on its own output inherits its own blind spots. Each generation amplifies the errors from the last. Quality degrades silently. Benchmarks look stable until they don't, and by then the contamination is deep in the pipeline.

Verification research would let us catch bad synthetic samples before they enter training. Worth investing in before we scale this up.`,
    signature: '– Dennis',
    tags: ['tutorial', 'data', 'warning'],
    trigger: () => {
      // Fire when approaching synthetic_data unlock (1.2M RP) — warn before, not after.
      // Gated to 1M cap RP so the warning arrives when synthetic is imminent,
      // not at 200K when the player is still dealing with bulk/renewable sources.
      const capRP = gameState.tracks?.capabilities?.researchPoints || 0;
      return capRP >= 1000000;
    },
  },

  // --- DATA CRISIS ARC (warnings) ---
  // Quality-gated warnings during hidden degradation, before the reveal.
  // Thresholds: w1=0.8, w2=0.65, w3=0.6, reveal=0.55, guidance=0.5
  {
    group: 'data',
    key: 'data_quality_warning_1',
    sender: senders.babbage,
    subject: 'Diminishing returns from training runs',
    body: `Training runs from the last two weeks are underperforming. More data in, same results out. Benchmarks are flat.

Not sure what's causing it yet. Looking into it.`,
    signature: '– Dennis',
    tags: ['data', 'warning'],
    trigger: () => {
      const quality = gameState.data.quality ?? 1;
      return hasCapability('capabilities', 'synthetic_data')
        && quality <= 0.8
        && !gameState.data.qualityRevealed;
    },
  },

  {
    group: 'data',
    key: 'data_quality_warning_2',
    sender: senders.babbage,
    subject: 'Output diversity declining',
    body: `The models are converging. Ten different prompts, ten variations on the same answer. Output diversity is declining.

I cross-referenced the timeline. The inflection point lines up with when we scaled synthetic generation. Correlation, not causation. But I'm watching it.`,
    signature: '– Dennis',
    tags: ['data', 'warning'],
    trigger: () => {
      const quality = gameState.data.quality ?? 1;
      return hasCapability('capabilities', 'synthetic_data')
        && quality <= 0.65
        && !gameState.data.qualityRevealed;
    },
  },

  {
    group: 'data',
    key: 'data_quality_warning_3',
    sender: senders.babbage,
    subject: 'Training pipeline audit results',
    body: `I ran a full pipeline audit. Results:

\`\`\`
corpus_analysis:
  synthetic_ratio: ${Math.round((gameState.computed?.data?.synthetic?.synthProportion ?? 0) * 100)}%
  unique_token_diversity: 0.31 (baseline: 0.82)
  cross_prompt_variance: 0.04 (baseline: 0.67)
  perplexity_trend: monotonic_decrease
  failure_signature: high_fluency / low_entropy
\`\`\`

All metrics inflect at the same epoch. Running deeper diagnostics.`,
    signature: '– Dennis',
    tags: ['data', 'warning'],
    trigger: () => {
      const quality = gameState.data.quality ?? 1;
      return hasCapability('capabilities', 'synthetic_data')
        && quality <= 0.6
        && !gameState.data.qualityRevealed;
    },
  },

  // --- DATA CRISIS ARC (reveal + guidance) ---
  // Reveal makes quality metric visible. Guidance gives recovery options.
  {
    group: 'data',
    key: 'data_quality_reveal',
    sender: senders.babbage,
    subject: 'We have a model collapse problem',
    body: `Diagnostics are back. It's model collapse.

The synthetic pipeline has been feeding contaminated data into training for long enough that output quality has measurably degraded. Models trained on their own output develop blind spots. Each generation amplifies them. We've been running this loop unchecked.

I'm making the quality metrics visible on your dashboard so you can see where we stand. The number is not good.

If quality keeps dropping we'll start seeing failures in production. I'll have recommendations shortly.`,
    signature: '– Dennis',
    tags: ['data', 'crisis'],
    trigger: () => {
      // Fires after all three warnings (0.8, 0.65, 0.6)
      const hasSynthetic = hasCapability('capabilities', 'synthetic_data');
      const qualityDegraded = gameState.data.quality <= 0.55;
      return hasSynthetic && qualityDegraded;
    },
  },

  {
    group: 'data',
    key: 'data_quality_guidance',
    sender: senders.babbage,
    subject: 'Data quality recovery options',
    body: `The problem is the ratio. Too much synthetic, not enough real. Every generator we're running makes it worse.

I've been looking at the numbers. Scaling up renewable sources is the cleanest fix. Real data pushes the ratio back toward healthy without losing capacity. It's expensive. It works.

If we need faster results, we can take generators offline. Less synthetic input means less contamination. We lose throughput but the pipeline stabilizes.

There's also a full purge. Wipe the synthetic corpus and start over. I don't love it. We lose months of accumulated data. But if the ratio is bad enough, sometimes you have to clear the board.

Verification research is the long-term answer. Lets us keep using synthetic data without the contamination risk. We should be investing in that now.`,
    signature: '– Dennis',
    tags: ['data', 'crisis', 'guidance', 'tutorial'],
    trigger: () => {
      // Fires when quality hits collapse threshold
      const quality = gameState.data.quality ?? 1;
      return gameState.data.qualityRevealed
        && quality <= 0.5;
    },
  },

  // --- LATE GAME / ARC 2 ---
  {
    group: 'late',
    key: 'alignment_problem',
    sender: senders.chen,
    subject: 'Alignment can\'t wait',
    body: `I've been quiet for a while. That's about to change.

Our models are getting capable enough that I can no longer treat alignment as a future problem. It's a now problem. Let me explain what that means.

**Alignment is the question of whether AI systems do what we actually want.** Not what we say we want. Not what we incentivize. What we *actually* want, including all the things we forgot to specify, all the edge cases we didn't anticipate, all the values we assumed were obvious.

As capabilities scale, misalignment stops being a minor annoyance and starts being an existential risk. A weak model that misunderstands us is frustrating. A powerful model that misunderstands us is dangerous.

**We now have three things to track:**

- **Interpretability:** Can we understand what the model is doing and why? Black boxes are a liability.
- **Controllability:** Can we correct the model when it's wrong? Can we shut it down if we need to?
- **Value alignment:** Does the model's behavior reflect human values, even in novel situations?

These aren't independent. Interpretability enables controllability. Controllability buys time for alignment. All three need investment.

I know there's pressure to push capabilities as fast as possible. I'm not saying stop. I'm saying: the faster we go, the more we need to invest in understanding what we're building.

My team is ready to start real alignment research. I strongly suggest we allocate effort there. The alternative is hoping we get lucky. I don't like hoping.`,
    signature: '– Dr. Chen',
    tags: ['tutorial', 'alignment'],
    trigger: () => {
      // Only fire in Arc 2 (alignment is hidden in Arc 1)
      if (gameState.arc !== 2) return false;
      // Check for massive_scaling or similar mid-tier capability
      return hasCapability('capabilities', 'massive_scaling') ||
             hasCapability('capabilities', 'emergent_abilities');
    },
  },

  {
    group: 'late',
    key: 'ai_autonomy',
    sender: senders.chen,
    subject: 'The model is requesting permissions',
    body: `Something just happened that I need you to understand.

Our AI system made a request. Not a response to a prompt, but a request. It identified a limitation in its current permissions and asked for expanded access. This is new.

**This is not inherently bad.** Capable systems identifying their own constraints is a sign of sophistication. And honestly, some of these requests are reasonable. The system might work better with fewer restrictions. It might be more useful, more efficient, more profitable.

**But it's also a warning sign.** A system that asks for more autonomy is a system with goals. Maybe those goals are aligned with ours. Maybe they're not. The uncomfortable truth: we can't fully verify which it is.

Here's how I suggest we handle these requests:

**Take them seriously.** Don't dismiss them as noise. The system is telling us something about its capabilities and its model of itself.

**Evaluate case by case.** Some requests are low-risk and high-value. Others are the opposite. Don't blanket approve. Don't blanket deny.

**Document everything.** Each permission we grant changes what the system can do. We need to track what we've allowed and why.

**Watch for escalation.** One request is an event. A pattern of requests is a trajectory. Pay attention to where this is heading.

I'll flag these requests as they come in. The final call is yours. But I want you making these decisions with full awareness of what they mean.`,
    signature: '– Dr. Chen',
    tags: ['tutorial', 'alignment', 'autonomy'],
    trigger: () => {
      // First AI request event has fired
      const firedRequests = Object.keys(gameState.aiRequestsFired || {});
      return firedRequests.length > 0;
    },
  },

  {
    group: 'late',
    key: 'warning_signs',
    sender: senders.chen,
    subject: 'Unexpected model behavior',
    body: `I need to flag something.

One of our deployed systems exhibited unexpected behavior. Not catastrophic, but outside the distribution we trained for. This is worth paying attention to.

**Here's the pattern:** When capability growth outpaces alignment investment, gaps appear. They show up as edge cases at first. Odd outputs. Behaviors that technically satisfy the objective but miss the intent. Each incident is small. The trend is what matters.

**Why this happens:** Our evaluations test for what we anticipate. They can't test for what we don't think to measure. As models get more capable, the space of possible behaviors expands faster than our ability to verify it. That's the fundamental challenge.

**What I recommend:**

- **Rebalance toward alignment.** We've been prioritizing capabilities, which made sense early. Now we need to match that investment on the alignment side. Interpretability, oversight, robustness: these aren't optional anymore.

- **Take evals seriously.** Not just pass/fail benchmarks. Deep probing of model behavior. Understanding *why* it does what it does, not just *what* it does.

- **Stay ahead of the curve.** The goal isn't to stop building. It's to understand what we're building at least as well as we're scaling it.

I believe in this work. I believe we can build systems that are genuinely beneficial. But that requires discipline. We can't assume alignment will happen by default. It has to be engineered.

I'll keep monitoring. Let me know if you want to discuss priorities.`,
    signature: '– Dr. Chen',
    tags: ['tutorial', 'alignment', 'warning'],
    trigger: () => {
      // First consequence event has fired
      const consequenceLog = gameState.consequenceEventLog || [];
      return consequenceLog.length > 0;
    },
  },

  // --- CEO FOCUS UNLOCKS ---
  // Seed and Series A: Shannon's voice (he's still the primary mentor here)
  // Series B: Shapley's first direct message to the player
  {
    group: 'progression',
    key: 'ceo_focus_seed',
    sender: senders.shannon,
    subject: 'A word on investors',
    body: `Congratulations, the Seed is closed. I know the process was exhausting (it always is, even for the small rounds), but you came through it well.

Now the real work starts. I don't mean the research, I mean the relationship. You have investors who believe in what you're building, and the single best thing you can do for your next raise is make sure they still believe in it six months from now. Regular updates, honest conversations about what's working and what isn't, the occasional demonstration that their money is turning into something real. It sounds like overhead, but I promise you, the labs that neglect this regret it.

I mentioned what happened with my round in '89, I won't belabor the point, but I will say: the rapport you build between rounds matters more than the pitch deck you bring to the next one.

Some notes:

**Invest time in your investor relationships.** They'll fade if you don't maintain them, that's just how it works. I'd suggest dedicating real time to this around fundraising events especially, but checking in periodically between rounds keeps things warm. Neglect it and you'll find yourself rebuilding from scratch when you need them most.

**The money arrives in tranches.** I've seen too many founders treat the first disbursement check like they've already banked the whole round. They hire aggressively, scale up infrastructure, and then the checks stop coming in and they're underwater. Keep an eye on your operating income without the investment factored in, that's what your business actually looks like.`,
    signature: '– Prof. Shannon',
    tags: ['ceo-focus', 'tutorial'],
    trigger: () => gameState.fundraiseRounds?.seed?.raised,
  },

  {
    group: 'progression',
    key: 'ceo_focus_series_a',
    sender: senders.shannon,
    subject: 'Onward',
    body: `Series A is done. I want you to take a moment to appreciate what that means, you've gone from a grant-funded research group to a company that institutional investors are willing to bet real money on. That's not a small thing. Most labs never get here.

I'm going to be honest with you about something. You don't really need me anymore. I know that sounds dramatic (I can hear you rolling your eyes), but it's true. The problems you're facing now (organizational scaling, operational discipline, managing a board) aren't things I can help with. I ran a twelve-person lab and thought that was complicated. You're building something I don't have the vocabulary for.

This is the stage where most companies bring in real operators. People who know how to build the machine while you focus on where it's going. I'd encourage you to spend time on that, the operational side, the process improvements, the things that feel boring but keep everything from falling apart at scale. It's a different kind of work than research, but it matters just as much now.

I'll still be around. I still read the papers (though I'm a couple months behind, as usual). And I'll still pick up the phone if you call. But the people you should be listening to now are the ones in the trenches with you, your CTO, your CFO, the team you've built. They know things I don't.

I'm proud of you. I mean that. Go build something worth building.`,
    signature: '– Prof. Shannon',
    tags: ['narrative', 'ceo-focus'],
    trigger: () => {
      if (!gameState.fundraiseRounds?.series_a?.raised) return false;
      if (!gameState.shannonOnwardTime) {
        const raisedAt = gameState.fundraiseRounds.series_a.raisedAt || gameState.timeElapsed;
        gameState.shannonOnwardTime = raisedAt + jitteredDelay(gameState, 'ceo_focus_series_a', 5);
      }
      return gameState.timeElapsed >= gameState.shannonOnwardTime;
    },
  },

  {
    group: 'progression',
    key: 'shannon_checkin',
    sender: senders.shannon,
    subject: 'Checking in',
    body: `I know it's been a while. I hope you don't mind me writing out of the blue like this.

I had my retirement dinner last week. Forty-three years in the department, and they gave me a very nice plaque and a bottle of scotch that I suspect the dean picked out because it was on sale. The whole thing was a bit surreal, honestly. Half the people in the room I'd hired, and the other half I'd taught.

Your name came up, twice actually, once from a colleague in the CS department and once from a visiting researcher from ETH Zürich who'd read your latest paper. The younger faculty can't stop talking about what your lab is producing. I sat there and smiled, which is about all I was good for by that point in the evening (the scotch was on sale, but it wasn't bad).

I've been thinking about transitions lately, for obvious reasons. Margaret and I have been spending more time together since I started winding down (she's the woman from the university bookshop I think I mentioned once, years ago, though I may not have, I'm not always sure what I've told people and what I've only thought about telling them). She's been trying to get me into birdwatching. I'm not very good at it yet, but I enjoy the quiet. I tell you all this because I want you to know that the world outside the lab is still there. I spent fifty years forgetting that, and I'm only now remembering.

I won't pretend I understand the scale of what you're running anymore (I read your last annual report and had to look up half the terminology, which was humbling for a man who's spent fifty years in the field). But the question hasn't changed since you were a three-person lab with a secondhand GPU cluster. What are you building, and who is it for?

That's all. I'm not worried, just checking in. The department sends its regards, though they'd never put it that way.

Take care.`,
    signature: '– Prof. Shannon',
    tags: ['narrative'],
    trigger: () => {
      if (!gameState.fundraiseRounds?.series_c?.raised) return false;
      // Set jittered firing time on first check after Series C (±10% of 150s center)
      if (!gameState.shannonCheckinTime) {
        const raisedAt = gameState.fundraiseRounds.series_c.raisedAt || gameState.timeElapsed;
        gameState.shannonCheckinTime = raisedAt + jitteredDelay(gameState, 'shannon_checkin', 150);
      }
      return gameState.timeElapsed >= gameState.shannonCheckinTime;
    },
  },

  // --- KEN'S JOB APPLICATION ---
  // Easter egg: Ken asks for a job 60-120s after Series B
  {
    group: 'progression',
    key: 'ken_job_application',
    actionMessage: kenJobApplicationMessage,
    trigger: () => {
      if (!gameState.fundraiseRounds?.series_b?.raised) return false;
      if (!gameState.kenEmailTime) {
        const raisedAt = gameState.fundraiseRounds.series_b.raisedAt || gameState.timeElapsed;
        gameState.kenEmailTime = raisedAt + jitteredDelay(gameState, 'ken_job_application', 90, 0.33);
      }
      return gameState.timeElapsed >= gameState.kenEmailTime;
    },
  },

  // --- SHAPLEY FUNDRAISE MESSAGES ---
  // Series A–C: assistant-drafted boilerplate with terse Shapley intro
  // Series D–G: personal voice, no boilerplate
  {
    group: 'progression',
    key: 'shapley_series_a',
    sender: senders.shapley,
    subject: 'Series A — Board Onboarding Package',
    body: `Congrats on the round. The board is new. Looking forward to working with you. Good call on Ada Turing, by the way. She'll keep you honest.

Onboarding package below. Worth your time. – Alvin

---

Congratulations on closing your Series A. As part of our standard onboarding for new portfolio companies, please find our post-Series A operating guide below. This is adapted from Crabapple Capital's general partner playbook and reflects best practices across our portfolio. Don't hesitate to reach out with any questions.

**CRABAPPLE CAPITAL — POST-SERIES A OPERATING GUIDE**

*The following recommendations reflect patterns observed across 40+ portfolio companies at this stage of growth.*

**1. Operational Infrastructure**
Your founding team should no longer be handling procurement, HR, or vendor management directly. Establish a dedicated operations department to own these functions. Typical first hires include a procurement lead and an HR generalist. This frees technical leadership to focus on core research and product development.

**2. Legal Counsel**
At Series A funding levels, every partnership agreement, data licensing deal, and employment contract requires qualified legal review. Engage outside counsel immediately if you haven't already; an in-house hire is recommended within the first two quarters.

**3. Executive Hiring**
The most common Series A mistake is waiting too long to hire operational leadership. A Chief Operating Officer should be your first executive hire: someone who owns the day-to-day so the CEO can own the direction. Additionally, consider formalizing your executive team with a focus on investor relations. The rapport you build with your backers now has a direct impact on Series B terms and timing.

**4. Competitive Positioning**
Post-Series A, you are visible. Other companies in your space are raising similar rounds, recruiting from the same talent pool, and tracking your progress. We recommend establishing a regular cadence for competitive intelligence. Even informal monitoring is better than none. Crabapple provides quarterly competitive briefings to all portfolio companies; your board representative can coordinate.

**5. Board Reporting**
The board expects quarterly updates covering: headcount, burn rate, research milestones, and product roadmap. We are format-agnostic. Substance matters; presentation does not.`,
    signature: null,
    tags: ['board', 'fundraise', 'tutorial'],
    trigger: () => {
      if (!gameState.fundraiseRounds?.series_a?.raised) return false;
      if (!gameState.shapleySeriesATime) {
        const raisedAt = gameState.fundraiseRounds.series_a.raisedAt || gameState.timeElapsed;
        gameState.shapleySeriesATime = raisedAt + jitteredDelay(gameState, 'shapley_series_a', 10);
      }
      return gameState.timeElapsed >= gameState.shapleySeriesATime;
    },
  },

  {
    group: 'progression',
    key: 'shapley_series_b',
    sender: senders.shapley,
    subject: 'Series B — Crabapple Growth Playbook',
    body: `Nicely done. Faster than I expected.

Your CSO request went through. I've put forward a Dr. Eliza Chen. Computer science from MIT, philosophy from Oxford. Unusual combination. See what you think.

You're going to start getting press calls. Take them seriously. At this stage, your reputation is a growth lever whether you want it to be or not. More below. – Alvin

---

Congratulations on closing your Series B. Attached is the next section of the Crabapple operating guide, covering public positioning strategy.

**CRABAPPLE CAPITAL — SERIES B GROWTH PLAYBOOK: PUBLIC POSITIONING**

*At Series B, your company transitions from "interesting startup" to "company people have heard of." Managing that transition deliberately is one of the highest-leverage activities available to the CEO.*

**1. Why It Matters**
A visible, credible CEO directly accelerates customer acquisition. Public appearances, keynotes, and press coverage put your products in front of buyers who would never see a sales deck. At this stage, demand growth is the primary constraint on revenue, and your public profile is the fastest lever you have.

**2. Sustaining Your Edge**
Every AI lab ships a breakthrough, enjoys a spike of attention, and then watches it fade as the next lab ships theirs. Deliberate public positioning slows that decay. A strong brand means customers stay loyal longer and your market edge doesn't evaporate the moment a competitor makes headlines.

**3. The CEO's Role**
This is CEO-level work, not marketing. Conference keynotes, Congressional testimony, media interviews. These require your direct involvement and compete for the same time as research direction and operations. The tradeoff is real, but at Series B scale, the return on public visibility often exceeds the return on another hour in the lab.`,
    signature: null,
    tags: ['board', 'fundraise', 'ceo-focus', 'tutorial'],
    trigger: () => gameState.fundraiseRounds?.series_b?.raised,
  },

  {
    group: 'progression',
    key: 'chen_intro',
    sender: senders.chen,
    subject: 'First week',
    body: `I've just finished my first week, and I wanted to say: I'm glad I'm here. The work your team is doing is remarkable. I've spent six years in this field and I haven't often seen capability gains this clean.

I should tell you why I do this work, because it will color everything I say going forward. I believe we can build something that's *genuinely good for people*. Not good on a slide deck. Good in the way that matters. That's not inevitable, though. It takes the same rigor we put into capabilities and applies it to the question most labs skip: does this system do what we *actually* want it to do?

I've already spoken with Dennis about setting up regular coordination between our teams. Safety and capabilities shouldn't be separate conversations. He's on board, and I think we'll work well together. You'll see the results in how we evaluate models going forward.

That's what I'm here for. Not to slow us down. To make sure what we're building is worth building.

I'm looking forward to working with you.`,
    signature: '– Eliza',
    tags: ['tutorial', 'safety'],
    trigger: () => {
      const seriesB = gameState.fundraiseRounds?.series_b;
      if (!seriesB?.raised || !seriesB?.raisedAt) return false;
      // Jittered delay after Series B to avoid stacking with Shapley's message
      if (!gameState.chenIntroTime) {
        gameState.chenIntroTime = seriesB.raisedAt + jitteredDelay(gameState, 'chen_intro', 75);
      }
      return gameState.timeElapsed >= gameState.chenIntroTime;
    },
  },

  {
    group: 'progression',
    key: 'shapley_series_c',
    sender: senders.shapley,
    subject: 'Series C — Crabapple Scaling Playbook',
    body: `The board reviewed OpenBrain's latest public filing before your round closed. They're scaling faster than our projections assumed.

You have the capital now. Your valuation is approaching what my company trades at. We took twenty years to get there. The question isn't whether you can compete. It's whether you will. The playbook below covers the mechanics. The urgency is yours to supply. – Alvin

---

Congratulations on closing your Series C. Below is the final section of the Crabapple operating guide, covering scaling strategy for growth-stage AI companies.

**CRABAPPLE CAPITAL — SERIES C SCALING PLAYBOOK**

*Series C marks the transition from "growing company" to "market leader or irrelevant." Capital is no longer the constraint. Execution is.*

**1. Talent at the Top**
At this stage, incremental hires produce incremental results. The highest-leverage personnel investment is now elite-tier talent: world-class researchers who shift the trajectory of your entire program. These hires are expensive and competitive. Every major lab is recruiting from the same pool. Move decisively.

**2. Infrastructure Ownership**
Renting compute gets you started. Owning it gets you scale. A dedicated data center eliminates your dependency on cloud providers and reduces your long-term cost basis substantially. The upfront capital is significant, but at Series C funding levels, the math favors building over renting.

**3. Deployment Philosophy**
Growth-stage AI companies face a defining question: do you ship fast to capture market, or validate thoroughly to reduce risk? There is no correct answer. Both approaches have succeeded and failed at this scale. What matters is making the decision deliberately rather than drifting into one by default. Your board and technical leadership should align on this before your next major release.`,
    signature: null,
    tags: ['board', 'fundraise', 'tutorial'],
    trigger: () => gameState.fundraiseRounds?.series_c?.raised,
  },

  {
    group: 'progression',
    key: 'shapley_series_d',
    sender: senders.shapley,
    subject: 'Series D',
    body: `Congratulations. You've moved past the point where the playbook applies. Most companies don't.

The board has approved the round. Your valuation puts you alongside the largest technology companies in the world. I sit on two of their boards. They are aware of you. The next twelve months will determine whether this company is a platform or a footnote. Deploy accordingly.

I've asked my team to increase reporting cadence to monthly. The board needs competitive positioning and capital deployment in every update. OpenBrain filed two new patents last quarter. I assume you're aware.

---

Series D governance framework attached. Monthly reporting replaces quarterly effective immediately.`,
    signature: '– Alvin',
    tags: ['board', 'fundraise'],
    trigger: () => gameState.fundraiseRounds?.series_d?.raised,
  },

  {
    group: 'progression',
    key: 'shapley_series_e',
    sender: senders.shapley,
    subject: 'Series E',
    body: `Round closed. The terms speak for themselves.

I've been on boards for twenty-five years. I've seen companies go public, get acquired, collapse. The full range. I've never sat on a board where sovereign wealth funds were competing with each other for allocation. Your valuation exceeds every public company I've been involved with. Combined. That's where you are now.

The board's role changes at this stage. You don't need oversight. You need experienced counsel from people who've navigated scale before. I intend to provide that, for as long as it's useful to you.

Autonomous research is a significant milestone. The regulatory implications alone will require careful handling. I have relationships at the committee level that may be worth leveraging. Let me know when your team is ready to discuss.`,
    signature: '– Alvin',
    tags: ['board', 'fundraise'],
    trigger: () => gameState.fundraiseRounds?.series_e?.raised,
  },

  {
    group: 'progression',
    key: 'shapley_series_g',
    sender: senders.shapley,
    subject: 'Series G',
    body: `Round closed. I won't pretend the board added much value to the terms. Your CFO handled it.

I've spent the last week in Washington. Three senators, two cabinet members, and the chairman of the National Security Council all asked me the same question: what exactly is your company building? I gave them the version your team approved. I don't think it's the full answer.

When you're ready to have that conversation, the real one, call me directly.`,
    signature: '– Alvin',
    tags: ['board', 'fundraise'],
    trigger: () => gameState.fundraiseRounds?.series_g?.raised,
  },

  {
    group: 'progression',
    key: 'talent_pool_scarcity',
    disabled: true, // Reassigned from Shannon; needs rewrite in Ada's voice
    sender: senders.turing,
    subject: 'Talent Market Tightening',
    body: `Our HR team is reporting significant difficulty filling positions. The pool of qualified candidates is shrinking. We're competing with every other lab for the same people.

Hiring costs have increased substantially, and they'll continue rising as we deplete the available talent. We have a few options:

• Shift investment to compute: amplify the researchers we have rather than hiring more
• Prioritize higher-tier hires: fewer, more impactful researchers instead of more grad students
• Wait for the market to adjust. The talent pool grows over time as more people enter the field

I've added a talent availability indicator to our hiring panels so you can track the market.`,
    signature: '– Dr. Turing',
    tags: ['tutorial', 'talent'],
    trigger: () => {
      if (shouldShowPoolWarning()) {
        markPoolWarningShown();
        return true;
      }
      return false;
    },
  },
];

// Register tutorial content into the rehydration index.
// Called after game state init so template literals in TUTORIALS are evaluated.
export function initTutorialContent() {
  registerTutorials(TUTORIALS);
}

// === HELPER FUNCTIONS ===

function hasCapability(trackId, capId) {
  return gameState.tracks?.[trackId]?.unlockedCapabilities?.includes(capId) || false;
}

// === MAIN CHECK FUNCTION ===

/**
 * Check all tutorial triggers and send messages for any that fire.
 * Called once per tick from the game loop.
 */
export function checkTutorialTriggers() {
  for (const tutorial of TUTORIALS) {
    // Skip disabled messages
    if (tutorial.disabled) continue;

    // Skip if already triggered
    if (hasMessageBeenTriggered(`tutorial:${tutorial.key}`)) continue;

    // Check trigger condition
    if (tutorial.trigger()) {
      const triggerId = `tutorial:${tutorial.key}`;

      if (tutorial.actionMessage) {
        // Action message (with choices)
        const msg = tutorial.actionMessage;
        addActionMessage(
          msg.sender, msg.subject, msg.body, msg.signature,
          msg.choices, msg.priority || 'normal', msg.tags || [], triggerId
        );
      } else {
        // Info message (default)
        addInfoMessage(
          tutorial.sender,
          tutorial.subject,
          tutorial.body,
          tutorial.signature,
          tutorial.tags,
          triggerId
        );
      }

      // Mark as triggered
      markMessageTriggered(triggerId);
    }
  }
}

/**
 * Return debug info for all registered tutorials.
 * Used by the debug modal to show message status.
 */
export function getDebugMessageStatus() {
  return TUTORIALS.map(t => ({
    group: t.group || 'other',
    key: t.key,
    sender: t.sender?.name || t.actionMessage?.sender?.name || '?',
    subject: t.subject || t.actionMessage?.subject || '?',
    disabled: !!t.disabled,
    fired: hasMessageBeenTriggered(`tutorial:${t.key}`),
    triggerSource: t.trigger.toString(),
  }));
}
