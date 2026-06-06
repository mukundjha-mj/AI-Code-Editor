import Groq from "groq-sdk";
import type {
  AiProvider,
  ProviderCompletionRequest,
  ProviderCompletionResponse,
  ProviderStreamEvent,
} from "./provider.types";

type GroqProviderConfig = {
  apiKey: string;
};

export const createGroqProvider = (config: GroqProviderConfig): AiProvider => {
  const client = new Groq({ apiKey: config.apiKey });

  return {
    complete: async (
      request: ProviderCompletionRequest,
    ): Promise<ProviderCompletionResponse> => {
      const completion = await client.chat.completions.create({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
      });

      return {
        content: completion.choices[0]?.message?.content ?? "",
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    },
    stream: async function* (
      request: ProviderCompletionRequest,
    ): AsyncGenerator<ProviderStreamEvent> {
      const stream = await client.chat.completions.create({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        stream: true,
      });

      for await (const event of stream) {
        const token = event.choices[0]?.delta?.content;
        if (token) {
          yield { type: "token", token };
        }
      }

      yield { type: "done" };
    },
  };
};
