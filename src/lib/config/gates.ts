export type Level =
  | "neuner"
  | "viewner"
  | "sytner"
  | "omner"
  | "vexer";

export type Tier =
  | "start"
  | "pro"
  | "master";

export type GateRule = {
  minLevel?: Level;
  minTier?: Tier;
  minXP?: number;
  auroCost?: number;
};

/**
 * Viewora Feature Access Rules
 * Defines which levels or tiers can access specific platform features.
 */
export const gates: Record<string, GateRule> = {
  // Education & Academy
  academy: {
    minLevel: "viewner"
  },

  // Social & Groups
  createGroup: {
    minLevel: "viewner"
  },
  joinGroup: {
    minLevel: "neuner"
  },

  // Events & Competitions
  challenge: {
    minLevel: "sytner"
  },
  exhibition: {
    minLevel: "omner"
  },

  // Mentorship & Strategy
  mentor: {
    minLevel: "vexer"
  },
  mentorAnalysis: {
    minLevel: "vexer",
    minTier: "master",
    auroCost: 10
  }
};
