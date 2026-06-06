import type {
  RepositoryFileContentResponse,
  RepositoryFilesResponse,
  RepositoryScanResponse,
} from "../types/repository";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/repository${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Repository request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Ignore parse failures and keep fallback message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const scanRepository = async (rootPath?: string): Promise<RepositoryScanResponse> =>
  request<RepositoryScanResponse>("/scan", {
    method: "POST",
    body: JSON.stringify({
      ...(rootPath && rootPath.trim().length > 0 ? { rootPath: rootPath.trim() } : {}),
      watch: true,
    }),
  });

export const getRepositoryFiles = async (): Promise<RepositoryFilesResponse> =>
  request<RepositoryFilesResponse>("/files");

export const getRepositoryFileContent = async (filePath: string): Promise<RepositoryFileContentResponse> =>
  request<RepositoryFileContentResponse>(`/file?path=${encodeURIComponent(filePath)}`);

export const saveRepositoryFileContent = async (
  filePath: string,
  content: string,
): Promise<RepositoryFileContentResponse> =>
  request<RepositoryFileContentResponse>("/file", {
    method: "PUT",
    body: JSON.stringify({
      path: filePath,
      content,
    }),
  });
