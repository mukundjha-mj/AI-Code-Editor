import type { GraphKind, GraphPayload } from "../types/graph";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/graph${path}`);
  if (!response.ok) {
    let message = `Graph request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // No-op.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
};

const buildQuery = (params: {
  query?: string;
  focusNodeId?: string;
  offset?: number;
  limit?: number;
}) => {
  const search = new URLSearchParams();
  if (params.query?.trim()) {
    search.set("query", params.query.trim());
  }
  if (params.focusNodeId) {
    search.set("focusNodeId", params.focusNodeId);
  }
  if (typeof params.offset === "number") {
    search.set("offset", String(params.offset));
  }
  if (typeof params.limit === "number") {
    search.set("limit", String(params.limit));
  }
  const query = search.toString();
  return query.length > 0 ? `?${query}` : "";
};

export const getGraph = async (
  kind: GraphKind,
  options: {
    query?: string;
    focusNodeId?: string;
    offset?: number;
    limit?: number;
  } = {},
): Promise<GraphPayload> => request<GraphPayload>(`/${kind}${buildQuery(options)}`);
