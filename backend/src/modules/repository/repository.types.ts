export const SUPPORTED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export type SymbolType =
  | "function"
  | "component"
  | "class"
  | "interface"
  | "type"
  | "variable";

export interface RepositorySymbol {
  id: string;
  name: string;
  type: SymbolType;
  sourceFile: string;
  isExported: boolean;
  relationships: string[];
}

export interface ImportReference {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
}

export interface ExportReference {
  name: string;
  isDefault: boolean;
  source?: string;
}

export interface RepositoryFileRecord {
  path: string;
  extension: SupportedExtension;
  size: number;
  mtimeMs: number;
  hash: string;
  symbols: RepositorySymbol[];
  imports: ImportReference[];
  exports: ExportReference[];
  componentDefinitions: string[];
  componentUsages: string[];
  discoveredRoutes: string[];
  isEntryPoint: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  importSource: string;
}

export interface DependencyGraphSummary {
  edges: DependencyEdge[];
  adjacency: Record<string, string[]>;
  incomingCount: Record<string, number>;
  circularDependencies: string[][];
  orphanFiles: string[];
  highDependencyFiles: Array<{ file: string; incoming: number }>;
}

export interface ComponentRelationshipSummary {
  parentToChildren: Record<string, string[]>;
  componentUsageCount: Record<string, number>;
  sharedComponents: string[];
}

export interface RouteDiscoverySummary {
  routes: Array<{ file: string; route: string }>;
  entryPoints: string[];
  featureBoundaries: string[];
}

export interface RepositoryScanStats {
  totalFilesDiscovered: number;
  filesIndexed: number;
  filesReindexed: number;
  filesRemoved: number;
  foldersDiscovered: number;
  durationMs: number;
}

export interface RepositoryScanResult {
  rootPath: string;
  scannedAt: string;
  stats: RepositoryScanStats;
}

export interface RepositorySnapshot {
  rootPath: string | null;
  scannedAt: string | null;
  files: RepositoryFileRecord[];
  folders: string[];
  symbols: RepositorySymbol[];
  dependencies: DependencyGraphSummary;
  components: ComponentRelationshipSummary;
  routes: RouteDiscoverySummary;
}

export interface ParsedFileMetadata {
  symbols: RepositorySymbol[];
  imports: ImportReference[];
  exports: ExportReference[];
  componentDefinitions: string[];
  componentUsages: string[];
  discoveredRoutes: string[];
  isEntryPoint: boolean;
}
