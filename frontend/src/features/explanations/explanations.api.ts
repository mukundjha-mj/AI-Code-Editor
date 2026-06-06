const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type ExplainTarget = "file" | "component" | "function" | "class" | "module" | "route";
export type ExplainMode = "quick" | "deep";

export interface ExplainPayload {
  mode: ExplainMode;
  path?: string;
  symbol?: string;
  route?: string;
}

export interface ExplainResponse {
  target: ExplainTarget;
  mode: ExplainMode;
  summary: string;
  responsibilities: string[];
  dependencies: string[];
  relationships: string[];
  risks: string[];
  suggestedReadingOrder: string[];
  relatedFiles: string[];
  contextVersion: string;
  cached: boolean;
}

const parseError = async (response: Response) => {
  let message = `Explain request failed (${response.status})`;
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

export const explainEntity = async (
  target: ExplainTarget,
  payload: ExplainPayload,
): Promise<ExplainResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/explain/${target}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as ExplainResponse;
};

export const streamEntityExplanation = async (
  target: ExplainTarget,
  payload: ExplainPayload,
  onToken: (token: string) => void,
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/explain/${target}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (!response.body) {
    throw new Error("Streaming response body is not available.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((item) => item.startsWith("data: "))
        ?.slice(6);
      if (!line) {
        continue;
      }

      const payloadData = JSON.parse(line) as
        | { type: "token"; value: string }
        | { type: "done" }
        | { type: "error"; message: string };

      if (payloadData.type === "token") {
        onToken(payloadData.value);
      }
      if (payloadData.type === "error") {
        throw new Error(payloadData.message);
      }
    }
  }
};
