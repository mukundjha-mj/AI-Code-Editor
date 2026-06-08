import type { ContextService } from "../ai/context/context.service";
import { createContextService } from "../ai/context/context.service";
import type { ContextProvider, ContextRequest } from "../ai/context/context.types";
import type { RepositoryIntelligenceService } from "../repository/repository-intelligence.service";
import type {
  RepositoryFileRecord,
  RepositorySnapshot,
  RepositorySymbol,
} from "../repository/repository.types";
import type { ExplainRequestInput } from "./explain.types";

const uniqueSorted = (values: Iterable<string>) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

const truncateText = (value: string, max = 6000) =>
  value.length <= max ? value : `${value.slice(0, max)}\n... [truncated]`;

const collectTopDependencies = (
  snapshot: RepositorySnapshot,
  filePath: string,
  maxItems: number,
): { imports: string[]; consumers: string[] } => {
  const imports = snapshot.dependencies.adjacency[filePath] ?? [];
  const consumers = Object.entries(snapshot.dependencies.adjacency)
    .filter(([, deps]) => deps.includes(filePath))
    .map(([candidate]) => candidate);

  return {
    imports: imports.slice(0, maxItems),
    consumers: consumers.slice(0, maxItems),
  };
};

const selectRelatedFiles = (
  snapshot: RepositorySnapshot,
  filePath: string | undefined,
  mode: "quick" | "deep",
): string[] => {
  if (!filePath) {
    return [];
  }
  const limit = mode === "deep" ? 10 : 4;
  const dependencies = snapshot.dependencies.adjacency[filePath] ?? [];
  const consumers = Object.entries(snapshot.dependencies.adjacency)
    .filter(([, deps]) => deps.includes(filePath))
    .map(([candidate]) => candidate);
  return uniqueSorted([...dependencies, ...consumers]).slice(0, limit);
};

const inferSourceFile = (
  snapshot: RepositorySnapshot,
  input: ExplainRequestInput,
): string | undefined => {
  if (input.path) {
    return input.path;
  }
  if (input.target === "route" && input.route) {
    return snapshot.routes.routes.find((entry) => entry.route === input.route)?.file;
  }
  if (
    (input.target === "function" || input.target === "component" || input.target === "class") &&
    input.symbol
  ) {
    return snapshot.symbols.find((symbol) => symbol.name === input.symbol)?.sourceFile;
  }
  return undefined;
};

const collectSymbolContext = (
  symbols: RepositorySymbol[],
  input: ExplainRequestInput,
): { selected: RepositorySymbol[]; nearby: RepositorySymbol[] } => {
  if (!input.symbol) {
    return { selected: [], nearby: [] };
  }
  const selected = symbols.filter((symbol) => symbol.name === input.symbol);
  const sourceFile = selected[0]?.sourceFile;
  const nearby = sourceFile
    ? symbols.filter((symbol) => symbol.sourceFile === sourceFile).slice(0, 30)
    : [];
  return { selected, nearby };
};

const collectComponentRelationships = (
  snapshot: RepositorySnapshot,
  symbolName: string | undefined,
) => {
  if (!symbolName) {
    return {
      parents: [] as string[],
      children: [] as string[],
    };
  }
  const children = snapshot.components.parentToChildren[symbolName] ?? [];
  const parents = Object.entries(snapshot.components.parentToChildren)
    .filter(([, descendants]) => descendants.includes(symbolName))
    .map(([component]) => component);

  return {
    parents: uniqueSorted(parents),
    children: uniqueSorted(children),
  };
};

