import type { Router } from "express";
import { env } from "../../config/env";
import { createPromptRegistry } from "../ai/prompt/prompt.registry";
import { createAiProvider } from "../ai/provider/provider-factory";
import { createModelRegistry } from "../ai/model-registry";
import { createExplainRouter } from "./explain.routes";
import { createExplainService } from "./explain.service";
import { InMemoryExplanationCache } from "./explanation.cache";
import {
  createRepositoryContextBuilder,
  createRepositoryContextService,
} from "./repository-context.builder";
import { getRepositoryIntelligenceService } from "../repository/repository.runtime";

export const createExplainModuleRouter = (): Router => {
  const repository = getRepositoryIntelligenceService();
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
  const contextBuilder = createRepositoryContextBuilder(repository);
  const contextService = createRepositoryContextService();
  const cache = new InMemoryExplanationCache();

  const explainService = createExplainService({
    repository,
    provider,
    modelRegistry,
    promptRegistry,
    contextService,
    contextBuilder,
    cache,
  });

  return createExplainRouter(explainService);
};
