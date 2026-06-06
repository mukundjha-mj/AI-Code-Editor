import path from "node:path";
import { AstParser } from "./ast-parser";
import {
  InMemoryRepositoryMetadataStore,
  type RepositoryMetadataStore,
} from "./repository.store";
import { RepositoryScanner } from "./repository-scanner";
import type {
  ComponentRelationshipSummary,
  DependencyEdge,
  DependencyGraphSummary,
  RepositoryFileRecord,
  RepositoryScanResult,
  RepositorySnapshot,
  RepositorySymbol,
} from "./repository.types";

interface ScanOptions {
  rootPath?: string;
  watch?: boolean;
}

const resolveDefaultRoot = () => {
  const cwd = process.cwd();
  const currentFolder = path.basename(cwd).toLowerCase();
  if (currentFolder === "backend") {
    return path.resolve(cwd, "..");
  }
  return cwd;
};

const toPosix = (value: string) => value.split(path.sep).join("/");

const normalizeRootPath = (inputPath?: string) => {
  if (!inputPath || inputPath.trim().length === 0) {
    return resolveDefaultRoot();
  }
  return path.resolve(inputPath.trim());
};

const supportedImportExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];

const buildEmptyDependencySummary = (): DependencyGraphSummary => ({
  edges: [],
  adjacency: {},
  incomingCount: {},
  circularDependencies: [],
  orphanFiles: [],
  highDependencyFiles: [],
});

const resolveImportToFile = (
  importerRelativePath: string,
  importSource: string,
  filePaths: Set<string>,
): string | null => {
  if (!importSource.startsWith(".")) {
    return null;
  }

  const importerDir = path.posix.dirname(importerRelativePath);
  const base = path.posix.normalize(path.posix.join(importerDir, importSource));
  const candidates = [base];
  for (const extension of supportedImportExtensions) {
    candidates.push(`${base}${extension}`);
    candidates.push(path.posix.join(base, `index${extension}`));
  }

  for (const candidate of candidates) {
    if (filePaths.has(candidate)) {
      return candidate;
    }
  }

  return null;
};

