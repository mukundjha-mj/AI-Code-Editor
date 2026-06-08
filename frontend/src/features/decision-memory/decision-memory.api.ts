const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export const decisionTypes = [
  "code-added",
  "code-modified",
  "code-removed",
  "performance",
  "architecture",
  "refactor",
  "bugfix",
  "other",
] as const;

export type DecisionType = (typeof decisionTypes)[number];

export const decisionEntityTypes = [
  "file",
  "symbol",
  "component",
  "function",
  "class",
  "route",
  "module",
] as const;

export type DecisionEntityType = (typeof decisionEntityTypes)[number];

export interface DecisionEntityLink {
  type: DecisionEntityType;
  value: string;
  filePath?: string;
}

export interface DecisionRecord {
  id: string;
  title: string;
  description: string;
  decisionType: DecisionType;
  reason: string;
  tradeOffs: string[];
  expectedBenefits: string[];
  risks: string[];
  author: string;
  timestamp: string;
  linkedEntities: DecisionEntityLink[];
  followUpToDecisionId: string | null;
  replacesDecisionId: string | null;
  supersedesDecisionId: string | null;
}

export interface ExplainDecisionSummary {
  id: string;
  title: string;
  decisionType: DecisionType;
  reason: string;
  timestamp: string;
}

export interface CreateDecisionInput {
  title: string;
  description: string;
  decisionType?: DecisionType;
  reason: string;
  tradeOffs?: string[];
  expectedBenefits?: string[];
  risks?: string[];
  author: string;
  linkedEntities: DecisionEntityLink[];
  followUpToDecisionId?: string | null;
  replacesDecisionId?: string | null;
  supersedesDecisionId?: string | null;
  aiAssist?: {
    summarize?: boolean;
    categorize?: boolean;
  };
}

export interface DecisionListFilters {
  file?: string;
  symbol?: string;
  component?: string;
  route?: string;
  module?: string;
  type?: DecisionType;
  author?: string;
  query?: string;
}

export interface DecisionHistoryResponse {
  rootDecisionId: string;
  chain: DecisionRecord[];
}

export interface DecisionEntityContextResponse {
  entity: DecisionEntityLink;
  decisions: DecisionRecord[];
  answers: {
    whyExists: string[];
    whyChanged: string[];
    performanceOptimizations: string[];
    architecturalDecisions: string[];
  };
}

const parseError = async (response: Response) => {
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) {
      message = body.error;
    }
  } catch {
    // ignore
  }
  return message;
};

export const createDecision = async (input: CreateDecisionInput): Promise<DecisionRecord> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/decision-memory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as DecisionRecord;
};

export const listDecisions = async (
  filters: DecisionListFilters = {},
): Promise<{ decisions: DecisionRecord[] }> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== "") {
      params.append(key, String(val));
    }
  });

  const response = await fetch(`${API_BASE_URL}/api/v1/decision-memory?${params.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as { decisions: DecisionRecord[] };
};

export const getDecisionById = async (id: string): Promise<DecisionRecord> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/decision-memory/${id}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as DecisionRecord;
};

export const getByEntity = async (
  entity: DecisionEntityLink,
): Promise<DecisionEntityContextResponse> => {
  const params = new URLSearchParams();
  params.append("type", entity.type);
  params.append("value", entity.value);
  if (entity.filePath) {
    params.append("filePath", entity.filePath);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/decision-memory/entity?${params.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as DecisionEntityContextResponse;
};

export const getHistory = async (input: {
  id?: string;
  type?: DecisionEntityType;
  value?: string;
}): Promise<DecisionHistoryResponse> => {
  const params = new URLSearchParams();
  if (input.id) params.append("id", input.id);
  if (input.type) params.append("type", input.type);
  if (input.value) params.append("value", input.value);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/decision-memory/history?${params.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as DecisionHistoryResponse;
};
