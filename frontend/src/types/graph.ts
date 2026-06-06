export type GraphKind = "files" | "components" | "routes" | "modules";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  groupId?: string;
  clusterId?: string;
  filePath?: string;
  symbol?: string;
  route?: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  label?: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface GraphGroup {
  id: string;
  label: string;
  nodeIds: string[];
  collapsed: boolean;
}

export interface GraphCluster {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface GraphPayload {
  kind: GraphKind;
  rootPath: string | null;
  scannedAt: string | null;
  layout: {
    type: "layered" | "force" | "hierarchical";
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  clusters: GraphCluster[];
  page: {
    totalNodes: number;
    totalEdges: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}
