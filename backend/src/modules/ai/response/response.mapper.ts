import type { AiCapability } from "../ai.types";
import type { ProviderCompletionResponse } from "../provider/provider.types";
import type { AiMockResponse, AiResponse } from "./response.types";

export const mapProviderResponse = (
  capability: AiCapability,
  model: string,
  response: ProviderCompletionResponse,
): AiResponse => {
  return {
    capability,
    model,
    content: response.content,
    usage: response.usage,
  };
};

export const createMockResponse = (
  capability: AiCapability,
  model: string,
  requestText: string,
): AiMockResponse => {
  return {
    mock: true,
    capability,
    model,
    content: `Mock ${capability} response for request: ${requestText.slice(0, 120)}`,
  };
};
