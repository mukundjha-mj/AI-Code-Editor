import { createDecisionMemoryService } from "./decision-memory.service";
import type { DecisionMemoryService } from "./decision-memory.service";
import { InMemoryDecisionMemoryStore, PostgresDecisionMemoryStore } from "./decision-memory.store";
import { getRepositoryIntelligenceService } from "../repository/repository.runtime";
import { createPostgresPool } from "../../infrastructure/database/postgres.client";
import { createDecisionMemoryAiService } from "./decision-memory.ai";
import { createAiProvider } from "../ai/provider/provider-factory";
import { createModelRegistry } from "../ai/model-registry";
import { createPromptRegistry } from "../ai/prompt/prompt.registry";
import { env } from "../../config/env";

let sharedService: DecisionMemoryService | null = null;

export const getDecisionMemoryService = (): DecisionMemoryService => {
  if (!sharedService) {
    const repository = getRepositoryIntelligenceService();
    const pool = createPostgresPool();
    const store = pool ? new PostgresDecisionMemoryStore(pool) : new InMemoryDecisionMemoryStore();

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

    const ai = createDecisionMemoryAiService({
      provider,
      modelRegistry,
      promptRegistry,
    });

    sharedService = createDecisionMemoryService({
      store,
      repository,
      ai,
    });
  }
  return sharedService;
};
