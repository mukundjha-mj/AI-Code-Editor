export type LlmRequest = {
  model: string;
  prompt: string;
};

export type LlmResponse = {
  content: string;
};

export interface LlmProvider {
  complete(request: LlmRequest): Promise<LlmResponse>;
}
