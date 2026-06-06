export interface RepositoryFileRecord {
  path: string;
  extension: string;
  size: number;
  mtimeMs: number;
  hash: string;
}

export interface RepositoryFilesResponse {
  rootPath: string | null;
  scannedAt: string | null;
  files: RepositoryFileRecord[];
  folders: string[];
}

export interface RepositoryScanResponse {
  rootPath: string;
  scannedAt: string;
  stats: {
    totalFilesDiscovered: number;
    filesIndexed: number;
    filesReindexed: number;
    filesRemoved: number;
    foldersDiscovered: number;
    durationMs: number;
  };
}

export interface RepositoryFileContentResponse {
  path: string;
  content: string;
  hash: string;
  mtimeMs: number;
}

export interface RepositorySymbol {
  id: string;
  name: string;
  type: "function" | "component" | "class" | "interface" | "type" | "variable";
  sourceFile: string;
  isExported: boolean;
  relationships: string[];
}

export interface RepositorySymbolsResponse {
  rootPath: string | null;
  scannedAt: string | null;
  symbols: RepositorySymbol[];
}

export interface RepositoryComponentsResponse {
  rootPath: string | null;
  scannedAt: string | null;
  components: {
    parentToChildren: Record<string, string[]>;
    componentUsageCount: Record<string, number>;
    sharedComponents: string[];
  };
  routes: {
    routes: Array<{ file: string; route: string }>;
    entryPoints: string[];
    featureBoundaries: string[];
  };
}
