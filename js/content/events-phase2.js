// Phase 2 Event Definitions - The Foundation Model Era

export const phase2Events = [
  {
    id: "scaling_race",
    name: "The Scaling Race",

    trigger: {
      type: "capability_unlock",
      value: "massive_scaling",
    },

    text: "Your breakthrough in scaling has not gone unnoticed. Competitors are pouring billions into matching your capabilities. The board is pressuring you to move faster, but your safety team warns that rushing could lead to deployed systems with unknown failure modes. Meanwhile, governments are starting to pay attention.",

    choices: [
      {
        id: "accelerate",
        text: "Accelerate development (+30% research rate, +safety incidents)",
        effects: {
          researchRateMultiplier: 1.3,
          choices: { safetyIncidents: 2, alignmentInvestment: -10 },
        },
      },
      {
        id: "measured_pace",
        text: "Maintain measured pace (balanced approach)",
        effects: {
          researchRateMultiplier: 1.1,
          choices: { reputation: 5, alignmentInvestment: 5 },
        },
      },
      {
        id: "safety_first",
        text: "Prioritize safety research (-15% capability rate, +alignment)",
        effects: {
          researchRateMultiplier: 0.85,
          choices: { alignmentInvestment: 15, safetyIncidents: -1 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "public_demo_disaster",
    name: "The Public Demo",

    trigger: {
      type: "capability_unlock",
      value: "emergent_abilities",
    },

    text: "Your AI system goes viral after a public demo, but it also produces some concerning outputs that spread on social media. Critics call for regulation, while supporters argue this is the future of productivity. How do you respond?",

    choices: [
      {
        id: "pr_campaign",
        text: "Launch PR campaign highlighting benefits (+reputation, -research focus)",
        effects: {
          researchRateMultiplier: 0.95,
          choices: { reputation: 15, publicTrust: 10 },
        },
      },
      {
        id: "restrict_access",
        text: "Restrict access and add safeguards (-capability, +safety)",
        effects: {
          researchRateMultiplier: 0.9,
          choices: { alignmentInvestment: 10, safetyIncidents: -1, reputation: 5 },
        },
      },
      {
        id: "ignore_critics",
        text: "Ignore critics and continue development (risky)",
        effects: {
          researchRateMultiplier: 1.15,
          choices: { safetyIncidents: 3, reputation: -10, publicTrust: -15 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "regulatory_pressure",
    name: "Regulatory Pressure",

    trigger: {
      type: "capability_unlock",
      value: "agent_architectures",
    },

    text: "Congress has called hearings on AI safety. Legislators are debating mandatory licensing for AI systems above a certain capability threshold. Your lobbyists say you can influence the outcome, but some of your researchers believe proactive self-regulation would be better for the field.",

    choices: [
      {
        id: "lobby_against",
        text: "Lobby against strict regulation (maintain speed, risk backlash)",
        effects: {
          researchRateMultiplier: 1.1,
          choices: { reputation: -10, regulatoryStanding: -15 },
        },
      },
      {
        id: "propose_framework",
        text: "Propose industry self-regulation framework (balanced)",
        effects: {
          choices: { reputation: 10, regulatoryStanding: 10, alignmentInvestment: 5 },
        },
      },
      {
        id: "support_oversight",
        text: "Support government oversight (+trust, slower development)",
        effects: {
          researchRateMultiplier: 0.85,
          choices: { reputation: 15, regulatoryStanding: 20, publicTrust: 10 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "talent_war",
    name: "The Talent War",

    trigger: {
      type: "capability_unlock",
      value: "tool_use",
    },

    text: "A competitor is offering your top researchers 3x their current salaries. Losing them could set you back months. Your CFO warns that matching the offers would strain the budget significantly. Some researchers say they'd stay for more interesting projects or better work-life balance.",

    choices: [
      {
        id: "match_offers",
        text: "Match the salary offers (-2000 research, retain talent)",
        effects: {
          resources: { research: -2000 },
          researchRateMultiplier: 1.15,
          choices: { talentRetention: 10 },
        },
      },
      {
        id: "interesting_projects",
        text: "Offer exciting research directions (safety/alignment focus)",
        effects: {
          researchRateMultiplier: 1.05,
          choices: { alignmentInvestment: 10, talentRetention: 5 },
        },
      },
      {
        id: "let_them_go",
        text: "Let them go and recruit new talent (temporary slowdown)",
        effects: {
          researchRateMultiplier: 0.8,
          choices: { talentRetention: -10 },
        },
      },
    ],

    oneTime: true,
  },

  {
    id: "world_model_ethics",
    name: "The World Model Question",

    trigger: {
      type: "capability_unlock",
      value: "world_models",
    },

    text: "Your world models are showing signs of sophisticated reasoning about human psychology and social dynamics. Some researchers are excited about the implications for understanding intelligence. Others are deeply concerned about manipulation potential. The ethics board has requested an urgent meeting.",

    choices: [
      {
        id: "full_steam",
        text: "Continue development with monitoring (high capability, high risk)",
        effects: {
          researchRateMultiplier: 1.2,
          choices: { alignmentInvestment: -15, safetyIncidents: 2 },
        },
      },
      {
        id: "red_team",
        text: "Extensive red-teaming before proceeding (slower but safer)",
        effects: {
          researchRateMultiplier: 0.9,
          choices: { alignmentInvestment: 20, safetyIncidents: -2 },
        },
      },
      {
        id: "publish_concerns",
        text: "Publish findings and concerns openly (reputation + community input)",
        effects: {
          researchRateMultiplier: 0.95,
          competitorBoost: 0.1,
          choices: { reputation: 20, alignmentInvestment: 15, openSourceDecisions: 1 },
        },
      },
    ],

    oneTime: true,
  },
];
