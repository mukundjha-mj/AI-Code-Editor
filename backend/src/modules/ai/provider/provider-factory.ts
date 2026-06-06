import type { env } from "../../../config/env";
import { createGroqProvider } from "./groq.provider";
import type { AiProvider } from "./provider.types";

type ProviderConfig = Pick<typeof env, "AI_PROVIDER" | "GROQ_API_KEY">;

export const createAiProvider = (config: ProviderConfig): AiProvider => {
  switch (config.AI_PROVIDER) {
    case "groq":
      return createGroqProvider({ apiKey: config.GROQ_API_KEY });
    default: {
      const neverProvider: never = config.AI_PROVIDER;
      throw new Error(`Unsupported AI provider: ${neverProvider}`);
    }
  }
};
