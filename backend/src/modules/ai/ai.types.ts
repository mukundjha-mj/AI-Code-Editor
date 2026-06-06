export const aiCapabilities = [
  "chat",
  "codeExplanation",
  "intentOptimization",
  "repositoryAnalysis",
  "decisionMemory",
] as const;

export type AiCapability = (typeof aiCapabilities)[number];

export type AiExecutionMode = "mock" | "live";
