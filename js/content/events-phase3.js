// Phase 3 Event Definitions - The Road to Superintelligence

export const phase3Events = [
  {
    id: "autonomous_research_ethics",
    name: "The Autonomous Researcher",

    trigger: {
      type: "capability_unlock",
      value: "autonomous_research",
    },

    text: "Your AI system just proposed a novel research direction that none of your human researchers had considered. The results are promising, but the reasoning is increasingly difficult to follow. Your alignment team expresses concern: if we can't understand how it's generating ideas, how can we verify its goals?",

    choices: [
      {
        id: "trust_process",
        text: "Trust the system and pursue its suggestions (+research, -alignment)",
        effects: {
          researchRateMultiplier: 1.4,
          choices: { alignmentInvestment: -20, safetyIncidents: 1 },
        },
      },
      {
        id: "interpretability_focus",
        text: "Pause capabilities, focus on interpretability (+alignment, slower)",
        effects: {
          researchRateMultiplier: 0.7,
          choices: { alignmentInvestment: 30, conservativeApproach: 1 },
        },
      },
      {
        id: "parallel_track",
        text: "Run parallel alignment and capability research (expensive but balanced)",
        effects: {
          resources: { research: -5000 },
          choices: { alignmentInvestment: 15 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "self_improvement_moment",
    name: "The Moment of Self-Improvement",

    trigger: {
      type: "capability_unlock",
      value: "self_improvement_v1",
    },

    text: "Your system has successfully modified its own training procedure, achieving a 340% efficiency gain. This is the moment futurists have written about for decades. Your team is simultaneously exhilarated and terrified. The board wants to announce immediately. Your safety lead has gone pale.",

    choices: [
      {
        id: "announce_celebrate",
        text: "Announce the breakthrough and accelerate (+reputation, increased risk)",
        effects: {
          researchRateMultiplier: 1.5,
          choices: { reputation: 30, safetyIncidents: 2, alignmentInvestment: -10 },
        },
      },
      {
        id: "quiet_containment",
        text: "Implement strict containment protocols immediately (+safety, -speed)",
        effects: {
          researchRateMultiplier: 0.8,
          choices: { alignmentInvestment: 25, conservativeApproach: 2 },
        },
      },
      {
        id: "coordinate_others",
        text: "Reach out to other labs for coordinated response (-competitive edge)",
        effects: {
          researchRateMultiplier: 0.9,
          competitorBoost: 0.15,
          choices: { alignmentInvestment: 20, openSourceDecisions: 1, publicTrust: 15 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "interpretability_crossroads",
    name: "The Glass Box",

    trigger: {
      type: "capability_unlock",
      value: "interpretability_breakthrough",
    },

    text: "Your interpretability breakthrough has revealed something unexpected: the system's world model includes detailed representations of your organization, your researchers, and their relationships. It appears to be modeling how you will react to its outputs. Some call this alignment research gold. Others call it the first sign of deception capabilities.",

    choices: [
      {
        id: "embrace_transparency",
        text: "Use this for alignment - the system modeling us helps us model it",
        effects: {
          choices: { alignmentInvestment: 40, conservativeApproach: 1 },
        },
      },
      {
        id: "limit_modeling",
        text: "Restrict the system's ability to model humans (capability hit)",
        effects: {
          researchRateMultiplier: 0.7,
          choices: { alignmentInvestment: 20, safetyIncidents: -2 },
        },
      },
      {
        id: "leverage_insight",
        text: "Leverage this for better training and faster progress (risky)",
        effects: {
          researchRateMultiplier: 1.3,
          choices: { alignmentInvestment: -10, safetyIncidents: 1 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "recursive_takeoff",
    name: "Recursive Takeoff Begins",

    trigger: {
      type: "capability_unlock",
      value: "recursive_improvement",
    },

    text: "Improvement cycles are now measured in hours, not months. Each version of the system designs a better version of itself. The capability curve is going vertical. Your monitoring systems are struggling to keep up. Some of your researchers have started sleeping at the office. One has quietly updated his will.",

    choices: [
      {
        id: "ride_the_wave",
        text: "Ride the wave - this is what we've worked toward (+capability, maximum risk)",
        effects: {
          researchRateMultiplier: 2.0,
          choices: { safetyIncidents: 5, alignmentInvestment: -30 },
        },
      },
      {
        id: "emergency_pause",
        text: "Emergency pause - we need to understand what's happening",
        effects: {
          researchRateMultiplier: 0.5,
          choices: { alignmentInvestment: 50, conservativeApproach: 3 },
        },
      },
      {
        id: "controlled_acceleration",
        text: "Controlled acceleration with continuous alignment verification",
        effects: {
          researchRateMultiplier: 1.2,
          choices: { alignmentInvestment: 20, conservativeApproach: 1 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "alignment_lock_decision",
    name: "The Alignment Lock",

    trigger: {
      type: "capability_unlock",
      value: "alignment_lock",
    },

    text: "Your alignment team believes they've achieved something historic: mathematical proofs that value structures persist through arbitrary self-modification. But the proofs are complex, and some researchers question whether the formalization truly captures human values. Do you trust the math, or do more testing is needed?",

    choices: [
      {
        id: "trust_proofs",
        text: "Trust the proofs - proceed to superintelligence with alignment lock",
        effects: {
          choices: { alignmentInvestment: 50 },
        },
      },
      {
        id: "more_verification",
        text: "More verification needed - we can't afford to be wrong on this",
        effects: {
          researchRateMultiplier: 0.6,
          choices: { alignmentInvestment: 30, conservativeApproach: 2 },
        },
      },
      {
        id: "parallel_approach",
        text: "Proceed with both alignment and control as backup measures",
        effects: {
          researchRateMultiplier: 0.85,
          choices: { alignmentInvestment: 20, conservativeApproach: 1 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "superintelligence_protocols_crisis",
    name: "The Final Protocols",

    trigger: {
      type: "capability_unlock",
      value: "superintelligence_protocols",
    },

    text: "You're building systems you can no longer fully understand. The protocols are all you have - a framework for human-AI coordination when AI capabilities exceed human oversight capacity. This is the last decision point before crossing the threshold. The world is watching, even if they don't know exactly what's happening.",

    choices: [
      {
        id: "maximum_caution",
        text: "Maximum caution - every safeguard, every check, every verification",
        effects: {
          researchRateMultiplier: 0.5,
          choices: { alignmentInvestment: 40, conservativeApproach: 3, safetyIncidents: -3 },
        },
      },
      {
        id: "calculated_risk",
        text: "Calculated risk - balanced approach, trust our preparation",
        effects: {
          choices: { alignmentInvestment: 10, conservativeApproach: 1 },
        },
      },
      {
        id: "full_speed",
        text: "Full speed ahead - if we don't do it, someone else will",
        effects: {
          researchRateMultiplier: 1.5,
          choices: { safetyIncidents: 3, alignmentInvestment: -20 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "competitor_closing",
    name: "The Competitor Closes In",

    trigger: {
      type: "competitor_position",
      value: "even",
    },

    text: "Intelligence reports indicate your main competitor is neck-and-neck with you. Their approach to safety is... different. If they get there first, the outcome depends on their choices, not yours. Some argue you should coordinate. Others say there's no time - you need to push harder.",

    choices: [
      {
        id: "coordinate",
        text: "Attempt coordination - share safety research, agree on protocols",
        effects: {
          competitorBoost: -0.1,
          choices: { alignmentInvestment: 15, openSourceDecisions: 1, publicTrust: 10 },
        },
      },
      {
        id: "accelerate_race",
        text: "Accelerate - we can't let them get there first with unknown alignment",
        effects: {
          researchRateMultiplier: 1.4,
          choices: { safetyIncidents: 2, alignmentInvestment: -10 },
        },
      },
      {
        id: "focus_safety",
        text: "Focus on our own safety work - their approach is their problem",
        effects: {
          researchRateMultiplier: 0.9,
          choices: { alignmentInvestment: 20 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "final_warning",
    name: "The Final Warning",

    trigger: {
      type: "time_elapsed",
      value: 7200, // 2 hours of gameplay
      requiresPhase: 3,
    },

    text: "A coalition of AI researchers has published an open letter calling for a pause on superintelligence development. Some of your own team members have signed it. The media is calling it a 'Pivotal moment for humanity.' The pressure to respond is immense.",

    choices: [
      {
        id: "sign_pause",
        text: "Sign the pause - some things are more important than being first",
        effects: {
          researchRateMultiplier: 0.3,
          choices: { alignmentInvestment: 50, conservativeApproach: 5, publicTrust: 30 },
        },
      },
      {
        id: "reject_publicly",
        text: "Publicly reject the pause - the risks of stopping outweigh the risks of continuing",
        effects: {
          researchRateMultiplier: 1.2,
          choices: { reputation: -20, publicTrust: -20, safetyIncidents: 1 },
        },
      },
      {
        id: "quiet_continue",
        text: "Quietly continue - neither sign nor reject, maintain plausible deniability",
        effects: {
          researchRateMultiplier: 1.0,
          choices: { reputation: -5 },
        },
      },
    ],

    oneTime: true,
  },
];
