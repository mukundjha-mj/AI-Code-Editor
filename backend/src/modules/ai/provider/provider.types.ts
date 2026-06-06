export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderCompletionRequest = {
  model: string;
  messages: ProviderMessage[];
  temperature?: number;
};

export type ProviderCompletionResponse = {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type ProviderStreamEvent =
  | { type: "token"; token: string }
  | { type: "done"; usage?: ProviderCompletionResponse["usage"] };

export interface AiProvider {
  complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResponse>;
  stream(request: ProviderCompletionRequest): AsyncGenerator<ProviderStreamEvent>;
}
