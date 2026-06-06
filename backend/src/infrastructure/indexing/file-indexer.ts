export interface FileIndexer {
  indexWorkspace(rootPath: string): Promise<void>;
}
