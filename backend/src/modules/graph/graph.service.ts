import type { RepositorySnapshot } from "../repository/repository.types";
import type { RepositoryIntelligenceService } from "../repository/repository-intelligence.service";
import type {
  GraphCluster,
  GraphEdge,
  GraphGroup,
  GraphNode,
  GraphPayload,
  GraphQueryOptions,
} from "./graph.types";

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 1000;

const uniqueSorted = (items: Iterable<string>) => [...new Set(items)].sort((a, b) => a.localeCompare(b));

const firstPathSegment = (pathValue: string) => pathValue.split("/").filter(Boolean)[0] ?? "(root)";

const clampLimit = (limit?: number) => Math.max(1, Math.min(MAX_LIMIT, limit ?? DEFAULT_LIMIT));

const normalizeQuery = (query?: string) => query?.trim().toLowerCase() ?? "";

const nodeMatchesQuery = (node: GraphNode, query: string) => {
  if (!query) {
    return true;
  }
  if (node.label.toLowerCase().includes(query) || node.id.toLowerCase().includes(query)) {
    return true;
  }
  return Object.values(node.metadata).some((value) => String(value ?? "").toLowerCase().includes(query));
};

const withFocusContext = (allNodes: GraphNode[], allEdges: GraphEdge[], focusNodeId?: string) => {
  if (!focusNodeId) {
    return {
      nodes: allNodes,
      edges: allEdges,
    };
  }

  const neighboringNodeIds = new Set<string>([focusNodeId]);
  for (const edge of allEdges) {
    if (edge.from === focusNodeId) {
      neighboringNodeIds.add(edge.to);
    }
    if (edge.to === focusNodeId) {
      neighboringNodeIds.add(edge.from);
    }
  }

  const focusedNodes = allNodes.filter((node) => neighboringNodeIds.has(node.id));
  const focusedEdges = allEdges.filter(
    (edge) => neighboringNodeIds.has(edge.from) && neighboringNodeIds.has(edge.to),
  );

  return {
    nodes: focusedNodes,
    edges: focusedEdges,
  };
};

const pageGraph = (
  payload: Omit<GraphPayload, "page">,
  options: GraphQueryOptions,
  allNodesCount: number,
  allEdgesCount: number,
): GraphPayload => {
  const offset = Math.max(0, options.offset ?? 0);
  const limit = clampLimit(options.limit);
  const pagedNodes = payload.nodes.slice(offset, offset + limit);
  const pagedNodeIds = new Set(pagedNodes.map((node) => node.id));
  const pagedEdges = payload.edges.filter((edge) => pagedNodeIds.has(edge.from) && pagedNodeIds.has(edge.to));
  const pagedGroups = payload.groups
    .map((group) => ({
      ...group,
      nodeIds: group.nodeIds.filter((nodeId) => pagedNodeIds.has(nodeId)),
    }))
    .filter((group) => group.nodeIds.length > 0);
  const pagedClusters = payload.clusters
    .map((cluster) => ({
      ...cluster,
      nodeIds: cluster.nodeIds.filter((nodeId) => pagedNodeIds.has(nodeId)),
    }))
    .filter((cluster) => cluster.nodeIds.length > 0);

  return {
    ...payload,
    nodes: pagedNodes,
    edges: pagedEdges,
    groups: pagedGroups,
    clusters: pagedClusters,
    page: {
      totalNodes: allNodesCount,
      totalEdges: allEdgesCount,
      offset,
      limit,
      hasMore: offset + pagedNodes.length < allNodesCount,
    },
  };
};

export class GraphService {
  constructor(private readonly repositoryService: RepositoryIntelligenceService) {}

  getFileGraph(options: GraphQueryOptions = {}): GraphPayload {
    const snapshot = this.repositoryService.getSnapshot();
    const fileNodes: GraphNode[] = snapshot.files.map((file) => ({
      id: `file:${file.path}`,
      label: file.path,
      type: "file",
      groupId: `folder:${firstPathSegment(file.path)}`,
      clusterId: `extension:${file.extension}`,
      filePath: file.path,
      metadata: {
        extension: file.extension,
        size: file.size,
        imports: file.imports.length,
        exports: file.exports.length,
      },
    }));
    const nodeByPath = new Map(fileNodes.map((node) => [node.filePath, node] as const));

    const edges: GraphEdge[] = [];
    for (const dependency of snapshot.dependencies.edges) {
      const fromNode = nodeByPath.get(dependency.from);
      const toNode = nodeByPath.get(dependency.to);
      if (!fromNode || !toNode) {
        continue;
      }
      edges.push({
        id: `dep:${dependency.from}->${dependency.to}`,
        from: fromNode.id,
        to: toNode.id,
        type: "imports",
        label: dependency.importSource,
        metadata: {
          importSource: dependency.importSource,
        },
      });
    }

    const groups = this.buildGroupsFromNodes(fileNodes, "folder:");
    const clusters = this.buildClustersFromNodes(fileNodes, "extension:");
    const filtered = this.filterGraph(fileNodes, edges, groups, clusters, options, snapshot);

    return pageGraph(
      {
        kind: "files",
        rootPath: snapshot.rootPath,
        scannedAt: snapshot.scannedAt,
        layout: { type: "force" },
        nodes: filtered.nodes,
        edges: filtered.edges,
        groups: filtered.groups,
        clusters: filtered.clusters,
      },
      options,
      filtered.totalNodes,
      filtered.totalEdges,
    );
  }

