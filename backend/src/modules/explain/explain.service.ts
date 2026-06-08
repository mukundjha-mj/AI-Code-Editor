import { z } from "zod";
import type { ContextService } from "../ai/context/context.service";
import type { ModelRegistry } from "../ai/model-registry";
import type { PromptRegistry } from "../ai/prompt/prompt.types";
import type { AiProvider, ProviderStreamEvent } from "../ai/provider/provider.types";
import type { RepositoryIntelligenceService } from "../repository/repository-intelligence.service";
import type { ExplanationCache } from "./explanation.cache";
import {
  getCacheKey,
  getContextVersion,
  toStructuredContextText,
  validateExplainInput,
  type RepositoryContextBuilder,
} from "./repository-context.builder";
import type { DecisionMemoryService } from "../decision-memory/decision-memory.service";
import type { DecisionEntityType } from "../decision-memory/decision-memory.types";
import type { ExplainRequestInput, ExplainResponse } from "./explain.types";

const explanationSchema = z.object({
  summary: z.string(),
  responsibilities: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  relationships: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  suggestedReadingOrder: z.array(z.string()).default([]),
});

const getSystemPrompt = (
  target: ExplainRequestInput["target"],
  mode: ExplainRequestInput["mode"],
) =>
  [
    `You are a codebase explanation engine for ${target} analysis in ${mode} mode.`,
    "Only use the provided repository context and engineering decisions context. Never claim unseen files.",
    "Return STRICT JSON with fields: summary, responsibilities, dependencies, relationships, risks, suggestedReadingOrder.",
    "Each list must contain concise bullet-like strings.",
  ].join(" ");

const getUserPrompt = (input: ExplainRequestInput, contextText: string) =>
  [
    "Explain the selected repository entity using the context JSON and architectural decisions context below.",
    `Target: ${input.target}`,
    `Mode: ${input.mode}`,
    input.path ? `Path: ${input.path}` : "",
    input.symbol ? `Symbol: ${input.symbol}` : "",
    input.route ? `Route: ${input.route}` : "",
    "",
    "RepositoryContextJSON:",
    contextText,
  ]
    .filter((line) => line.length > 0)
    .join("\n");

const parseStructuredResponse = (content: string) => {
  const normalized = content.trim();
  const json = normalized.startsWith("```")
    ? normalized
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim()
    : normalized;
  const parsed = JSON.parse(json);
  return explanationSchema.parse(parsed);
};

export interface ExplainService {
  explain(input: ExplainRequestInput): Promise<ExplainResponse>;
  stream(input: ExplainRequestInput): AsyncGenerator<ProviderStreamEvent>;
}

interface ExplainServiceDeps {
  repository: RepositoryIntelligenceService;
  provider: AiProvider;
  modelRegistry: ModelRegistry;
  promptRegistry: PromptRegistry;
  contextService: ContextService;
  contextBuilder: RepositoryContextBuilder;
  cache: ExplanationCache;
  decisionMemory?: DecisionMemoryService;
}

