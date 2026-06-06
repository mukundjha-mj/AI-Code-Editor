import { useMemo, useState } from "react";
import type { GraphEdge, GraphNode, GraphPayload } from "../../types/graph";
import { applyLayout } from "./graph-layout";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

const edgeKey = (edge: GraphEdge) => edge.id;

interface GraphEngineProps {
  graph: GraphPayload;
  hiddenGroupIds: Set<string>;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onNodeClick: (node: GraphNode) => void;
  onEdgeClick: (edge: GraphEdge) => void;
}

export const GraphEngine = ({
  graph,
  hiddenGroupIds,
  selectedNodeId,
  selectedEdgeId,
  onNodeClick,
  onEdgeClick,
}: GraphEngineProps) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 420, y: 300 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const visibleNodes = useMemo(
    () =>
      graph.nodes.filter((node) => {
        if (!node.groupId) {
          return true;
        }
        return !hiddenGroupIds.has(node.groupId);
      }),
    [graph.nodes, hiddenGroupIds],
  );

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => graph.edges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)),
    [graph.edges, visibleNodeIds],
  );

  const positionedNodes = useMemo(
    () => applyLayout(graph.layout.type, visibleNodes, visibleEdges),
    [graph.layout.type, visibleEdges, visibleNodes],
  );
  const positionedById = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded border border-slate-800 bg-slate-950"
      onWheel={(event) => {
        event.preventDefault();
        const direction = event.deltaY > 0 ? -0.1 : 0.1;
        setZoom((current) => Math.min(2.4, Math.max(0.35, Number((current + direction).toFixed(2)))));
      }}
      onMouseDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        setDragStart({
          x: event.clientX - offset.x,
          y: event.clientY - offset.y,
        });
      }}
      onMouseMove={(event) => {
        if (!dragStart) {
          return;
        }
        setOffset({
          x: event.clientX - dragStart.x,
          y: event.clientY - dragStart.y,
        });
      }}
      onMouseUp={() => {
        setDragStart(null);
      }}
      onMouseLeave={() => {
        setDragStart(null);
      }}
    >
      <svg className="h-full w-full">
        <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
          {visibleEdges.map((edge) => {
            const from = positionedById.get(edge.from);
            const to = positionedById.get(edge.to);
            if (!from || !to) {
              return null;
            }

            const fromX = from.x + NODE_WIDTH / 2;
            const fromY = from.y + NODE_HEIGHT / 2;
            const toX = to.x + NODE_WIDTH / 2;
            const toY = to.y + NODE_HEIGHT / 2;

            return (
              <g key={edgeKey(edge)}>
                <line
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke={selectedEdgeId === edge.id ? "#22d3ee" : "#475569"}
                  strokeWidth={selectedEdgeId === edge.id ? 2.8 : 1.5}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdgeClick(edge);
                  }}
                />
              </g>
            );
          })}

          {positionedNodes.map((node) => (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={(event) => {
                event.stopPropagation();
                onNodeClick(node);
              }}
              className="cursor-pointer"
            >
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={10}
                fill={selectedNodeId === node.id ? "#164e63" : "#0f172a"}
                stroke={selectedNodeId === node.id ? "#22d3ee" : "#334155"}
                strokeWidth={selectedNodeId === node.id ? 2 : 1}
              />
              <text x={12} y={22} fill="#e2e8f0" fontSize={11} fontFamily="ui-monospace, SFMono-Regular">
                {node.label.slice(0, 32)}
              </text>
              <text x={12} y={40} fill="#94a3b8" fontSize={10}>
                {node.type}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <div className="pointer-events-none absolute bottom-2 right-2 rounded border border-slate-700 bg-slate-900/90 px-2 py-1 text-[11px] text-slate-400">
        Zoom {Math.round(zoom * 100)}%
      </div>
    </div>
  );
};
