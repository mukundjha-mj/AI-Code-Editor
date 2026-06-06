export const explanationTargets = [
  "file",
  "component",
  "function",
  "class",
  "module",
  "route",
] as const;

export type ExplanationTarget = (typeof explanationTargets)[number];

export type ExplanationMode = "quick" | "deep";

export interface ExplainRequestInput {
  target: ExplanationTarget;
  mode: ExplanationMode;
  path?: string;
  symbol?: string;
  route?: string;
}

export interface ExplainResponse {
  target: ExplanationTarget;
  mode: ExplanationMode;
  summary: string;
  responsibilities: string[];
  dependencies: string[];
  relationships: string[];
  risks: string[];
  suggestedReadingOrder: string[];
  relatedFiles: string[];
  contextVersion: string;
  cached: boolean;
}
