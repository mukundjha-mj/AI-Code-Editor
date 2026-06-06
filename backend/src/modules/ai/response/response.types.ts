import type { AiCapability } from "../ai.types";

export type AiResponse = {
  capability: AiCapability;
  model: string;
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type AiMockResponse = AiResponse & {
  mock: true;
};