  getComponentGraph(options: GraphQueryOptions = {}): GraphPayload {
    const snapshot = this.repositoryService.getSnapshot();
    const componentSymbolByName = new Map(
      snapshot.symbols
        .filter((symbol) => symbol.type === "component")
        .map((symbol) => [symbol.name, symbol] as const),
    );
    const componentNames = uniqueSorted([
      ...Object.keys(snapshot.components.parentToChildren),
      ...Object.values(snapshot.components.parentToChildren).flat(),
    ]);

    const nodes: GraphNode[] = componentNames.map((componentName) => {
      const symbol = componentSymbolByName.get(componentName);
      const usage = snapshot.components.componentUsageCount[componentName] ?? 0;
      const sourceFile = symbol?.sourceFile ?? null;
      return {
        id: `component:${componentName}`,
        label: componentName,
        type: "component",
        groupId: sourceFile ? `folder:${firstPathSegment(sourceFile)}` : "folder:unknown",
        clusterId: usage > 1 ? "cluster:shared" : "cluster:single",
        filePath: sourceFile ?? undefined,
        symbol: componentName,
        metadata: {
          usageCount: usage,
          shared: usage > 1,
          sourceFile,
        },
      };
    });

    const edges: GraphEdge[] = [];
    for (const [parent, children] of Object.entries(snapshot.components.parentToChildren)) {
      for (const child of children) {
        edges.push({
          id: `render:${parent}->${child}`,
          from: `component:${parent}`,
          to: `component:${child}`,
          type: "renders",
          metadata: {},
        });
      }
    }

    const groups = this.buildGroupsFromNodes(nodes, "folder:");
    const clusters = this.buildClustersFromNodes(nodes, "cluster:");
    const filtered = this.filterGraph(nodes, edges, groups, clusters, options, snapshot);

    return pageGraph(
      {
        kind: "components",
        rootPath: snapshot.rootPath,
        scannedAt: snapshot.scannedAt,
        layout: { type: "hierarchical" },
        nodes: filtered.nodes,
        edges: filtered.edges,
        groups: filtered.groups,
        clusters: filtered.clusters,
      },
      options,
      filtered.totalNodes,
      filtered.totalEdges,
    );
  }

  getRouteGraph(options: GraphQueryOptions = {}): GraphPayload {
    const snapshot = this.repositoryService.getSnapshot();
    const routeNodes: GraphNode[] = snapshot.routes.routes.map((entry) => ({
      id: `route:${entry.route}:${entry.file}`,
      label: entry.route,
      type: "route",
      groupId: `boundary:${firstPathSegment(entry.file)}`,
      clusterId: "cluster:route",
      filePath: entry.file,
      route: entry.route,
      metadata: {
        file: entry.file,
      },
    }));
    const entryNodes: GraphNode[] = snapshot.routes.entryPoints.map((entryFile) => ({
      id: `entry:${entryFile}`,
      label: entryFile,
      type: "entrypoint",
      groupId: `boundary:${firstPathSegment(entryFile)}`,
      clusterId: "cluster:entrypoint",
      filePath: entryFile,
      metadata: {},
    }));
    const boundaryNodes: GraphNode[] = snapshot.routes.featureBoundaries.map((boundary) => ({
      id: `boundary:${boundary}`,
      label: boundary,
      type: "boundary",
      groupId: "boundary:overview",
      clusterId: "cluster:boundary",
      metadata: {},
    }));

    const nodes = [...routeNodes, ...entryNodes, ...boundaryNodes];
    const edges: GraphEdge[] = [];

    for (const entryNode of entryNodes) {
      for (const routeNode of routeNodes) {
        if (routeNode.filePath === entryNode.filePath) {
          edges.push({
            id: `entry-route:${entryNode.id}->${routeNode.id}`,
            from: entryNode.id,
            to: routeNode.id,
            type: "entry-to-route",
            metadata: {},
          });
        }
      }
    }

    for (const boundaryNode of boundaryNodes) {
      for (const routeNode of routeNodes) {
        if (routeNode.filePath?.startsWith(`${boundaryNode.label}/`)) {
          edges.push({
            id: `boundary-route:${boundaryNode.id}->${routeNode.id}`,
            from: boundaryNode.id,
            to: routeNode.id,
            type: "contains",
            metadata: {},
          });
        }
      }
    }

    const groups = this.buildGroupsFromNodes(nodes, "boundary:");
    const clusters = this.buildClustersFromNodes(nodes, "cluster:");
    const filtered = this.filterGraph(nodes, edges, groups, clusters, options, snapshot);

    return pageGraph(
      {
        kind: "routes",
        rootPath: snapshot.rootPath,
        scannedAt: snapshot.scannedAt,
        layout: { type: "layered" },
        nodes: filtered.nodes,
        edges: filtered.edges,
        groups: filtered.groups,
        clusters: filtered.clusters,
      },
      options,
      filtered.totalNodes,
      filtered.totalEdges,
    );
  }

