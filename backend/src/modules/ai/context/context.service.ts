import type { ContextChunk, ContextProvider, ContextRequest } from "./context.types";

export type ContextService = {
  collect(request: ContextRequest): Promise<ContextChunk[]>;
};

export const createContextService = (providers: ContextProvider[]): ContextService => {
  return {
    collect: async (request: ContextRequest) => {
      const chunks = await Promise.all(providers.map((provider) => provider.collect(request)));
      return chunks.flat();
    },
  };
};

export const createPlaceholderContextProviders = (): ContextProvider[] => {
  const providers: ContextProvider[] = [
    {
      scope: "currentFile",
      collect: async () => [],
    },
    {
      scope: "multipleFiles",
      collect: async () => [],
    },
    {
      scope: "repository",
      collect: async () => [],
    },
    {
      scope: "userInstructions",
      collect: async () => [],
    },
    {
      scope: "memory",
      collect: async () => [],
    },
  ];

  return providers;
};
