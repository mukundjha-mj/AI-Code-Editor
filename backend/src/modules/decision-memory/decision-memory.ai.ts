import { z } from "zod";
import type { ModelRegistry } from "../ai/model-registry";
import type { PromptRegistry } from "../ai/prompt/prompt.types";
import type { AiProvider } from "../ai/provider/provider.types";
import type { DecisionListFilters, DecisionType } from "./decision-memory.types";

const categorySchema = z.object({
  decisionType: z.enum([
    "code-added",
    "code-modified",
    "code-removed",
    "performance",
    "architecture",
    "refactor",
    "bugfix",
    "other",
  ]),
});

const summarySchema = z.object({
  description: z.string(),
});

const querySchema = z.object({
  terms: z.array(z.string()).max(8).default([]),
});

const parseJsonResponse = <T>(content: string, schema: z.ZodSchema<T>): T => {
  const normalized = content.trim();
  const stripped = normalized.startsWith("```")
    ? normalized
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim()
    : normalized;
  return schema.parse(JSON.parse(stripped));
};

export interface DecisionMemoryAiService {
  categorize(input: { title: string; description: string; reason: string }): Promise<DecisionType>;
  summarize(input: { title: string; description: string; reason: string }): Promise<string>;
  enhanceSearch(input: { query: string; filters: DecisionListFilters }): Promise<string[]>;
}

interface DecisionMemoryAiDeps {
  provider: AiProvider;
  modelRegistry: ModelRegistry;
  promptRegistry: PromptRegistry;
}

export const createDecisionMemoryAiService = (
  deps: DecisionMemoryAiDeps,
): DecisionMemoryAiService => {
  const model = deps.modelRegistry.getModel("decisionMemory");
  const prompt = deps.promptRegistry.getPrompt("decisionMemory");

  return {
    categorize: async (input) => {
      const completion = await deps.provider.complete({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `${prompt.systemPrompt} Classify an engineering decision into one enum and return strict JSON only.`,
          },
          {
            role: "user",
            content: [
              'Return JSON: {"decisionType": "..."}',
              `Title: ${input.title}`,
              `Description: ${input.description}`,
              `Reason: ${input.reason}`,
              "Allowed values: code-added, code-modified, code-removed, performance, architecture, refactor, bugfix, other",
            ].join("\n"),
          },
        ],
      });

      return parseJsonResponse(completion.content, categorySchema).decisionType;
    },
    summarize: async (input) => {
      const completion = await deps.provider.complete({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `${prompt.systemPrompt} Rewrite verbose engineering decision text into a concise technical summary.`,
          },
          {
            role: "user",
            content: [
              'Return JSON: {"description": "..."}',
              "Keep intent, constraints, and rationale. Max 4 sentences.",
              `Title: ${input.title}`,
              `Description: ${input.description}`,
              `Reason: ${input.reason}`,
            ].join("\n"),
          },
        ],
      });

      return parseJsonResponse(completion.content, summarySchema).description;
    },
    enhanceSearch: async (input) => {
      const completion = await deps.provider.complete({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `${prompt.systemPrompt} Expand search text with codebase reasoning synonyms and related engineering terms.`,
          },
          {
            role: "user",
            content: [
              'Return JSON: {"terms": ["..."]}',
              "terms must be short lowercase keywords only.",
              `Query: ${input.query}`,
              `Filters: ${JSON.stringify(input.filters)}`,
            ].join("\n"),
          },
        ],
      });

      return parseJsonResponse(completion.content, querySchema).terms;
    },
  };
};
