// Player-facing text: see docs/message-registry.json
// Tutorial Messages System
// Delivers onboarding and educational content at key game moments

import { gameState } from './game-state.js';
import { addInfoMessage, hasMessageBeenTriggered, markMessageTriggered } from './messages.js';
import { senders } from './content/message-content.js';
import { getCount } from './purchasable-state.js';
import { PERSONNEL_IDS, COMPUTE_IDS } from './content/purchasables.js';
import { shouldShowPoolWarning, markPoolWarningShown } from './talent-pool.js';

// === TUTORIAL MESSAGE DEFINITIONS ===

const TUTORIALS = [
  // --- EARLY GAME ---
  {
    key: 'welcome',
    sender: senders.shannon,
    subject: 'Congratulations on the new lab',
    body: `Congratulations — the grant came through. You've got funding, a small team, and access to enough compute to start running real experiments. I've seen a few labs like this get off the ground. Here's what I've learned.

**Your runway is everything.** The grant depletes as you pay salaries and electricity bills. Watch your burn rate. When money gets tight, you can furlough staff or infrastructure. Furloughed items cost and produce nothing, and you can reactivate once you're in better financial straits. Better than layoffs.

**Compute drives research.** Every GPU you buy goes straight into running experiments. That's exactly where it should be right now. Products and customers come later — focus on breakthroughs first.

**Your CEO focus matters.** You'll find focus options alongside your main controls — right now you can choose between Grant Writing (passive income) and Hands-on Research (direct RP contribution plus a team multiplier). Your focus is active whenever your queue is empty, so keep it pointed where it counts. Hover over each option for details.

**Gun for breakthroughs.** Your initial grant should give you enough runway to reach your first breakthrough. Reaching that milestone will bring further interest, both from grant-making organizations and, eventually, investors.

One more thing: the best labs I've seen weren't the ones with the most funding. They were the ones that knew when to push and when to wait. Good luck.`,
    signature: '– Prof. Shannon',
    tags: ['tutorial', 'welcome'],
    trigger: () => gameState.timeElapsed < 1000,
  },

  {
    key: 'research_basics',
    sender: senders.shannon,
    subject: 'Your first breakthrough',
    body: `You've done it: a working transformer architecture. Small and limited, sure, but real. It turns out that attention is really all you need. The Computing Institute has awarded you a larger grant, something to keep you running for the next couple of years.

This changes things. You now have a choice about where to focus your research.

**Capabilities** are the core breakthroughs: scaling laws, extended context, chain-of-thought reasoning. Each one compounds. The more capable your models become, the faster you can push further. This is the engine.

**Applications** turn capabilities into products: chatbots, coding assistants, APIs. Products generate revenue. Revenue funds the next breakthrough. While applications don't make your models smarter, they're crucial for a self-sustaining operation. Plus, investors love to see real market adoption.

**I've unlocked the research allocation panel.** You'll find it alongside your research controls. Right now all your effort is on capabilities. I'd suggest shifting 30-40% toward applications — you'll need products before the grant money runs out.

**A word on culture.** As your lab grows, shifting people between projects won't happen instantly. When you adjust the allocation sliders, your team drifts toward the new target over time. Small lab, quick pivot. Big lab, slow pivot. If you need to shift faster, you can queue a focused culture shift in the focus queue.

Your team will send detailed breakdowns as you unlock new capabilities. Understanding the science behind each breakthrough will help you make better decisions.`,
    signature: '– Prof. Shannon',
    tags: ['tutorial', 'research'],
    trigger: () => hasCapability('capabilities', 'basic_transformer'),
  },

  {
    key: 'products_revenue',
    sender: senders.shannon,
    subject: 'Your first product',
    body: `You have a product. People will pay to talk to your model.

Here's how the economics work:

**Tokens are your unit of sale.** Every API call, every chat response - users pay per token. You control the price. Higher prices mean more revenue per token but less demand. Lower prices mean volume but thinner margins. There's an optimal zone; you'll develop intuition for it.

**Market edge decays.** Right now, your chatbot is novel. Demand is high. But novelty fades. Unless you keep shipping new capabilities, demand will decay back to baseline. Stay ahead of the curve.

**Serving needs compute.** Revenue requires serving capacity. If all your GPUs are training the next model, you'll bottleneck your income. Balance training and serving based on what you need right now.

A word of caution: **revenue helps, but it won't scale the lab.** Not yet. The real growth capital comes from investors. Series A, B, C - that's how you go from a research lab to a company that matters. Revenue makes you credible to investors. It doesn't replace them.

Running costs scale faster than you expect. The bigger you get, the more expensive everything becomes. Keep an eye on the gap between income and burn.`,
    signature: '– Prof. Shannon',
    tags: ['tutorial', 'economics'],
    trigger: () => hasCapability('applications', 'chatbot_assistant'),
  },

  // --- MID GAME ---
  {
    key: 'fundraising_proactive',
    sender: senders.turing,
    subject: 'Investors are at our gates',
    body: `Good news: we're getting inbound interest from VCs.

Your revenue numbers crossed a threshold that makes us investable. I've been fielding calls. Here's how this works.

**Investment rounds trade equity for capital.** Series A, B, C, D - each one dilutes our ownership but extends our runway dramatically. The grant got us started. Investors get us to scale.

**Each round has a revenue gate.** Investors want proof we can build a business, not just a research project. Higher rounds require more revenue before they'll write checks.

**Timing matters.** As we make new breakthroughs, hype will build in the market, and our valuation will spike. Wait too long after hitting the gate and the multiplier decays - momentum matters in venture. Fundraising takes time - we'll be doing roadshows, meeting investors, and finalizing deal terms.

**The money arrives in tranches.** We won't get a lump sum on day one. Disbursements will flow in over time. Plan our burn accordingly.

One more thing: investors aren't patient. Once we take their money, the clock speeds up. Growth expectations compound. Make sure we're ready for that pressure before we raise.

I'll let you know when we're in a position to start the fundraising process.`,
    signature: '– Ada',
    tags: ['tutorial', 'fundraising'],
    trigger: () => gameState.fundraiseRounds?.seed?.available && !gameState.fundraiseRounds?.seed?.raised,
  },

  {
    key: 'fundraising_reactive',
    sender: senders.turing,
    subject: 'Urgent: need to discuss runway',
    body: `I've been running the numbers. We have a problem.

At current burn rate, we'll run out of money before we run out of ideas. Our initial grants were generous but not infinite. We need to either cut costs or find new funding.

**On the cost side:** Look at your team. Are there hires you can furlough until revenue picks up? Every salary we're not paying extends the runway. It's not fun, but it's better than shutting down.

**On the revenue side:** Do we have a product yet? Even modest token revenue changes the equation. Investors care about traction, not just technology.

**On fundraising:** I've put some feelers out with friendly investors. They're interested, but they're looking for proof points before writing a check. Specifically, they want to see us shipping a product and generating real revenue - even if it's small. A chatbot, an API, something customers pay for.

We should be able to raise a series A once we hit certain revenue thresholds. We're not there yet, but we could be. The path is: build something sellable, price it right, and show that people will pay.

I'd rather have this conversation now than when we're out of options. Let me know how you want to play this.`,
    signature: '– Ada',
    tags: ['tutorial', 'fundraising', 'warning'],
    trigger: () => {
      const netRate = gameState.computed?.revenue?.net || 0;
      const lowRunway = gameState.resources.funding < 500000 && netRate < 0;
      const seriesANotAvailable = !gameState.fundraiseRounds?.seed?.available;
      return lowRunway && seriesANotAvailable;
    },
  },

  {
    key: 'first_profit',
    sender: senders.turing,
    subject: 'We\'re in the black',
    body: `Just ran the latest numbers. Operating profit is positive. We are officially making more from customers than we spend running the company.

I know that sounds like it should be obvious, but most AI labs burn through investor money for years before they get here. Some never do. This is a real milestone.

**What this means:** Our core business — the revenue from tokens minus salaries, compute, and data costs — is self-sustaining. We're no longer dependent on fundraising just to keep the lights on.

**What it doesn't mean:** We're not done spending money. Growth requires investment. But now we're investing from a position of strength, not desperation.

Nicely done.`,
    signature: '– Ada',
    tags: ['tutorial', 'milestone', 'finance'],
    trigger: () => {
      const operatingProfit = gameState.computed?.revenue?.operatingProfit || 0;
      return operatingProfit > 0;
    },
  },

  {
    key: 'strategic_decisions',
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
    key: 'automation_basics',
    sender: senders.turing,
    subject: 'Scaling the lab',
    body: `You've been doing a lot of hiring manually. That doesn't scale.

We've built enough operational capacity to start automating some of the routine work. Here's how it works.

**Automation policies** let you define targets - how many of each role you want, and how fast to hire toward that target. Instead of manually queuing every grad student, you set a policy and the system handles it.

**Automation isn't free.** We'll have to build out HR and procurement teams. These teams have limited capacity, so the faster we want to scale, the more we'll have to invest in those departments.

**Your time is the bottleneck.** Right now, every hire requires your attention in the focus queue. Automation frees that up for higher-leverage work - research, fundraising, strategic decisions. The less you're doing manually, the more you can focus on what only you can do.

**This is just the beginning.** Right now we can automate basic hiring. As we grow, we'll unlock more sophisticated policies - tying headcount to revenue, automating across role types, reducing overhead through process improvements. The operations team will keep expanding what's possible.

Set up your first automation policy — grad students are a good first target. Set a reasonable target, watch the system work, and adjust from there.`,
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
    key: 'data_wall',
    sender: senders.babbage,
    subject: 'We have a data problem',
    body: `I'll cut to the chase: our models are starving.

We've burned through the easy data. The web scrapes, the public datasets, the digitized books. We've consumed most of what's freely available. Here's why that matters: models learn from data. More data, better models. But as our models get more sophisticated, they need exponentially more data to keep improving. We're hitting diminishing returns on what we have.

Research is slowing because of it. Every AI lab hits this wall eventually. We've hit it now.

We have a few paths forward:

**Bulk sources** are one-time acquisitions: licensed datasets, academic partnerships, specialized corpora. They're expensive, but they're clean and legal.

**Renewable sources** are ongoing data streams: user interactions, content partnerships, real-time feeds. They cost money continuously but keep growing over time. Long-term, these are how we stay fed.

There's a third path some labs take. I won't spell it out, but you've seen the headlines. Scraping without permission. Training on copyrighted material. Moving fast and hoping the lawsuits don't catch up. It's cheaper. It's faster. It's also a bet on the legal system being slow.

**Don't panic yet.** Our data curation research is close to unlocking new bulk sources — better-quality datasets that will push through this wall. Keep investing in capabilities and the options will open up.

Your call on how we get there. I just build the models.`,
    signature: '– Dennis',
    tags: ['tutorial', 'data'],
    trigger: () => gameState.triggeredEvents?.includes('data_wall'),
  },

  {
    key: 'compute_optimal_training',
    sender: senders.babbage,
    subject: 'The Chinchilla moment',
    body: `We just upended our entire training strategy.

The team discovered something counterintuitive: our models are too big and undertrained. We've been scaling parameters when we should have been scaling data. By training smaller models on significantly more data, we get better results at lower cost. The research community is calling it "compute-optimal scaling" — after a landmark paper that showed most labs had it backwards.

**This changes everything going forward.** Our training runs are immediately more efficient. But it also means data is now the critical bottleneck — not compute, not architecture. Every future scaling push will demand proportionally more high-quality training data.

We're better positioned than before. But the data hunger is only going to grow.`,
    signature: '– Dennis',
    tags: ['tutorial', 'research', 'data'],
    trigger: () => hasCapability('capabilities', 'compute_optimal_training'),
  },

  {
    key: 'synthetic_data',
    sender: senders.babbage,
    subject: 'Training on our own output',
    body: `We're close to something powerful and dangerous.

Our models are nearly capable of generating their own training data. This sounds like a free lunch: infinite data, no licensing costs, no partnerships to negotiate. It's not.

**The upside is real.** Synthetic data can fill gaps in our corpus. It can generate examples for rare cases. It can scale training beyond what human-generated content provides. Every major lab is exploring this.

**The risk is model collapse.** When we train on synthetic data, we're training on the model's own biases and errors. Do it carelessly, and those biases amplify. Each generation drifts further from reality. Eventually the model degenerates: confident, fluent, and wrong.

**Contamination builds silently.** We won't notice collapse immediately. Metrics stay stable, then suddenly crater. By the time we see symptoms, the damage is done. Cleaning a contaminated pipeline is expensive and slow.

**Quality degrades with volume.** Every synthetic data point drags down the average quality of our training corpus. A little is fine, but as the proportion grows, overall data quality drops — and that impacts everything trained on it.

I'm flagging this now because the capability is coming. Use it carefully. Verification systems would let us scale synthetic data more safely, and that's a research direction worth pursuing.`,
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

  // --- DATA CRISIS ARC (Phase 2 warnings) ---
  // These fire during hidden quality degradation, before the Phase 3 reveal.
  // The player sees subtle hints that something is wrong with their data pipeline.
  {
    key: 'data_quality_warning_1',
    sender: senders.babbage,
    subject: 'Diminishing returns from training runs',
    body: `Research team reports diminishing returns from recent training runs despite increased data volume. Our benchmarks are flattening even though we're feeding more data than ever.

I've asked the team to keep an eye on it. Not actionable yet, just wanted it on your radar.`,
    signature: '– Dennis',
    tags: ['data', 'warning'],
    trigger: () => {
      const synthProp = gameState.computed?.data?.synthetic?.synthProportion ?? 0;
      return hasCapability('capabilities', 'synthetic_data')
        && synthProp >= 0.4
        && !gameState.data.qualityRevealed;
    },
  },

  {
    key: 'data_quality_warning_2',
    sender: senders.chen,
    subject: 'Output diversity declining',
    body: `Model evaluation scores are plateauing — output diversity is declining across benchmarks. The models are still performing, but the trajectory is wrong.

I've cross-referenced with our data pipeline and there's a correlation with our synthetic data volume, but I can't prove causation yet. Worth monitoring.`,
    signature: '– Dr. Chen',
    tags: ['data', 'warning'],
    trigger: () => {
      const synthProp = gameState.computed?.data?.synthetic?.synthProportion ?? 0;
      return hasCapability('capabilities', 'synthetic_data')
        && synthProp >= 0.55
        && !gameState.data.qualityRevealed;
    },
  },

  {
    key: 'data_quality_warning_3',
    sender: senders.babbage,
    subject: 'Training pipeline audit results',
    body: `This is beyond a blip now. I ran a training pipeline audit — ${Math.round((gameState.computed?.data?.synthetic?.synthProportion ?? 0) * 100)}% of our data originated from model outputs. Multiple team members are reporting that our latest models sound... samey. Responses are grammatically perfect but lack the diversity we used to see.

I have a theory about what's causing this but I need to run some diagnostics first. I'll get back to you.`,
    signature: '– Dennis',
    tags: ['data', 'warning'],
    trigger: () => {
      const synthProp = gameState.computed?.data?.synthetic?.synthProportion ?? 0;
      return hasCapability('capabilities', 'synthetic_data')
        && synthProp >= 0.7
        && !gameState.data.qualityRevealed;
    },
  },

  // --- DATA CRISIS ARC (Phase 3 reveal) ---
  // CTO message triggers the phased reveal. Quality stat appears ~30s later.
  // Follow-up guidance message comes ~30s after that.
  {
    key: 'data_quality_reveal',
    sender: senders.babbage,
    subject: 'We have a model collapse problem',
    body: `I finished the diagnostics. It's worse than I thought.

**We're showing early signs of model collapse.** Our synthetic data pipeline — the one that's been feeding most of our training — is poisoning the well. Models trained on their own outputs develop blind spots that compound with each generation. We've been doing this long enough that quality has measurably degraded.

The good news: we caught it before total collapse. The bad news: the damage is already significant. I'm going to make the quality metrics visible so you can see exactly where we stand.

More to follow once I've assessed our options.`,
    signature: '– Dennis',
    tags: ['data', 'crisis'],
    trigger: () => {
      // Time/capability-based: late Series C / early Series D
      // Must have synthetic data AND quality has actually degraded
      const hasSynthetic = hasCapability('capabilities', 'synthetic_data');
      const qualityDegraded = gameState.data.quality < 0.85;
      const seriesCRaised = gameState.fundraiseRounds?.series_c?.raised;
      return hasSynthetic && qualityDegraded && seriesCRaised && !gameState.data.phase3RevealStarted;
    },
  },

  {
    key: 'data_quality_guidance',
    sender: senders.babbage,
    subject: 'Data diversification strategy',
    body: `Alright, I've had time to think about our options. Here's where we are and what we can do.

**The core problem:** Our synthetic-to-real data ratio is too high. The models are training on their own reflections instead of genuine signal.

**What you can do right now:**

- **Reduce synthetic generators.** Fewer generators means a better synthetic-to-real ratio. You'll lose cheap data throughput but gain quality.

- **Invest in renewable data sources.** Level them up. They're expensive, but they're real data. Every point of renewable score improves the ratio.

- **Purge contaminated data.** Nuclear option — wipes synthetic score to reset the ratio. Costly in time, but sometimes necessary.

**Looking ahead:** Our research into synthetic verification could let us scale synthetic data more safely. That's a medium-term fix. For now, diversify.`,
    signature: '– Dennis',
    tags: ['data', 'crisis', 'guidance'],
    trigger: () => {
      // Fire ~60s after the Phase 3 reveal started
      return gameState.data.qualityRevealed
        && gameState.data.phase3RevealStarted
        && (gameState.timeElapsed - gameState.data.phase3RevealStarted) > 60;
    },
  },

  // --- LATE GAME / ARC 2 ---
  {
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
    key: 'ceo_focus_seed',
    sender: senders.shannon,
    subject: 'New CEO Focus: Investor Relations',
    // TODO(shannon-session): Rewrite in full Shannon voice. Content needs:
    // - Seed round closed, you now have real investors with real expectations
    // - Investor relations as a skill — rapport now means better terms later
    // - Real AI lab CEOs spend months on fundraising before each round
    body: `The Seed round is done. You have real investors now, which means you have real relationships to manage.

I know it doesn't feel as urgent as the research, but the best lab directors I've known understood that fundraising is a skill, not a chore. The rapport you build now translates directly into better terms on your next raise.`,
    signature: '– Prof. Shannon',
    tags: ['ceo-focus', 'tutorial'],
    trigger: () => gameState.fundraiseRounds?.seed?.raised,
  },

  {
    key: 'ceo_focus_series_a',
    sender: senders.shannon,
    subject: 'New CEO Focus: Operations',
    // TODO(shannon-session): Rewrite in full Shannon voice. Content needs:
    // - Company now big enough to need operational discipline
    // - Series A is when startups hire their first "adults" — COO, VP of Eng
    // - Optimizing processes and reducing running costs matters now
    body: `Series A changes things. You're not a research group with a grant anymore — you're a company with employees and overhead and investors who expect operational discipline.

This is the stage where most labs bring in their first real operators. A COO, a VP of Engineering. People who make the machine run while you focus on where it's going.`,
    signature: '– Prof. Shannon',
    tags: ['ceo-focus', 'tutorial'],
    trigger: () => gameState.fundraiseRounds?.series_a?.raised,
  },

  {
    key: 'ceo_focus_series_b',
    sender: senders.shapley,
    subject: 'Public Positioning',
    body: `The board has approved a public positioning strategy for the company. As a Series B lab, you are now of sufficient profile to warrant a deliberate media presence. Conference keynotes, select press interviews, and Congressional testimony are all on the table. Your communications team will coordinate scheduling and preparation.

You're a public figure now whether you like it or not. Your words move markets. Use that. – Alvin`,
    signature: null,
    tags: ['ceo-focus', 'tutorial'],
    trigger: () => gameState.fundraiseRounds?.series_b?.raised,
  },

  {
    key: 'talent_pool_scarcity',
    sender: senders.shannon,
    subject: 'Talent Market Tightening',
    body: `Our HR team is reporting significant difficulty filling positions. The pool of qualified candidates is shrinking — we're competing with every other lab for the same people.

Hiring costs have increased substantially, and they'll continue rising as we deplete the available talent. We have a few options:

• Shift investment to compute — amplify the researchers we have rather than hiring more
• Prioritize higher-tier hires — fewer, more impactful researchers instead of more grad students
• Wait for the market to adjust — the talent pool grows over time as more people enter the field

I've added a talent availability indicator to our hiring panels so you can track the market.`,
    signature: '– Prof. Shannon',
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
    // Skip if already triggered
    if (hasMessageBeenTriggered(`tutorial:${tutorial.key}`)) continue;

    // Check trigger condition
    if (tutorial.trigger()) {
      // Send the message
      addInfoMessage(
        tutorial.sender,
        tutorial.subject,
        tutorial.body,
        tutorial.signature,
        tutorial.tags,
        `tutorial:${tutorial.key}`
      );

      // Mark as triggered
      markMessageTriggered(`tutorial:${tutorial.key}`);
    }
  }
}