const uniqueSorted = (values: Iterable<string>) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export class RepositoryIntelligenceService {
  private readonly parser: AstParser;
  private readonly scanner: RepositoryScanner;
  private readonly store: RepositoryMetadataStore;

  constructor(input?: {
    parser?: AstParser;
    scanner?: RepositoryScanner;
    store?: RepositoryMetadataStore;
  }) {
    this.parser = input?.parser ?? new AstParser();
    this.scanner = input?.scanner ?? new RepositoryScanner();
    this.store = input?.store ?? new InMemoryRepositoryMetadataStore();
  }

  async scanRepository(options: ScanOptions = {}): Promise<RepositoryScanResult> {
    const startedAt = Date.now();
    const rootPath = normalizeRootPath(options.rootPath);
    const discovery = await this.scanner.discover(rootPath);
    const discoveredByPath = new Map(discovery.files.map((item) => [item.relativePath, item]));
    const existingFiles = this.store.getFiles();
    const existingByPath = new Map(existingFiles.map((file) => [file.path, file]));

    let filesIndexed = 0;
    let filesReindexed = 0;

    for (const file of discovery.files) {
      const previous = existingByPath.get(file.relativePath);
      const unchanged =
        previous && previous.mtimeMs === file.stats.mtimeMs && previous.size === file.stats.size;

      if (unchanged) {
        continue;
      }

      const content = await this.scanner.readFile(file.absolutePath);
      const parsed = this.parser.parse(file.relativePath, file.extension, content);
      const hash = this.scanner.computeHash(content);

      const nextRecord: RepositoryFileRecord = {
        path: file.relativePath,
        extension: file.extension,
        size: file.stats.size,
        mtimeMs: file.stats.mtimeMs,
        hash,
        symbols: parsed.symbols,
        imports: parsed.imports,
        exports: parsed.exports,
        componentDefinitions: parsed.componentDefinitions,
        componentUsages: parsed.componentUsages,
        discoveredRoutes: parsed.discoveredRoutes,
        isEntryPoint: parsed.isEntryPoint,
      };

      this.store.upsertFile(nextRecord);
      if (previous) {
        filesReindexed += 1;
      } else {
        filesIndexed += 1;
      }
    }

    let filesRemoved = 0;
    for (const existing of existingFiles) {
      if (!discoveredByPath.has(existing.path)) {
        this.store.removeFile(existing.path);
        filesRemoved += 1;
      }
    }

    this.store.setRootPath(rootPath);
    this.store.replaceFolders(discovery.folders);
    this.rebuildDerivedIndexes();

    const scannedAt = new Date().toISOString();
    this.store.setScannedAt(scannedAt);

    if (options.watch ?? true) {
      this.scanner.startWatching(rootPath, async (relativePath) => {
        await this.handleFileChange(rootPath, relativePath);
      });
    } else {
      this.scanner.stopWatching();
    }

    return {
      rootPath,
      scannedAt,
      stats: {
        totalFilesDiscovered: discovery.files.length,
        filesIndexed,
        filesReindexed,
        filesRemoved,
        foldersDiscovered: discovery.folders.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  getSnapshot(): RepositorySnapshot {
    return this.store.snapshot();
  }

  getFiles() {
    const snapshot = this.getSnapshot();
    return {
      rootPath: snapshot.rootPath,
      scannedAt: snapshot.scannedAt,
      files: snapshot.files,
      folders: snapshot.folders,
    };
  }

  getSymbols(filters?: { name?: string; type?: string; file?: string }) {
    const snapshot = this.getSnapshot();
    let symbols = snapshot.symbols;

    if (filters?.name) {
      const lower = filters.name.toLowerCase();
      symbols = symbols.filter((symbol) => symbol.name.toLowerCase().includes(lower));
    }
    if (filters?.type) {
      symbols = symbols.filter((symbol) => symbol.type === filters.type);
    }
    if (filters?.file) {
      symbols = symbols.filter((symbol) => symbol.sourceFile === filters.file);
    }

    return {
      rootPath: snapshot.rootPath,
      scannedAt: snapshot.scannedAt,
      symbols,
    };
  }

  getDependencies() {
    const snapshot = this.getSnapshot();
    return {
      rootPath: snapshot.rootPath,
      scannedAt: snapshot.scannedAt,
      dependencies: snapshot.dependencies,
    };
  }

  getComponents() {
    const snapshot = this.getSnapshot();
    return {
      rootPath: snapshot.rootPath,
      scannedAt: snapshot.scannedAt,
      components: snapshot.components,
      routes: snapshot.routes,
    };
  }

  getRelatedFiles(filePath: string) {
    const snapshot = this.getSnapshot();
    const outgoing = new Set(snapshot.dependencies.adjacency[filePath] ?? []);
    for (const [candidate, dependencies] of Object.entries(snapshot.dependencies.adjacency)) {
      if (dependencies.includes(filePath)) {
        outgoing.add(candidate);
      }
    }
    return uniqueSorted(outgoing);
  }

  getRelatedSymbols(name: string): RepositorySymbol[] {
    const lower = name.toLowerCase();
    const snapshot = this.getSnapshot();
    return snapshot.symbols.filter((symbol) => symbol.name.toLowerCase().includes(lower));
  }

  getDependencyChain(fromFile: string, toFile: string, maxDepth = 10): string[] {
    const snapshot = this.getSnapshot();
    const adjacency = snapshot.dependencies.adjacency;
    const queue: Array<{ path: string; chain: string[]; depth: number }> = [
      { path: fromFile, chain: [fromFile], depth: 0 },
    ];
    const visited = new Set<string>([fromFile]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      if (current.path === toFile) {
        return current.chain;
      }

      if (current.depth >= maxDepth) {
        continue;
      }

      for (const next of adjacency[current.path] ?? []) {
        if (visited.has(next)) {
          continue;
        }
        visited.add(next);
        queue.push({
          path: next,
          chain: [...current.chain, next],
          depth: current.depth + 1,
        });
      }
    }

    return [];
  }

  getComponentTree(componentName: string) {
    const snapshot = this.getSnapshot();
    const relationships = snapshot.components.parentToChildren;

    const expand = (name: string, seen = new Set<string>()): { name: string; children: unknown[] } => {
      if (seen.has(name)) {
        return { name, children: [] };
      }
      const nextSeen = new Set(seen);
      nextSeen.add(name);
      return {
        name,
        children: (relationships[name] ?? []).map((child) => expand(child, nextSeen)),
      };
    };

    return expand(componentName);
  }

  private async handleFileChange(rootPath: string, relativePath: string): Promise<void> {
    const absolutePath = path.join(rootPath, relativePath);
    const stillExists = await this.scanner.exists(absolutePath);

    if (!stillExists) {
      this.store.removeFile(toPosix(relativePath));
      this.rebuildDerivedIndexes();
      this.store.setScannedAt(new Date().toISOString());
      return;
    }

    const content = await this.scanner.readFile(absolutePath);
    const extension = path.extname(relativePath);
    if (extension.length === 0) {
      return;
    }

    const parsed = this.parser.parse(
      toPosix(relativePath),
      extension as RepositoryFileRecord["extension"],
      content,
    );
    const stat = await Bun.file(absolutePath).stat();
    if (!stat) {
      return;
    }

    this.store.upsertFile({
      path: toPosix(relativePath),
      extension: extension as RepositoryFileRecord["extension"],
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      hash: this.scanner.computeHash(content),
      symbols: parsed.symbols,
      imports: parsed.imports,
      exports: parsed.exports,
      componentDefinitions: parsed.componentDefinitions,
      componentUsages: parsed.componentUsages,
      discoveredRoutes: parsed.discoveredRoutes,
      isEntryPoint: parsed.isEntryPoint,
    });

    this.rebuildDerivedIndexes();
    this.store.setScannedAt(new Date().toISOString());
  }

  private rebuildDerivedIndexes(): void {
    const files = this.store.getFiles();
    const symbolIndex = files.flatMap((file) =>
      file.symbols.map((symbol) => ({
        ...symbol,
        relationships: uniqueSorted([
          ...symbol.relationships,
          ...file.imports.map((entry) => entry.source),
          ...file.exports.map((entry) => entry.name),
        ]),
      })),
    );

    const dependencies = this.buildDependencyGraph(files);
    const components = this.buildComponentRelationships(files, symbolIndex);
    const routes = this.buildRouteDiscovery(files);

    this.store.setDerivedData({
      symbols: symbolIndex,
      dependencies,
      components,
      routes,
    });
  }

  private buildDependencyGraph(files: RepositoryFileRecord[]): DependencyGraphSummary {
    if (files.length === 0) {
      return buildEmptyDependencySummary();
    }

    const filePaths = new Set(files.map((file) => toPosix(file.path)));
    const edges: DependencyEdge[] = [];
    const adjacency = new Map<string, Set<string>>();
    const incoming = new Map<string, number>();

    for (const file of files) {
      const from = toPosix(file.path);
      if (!adjacency.has(from)) {
        adjacency.set(from, new Set());
      }
      if (!incoming.has(from)) {
        incoming.set(from, 0);
      }

      for (const imported of file.imports) {
        const resolved = resolveImportToFile(from, imported.source, filePaths);
        if (!resolved) {
          continue;
        }

        adjacency.get(from)?.add(resolved);
        incoming.set(resolved, (incoming.get(resolved) ?? 0) + 1);
        edges.push({
          from,
          to: resolved,
          importSource: imported.source,
        });
      }
    }

    const adjacencyObject: Record<string, string[]> = {};
    for (const [file, dependencies] of adjacency.entries()) {
      adjacencyObject[file] = uniqueSorted(dependencies);
    }

    const incomingCountObject: Record<string, number> = {};
    for (const file of filePaths) {
      incomingCountObject[file] = incoming.get(file) ?? 0;
    }

    const circularDependencies = this.findCircularDependencies(adjacencyObject);
    const orphanFiles = [...filePaths].filter(
      (file) => (adjacencyObject[file]?.length ?? 0) === 0 && (incomingCountObject[file] ?? 0) === 0,
    );
    const highDependencyFiles = [...filePaths]
      .map((file) => ({ file, incoming: incomingCountObject[file] ?? 0 }))
      .filter((entry) => entry.incoming > 0)
      .sort((a, b) => b.incoming - a.incoming || a.file.localeCompare(b.file))
      .slice(0, 20);

    return {
      edges,
      adjacency: adjacencyObject,
      incomingCount: incomingCountObject,
      circularDependencies,
      orphanFiles: uniqueSorted(orphanFiles),
      highDependencyFiles,
    };
  }

  private findCircularDependencies(adjacency: Record<string, string[]>): string[][] {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];
    const cycles = new Set<string>();

    const dfs = (node: string) => {
      visited.add(node);
      inStack.add(node);
      stack.push(node);

      for (const neighbor of adjacency[node] ?? []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
          continue;
        }

        if (!inStack.has(neighbor)) {
          continue;
        }

        const cycleStart = stack.indexOf(neighbor);
        if (cycleStart === -1) {
          continue;
        }

        const cycle = stack.slice(cycleStart);
        cycle.push(neighbor);
        cycles.add(cycle.join(" -> "));
      }

      stack.pop();
      inStack.delete(node);
    };

    for (const node of Object.keys(adjacency)) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return [...cycles]
      .sort((a, b) => a.localeCompare(b))
      .map((cycle) => cycle.split(" -> "));
  }

  private buildComponentRelationships(
    files: RepositoryFileRecord[],
    symbols: RepositorySymbol[],
  ): ComponentRelationshipSummary {
    const componentToFile = new Map(
      symbols.filter((symbol) => symbol.type === "component").map((symbol) => [symbol.name, symbol.sourceFile]),
    );

    const parentToChildren = new Map<string, Set<string>>();
    const usageCount = new Map<string, number>();

    for (const file of files) {
      const parentComponents = file.componentDefinitions;
      if (parentComponents.length === 0) {
        continue;
      }

      const children = uniqueSorted(
        file.componentUsages.filter(
          (component) => componentToFile.has(component) && !parentComponents.includes(component),
        ),
      );
      if (children.length === 0) {
        continue;
      }

      for (const parent of parentComponents) {
        if (!parentToChildren.has(parent)) {
          parentToChildren.set(parent, new Set());
        }
        for (const child of children) {
          parentToChildren.get(parent)?.add(child);
          usageCount.set(child, (usageCount.get(child) ?? 0) + 1);
        }
      }
    }

    const parentToChildrenObject: Record<string, string[]> = {};
    for (const [parent, children] of parentToChildren.entries()) {
      parentToChildrenObject[parent] = uniqueSorted(children);
    }

    const componentUsageCount: Record<string, number> = {};
    for (const [component, count] of usageCount.entries()) {
      componentUsageCount[component] = count;
    }

    const sharedComponents = [...usageCount.entries()]
      .filter(([, count]) => count > 1)
      .map(([component]) => component)
      .sort((a, b) => a.localeCompare(b));

    return {
      parentToChildren: parentToChildrenObject,
      componentUsageCount,
      sharedComponents,
    };
  }

  private buildRouteDiscovery(files: RepositoryFileRecord[]) {
    const routes = files.flatMap((file) =>
      file.discoveredRoutes.map((route) => ({
        file: file.path,
        route,
      })),
    );
    const entryPoints = uniqueSorted(files.filter((file) => file.isEntryPoint).map((file) => file.path));

    const featureBoundaries = uniqueSorted(
      files
        .map((file) => file.path.split("/"))
        .filter((parts) => parts.length > 1)
        .map((parts) => `${parts[0]}/${parts[1]}`),
    );

    return {
      routes,
      entryPoints,
      featureBoundaries,
    };
  }
}
