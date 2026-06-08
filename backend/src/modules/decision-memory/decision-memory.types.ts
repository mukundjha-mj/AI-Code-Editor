export const decisionTypes = [
  "code-added",
  "code-modified",
  "code-removed",
  "performance",
  "architecture",
  "refactor",
  "bugfix",
  "other",
] as const;

export type DecisionType = (typeof decisionTypes)[number];

export const decisionEntityTypes = [
  "file",
  "symbol",
  "component",
  "function",
  "class",
  "route",
  "module",
] as const;

export type DecisionEntityType = (typeof decisionEntityTypes)[number];

export interface DecisionEntityLink {
  type: DecisionEntityType;
  value: string;
  filePath?: string;
}

export interface DecisionRecord {
  id: string;
  title: string;
  description: string;
  decisionType: DecisionType;
  reason: string;
  tradeOffs: string[];
  expectedBenefits: string[];
  risks: string[];
  author: string;
  timestamp: string;
  linkedEntities: DecisionEntityLink[];
  followUpToDecisionId: string | null;
  replacesDecisionId: string | null;
  supersedesDecisionId: string | null;
}

export interface CreateDecisionInput {
  title: string;
  description: string;
  decisionType?: DecisionType;
  reason: string;
  tradeOffs?: string[];
  expectedBenefits?: string[];
  risks?: string[];
  author: string;
  linkedEntities: DecisionEntityLink[];
  followUpToDecisionId?: string | null;
  replacesDecisionId?: string | null;
  supersedesDecisionId?: string | null;
  aiAssist?: {
    summarize?: boolean;
    categorize?: boolean;
  };
}

export interface DecisionListFilters {
  file?: string;
  symbol?: string;
  component?: string;
  route?: string;
  module?: string;
  type?: DecisionType;
  author?: string;
  query?: string;
}

export interface DecisionHistoryResponse {
  rootDecisionId: string;
  chain: DecisionRecord[];
}

export interface DecisionEntityContextResponse {
  entity: DecisionEntityLink;
  decisions: DecisionRecord[];
  answers: {
    whyExists: string[];
    whyChanged: string[];
    performanceOptimizations: string[];
    architecturalDecisions: string[];
  };
}

export interface ExplainDecisionSummary {
  id: string;
  title: string;
  decisionType: DecisionType;
  reason: string;
  timestamp: string;
}
