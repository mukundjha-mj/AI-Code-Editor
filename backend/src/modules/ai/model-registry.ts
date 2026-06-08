import type { env } from "../../config/env";
import type { AiCapability } from "./ai.types";

type EnvConfig = Pick<typeof env, "GROQ_CHAT_MODEL" | "GROQ_CODE_MODEL" | "GROQ_REASONING_MODEL">;

export type ModelRegistry = {
  getModel(capability: AiCapability): string;
  listModels(): Record<AiCapability, string>;
};

export const createModelRegistry = (config: EnvConfig): ModelRegistry => {
  const models: Record<AiCapability, string> = {
    chat: config.GROQ_CHAT_MODEL,
    codeExplanation: config.GROQ_CODE_MODEL,
    intentOptimization: config.GROQ_REASONING_MODEL,
    repositoryAnalysis: config.GROQ_REASONING_MODEL,
    decisionMemory: config.GROQ_REASONING_MODEL,
  };

  return {
    getModel: (capability) => models[capability],
    listModels: () => ({ ...models }),
  };
};
