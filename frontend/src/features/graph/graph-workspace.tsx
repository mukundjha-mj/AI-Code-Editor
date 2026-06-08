import { useEffect, useMemo, useState } from "react";
import { getGraph } from "../../services/graph-api";
import type { GraphEdge, GraphKind, GraphNode, GraphPayload } from "../../types/graph";
import { editorEventBus } from "../editor-events/editor-events";
import { GraphEngine } from "./graph-engine";

interface GraphWorkspaceProps {
  onOpenFile: (path: string) => Promise<void>;
}

const GRAPH_TYPES: Array<{ id: GraphKind; label: string }> = [
  { id: "files", label: "File Graph" },
  { id: "components", label: "Component Graph" },
  { id: "routes", label: "Route Graph" },
  { id: "modules", label: "Module Graph" },
];

const prettyMetadata = (metadata: Record<string, string | number | boolean | null>) =>
  Object.entries(metadata).filter(([, value]) => value !== null && value !== "");

export const GraphWorkspace = ({ onOpenFile }: GraphWorkspaceProps) => {
  const [graphType, setGraphType] = useState<GraphKind>("files");
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);

  const fetchGraph = async (nextOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getGraph(graphType, {
        query,
        focusNodeId: focusMode ? selectedNode?.id : undefined,
        offset: nextOffset,
        limit: 250,
      });
      setGraph((current) => {
        if (!current || nextOffset === 0 || current.kind !== payload.kind) {
          return payload;
        }
        const nodeMap = new Map(
          [...current.nodes, ...payload.nodes].map((node) => [node.id, node] as const),
        );
        const edgeMap = new Map(
          [...current.edges, ...payload.edges].map((edge) => [edge.id, edge] as const),
        );
        return {
          ...payload,
          nodes: [...nodeMap.values()],
          edges: [...edgeMap.values()],
        };
      });
      setOffset(nextOffset);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load graph.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGraph(0);
    setSelectedNode(null);
    setSelectedEdge(null);
    setHiddenGroupIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphType]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchGraph(0);
      setSelectedNode(null);
      setSelectedEdge(null);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, focusMode]);

  useEffect(() => {
    if (!focusMode) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGraph(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode, selectedNode?.id]);

  const selectedNodeMetadata = useMemo(
    () => (selectedNode ? prettyMetadata(selectedNode.metadata) : []),
    [selectedNode],
  );

  const handleNodeSelect = async (node: GraphNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);

    if (node.filePath) {
      await onOpenFile(node.filePath);
      editorEventBus.emit("explainTargetSelected", {
        target: "file",
        path: node.filePath,
      });
    }

    if (node.symbol && node.filePath) {
      editorEventBus.emit("symbolSelected", {
        path: node.filePath,
        symbol: node.symbol,
      });
      editorEventBus.emit("explainTargetSelected", {
        target: "component",
        path: node.filePath,
        symbol: node.symbol,
      });
    }

    if (node.route) {
      editorEventBus.emit("explainTargetSelected", {
        target: "route",
        route: node.route,
      });
    }
  };

  return (
    <section className="grid h-full min-h-0 grid-cols-[1fr_280px] gap-3 p-3">
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-2">
          {GRAPH_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                setGraphType(type.id);
              }}
              className={`rounded border px-2 py-1 text-xs ${
                graphType === type.id
                  ? "border-cyan-500/70 bg-cyan-500/20 text-cyan-100"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              }`}
            >
              {type.label}
            </button>
          ))}
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search nodes..."
            className="min-w-44 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={() => {
              setFocusMode((current) => !current);
            }}
            className={`rounded border px-2 py-1 text-xs ${
              focusMode
                ? "border-cyan-500/70 bg-cyan-500/20 text-cyan-100"
                : "border-slate-700 text-slate-300"
            }`}
          >
            Focus Mode
          </button>
          <button
            type="button"
            onClick={() => {
              void fetchGraph(0);
            }}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
          >
            Refresh
          </button>
        </div>

        {error ? (
          <div className="rounded border border-rose-700 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          {graph ? (
            <GraphEngine
              graph={graph}
              hiddenGroupIds={hiddenGroupIds}
              selectedNodeId={selectedNode?.id ?? null}
              selectedEdgeId={selectedEdge?.id ?? null}
              onNodeClick={(node) => {
                void handleNodeSelect(node);
              }}
              onEdgeClick={(edge) => {
                setSelectedEdge(edge);
                setSelectedNode(null);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded border border-slate-800 bg-slate-950 text-sm text-slate-500">
              {loading ? "Loading graph..." : "Scan a project to view graph data."}
            </div>
          )}
        </div>

        {graph?.page.hasMore ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                void fetchGraph(offset + graph.page.limit);
              }}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200"
              disabled={loading}
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        ) : null}
      </div>

      <aside className="min-h-0 overflow-auto rounded border border-slate-800 bg-slate-900 p-3 text-xs">
        <h3 className="text-sm font-semibold text-slate-100">Graph Details</h3>
        {graph ? (
          <div className="mt-2 space-y-3 text-slate-300">
            <section>
              <p>Total nodes: {graph.page.totalNodes}</p>
              <p>Total edges: {graph.page.totalEdges}</p>
              <p>Rendered nodes: {graph.nodes.length}</p>
              <p>Rendered edges: {graph.edges.length}</p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-200">Groups</h4>
              <div className="mt-1 space-y-1">
                {graph.groups.map((group) => {
                  const hidden = hiddenGroupIds.has(group.id);
                  return (
                    <button
                      type="button"
                      key={group.id}
                      onClick={() => {
                        setHiddenGroupIds((current) => {
                          const next = new Set(current);
                          if (next.has(group.id)) {
                            next.delete(group.id);
                          } else {
                            next.add(group.id);
                          }
                          return next;
                        });
                      }}
                      className={`block w-full rounded border px-2 py-1 text-left ${
                        hidden
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-100"
                          : "border-slate-700"
                      }`}
                    >
                      {hidden ? "Expand" : "Collapse"} {group.label} ({group.nodeIds.length})
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h4 className="font-semibold text-slate-200">Selected Node</h4>
              {selectedNode ? (
                <div className="mt-1 rounded border border-slate-700 bg-slate-950 p-2">
                  <p className="text-slate-100">{selectedNode.label}</p>
                  <p className="text-slate-400">{selectedNode.type}</p>
                  {selectedNodeMetadata.map(([key, value]) => (
                    <p key={key}>
                      {key}: {String(value)}
                    </p>
                  ))}
                  {Number(selectedNode.metadata.decisionCount ?? 0) > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        editorEventBus.emit("decisionPanelOpen", {
                          type: selectedNode.type as
                            | "file"
                            | "symbol"
                            | "component"
                            | "function"
                            | "class"
                            | "route"
                            | "module",
                          value:
                            selectedNode.symbol ||
                            selectedNode.filePath ||
                            selectedNode.route ||
                            "",
                          filePath: selectedNode.filePath,
                        });
                      }}
                      className="mt-2 w-full rounded bg-cyan-500/10 border border-cyan-500/50 hover:bg-cyan-500/20 text-cyan-200 px-2 py-1 text-center font-medium transition"
                    >
                      View Linked Decisions ({selectedNode.metadata.decisionCount})
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-slate-500">
                  Select a node to inspect details and trigger Explain.
                </p>
              )}
            </section>

            <section>
              <h4 className="font-semibold text-slate-200">Selected Edge</h4>
              {selectedEdge ? (
                <div className="mt-1 rounded border border-slate-700 bg-slate-950 p-2">
                  <p className="text-slate-100">{selectedEdge.type}</p>
                  <p className="text-slate-400">
                    {selectedEdge.from} {"->"} {selectedEdge.to}
                  </p>
                  {selectedEdge.label ? (
                    <p className="text-slate-400">label: {selectedEdge.label}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-slate-500">
                  Select an edge to inspect relationship metadata.
                </p>
              )}
            </section>
          </div>
        ) : (
          <p className="mt-2 text-slate-500">No graph loaded.</p>
        )}
      </aside>
    </section>
  );
};
