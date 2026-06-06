import type { SerializedSelection } from "../editor-events/editor-events";

const STORAGE_KEY = "ai-code-editor.workspace.v1";

export interface StoredEditorViewState {
  lineNumber: number;
  column: number;
  scrollTop: number;
  scrollLeft: number;
  selection: SerializedSelection | null;
}

export interface StoredWorkspaceState {
  rootPath: string | null;
  openTabs: string[];
  activeFilePath: string | null;
  expandedFolders: string[];
  viewStates: Record<string, StoredEditorViewState>;
}

export const loadWorkspaceState = (): StoredWorkspaceState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredWorkspaceState;
  } catch {
    return null;
  }
};

export const saveWorkspaceState = (state: StoredWorkspaceState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage limits or privacy settings should not block editor usage.
  }
};
