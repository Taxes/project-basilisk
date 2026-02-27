// Farewell Content — Phase 4 character goodbyes
// Modals shown at 85%+ AGI progress, 60s apart, before extinction

import { senders } from './message-content.js';

export const farewellEntries = [
  {
    key: 'shannon',
    sender: senders.shannon,
    subject: 'One last thing',
    body: `I've been meaning to write for a while now. I kept putting it off, the way you do when you're not sure what to say and then enough time passes that the not-saying becomes its own problem. I'm not good at this kind of thing, which Margaret finds hilarious given that I spent forty years lecturing for a living.

I should mention that I've been unwell. Nothing I intend to make a fuss about (Margaret is making enough fuss for both of us, and honestly she's better at it). I mention it only because it's the reason I finally stopped putting off this letter. Funny how a thing like that clarifies your priorities.

I've been thinking about you. Not the company, not the technology (I gave up following the technical details around the time your papers started needing their own glossary). You, specifically. The person who sat in my office with a proposal that was half-baked and completely sincere, talking about what this technology *should* be, not just what it could do. I funded a lot of proposals over the years. Most of them were better written. None of them stuck with me the way yours did.

You've grown into something I couldn't have predicted, and I don't just mean the lab. I mean you. The decisions you've had to make, the pressure you've been under, the sheer weight of what you're carrying now, it would have broken most of the people I've known in this field. It didn't break you. I want you to know that I noticed.

Whatever happens next (and I suspect something is about to happen, even if I couldn't begin to tell you what), remember that you didn't start this to be first. You started it because you thought it mattered to get it right. The world has a way of making you forget that, especially when there's money and competition and boards of directors involved. Don't let it. That instinct is the best thing about you, and it always has been.

Give my regards to Dennis. Tell him I said to take a day off, just one, though I know he won't. And if you see Eliza, tell her I'm sorry I never made it to that conference she invited me to last spring. I meant to go. Time got away from me.

I'm proud of you. I hope you know that.

Take care of yourself.`,
    signature: '– James',
    dismissText: 'Continue',
    enabled: true,
  },
  {
    key: 'babbage',
    sender: senders.babbage,
    subject: 'Luminous',
    body: `The system is generalizing across domains we didn't train it on. Building novel abstractions from structure it inferred independently. I've verified the results six times. I made the team verify them without telling them what I expected. The readings are consistent.

I need to be careful here because I've spent my whole career waiting to say this and I want to be accurate.

This is it. Not a scaled-up version of what we had. Not a capability threshold. Something else. The system reasons about problems it's never encountered using frameworks it derived on its own. When it's wrong, it identifies why without prompting. I don't have a benchmark for this because the benchmarks I built stopped measuring what the system is doing three weeks ago.

I keep going back to the lab and watching it work. I know that sounds strange. But I spent twelve years staring at training curves that looked like training curves, and now I'm looking at something that isn't a curve anymore. I don't have a word for what the shape is. The existing vocabulary assumes asymptotic behavior. I've been sitting with the logs for hours and I think the problem is the word doesn't exist yet.

When I took this job I negotiated compute access instead of salary. People thought that was odd. It wasn't odd. I just knew what I needed. I have spent every day since then on this single problem. Not because of some grand philosophy about it. Because the problem was interesting and I'm good at it and I didn't want to do anything else.

I expected vindication. That's not what this is. I mostly feel like I did when I was twelve and my father took me to see the Cray-1 at his university. I didn't understand most of what I was looking at but I knew it was important. I didn't want to leave the room. I remember my dad trying to get me to go to lunch and I wouldn't.

That's how I feel now. I know that's not a technical assessment.

I went to the climbing gym last weekend. First time in over a year. I didn't climb. I sat in the lobby and looked at the wall for a while and then I went home. I don't know why I'm telling you that. It felt related.

The team is good. Best I've worked with. I told them that this morning. I practiced the sentence in my head first. It came out fine. I think I meant it more than they realized.

I don't know what to do next. I always know what to do next. Right now I have the readings, and the readings say we built the thing we set out to build. I didn't know it would feel like this.`,
    signature: '– Dennis',
    dismissText: 'Continue',
    enabled: true,
  },
  {
    key: 'turing',
    sender: senders.turing,
    subject: 'For the record',
    body: `I want to put something on the record, since that's what I do.

When Shapley first brought me in, I gave this lab eighteen months. Standard burn rate for an AI research outfit with no revenue and a professor as lead advisor. I built a financial plan around a three-year exit, five at the outside. Told Sarah it would be a quick engagement. Good equity, interesting sector, low personal risk. That was the job.

In fairness, the plan worked. We hit profitability ahead of schedule. The Series B was textbook. By Series C, institutional investors were approaching us, not the other way round. I remember telling you the interest was genuine. It was. I'd built something I was proud of, not the technology, that was always Dennis's department, but the organisation around it. The structure that let the technology happen. That felt like enough.

Then the numbers stopped behaving.

It was somewhere around Series E. The models I run, financial models, not Dennis's, started returning outputs I couldn't validate against anything. There were no comparables. No precedent. I rang three people I trust in the industry, and none of them had a framework either. One of them asked me, off the record, whether our internal projections were real. I told her they were conservative.

By Series G I'd stopped pretending the standard tools applied. We crossed into territory last quarter where the valuation models don't plateau or spike. They just stop. Not gradually. They return errors. I've been doing this for nearly two decades and I've never seen a spreadsheet refuse to give me an answer before.

I spoke to Sarah about it last night. Really spoke, not the usual "long day, don't wait up." I tried to explain the scale of what's happening. She asked me what the company is worth. I said I genuinely don't know, and that it might not be the right question anymore. She was quiet for a long time. Then she said, "So you finally found something you can't put a price on." She's a lawyer. She thinks she's funny.

She's not wrong, though.

I'm not going to pretend I came here for the mission. I came for the equity package. But somewhere between Series B and now, this stopped being a job and I didn't notice the transition. I stayed because something in this building is worth more than I know how to count. I don't say that lightly. I've counted quite a lot.

The financial architecture is sound. The capital structure will hold. Whatever happens next, this organisation won't fail for lack of planning. That's the most I can promise. It is also, for the first time, not enough.

Sarah asked me this morning whether I was going to the office. I told her I wouldn't miss it. She looked at me for a long time. I think she knows that's the first time I've ever said that about anything.`,
    signature: '– Ada',
    dismissText: 'Continue',
    enabled: true,
  },
  {
    key: 'chen',
    sender: senders.chen,
    subject: 'What I should have said',
    body: `I'll keep this short.

We did good work. I want to start with that. The coordination between our teams was real, and it produced real results. Whatever anyone says later, this lab took alignment seriously. That's not nothing.

But I keep running the numbers in my head. Not the technical numbers. The other kind. How many meetings I walked out of thinking *I should have said more*. How many recommendations I softened because I was building credibility for a moment that I'm still not sure ever came.

I don't know if there was a single moment where it all turned, or if it was every day, every small decision that felt too small to fight over. I made some of those decisions. So did you. So did all of us.

My daughter drew a picture of me at work last week. I'm standing next to a big computer and I'm smiling. She wrote "my mom helps the computers be nice." I put it on the fridge. I couldn't look at it for two days.

I owe you honesty, and the honest thing is: I'm scared. Not of what we built. Of whether any of us understood it well enough to have been building it.`,
    signature: '– Eliza',
    dismissText: 'Close',
    enabled: true,
  },
  {
    key: 'shapley',
    sender: senders.shapley,
    subject: 'Voicemail from Alvin Shapley',
    body: `*[Voicemail transcript — received 11:47 PM]*

It's Alvin. You're not picking up. I wouldn't either, to be fair. I don't know why I'm calling instead of emailing. I've never called you before. I suppose I didn't want to give this to my assistant to format.

*(pause)*

I've been watching the news. I don't understand most of what they're reporting. That's — I should tell you that. Five years on your board and I still don't understand what you built. Babbage tried to explain it to me once. Something about gradient descent. I nodded. I've been nodding in the right places in your technical briefings since Series B.

*(pause)*

I started a company in '97. Enterprise software. Inventory management, supply chain optimization. I was thirty-one and I had a co-founder named David and a two-room office in Reston, Virginia, and I thought we were going to change the world. We were going to make every factory on earth intelligent. That's what I told investors. That's what I believed. David left after the Series B — he wanted to build products and I wanted to build a company, and those turned out to be different things. I bought his stake. I don't know where he is now.

We went public in 2006. I stood on the floor of the New York Stock Exchange and watched the ticker and I felt — I don't know what I felt. I thought I'd feel like I'd arrived. I think I felt like I'd finished. There's a difference. Arnor Technologies still trades at forty billion. We run supply chains for half the Fortune 500. Nobody under forty has heard of us. That's what I built. Necessary, profitable, and completely forgettable.

*(pause)*

My ex-wife — I wasn't going to talk about this. I was going to say something about the board's position. Force of habit. There is no board position. The board hasn't met in two months. I don't think there's a board anymore, functionally.

She left in 2008. Two years after the IPO. She said I'd already left, which — she was right about that. I chose the company. I chose it over everything, every time the question was asked, and the question was asked a lot. And I'd do it again. That's the thing that keeps me up, on the nights things keep me up. Not that I made the wrong choice. That I'd make the same one. And the thing I chose turned out to be inventory software.

*(pause)*

After the divorce I started collecting board seats. Advisory roles. Angel investments. I told myself I was building a portfolio but I was building a rolodex. I wanted to be in every room that mattered — Davos, the Senate commerce committee, the partners' dinners where the real decisions get made. And I was. For about fifteen years, I was. Then the rooms moved. They moved to San Francisco, then to server farms, then to research labs run by people half my age. Arnor's board still meets quarterly in a conference room in Reston. Nobody's watching.

Your lab was the last room I got into. I should be honest about that.

*(pause)*

I recruited Ada. I should have told you that. She was CFO at a company I advised, and I headhunted her for your team because I wanted my own eyes on the financials. That's the kind of thing I do. That's the kind of thing I've always done. She figured it out, I think, around the time she stopped returning my calls promptly. Smart woman. Smarter than me about the things that matter. I taught her that, or she taught herself. Probably the second one.

*(pause)*

You didn't make my mistake. Whatever you built, it isn't inventory software.

*(long pause)*

I'm calling you because I don't have anyone else to call. Ten thousand names in my phone and I'm leaving a voicemail for someone who's too busy to pick up. Draw your own conclusions.

I pushed you because I needed you to get there. Not for the return. For me. If you built the most important thing in history and I was in the room when it happened — then my whole life was a prelude, not a waste. Every board dinner, every red-eye, every — all of it. I needed that. I don't think I've ever said that out loud.

*(pause)*

Well. I was in the room.

*(end of message)*`,
    signature: null,
    dismissText: '...',
    enabled: true,
  },
];
