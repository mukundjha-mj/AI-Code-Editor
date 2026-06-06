import type { RepositoryFileRecord } from "../../types/repository";
import type { SerializedSelection } from "../editor-events/editor-events";
import type { StoredEditorViewState } from "../editor-state/editor-state.persistence";

export interface WorkspaceDocument {
  path: string;
  content: string;
  savedContent: string;
  hash: string;
  mtimeMs: number;
  isLoading: boolean;
}

export interface EditorViewState {
  lineNumber: number;
  column: number;
  scrollTop: number;
  scrollLeft: number;
  selection: SerializedSelection | null;
}

export interface WorkspaceState {
  rootPath: string | null;
  scannedAt: string | null;
  files: RepositoryFileRecord[];
  folders: string[];
  openTabs: string[];
  activeFilePath: string | null;
  documents: Record<string, WorkspaceDocument>;
  expandedFolders: Set<string>;
  searchQuery: string;
  viewStates: Record<string, EditorViewState>;
  loadingProject: boolean;
  loadingFilePath: string | null;
  savingPaths: Set<string>;
  error: string | null;
}

export interface WorkspaceStore {
  state: WorkspaceState;
  hasUnsavedChanges: (path: string) => boolean;
  openProject: (rootPath?: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;
  reloadFile: (path: string) => Promise<void>;
  toggleFolder: (path: string) => void;
  setSearchQuery: (value: string) => void;
  updateEditorViewState: (path: string, nextState: EditorViewState) => void;
  getPersistedViewState: (path: string) => StoredEditorViewState | undefined;
}
