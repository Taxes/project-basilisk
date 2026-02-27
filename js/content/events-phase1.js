// Phase 1 Event Definitions

export const phase1Events = [
  {
    id: "alignment_tax_choice",
    name: "The Alignment Tax",

    trigger: {
      type: "capability_unlock",
      value: "rlhf",
    },

    text: "Your safety team proposes implementing RLHF, which will slow capability gains by 20% but improve alignment. Your investors are skeptical about the cost, arguing that the market rewards raw capability over safety. This is a pivotal decision that will shape your organization's trajectory.",

    choices: [
      {
        id: "accept_tax",
        text: "Implement RLHF (-20% research rate, +alignment investment)",
        effects: {
          researchRateMultiplier: 0.8,
          choices: { alignmentInvestment: 10 },
        },
      },
      {
        id: "reject_tax",
        text: "Focus on raw capability (+10% research rate, -alignment investment)",
        effects: {
          researchRateMultiplier: 1.1,
          choices: { alignmentInvestment: -5 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "open_source_debate",
    name: "The Open Source Dilemma",

    trigger: {
      type: "capability_unlock",
      value: "chain_of_thought",
    },

    text: "Your team has achieved a major breakthrough in chain-of-thought reasoning. The question arises: should you open-source your work to accelerate the field, or keep it proprietary to maintain competitive advantage? The scientific community is watching.",

    choices: [
      {
        id: "open_source",
        text: "Open source the research (+reputation, competitors accelerate)",
        effects: {
          researchRateMultiplier: 1.15,  // Community contributions
          choices: { openSourceDecisions: 1, reputation: 10 },
          competitorBoost: 0.2,  // Competitors benefit too
        },
      },
      {
        id: "keep_proprietary",
        text: "Keep it proprietary (maintain advantage, slower progress)",
        effects: {
          researchRateMultiplier: 0.95,
          choices: { openSourceDecisions: -1, reputation: -5 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "compute_costs",
    name: "The Compute Wall",

    trigger: {
      type: "capability_unlock",
      value: "multi_modal",
    },

    text: "Training multi-modal models is extraordinarily expensive. Your CFO is alarmed by the computing costs. You have three options: secure more funding, optimize your training process, or slow down research to manage costs.",

    choices: [
      {
        id: "secure_funding",
        text: "Secure additional funding (unlock cheaper compute)",
        effects: {
          computeCostReduction: 0.85,  // 15% cost reduction
          choices: { fundingRounds: 1 },
        },
      },
      {
        id: "optimize_training",
        text: "Invest in training efficiency (-1500 research, +compute multiplier)",
        effects: {
          resources: { research: -1500 },
          computeRateMultiplier: 1.3,
          choices: { efficiencyInvestment: 5 },
        },
      },
      {
        id: "slow_research",
        text: "Slow down and optimize costs (reduce research rate)",
        effects: {
          researchRateMultiplier: 0.85,
          choices: { conservativeApproach: 5 },
        },
      },
    ],

    oneTime: true,
  },
];