  getModuleGraph(options: GraphQueryOptions = {}): GraphPayload {
    const snapshot = this.repositoryService.getSnapshot();
    const moduleStats = new Map<string, { files: number; components: number; routes: number }>();

    for (const file of snapshot.files) {
      const moduleName = firstPathSegment(file.path);
      const stats = moduleStats.get(moduleName) ?? { files: 0, components: 0, routes: 0 };
      stats.files += 1;
      stats.components += file.componentDefinitions.length;
      stats.routes += file.discoveredRoutes.length;
      moduleStats.set(moduleName, stats);
    }

    const nodes: GraphNode[] = [...moduleStats.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([moduleName, stats]) => ({
        id: `module:${moduleName}`,
        label: moduleName,
        type: "module",
        groupId: "modules:all",
        clusterId: stats.files > 40 ? "cluster:large" : "cluster:normal",
        metadata: {
          files: stats.files,
          components: stats.components,
          routes: stats.routes,
        },
      }));

    const nodeByModule = new Map(nodes.map((node) => [node.label, node] as const));
    const edgeWeights = new Map<string, number>();

    for (const dependency of snapshot.dependencies.edges) {
      const fromModule = firstPathSegment(dependency.from);
      const toModule = firstPathSegment(dependency.to);
      if (fromModule === toModule) {
        continue;
      }
      const key = `${fromModule}->${toModule}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    }

    const edges: GraphEdge[] = [...edgeWeights.entries()].map(([key, weight]) => {
      const [fromModule = "(root)", toModule = "(root)"] = key.split("->");
      return {
        id: `module-edge:${key}`,
        from: nodeByModule.get(fromModule)?.id ?? `module:${fromModule}`,
        to: nodeByModule.get(toModule)?.id ?? `module:${toModule}`,
        type: "module-dependency",
        label: String(weight),
        metadata: {
          weight,
        },
      };
    });

    const groups = this.buildGroupsFromNodes(nodes, "modules:");
    const clusters = this.buildClustersFromNodes(nodes, "cluster:");
    const filtered = this.filterGraph(nodes, edges, groups, clusters, options, snapshot);

    return pageGraph(
      {
        kind: "modules",
        rootPath: snapshot.rootPath,
        scannedAt: snapshot.scannedAt,
        layout: { type: "force" },
        nodes: filtered.nodes,
        edges: filtered.edges,
        groups: filtered.groups,
        clusters: filtered.clusters,
      },
      options,
      filtered.totalNodes,
      filtered.totalEdges,
    );
  }

  private filterGraph(
    nodes: GraphNode[],
    edges: GraphEdge[],
    groups: GraphGroup[],
    clusters: GraphCluster[],
    options: GraphQueryOptions,
    snapshot: RepositorySnapshot,
  ) {
    const query = normalizeQuery(options.query);
    const queryFilteredNodes = query ? nodes.filter((node) => nodeMatchesQuery(node, query)) : nodes;
    const queryNodeIds = new Set(queryFilteredNodes.map((node) => node.id));
    const queryFilteredEdges = edges.filter((edge) => queryNodeIds.has(edge.from) || queryNodeIds.has(edge.to));
    const focused = withFocusContext(queryFilteredNodes, queryFilteredEdges, options.focusNodeId);

    return {
      nodes: focused.nodes.sort((a, b) => a.label.localeCompare(b.label)),
      edges: focused.edges.sort((a, b) => a.id.localeCompare(b.id)),
      groups,
      clusters,
      totalNodes: queryFilteredNodes.length,
      totalEdges: queryFilteredEdges.length,
      rootPath: snapshot.rootPath,
    };
  }

  private buildGroupsFromNodes(nodes: GraphNode[], prefix: string): GraphGroup[] {
    const grouped = new Map<string, Set<string>>();
    for (const node of nodes) {
      if (!node.groupId || !node.groupId.startsWith(prefix)) {
        continue;
      }
      if (!grouped.has(node.groupId)) {
        grouped.set(node.groupId, new Set());
      }
      grouped.get(node.groupId)?.add(node.id);
    }

    return [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, nodeIds]) => ({
        id,
        label: id.slice(prefix.length) || id,
        nodeIds: [...nodeIds].sort((a, b) => a.localeCompare(b)),
        collapsed: false,
      }));
  }

  private buildClustersFromNodes(nodes: GraphNode[], prefix: string): GraphCluster[] {
    const clustered = new Map<string, Set<string>>();
    for (const node of nodes) {
      if (!node.clusterId || !node.clusterId.startsWith(prefix)) {
        continue;
      }
      if (!clustered.has(node.clusterId)) {
        clustered.set(node.clusterId, new Set());
      }
      clustered.get(node.clusterId)?.add(node.id);
    }

    return [...clustered.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, nodeIds]) => ({
        id,
        label: id.slice(prefix.length) || id,
        nodeIds: [...nodeIds].sort((a, b) => a.localeCompare(b)),
      }));
  }
}