export const createExplainService = (deps: ExplainServiceDeps): ExplainService => ({
  explain: async (input) => {
    const snapshot = deps.repository.getSnapshot();
    const validationError = validateExplainInput(snapshot, input);
    if (validationError) {
      throw new Error(validationError);
    }

    const context = await deps.contextBuilder.build(input);
    const cacheKey = getCacheKey(input, context);
    const cached = deps.cache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }

    const model = deps.modelRegistry.getModel("codeExplanation");
    const promptTemplate = deps.promptRegistry.getPrompt("codeExplanation");
    const contextRequest = deps.contextBuilder.toContextRequest(context);
    const baseContextChunks = await deps.contextService.collect(contextRequest);
    const contextText = toStructuredContextText(context);
    const collectedText = baseContextChunks
      .map((chunk) => `[${chunk.scope}] ${chunk.content}`)
      .join("\n");

    let decisionContextText = "";
    const relatedDecisions = deps.decisionMemory
      ? await deps.decisionMemory.getExplainSummaries({
          filePath: input.path,
          symbol: input.symbol,
          route: input.route,
          moduleName: input.target === "module" ? input.symbol : undefined,
        })
      : [];

    if (deps.decisionMemory) {
      const entityValue = input.symbol || input.path || input.route || "";
      if (entityValue) {
        try {
          const contextResult = await deps.decisionMemory.getByEntity({
            type: input.target as DecisionEntityType,
            value: entityValue,
            filePath: input.path,
          });
          if (contextResult.decisions.length > 0) {
            decisionContextText =
              "\n\nArchitectural & Performance Decisions Rationale:\n" +
              contextResult.decisions
                .map(
                  (d) =>
                    `- [${d.decisionType}] ${d.title}: ${d.reason} (Expected Benefits: ${d.expectedBenefits.join(
                      ", ",
                    )}, Risks: ${d.risks.join(", ")})`,
                )
                .join("\n");
          }
        } catch {
          // ignore
        }
      }
    }

    const response = await deps.provider.complete({
      model,
      messages: [
        {
          role: "system",
          content: `${promptTemplate.systemPrompt}\n${getSystemPrompt(input.target, input.mode)}`,
        },
        {
          role: "user",
          content: getUserPrompt(
            input,
            [contextText, collectedText, decisionContextText]
              .filter((value) => value.length > 0)
              .join("\n\n"),
          ),
        },
      ],
      temperature: input.mode === "deep" ? 0.2 : 0.1,
    });

    const structured = parseStructuredResponse(response.content);
    const result: ExplainResponse = {
      target: input.target,
      mode: input.mode,
      summary: structured.summary,
      responsibilities: structured.responsibilities,
      dependencies: structured.dependencies,
      relationships: structured.relationships,
      risks: structured.risks,
      suggestedReadingOrder: structured.suggestedReadingOrder,
      relatedFiles: context.relatedFiles,
      contextVersion: getContextVersion(context),
      cached: false,
      relatedDecisions,
    };

    deps.cache.set(cacheKey, result);
    return result;
  },
  stream: async function* (input) {
    const snapshot = deps.repository.getSnapshot();
    const validationError = validateExplainInput(snapshot, input);
    if (validationError) {
      throw new Error(validationError);
    }

    const context = await deps.contextBuilder.build(input);
    const model = deps.modelRegistry.getModel("codeExplanation");
    const promptTemplate = deps.promptRegistry.getPrompt("codeExplanation");
    const contextRequest = deps.contextBuilder.toContextRequest(context);
    const contextChunks = await deps.contextService.collect(contextRequest);
    const contextText = toStructuredContextText(context);
    const collectedText = contextChunks
      .map((chunk) => `[${chunk.scope}] ${chunk.content}`)
      .join("\n");

    let decisionContextText = "";
    if (deps.decisionMemory) {
      const entityValue = input.symbol || input.path || input.route || "";
      if (entityValue) {
        try {
          const contextResult = await deps.decisionMemory.getByEntity({
            type: input.target as DecisionEntityType,
            value: entityValue,
            filePath: input.path,
          });
          if (contextResult.decisions.length > 0) {
            decisionContextText =
              "\n\nArchitectural & Performance Decisions Rationale:\n" +
              contextResult.decisions
                .map(
                  (d) =>
                    `- [${d.decisionType}] ${d.title}: ${d.reason} (Expected Benefits: ${d.expectedBenefits.join(
                      ", ",
                    )}, Risks: ${d.risks.join(", ")})`,
                )
                .join("\n");
          }
        } catch {
          // ignore
        }
      }
    }

    yield* deps.provider.stream({
      model,
      messages: [
        {
          role: "system",
          content: `${promptTemplate.systemPrompt}\n${getSystemPrompt(input.target, input.mode)}`,
        },
        {
          role: "user",
          content: [
            "Stream a concise markdown explanation using the same required sections:",
            "Summary, Responsibilities, Dependencies, Relationships, Risks, Suggested Reading Order.",
            "",
            getUserPrompt(
              input,
              [contextText, collectedText, decisionContextText]
                .filter((value) => value.length > 0)
                .join("\n\n"),
            ),
          ].join("\n"),
        },
      ],
      temperature: input.mode === "deep" ? 0.2 : 0.1,
    });
  },
});
