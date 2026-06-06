import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from "react";
import {
  getRepositoryFileContent,
  getRepositoryFiles,
  saveRepositoryFileContent,
  scanRepository,
} from "../../services/repository-api";
import type { RepositoryFileRecord } from "../../types/repository";
import {
  loadWorkspaceState,
  saveWorkspaceState,
  type StoredEditorViewState,
} from "../editor-state/editor-state.persistence";
import { editorEventBus } from "../editor-events/editor-events";
import type { EditorViewState, WorkspaceDocument, WorkspaceState, WorkspaceStore } from "./workspace.types";
import { WorkspaceContext } from "./workspace.context";

const createInitialState = (): WorkspaceState => {
  const persisted = loadWorkspaceState();
  return {
    rootPath: persisted?.rootPath ?? null,
    scannedAt: null,
    files: [],
    folders: [],
    openTabs: persisted?.openTabs ?? [],
    activeFilePath: persisted?.activeFilePath ?? null,
    documents: {},
    expandedFolders: new Set(persisted?.expandedFolders ?? []),
    searchQuery: "",
    viewStates: persisted?.viewStates ?? {},
    loadingProject: false,
    loadingFilePath: null,
    savingPaths: new Set<string>(),
    error: null,
  };
};

type WorkspaceAction =
  | { type: "project/loading"; payload: boolean }
  | { type: "project/set"; payload: { rootPath: string | null; scannedAt: string | null } }
  | { type: "files/set"; payload: { files: RepositoryFileRecord[]; folders: string[] } }
  | { type: "error/set"; payload: string | null }
  | { type: "search/set"; payload: string }
  | { type: "folder/toggle"; payload: string }
  | { type: "file/loading"; payload: string | null }
  | { type: "file/open"; payload: WorkspaceDocument }
  | { type: "file/close"; payload: string }
  | { type: "file/activate"; payload: string | null }
  | { type: "file/change"; payload: { path: string; content: string } }
  | { type: "file/saved"; payload: WorkspaceDocument }
  | { type: "saving/set"; payload: { path: string; value: boolean } }
  | { type: "view-state/set"; payload: { path: string; state: EditorViewState } };

const workspaceReducer = (state: WorkspaceState, action: WorkspaceAction): WorkspaceState => {
  switch (action.type) {
    case "project/loading":
      return {
        ...state,
        loadingProject: action.payload,
      };
    case "project/set":
      return {
        ...state,
        rootPath: action.payload.rootPath,
        scannedAt: action.payload.scannedAt,
      };
    case "files/set":
      return {
        ...state,
        files: action.payload.files,
        folders: action.payload.folders,
      };
    case "error/set":
      return {
        ...state,
        error: action.payload,
      };
    case "search/set":
      return {
        ...state,
        searchQuery: action.payload,
      };
    case "folder/toggle": {
      const expandedFolders = new Set(state.expandedFolders);
      if (expandedFolders.has(action.payload)) {
        expandedFolders.delete(action.payload);
      } else {
        expandedFolders.add(action.payload);
      }
      return {
        ...state,
        expandedFolders,
      };
    }
    case "file/loading":
      return {
        ...state,
        loadingFilePath: action.payload,
      };
    case "file/open": {
      const nextOpenTabs = state.openTabs.includes(action.payload.path)
        ? state.openTabs
        : [...state.openTabs, action.payload.path];
      return {
        ...state,
        openTabs: nextOpenTabs,
        activeFilePath: action.payload.path,
        documents: {
          ...state.documents,
          [action.payload.path]: action.payload,
        },
      };
    }
    case "file/close": {
      const nextOpenTabs = state.openTabs.filter((path) => path !== action.payload);
      const nextDocuments = { ...state.documents };
      delete nextDocuments[action.payload];
      const nextActiveFilePath =
        state.activeFilePath === action.payload ? nextOpenTabs[nextOpenTabs.length - 1] ?? null : state.activeFilePath;
      return {
        ...state,
        openTabs: nextOpenTabs,
        activeFilePath: nextActiveFilePath,
        documents: nextDocuments,
      };
    }
    case "file/activate":
      return {
        ...state,
        activeFilePath: action.payload,
      };
    case "file/change": {
      const current = state.documents[action.payload.path];
      if (!current || current.content === action.payload.content) {
        return state;
      }
      return {
        ...state,
        documents: {
          ...state.documents,
          [action.payload.path]: {
            ...current,
            content: action.payload.content,
          },
        },
      };
    }
    case "file/saved":
      return {
        ...state,
        documents: {
          ...state.documents,
          [action.payload.path]: action.payload,
        },
      };
    case "saving/set": {
      const savingPaths = new Set(state.savingPaths);
      if (action.payload.value) {
        savingPaths.add(action.payload.path);
      } else {
        savingPaths.delete(action.payload.path);
      }
      return {
        ...state,
        savingPaths,
      };
    }
    case "view-state/set":
      return {
        ...state,
        viewStates: {
          ...state.viewStates,
          [action.payload.path]: action.payload.state,
        },
      };
    default:
      return state;
  }
};

