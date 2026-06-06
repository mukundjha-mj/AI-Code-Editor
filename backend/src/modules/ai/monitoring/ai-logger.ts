import type { AiCapability } from "../ai.types";

export type AiRequestLog = {
  capability: AiCapability;
  model: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  errorMessage?: string;
};

export interface AiRequestLogger {
  log(entry: AiRequestLog): void;
}

export const createConsoleAiRequestLogger = (): AiRequestLogger => {
  return {
    log: (entry) => {
      const status = entry.errorMessage ? "error" : "ok";
      console.info("[ai-request]", { status, ...entry });
    },
  };
};
