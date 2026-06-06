import type { AiCapability } from "../ai.types";

export type PromptCategory = AiCapability;

export type PromptDefinition = {
  id: string;
  category: PromptCategory;
  version: string;
  systemPrompt: string;
};

export type PromptRegistry = {
  getPrompt(category: PromptCategory): PromptDefinition;
  listPrompts(): PromptDefinition[];
};
