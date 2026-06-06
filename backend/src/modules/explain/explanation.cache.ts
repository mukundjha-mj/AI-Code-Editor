import type { ExplainResponse } from "./explain.types";

export interface ExplanationCache {
  get(key: string): ExplainResponse | null;
  set(key: string, value: ExplainResponse): void;
}

export class InMemoryExplanationCache implements ExplanationCache {
  private readonly entries = new Map<string, ExplainResponse>();

  get(key: string): ExplainResponse | null {
    return this.entries.get(key) ?? null;
  }

  set(key: string, value: ExplainResponse): void {
    this.entries.set(key, value);
  }
}