export const WorkspaceProvider = ({ children }: PropsWithChildren) => {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createInitialState);
  const saveTimerRef = useRef<number | null>(null);

  const hasUnsavedChanges = useCallback(
    (path: string) => {
      const document = state.documents[path];
      if (!document) {
        return false;
      }
      return document.content !== document.savedContent;
    },
    [state.documents],
  );

  const syncFiles = useCallback(async () => {
    const payload = await getRepositoryFiles();
    dispatch({
      type: "project/set",
      payload: {
        rootPath: payload.rootPath,
        scannedAt: payload.scannedAt,
      },
    });
    dispatch({
      type: "files/set",
      payload: {
        files: payload.files,
        folders: payload.folders,
      },
    });
  }, []);

  const openProject = useCallback(
    async (rootPath?: string) => {
      dispatch({ type: "project/loading", payload: true });
      dispatch({ type: "error/set", payload: null });
      try {
        await scanRepository(rootPath);
        await syncFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open project";
        dispatch({ type: "error/set", payload: message });
      } finally {
        dispatch({ type: "project/loading", payload: false });
      }
    },
    [syncFiles],
  );

  const openFile = useCallback(
    async (path: string) => {
      const existing = state.documents[path];
      if (existing) {
        dispatch({ type: "file/activate", payload: path });
        editorEventBus.emit("fileOpened", { path });
        return;
      }
      dispatch({ type: "file/loading", payload: path });
      dispatch({ type: "error/set", payload: null });
      try {
        const payload = await getRepositoryFileContent(path);
        dispatch({
          type: "file/open",
          payload: {
            path,
            content: payload.content,
            savedContent: payload.content,
            hash: payload.hash,
            mtimeMs: payload.mtimeMs,
            isLoading: false,
          },
        });
        editorEventBus.emit("fileOpened", { path });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open file";
        dispatch({ type: "error/set", payload: message });
      } finally {
        dispatch({ type: "file/loading", payload: null });
      }
    },
    [state.documents],
  );

  const closeFile = useCallback((path: string) => {
    dispatch({ type: "file/close", payload: path });
    editorEventBus.emit("fileClosed", { path });
  }, []);

  const setActiveFile = useCallback((path: string) => {
    dispatch({ type: "file/activate", payload: path });
  }, []);

  const updateFileContent = useCallback(
    (path: string, content: string) => {
      dispatch({ type: "file/change", payload: { path, content } });
      editorEventBus.emit("contentChanged", {
        path,
        isDirty: state.documents[path]?.savedContent !== content,
      });
    },
    [state.documents],
  );

  const saveFile = useCallback(
    async (path: string) => {
      const document = state.documents[path];
      if (!document || document.content === document.savedContent) {
        return;
      }

      dispatch({ type: "saving/set", payload: { path, value: true } });
      dispatch({ type: "error/set", payload: null });
      try {
        const payload = await saveRepositoryFileContent(path, document.content);
        dispatch({
          type: "file/saved",
          payload: {
            path,
            content: payload.content,
            savedContent: payload.content,
            hash: payload.hash,
            mtimeMs: payload.mtimeMs,
            isLoading: false,
          },
        });
        editorEventBus.emit("fileSaved", { path });
        await syncFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save file";
        dispatch({ type: "error/set", payload: message });
      } finally {
        dispatch({ type: "saving/set", payload: { path, value: false } });
      }
    },
    [state.documents, syncFiles],
  );

  const saveAllFiles = useCallback(async () => {
    for (const path of state.openTabs) {
      if (state.documents[path]?.content !== state.documents[path]?.savedContent) {
        await saveFile(path);
      }
    }
  }, [saveFile, state.documents, state.openTabs]);

  const reloadFile = useCallback(async (path: string) => {
    dispatch({ type: "file/loading", payload: path });
    dispatch({ type: "error/set", payload: null });
    try {
      const payload = await getRepositoryFileContent(path);
      dispatch({
        type: "file/open",
        payload: {
          path,
          content: payload.content,
          savedContent: payload.content,
          hash: payload.hash,
          mtimeMs: payload.mtimeMs,
          isLoading: false,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reload file";
      dispatch({ type: "error/set", payload: message });
    } finally {
      dispatch({ type: "file/loading", payload: null });
    }
  }, []);

  const toggleFolder = useCallback((path: string) => {
    dispatch({ type: "folder/toggle", payload: path });
  }, []);

  const setSearchQuery = useCallback((value: string) => {
    dispatch({ type: "search/set", payload: value });
  }, []);

  const updateEditorViewState = useCallback((path: string, nextState: EditorViewState) => {
    dispatch({ type: "view-state/set", payload: { path, state: nextState } });
    if (nextState.selection) {
      editorEventBus.emit("selectionChanged", { path, selection: nextState.selection });
    }
    editorEventBus.emit("cursorChanged", {
      path,
      lineNumber: nextState.lineNumber,
      column: nextState.column,
    });
  }, []);

  const getPersistedViewState = useCallback(
    (path: string): StoredEditorViewState | undefined => {
      const viewState = state.viewStates[path];
      if (!viewState) {
        return undefined;
      }
      return viewState;
    },
    [state.viewStates],
  );

  useEffect(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveWorkspaceState({
        rootPath: state.rootPath,
        openTabs: state.openTabs,
        activeFilePath: state.activeFilePath,
        expandedFolders: [...state.expandedFolders],
        viewStates: state.viewStates,
      });
    }, 200);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [state.activeFilePath, state.expandedFolders, state.openTabs, state.rootPath, state.viewStates]);

  useEffect(() => {
    void syncFiles();
  }, [syncFiles]);

  const store = useMemo<WorkspaceStore>(
    () => ({
      state,
      hasUnsavedChanges,
      openProject,
      openFile,
      closeFile,
      setActiveFile,
      updateFileContent,
      saveFile,
      saveAllFiles,
      reloadFile,
      toggleFolder,
      setSearchQuery,
      updateEditorViewState,
      getPersistedViewState,
    }),
    [
      closeFile,
      getPersistedViewState,
      hasUnsavedChanges,
      openFile,
      openProject,
      reloadFile,
      saveAllFiles,
      saveFile,
      setActiveFile,
      setSearchQuery,
      state,
      toggleFolder,
      updateEditorViewState,
      updateFileContent,
    ],
  );

  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
};
