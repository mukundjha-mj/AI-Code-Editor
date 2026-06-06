import type { Router } from "express";
import { env } from "../../config/env";
import { createAiRouter } from "./ai.routes";
import { createAiService } from "./ai.service";
import { createContextService, createPlaceholderContextProviders } from "./context/context.service";
import { createConsoleAiRequestLogger } from "./monitoring/ai-logger";
import { createModelRegistry } from "./model-registry";
import { createPromptRegistry } from "./prompt/prompt.registry";
import { createAiProvider } from "./provider/provider-factory";

export const createAiModuleRouter = (): Router => {
  const provider = createAiProvider({
    AI_PROVIDER: env.AI_PROVIDER,
    GROQ_API_KEY: env.GROQ_API_KEY,
  });
  const modelRegistry = createModelRegistry({
    GROQ_CHAT_MODEL: env.GROQ_CHAT_MODEL,
    GROQ_CODE_MODEL: env.GROQ_CODE_MODEL,
    GROQ_REASONING_MODEL: env.GROQ_REASONING_MODEL,
  });
  const promptRegistry = createPromptRegistry();
  const contextService = createContextService(createPlaceholderContextProviders());
  const logger = createConsoleAiRequestLogger();
  const aiService = createAiService({
    provider,
    promptRegistry,
    contextService,
    modelRegistry,
    logger,
  });

  return createAiRouter(aiService);
};
