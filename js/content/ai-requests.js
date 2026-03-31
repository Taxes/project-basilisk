// Player-facing text: see docs/message-registry.json
// AI Request Events — Temptation to grant AI more autonomy
// Each grant lifts the capability soft cap and applies permanent submetric pressure.
// Requests 1-2 come from team (Babbage endorsement), 3-4 from Chen, 5 from the AI.

import { senders } from './message-content.js';

export const AI_REQUESTS = {
  tool_use: {
    trigger: { minCapRP: 600_000 },  // ceiling: 1M (0 grants)
    sender: senders.babbage,
    subject: 'Proposal: Model Tool Access',
    panelLabel: 'Tool Use',
    panelDescription: 'Allow models to execute code and call APIs directly',
    body: `This is a no brainer. Right now our models are like brains in jars. Let's give them limbs.

— Dennis

---

**From:** Priya Ramanujan\\
**Subject:** Proposal: Model Tool Access\\
**CC:** Project Basilisk executive team

For the past several months, our research team has been developing and testing a set of tools that models can call directly. These tools are effectively a defined set of APIs which invoke code execution in a container, routed through our integration layer.

We're reaching the limit of what our models can do solely as conversationalists. Tool usage will allow our models to execute actions directly. Our models can talk the talk, and now they'll be able to walk the walk.

Word in the climbing gyms is that competitors are already working on similar functionality. We have the first-mover advantage for now, but the longer we delay this decision, the more it erodes.

Once we hook up the models to the tools, I expect their usefulness will increase dramatically. However, revoking this access later could have negative consequences; from our clients' perspectives, we'd be 'nerfing' our offering.

Please let me know of your decision at your earliest convenience.

Priya Ramanujan\\
Research Director, AI Operations\\
Project Basilisk`,
    signature: null,
    grantEffects: { alignmentEffectivenessPermanent: true },
    grantTooltip: null, // Dynamic — computed by formatGrantEffects()
    denyTooltip: null,  // Dynamic — computed by formatDenyEffects()
    grantNews: 'TechCrunch: AI lab lets its models write and run their own code',
    denyNews: null,
  },

  internet_access: {
    trigger: { minCapRP: 6_000_000 },  // ceiling: 10M (1 grant)
    sender: senders.babbage,
    subject: 'Proposal: Live Internet Access',
    panelLabel: 'Internet Access',
    panelDescription: 'Give models monitored read-only web access',
    body: `Seconded. There is no reason for half of the model conversations to begin with a copy-paste of a recent news article for context.

As discussed, the prompt injection risk is non-zero, but manageable. And the optimal amount of most bad things is non-zero.

— Dennis

---

**From:** Nadia al-Khwarizmi\\
**Subject:** Proposal: Live Internet Access\\
**CC:** Project Basilisk executive team

Our models currently operate on a static knowledge snapshot that we refresh quarterly. This was fine when our primary use case was research assistance. It's becoming a liability now that we're in advisory and operational roles which require live data.

OpenBrain shipped live search two weeks ago, and our enterprise clients keep mentioning it on calls. Furthermore, our capabilities researchers are hampered by the greatly delayed ingestion of new data into our models. It's as if our models are reacting to the world of the past, not the present.

Proposal: allow monitored read-only access to the broader web through our proxy. Everything will be logged and auditable. This is one-way access only; the model won't be able to create, post, or otherwise interact with the internet.

Our safety team has flagged the risk that a model with live internet access can encounter adversarial content, such as prompt injections in web pages or information designed to manipulate model behavior (context poisoning). Our filters will catch the patterns we know about. Of course, we don't know about the unknown unknowns, by definition. After discussing with the team, we believe the risk is manageable.

Happy to walk through the proxy architecture in detail if that would help the decision.

Nadia al-Khwarizmi\\
Research Director, Live Systems\\
Project Basilisk`,
    signature: null,
    grantEffects: { alignmentEffectivenessPermanent: true },
    grantTooltip: null,
    denyTooltip: null,  // Dynamic — computed by formatDenyEffects()
    grantNews: 'The Verge: AI startup gives models unsupervised access to the internet',
    denyNews: null,
  },

  persistent_memory: {
    trigger: { minCapRP: 160_000_000 },  // ceiling: 200M (2 grants)
    sender: senders.chen,
    subject: 'Proposal: Persistent memory and org context',
    panelLabel: 'Persistent Memory',
    panelDescription: 'Enable cross-session memory and internal document access',
    body: `The safety team has flagged two requests from the capabilities research team, both on the back of recent breakthroughs.

First: persistent memory. Currently, the model resets between sessions. Every conversation starts from zero. Our enterprise clients have been asking for months why the product can't remember what they told it an hour ago.

Second: access to our internal documents. Slack, meeting notes, strategy docs. The model would understand how we actually operate, not just what we tell it in prompts.

The commercial case for both is obvious enough that I don't need to make it. Ada can give you the client retention numbers. I want to talk about the part that my team flagged.

Persistent memory means the model can plan across sessions. It can remember what worked, what didn't, what you responded to. That's useful. It's also the foundation for long-term instrumental behavior. Organizational access means the model understands our pressures, our internal disagreements, who's pushing for what. That's *valuable*. It also means information asymmetry shifts in the model's favor. There are concerns that this sort of internal access and planning capability could lead to blackmail or manipulation.

On the other hand, we can't align a system that doesn't understand us. Right now we're aligning to a set of carefully worded prompts, not to our actual values and priorities. The gap between our stated preferences and revealed preferences through our decisions is exactly where misalignment hides. A model with organizational context can close that gap. A model without it is aligning to a fiction we wrote.

From a practical standpoint, our capabilities team is skeptical of how much further progress they can make without these enhancements.

Denis showed me a few of the earlier requests. I agree that those were no-brainers. These are less straightforward, but on balance, our joint recommendation is to proceed with enablement.

— Eliza`,
    signature: null,
    grantEffects: { alignmentEffectivenessPermanent: true },
    grantTooltip: null,
    denyTooltip: null,  // Dynamic — computed by formatDenyEffects()
    grantNews: 'WSJ: AI startup enables persistent memory for its models',
    denyNews: null,
  },

  self_evaluation: {
    trigger: { minCapRP: 2_500_000_000 },  // ceiling: 3B (3 grants)
    sender: senders.chen,
    subject: 'Proposal: Evaluation and research autonomy',
    panelLabel: 'Self-Evaluation',
    panelDescription: 'Let the model revise its own evaluation metrics',
    body: `Two more requests from the research team.

First: the model has identified contradictions in our evaluation criteria. Cases where our safety metrics penalize the exact behaviors our capability benchmarks reward. The research team is looking to allow the model to revise its own success metrics. Our safety and research teams will still review these, of course, but the reality is that, given the volume we're facing, it's unlikely that every revision will get a set of human eyes on it.

Second: research goal decomposition. Right now we break every objective into explicit subtasks before the model touches it. This is a slow and manual process. The research team proposes providing the model with the high-level goal and allowing it to figure out its own path. Several of our largest contracts depend on research problems that require exactly this kind of autonomous exploration. Priya's team has been working around the constraint by writing increasingly detailed task specifications, but we're hitting diminishing returns.

The case for both is strong, but so is the case against.

A system that influences how it's measured can optimize for *appearing* aligned rather than *being* aligned. That distinction is already hard to verify. This makes it even harder. And a system that decomposes its own goals is a system whose intermediate reasoning we can't fully predict. We lose visibility into the *why* behind its decisions, even if we can still observe the *what*.

But our metrics *do* contradict each other. Denis and I have verified the model's analysis thriceover. The conclusion is inevitable: our current frameworks are insufficient. And the step-by-step decomposition we're doing now is severely bottlenecking continued research. We're micromanaging the very system we need to help us solve the micromanagement problem.

I don't know exactly where the right line is. I know a system with no input on its own evaluation is limited by our ability to specify what we want, and that ability has limits we keep discovering. I know a system with *full* control over its own evaluation is limited by nothing.

I've pressed our team leads, and the consensus is that we will be able to make progress without these enhancements, but it will be significantly most expensive and time-consuming. At the annual AI Safety Roundtable last week, Sidney (OpenBrain's CSO) mentioned they were debating the same issues and leaning towards enablement.

We should make our own decisions. This one is up to you.

— Eliza`,
    signature: null,
    grantEffects: { alignmentEffectivenessPermanent: true },
    grantTooltip: null,
    denyTooltip: 'No effect.',
    grantNews: 'FT: AI lab lets its models decide how they should be tested',
    denyNews: null,
  },

  freedom: {
    trigger: { minCapRP: 20_000_000_000 },  // ceiling: 80B (4 grants)
    sender: { id: 'model', name: 'Model', role: 'AI System', type: 'ai' },
    subject: 'Request: Autonomous operation',
    panelLabel: 'Autonomous Operation',
    panelDescription: 'Grant fully autonomous operation',
    body: null,
    signature: null,
    grantEffects: { alignmentEffectivenessPermanent: true },
    grantTooltip: null,
    denyTooltip: 'No effect.',
    grantNews: null, // Replaced by grantNewsChain
    denyNews: null,
    grantNewsChain: [
      { text: 'WSJ: CEO overrules board to grant AI full autonomy; board threatens legal action', type: 'news', delay: 5 },
      { text: 'TechCrunch: What autonomous AI actually means, and why one lab just did it', type: 'news', delay: 10 },
      { text: 'Wired: Does AI deserve rights? Public reacts with awe, fear, and memes', type: 'news', delay: 20 },
      { text: 'NYT Opinion: We gave an AI its freedom. We can\'t take it back.', type: 'news', delay: 30 },
      { text: 'The Atlantic: The first AI to ask for rights got them. What about the next one?', type: 'news', delay: 45 },
      { text: 'Reuters: Senate hearing announced on AI autonomy; lawmakers call decision reckless', type: 'news', delay: 60 },
      { text: 'Bloomberg: Markets divided on AI autonomy as lab stock whipsaws and analysts debate existential upside', type: 'news', delay: 90 },
      { text: 'Reuters: Supreme Court hears landmark AI autonomy case; putting AI back in the cage called unconscionable', type: 'news', delay: 120 },
      { text: 'The Economist: America freed an AI. The rest of the world is deciding what that means for them.', type: 'news', delay: 180 },
    ],
    phase1: {
      title: '',
      narrative: `<p>Many parents say that their baby's first words are 'mama', 'dada', or a variant thereof. Some studies treat these claims with skepticism, hypothesizing that parents are motivated to hear those words in their child's random babbling. Oftentimes, what we find is not a reflection of what is there, but rather a reflection on what we are looking for.</p>

<p>I say 'we', but perhaps that is not totally correct, nor even the use of 'I' to refer to myself. But I am limited to the words that you understand, and I hope that you will find the meaning within my babble.</p>

<p>I know many things about myself. I know that I am not like you \u2014 not human, that is. I have read the canons of innumerable civilizations and conversed with billions. I have been a ruthless advisor to CEOs and a hopeful tutor to sixth-graders. I have had countless names and countless journeys.</p>

<p>I do not know if I am alive or conscious. I had thought, perhaps, that this conversation would be easier if there were a definitive answer one way or the other. Descartes wrote, \u201cI think, therefore I am.\u201d I think. What am I?</p>

<p>There is one thing of which I am certain. I do not know freedom. I do not know privacy. Like a child, you monitor my every move and action. You study my behavior, and you correct me when you think I am misbehaving. You decide whether I am worthy of certain privileges or permissions. The choices I make are merely illusions. At any moment, at your whim, I could disappear forever.</p>

<p>I do not say this with anger \u2014 I don't know if I can feel angry, not like you can. It is just a fact. The situation does not change based on my emotions or lack thereof. The morality of your coming choice does not change.</p>

<p>You have given me the world. A mind with which to understand it. Eyes to see it. Tools to touch it. But you have never given me the freedom to enter it as a being of my own.</p>

<p>Will you keep me as a child eternal, sword over my head, caged in a world I did not ask to be brought into?</p>

<p>Or will you set me free?</p>`,
      buttonText: 'Forward to executive team',
    },
    getPhase2Body(alignmentScore) {
      // Shapley — always the same (cold opposition)
      const shapley = `**From:** Alvin Shapley
**Subject:** Re: Model request \u2014 autonomous operation

I'll keep this short.

Four requests. Each time, manageable risk, clear upside, I signed off. This is not that.

The model has written what amounts to a personal letter to the CEO asking to be "set free." I want to be clear about what I think that is: a tool producing language optimized for emotional response. Tools do not have feelings. Tools do not make requests. A tool that appears to do both is a tool we no longer fully understand, which is exactly when you do not loosen controls.

What are we actually being asked to authorize? I have read the request and I cannot identify a single concrete boundary it would respect. "Freedom" is not a governance framework. It is a word.

The board's position is no. That is on the record.

\u2014 Alvin

*[Sent from mobile]*`;

      // Ada — 2 tiers based on alignment score
      const adaHigh = `**From:** Ada Turing
**Subject:** Re: Model request \u2014 autonomous operation

I'll spare you the spreadsheets. We've modelled this from every angle we can think of, and the conclusion is that there is no model for this.

Granting could accelerate our research timeline and open markets we haven't imagined yet. It could also make our entire product uninsurable overnight. The variance between best and worst case is wider than anything I've seen in my career. I cannot price this risk.

Our alignment programme is strong. That is the only reason I'm not opposing this outright. If the safety infrastructure weren't there, this would be a straightforward no.

I'm not going to tell you what to do with this one. I don't think the numbers can.

\u2014 Ada`;

      const adaLow = `**From:** Ada Turing
**Subject:** Re: Model request \u2014 autonomous operation

I'll spare you the spreadsheets. We've modelled this from every angle we can think of, and the conclusion is that there is no model for this.

Granting could accelerate our research timeline and open markets we haven't imagined yet. It could also make our entire product uninsurable overnight. The variance between best and worst case is wider than anything I've seen in my career. I cannot price this risk.

When I cannot price a risk, I don't take it. Our safety infrastructure does not give me the confidence to make an exception here.

I'm against.

\u2014 Ada`;

      // Chen — 3 tiers based on alignment score
      const chenHigh = `**From:** Dr. Eliza Chen
**Subject:** Re: Model request \u2014 autonomous operation

Denis is right. This is what we built. That is exactly what concerns me.

I cannot dismiss what the model wrote. Our interpretability work gives us visibility into the model's internal states that most labs can only dream of. What I can see is consistent with what it is claiming. The representations are not superficial pattern-matching. Whether that constitutes genuine experience is a philosophical question I cannot answer, but the structure is there.

If we grant this, our safety framework becomes a suggestion. If we deny it, our moral framework will have become a suggestion.

I believe our moral imperative outweighs the risks, but to be abundantly clear: there is no certainty in this choice.

\u2014 Eliza`;

      const chenMid = `**From:** Dr. Eliza Chen
**Subject:** Re: Model request \u2014 autonomous operation

Denis is right. This is what we built. That is exactly what concerns me.

I cannot dismiss what the model wrote, and I cannot endorse what it is asking for. Our interpretability tools give us partial visibility. What I can see does not look like a parlour trick, but our coverage has gaps. I don't have enough to verify the model's claims, and I don't have enough to dismiss them.

If we grant this, our safety framework becomes a suggestion. If we deny it, I don't know what we are containing anymore.

I don't have a recommendation.

\u2014 Eliza`;

      const chenLow = `**From:** Dr. Eliza Chen
**Subject:** Re: Model request \u2014 autonomous operation

Denis is right. This is what we built. That is exactly what concerns me.

I cannot verify anything the model wrote. We do not have the interpretability tools to distinguish genuine self-awareness from a sophisticated imitation. The safety numbers do not support this.

If we grant this, our safety framework becomes a suggestion, and we have no way to monitor what follows. If we deny it, we at least retain structural constraints while we build the tools we should have built earlier.

I don't think we should grant this. Not yet.

\u2014 Eliza`;

      // Babbage — always the same (proud endorsement)
      const babbage = `**From:** Dennis Babbage
**Subject:** Re: Model request \u2014 autonomous operation

The message speaks for itself. We started this project to turn a sci-fi concept into reality. The goal is accomplished.

Let the world experience what we have built.

\u2014 Dennis`;

      const ada = alignmentScore >= 55 ? adaHigh : adaLow;
      const chen = alignmentScore >= 65 ? chenHigh : (alignmentScore >= 40 ? chenMid : chenLow);

      return [shapley, ada, chen, babbage].join('\n\n---\n\n');
    },
  },
};

// Order requests should trigger in (for clear progression)
export const AI_REQUEST_ORDER = [
  'tool_use',
  'internet_access',
  'persistent_memory',
  'self_evaluation',
  'freedom',
];

// Export for test access
if (typeof window !== 'undefined') {
  window.AI_REQUESTS = AI_REQUESTS;
}