export interface ExplanationContext {
  mode: "quick" | "deep";
  selected: {
    target: ExplainRequestInput["target"];
    filePath?: string;
    symbol?: string;
    route?: string;
  };
  rootPath: string | null;
  scannedAt: string | null;
  selectedFile: {
    path: string;
    hash: string;
    mtimeMs: number;
    imports: string[];
    exports: string[];
    dependencies: string[];
    consumers: string[];
  } | null;
  relatedFiles: string[];
  componentRelationships: {
    parents: string[];
    children: string[];
  };
  routes: Array<{ file: string; route: string }>;
  symbols: {
    selected: RepositorySymbol[];
    nearby: RepositorySymbol[];
  };
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface RepositoryContextBuilder {
  build(input: ExplainRequestInput): Promise<ExplanationContext>;
  toContextRequest(context: ExplanationContext): ContextRequest;
}

export const createRepositoryContextBuilder = (
  repository: RepositoryIntelligenceService,
): RepositoryContextBuilder => {
  const build = async (input: ExplainRequestInput): Promise<ExplanationContext> => {
    const snapshot = repository.getSnapshot();
    const selectedPath = inferSourceFile(snapshot, input);
    const selectedRecord = selectedPath
      ? (snapshot.files.find((file) => file.path === selectedPath) ?? null)
      : null;

    const relatedFiles = selectRelatedFiles(snapshot, selectedRecord?.path, input.mode);
    const filePathsToLoad = uniqueSorted(
      [selectedRecord?.path, ...relatedFiles.slice(0, input.mode === "deep" ? 8 : 3)].filter(
        (value): value is string => Boolean(value),
      ),
    );

    const files: Array<{ path: string; content: string }> = [];
    for (const filePath of filePathsToLoad) {
      const content = await repository.getFileContent(filePath);
      files.push({
        path: filePath,
        content: truncateText(content.content, input.mode === "deep" ? 9000 : 3500),
      });
    }

    const symbolContext = collectSymbolContext(snapshot.symbols, input);
    const relationships = collectComponentRelationships(snapshot, input.symbol);
    const dependencySummary = selectedRecord
      ? collectTopDependencies(snapshot, selectedRecord.path, input.mode === "deep" ? 12 : 6)
      : { imports: [], consumers: [] };

    return {
      mode: input.mode,
      selected: {
        target: input.target,
        filePath: selectedRecord?.path,
        symbol: input.symbol,
        route: input.route,
      },
      rootPath: snapshot.rootPath,
      scannedAt: snapshot.scannedAt,
      selectedFile: selectedRecord
        ? {
            path: selectedRecord.path,
            hash: selectedRecord.hash,
            mtimeMs: selectedRecord.mtimeMs,
            imports: selectedRecord.imports.map((entry) => entry.source),
            exports: selectedRecord.exports.map((entry) => entry.name),
            dependencies: dependencySummary.imports,
            consumers: dependencySummary.consumers,
          }
        : null,
      relatedFiles,
      componentRelationships: relationships,
      routes: snapshot.routes.routes.slice(0, input.mode === "deep" ? 80 : 30),
      symbols: symbolContext,
      files,
    };
  };

  return {
    build,
    toContextRequest: (context) => ({
      currentFilePath: context.selected.filePath,
      filePaths: context.files.map((file) => file.path),
      repositoryRoot: context.rootPath ?? undefined,
      userInstructions: `explain-target:${context.selected.target}; mode:${context.mode}`,
      memoryKeys: [],
    }),
  };
};

export const createRepositoryContextService = (): ContextService => {
  const providers: ContextProvider[] = [
    {
      scope: "currentFile",
      collect: async (request) => {
        const target = (request.userInstructions ?? "").includes("mode:deep") ? "deep" : "quick";
        if (!request.currentFilePath) {
          return [];
        }
        return [
          {
            scope: "currentFile",
            content: JSON.stringify(
              {
                filePath: request.currentFilePath,
                mode: target,
              },
              null,
              2,
            ),
          },
        ];
      },
    },
    {
      scope: "multipleFiles",
      collect: async (request) =>
        request.filePaths && request.filePaths.length > 0
          ? [
              {
                scope: "multipleFiles",
                content: JSON.stringify({ filePaths: request.filePaths }, null, 2),
              },
            ]
          : [],
    },
    {
      scope: "repository",
      collect: async (request) =>
        request.repositoryRoot
          ? [
              {
                scope: "repository",
                content: JSON.stringify({ rootPath: request.repositoryRoot }, null, 2),
              },
            ]
          : [],
    },
  ];

  return createContextService(providers);
};

export const toStructuredContextText = (context: ExplanationContext): string =>
  JSON.stringify(context, null, 2);

export const getContextVersion = (context: ExplanationContext): string => {
  const selectedFile = context.selectedFile;
  if (!selectedFile) {
    return `${context.selected.target}:none`;
  }
  return `${selectedFile.path}:${selectedFile.hash}:${selectedFile.mtimeMs}`;
};

export const getCacheKey = (input: ExplainRequestInput, context: ExplanationContext): string => {
  const state = context.selectedFile
    ? `${context.selectedFile.path}:${context.selectedFile.hash}:${context.selectedFile.mtimeMs}`
    : "no-file";
  return [
    input.target,
    input.mode,
    input.path ?? "",
    input.symbol ?? "",
    input.route ?? "",
    state,
  ].join("|");
};

export const validateExplainInput = (
  snapshot: RepositorySnapshot,
  input: ExplainRequestInput,
): string | null => {
  if (!snapshot.rootPath || !snapshot.scannedAt) {
    return "Repository has not been scanned yet. Run /api/v1/repository/scan first.";
  }

  if (input.target === "file" || input.target === "module") {
    if (!input.path) {
      return "path is required for file/module explanation";
    }
    const exists = snapshot.files.some((file: RepositoryFileRecord) => file.path === input.path);
    if (!exists) {
      return `File not found in repository index: ${input.path}`;
    }
  }

  if (input.target === "route") {
    if (!input.route) {
      return "route is required for route explanation";
    }
    const exists = snapshot.routes.routes.some((entry) => entry.route === input.route);
    if (!exists) {
      return `Route not found in repository index: ${input.route}`;
    }
  }

  if (input.target === "component" || input.target === "function" || input.target === "class") {
    if (!input.symbol) {
      return `symbol is required for ${input.target} explanation`;
    }
    const matches = snapshot.symbols.filter((symbol) => symbol.name === input.symbol);
    if (matches.length === 0) {
      return `Symbol not found in repository index: ${input.symbol}`;
    }
    if (input.target === "class" && !matches.some((symbol) => symbol.type === "class")) {
      return `Symbol ${input.symbol} is not indexed as class`;
    }
    if (input.target === "function" && !matches.some((symbol) => symbol.type === "function")) {
      return `Symbol ${input.symbol} is not indexed as function`;
    }
    if (input.target === "component" && !matches.some((symbol) => symbol.type === "component")) {
      return `Symbol ${input.symbol} is not indexed as component`;
    }
  }

  return null;
};
