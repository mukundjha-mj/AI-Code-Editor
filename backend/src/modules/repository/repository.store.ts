import type {
  ComponentRelationshipSummary,
  DependencyGraphSummary,
  RepositoryFileRecord,
  RepositorySnapshot,
  RepositorySymbol,
  RouteDiscoverySummary,
} from "./repository.types";

export interface RepositoryMetadataStore {
  setRootPath(rootPath: string): void;
  getRootPath(): string | null;
  setScannedAt(scannedAtIso: string): void;
  getScannedAt(): string | null;
  upsertFile(file: RepositoryFileRecord): void;
  removeFile(path: string): void;
  getFile(path: string): RepositoryFileRecord | undefined;
  getFiles(): RepositoryFileRecord[];
  replaceFolders(folders: string[]): void;
  getFolders(): string[];
  setDerivedData(input: {
    symbols: RepositorySymbol[];
    dependencies: DependencyGraphSummary;
    components: ComponentRelationshipSummary;
    routes: RouteDiscoverySummary;
  }): void;
  snapshot(): RepositorySnapshot;
}

const emptyDependencies: DependencyGraphSummary = {
  edges: [],
  adjacency: {},
  incomingCount: {},
  circularDependencies: [],
  orphanFiles: [],
  highDependencyFiles: [],
};

const emptyComponents: ComponentRelationshipSummary = {
  parentToChildren: {},
  componentUsageCount: {},
  sharedComponents: [],
};

const emptyRoutes: RouteDiscoverySummary = {
  routes: [],
  entryPoints: [],
  featureBoundaries: [],
};

export class InMemoryRepositoryMetadataStore implements RepositoryMetadataStore {
  private rootPath: string | null = null;
  private scannedAt: string | null = null;
  private readonly files = new Map<string, RepositoryFileRecord>();
  private folders: string[] = [];
  private symbols: RepositorySymbol[] = [];
  private dependencies: DependencyGraphSummary = emptyDependencies;
  private components: ComponentRelationshipSummary = emptyComponents;
  private routes: RouteDiscoverySummary = emptyRoutes;

  setRootPath(rootPath: string): void {
    this.rootPath = rootPath;
  }

  getRootPath(): string | null {
    return this.rootPath;
  }

  setScannedAt(scannedAtIso: string): void {
    this.scannedAt = scannedAtIso;
  }

  getScannedAt(): string | null {
    return this.scannedAt;
  }

  upsertFile(file: RepositoryFileRecord): void {
    this.files.set(file.path, file);
  }

  removeFile(path: string): void {
    this.files.delete(path);
  }

  getFile(path: string): RepositoryFileRecord | undefined {
    return this.files.get(path);
  }

  getFiles(): RepositoryFileRecord[] {
    return [...this.files.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  replaceFolders(folders: string[]): void {
    this.folders = [...folders].sort((a, b) => a.localeCompare(b));
  }

  getFolders(): string[] {
    return [...this.folders];
  }

  setDerivedData(input: {
    symbols: RepositorySymbol[];
    dependencies: DependencyGraphSummary;
    components: ComponentRelationshipSummary;
    routes: RouteDiscoverySummary;
  }): void {
    this.symbols = [...input.symbols];
    this.dependencies = input.dependencies;
    this.components = input.components;
    this.routes = input.routes;
  }

  snapshot(): RepositorySnapshot {
    return {
      rootPath: this.rootPath,
      scannedAt: this.scannedAt,
      files: this.getFiles(),
      folders: this.getFolders(),
      symbols: [...this.symbols],
      dependencies: this.dependencies,
      components: this.components,
      routes: this.routes,
    };
  }
}
