export interface RepositoryFileRecord {
  path: string;
  extension: string;
  size: number;
  mtimeMs: number;
  hash: string;
}

export interface RepositoryFilesResponse {
  rootPath: string | null;
  scannedAt: string | null;
  files: RepositoryFileRecord[];
  folders: string[];
}

export interface RepositoryScanResponse {
  rootPath: string;
  scannedAt: string;
  stats: {
    totalFilesDiscovered: number;
    filesIndexed: number;
    filesReindexed: number;
    filesRemoved: number;
    foldersDiscovered: number;
    durationMs: number;
  };
}

export interface RepositoryFileContentResponse {
  path: string;
  content: string;
  hash: string;
  mtimeMs: number;
}
