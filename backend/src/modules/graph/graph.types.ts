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

export interface GraphLayout {
  type: "layered" | "force" | "hierarchical";
}

export interface GraphPage {
  totalNodes: number;
  totalEdges: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface GraphPayload {
  kind: GraphKind;
  rootPath: string | null;
  scannedAt: string | null;
  layout: GraphLayout;
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  clusters: GraphCluster[];
  page: GraphPage;
}

export interface GraphQueryOptions {
  query?: string;
  focusNodeId?: string;
  offset?: number;
  limit?: number;
}
