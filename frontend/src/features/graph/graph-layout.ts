import type { GraphEdge, GraphNode } from "../../types/graph";

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;
const X_GAP = 72;
const Y_GAP = 28;

const buildDegreeMap = (nodes: GraphNode[], edges: GraphEdge[]) => {
  const degrees = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
  }
  return degrees;
};

const layoutLayered = (nodes: GraphNode[]): PositionedNode[] => {
  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const key = node.groupId ?? "ungrouped";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(node);
  }

  const result: PositionedNode[] = [];
  let groupIndex = 0;
  for (const [, groupNodes] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...groupNodes].sort((a, b) => a.label.localeCompare(b.label));
    sorted.forEach((node, index) => {
      result.push({
        ...node,
        x: groupIndex * (NODE_WIDTH + X_GAP),
        y: index * (NODE_HEIGHT + Y_GAP),
      });
    });
    groupIndex += 1;
  }
  return result;
};

const layoutHierarchical = (nodes: GraphNode[], edges: GraphEdge[]): PositionedNode[] => {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const layers = new Map<number, GraphNode[]>();
  const queue = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);
  const visited = new Set<string>();
  let depth = 0;
  let frontier = queue;

  while (frontier.length > 0) {
    layers.set(depth, frontier);
    const next: GraphNode[] = [];
    for (const node of frontier) {
      visited.add(node.id);
      for (const edge of edges) {
        if (edge.from !== node.id) {
          continue;
        }
        const target = nodes.find((candidate) => candidate.id === edge.to);
        if (target && !visited.has(target.id) && !next.some((item) => item.id === target.id)) {
          next.push(target);
        }
      }
    }
    frontier = next;
    depth += 1;
  }

  const remaining = nodes.filter((node) => !visited.has(node.id));
  if (remaining.length > 0) {
    layers.set(depth, remaining);
  }

  const positioned: PositionedNode[] = [];
  for (const [layerIndex, layerNodes] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...layerNodes].sort((a, b) => a.label.localeCompare(b.label));
    sorted.forEach((node, index) => {
      positioned.push({
        ...node,
        x: layerIndex * (NODE_WIDTH + X_GAP),
        y: index * (NODE_HEIGHT + Y_GAP),
      });
    });
  }
  return positioned;
};

const layoutForce = (nodes: GraphNode[], edges: GraphEdge[]): PositionedNode[] => {
  const degrees = buildDegreeMap(nodes, edges);
  const sorted = [...nodes].sort((a, b) => {
    const degreeDiff = (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0);
    if (degreeDiff !== 0) {
      return degreeDiff;
    }
    return a.label.localeCompare(b.label);
  });
  const perRing = Math.max(8, Math.ceil(Math.sqrt(sorted.length) * 4));

  return sorted.map((node, index) => {
    const ring = Math.floor(index / perRing);
    const slot = index % perRing;
    const radius = 140 + ring * 130;
    const angle = (slot / perRing) * Math.PI * 2;
    return {
      ...node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
};

export const applyLayout = (
  layoutType: "layered" | "force" | "hierarchical",
  nodes: GraphNode[],
  edges: GraphEdge[],
): PositionedNode[] => {
  if (layoutType === "hierarchical") {
    return layoutHierarchical(nodes, edges);
  }
  if (layoutType === "layered") {
    return layoutLayered(nodes);
  }
  return layoutForce(nodes, edges);
};
