import type { PromptDefinition, PromptRegistry } from "./prompt.types";

const defaultPromptDefinitions: PromptDefinition[] = [
  {
    id: "chat-default",
    category: "chat",
    version: "1.0.0",
    systemPrompt: "You are an assistant for AI Code Editor chat interactions.",
  },
  {
    id: "code-explanation-default",
    category: "codeExplanation",
    version: "1.0.0",
    systemPrompt: "You explain code changes clearly and accurately.",
  },
  {
    id: "intent-optimization-default",
    category: "intentOptimization",
    version: "1.0.0",
    systemPrompt: "You optimize user intent into actionable development tasks.",
  },
  {
    id: "repository-analysis-default",
    category: "repositoryAnalysis",
    version: "1.0.0",
    systemPrompt: "You analyze repository-level structure and architecture.",
  },
  {
    id: "decision-memory-default",
    category: "decisionMemory",
    version: "1.0.0",
    systemPrompt: "You summarize and retain key engineering decisions.",
  },
];

export const createPromptRegistry = (
  prompts: PromptDefinition[] = defaultPromptDefinitions,
): PromptRegistry => {
  const byCategory = new Map(prompts.map((prompt) => [prompt.category, prompt]));

  return {
    getPrompt: (category) => {
      const prompt = byCategory.get(category);
      if (!prompt) {
        throw new Error(`Missing prompt for category: ${category}`);
      }
      return prompt;
    },
    listPrompts: () => [...prompts],
  };
};
