export type ContextScope =
  | "currentFile"
  | "multipleFiles"
  | "repository"
  | "userInstructions"
  | "memory";

export type ContextChunk = {
  scope: ContextScope;
  content: string;
  metadata?: Record<string, string>;
};

export type ContextRequest = {
  currentFilePath?: string;
  filePaths?: string[];
  repositoryRoot?: string;
  userInstructions?: string;
  memoryKeys?: string[];
};

export interface ContextProvider {
  readonly scope: ContextScope;
  collect(request: ContextRequest): Promise<ContextChunk[]>;
}
