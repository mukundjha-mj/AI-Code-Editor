import type { ContextRequest } from "./context/context.types";
import type { ContextService } from "./context/context.service";
import type { AiRequestLogger } from "./monitoring/ai-logger";
import type { ModelRegistry } from "./model-registry";
import type { PromptRegistry } from "./prompt/prompt.types";
import { createMockResponse, mapProviderResponse } from "./response/response.mapper";
import type { AiMockResponse, AiResponse } from "./response/response.types";
import type { AiCapability, AiExecutionMode } from "./ai.types";
import type { AiProvider, ProviderStreamEvent } from "./provider/provider.types";

export type AiRequestInput = {
  capability: AiCapability;
  userText: string;
  contextRequest?: ContextRequest;
};

export type AiService = {
  execute(input: AiRequestInput, mode: AiExecutionMode): Promise<AiResponse | AiMockResponse>;
  stream(input: AiRequestInput): AsyncGenerator<ProviderStreamEvent>;
};

type AiServiceDependencies = {
  provider: AiProvider;
  promptRegistry: PromptRegistry;
  contextService: ContextService;
  modelRegistry: ModelRegistry;
  logger: AiRequestLogger;
};

export const createAiService = (deps: AiServiceDependencies): AiService => {
  return {
    execute: async (input, mode) => {
      const start = performance.now();
      const model = deps.modelRegistry.getModel(input.capability);

      try {
        const prompt = deps.promptRegistry.getPrompt(input.capability);
        const contextChunks = await deps.contextService.collect(input.contextRequest ?? {});
        const contextBlock = contextChunks
          .map((chunk) => `[${chunk.scope}] ${chunk.content}`)
          .join("\n");

        if (mode === "mock") {
          const mock = createMockResponse(input.capability, model, input.userText);
          deps.logger.log({
            capability: input.capability,
            model,
            latencyMs: performance.now() - start,
          });
          return mock;
        }

        const response = await deps.provider.complete({
          model,
          messages: [
            { role: "system", content: prompt.systemPrompt },
            {
              role: "user",
              content: contextBlock
                ? `${input.userText}\n\nContext:\n${contextBlock}`
                : input.userText,
            },
          ],
        });

        const mapped = mapProviderResponse(input.capability, model, response);
        deps.logger.log({
          capability: input.capability,
          model,
          latencyMs: performance.now() - start,
          tokenUsage: mapped.usage,
        });

        return mapped;
      } catch (error) {
        deps.logger.log({
          capability: input.capability,
          model,
          latencyMs: performance.now() - start,
          errorMessage: error instanceof Error ? error.message : "Unknown AI error",
        });
        throw error;
      }
    },
    stream: async function* (input) {
      const model = deps.modelRegistry.getModel(input.capability);
      const prompt = deps.promptRegistry.getPrompt(input.capability);
      const contextChunks = await deps.contextService.collect(input.contextRequest ?? {});
      const contextBlock = contextChunks
        .map((chunk) => `[${chunk.scope}] ${chunk.content}`)
        .join("\n");

      yield* deps.provider.stream({
        model,
        messages: [
          { role: "system", content: prompt.systemPrompt },
          {
            role: "user",
            content: contextBlock ? `${input.userText}\n\nContext:\n${contextBlock}` : input.userText,
          },
        ],
      });
    },
  };
};
