import { useMemo, useState } from "react";
import { MonacoDiffViewer } from "../diff-viewer/monaco-diff-viewer";
import { MonacoWorkspaceEditor } from "../editor/monaco-editor";
import { ExplainPanel } from "../explanations";
import { FileExplorerPanel } from "../explorer/file-explorer-panel";
import { useWorkspace } from "./workspace.hook";

export const WorkspaceShell = () => {
  const [projectPathInput, setProjectPathInput] = useState("");
  const [diffMode, setDiffMode] = useState(false);
  const {
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
  } = useWorkspace();

  const activePath = state.activeFilePath;
  const activeDocument = activePath ? state.documents[activePath] : undefined;
  const dirtyFiles = useMemo(
    () => state.openTabs.filter((path) => hasUnsavedChanges(path)),
    [hasUnsavedChanges, state.openTabs],
  );

  return (
    <main className="grid h-screen grid-rows-[auto_auto_1fr] bg-slate-950 text-slate-100">
      <header className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2">
        <input
          value={projectPathInput}
          onChange={(event) => {
            setProjectPathInput(event.target.value);
          }}
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-cyan-500"
          placeholder="Project root path (optional)"
        />
        <button
          type="button"
          onClick={() => {
            void openProject(projectPathInput);
          }}
          disabled={state.loadingProject}
          className="rounded border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 disabled:opacity-50"
        >
          {state.loadingProject ? "Scanning..." : "Open Project"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (activePath) {
              void saveFile(activePath);
            }
          }}
          disabled={!activePath || !hasUnsavedChanges(activePath)}
          className="rounded border border-slate-700 px-3 py-1 text-xs disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            void saveAllFiles();
          }}
          disabled={dirtyFiles.length === 0}
          className="rounded border border-slate-700 px-3 py-1 text-xs disabled:opacity-50"
        >
          Save All ({dirtyFiles.length})
        </button>
        <button
          type="button"
          onClick={() => {
            if (activePath) {
              void reloadFile(activePath);
            }
          }}
          disabled={!activePath}
          className="rounded border border-slate-700 px-3 py-1 text-xs disabled:opacity-50"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => {
            setDiffMode((current) => !current);
          }}
          disabled={!activePath}
          className="rounded border border-slate-700 px-3 py-1 text-xs disabled:opacity-50"
        >
          {diffMode ? "Editor" : "Diff"}
        </button>
      </header>

      <div className="flex h-9 items-center gap-1 border-b border-slate-800 bg-slate-900 px-2">
        {state.openTabs.length === 0 ? (
          <p className="text-xs text-slate-500">No open files</p>
        ) : (
          state.openTabs.map((path) => {
            const dirty = hasUnsavedChanges(path);
            const active = state.activeFilePath === path;
            return (
              <div
                key={path}
                className={`flex max-w-64 items-center gap-1 rounded-t border border-b-0 px-2 py-1 text-xs ${
                  active
                    ? "border-slate-700 bg-slate-950 text-slate-100"
                    : "border-slate-800 bg-slate-900 text-slate-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveFile(path);
                  }}
                  className="truncate"
                >
                  {path}
                  {dirty ? " *" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeFile(path);
                  }}
                  className="rounded px-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                >
                  x
                </button>
              </div>
            );
          })
        )}
      </div>

      <section className="grid min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr_380px]">
        <FileExplorerPanel
          files={state.files}
          folders={state.folders}
          activeFilePath={state.activeFilePath}
          expandedFolders={state.expandedFolders}
          searchQuery={state.searchQuery}
          onSearchChange={setSearchQuery}
          onToggleFolder={toggleFolder}
          onOpenFile={(path) => {
            void openFile(path);
          }}
        />
        <div className="min-h-0">
          {state.error ? (
            <div className="border-b border-rose-800 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
              {state.error}
            </div>
          ) : null}
          {!activePath || !activeDocument ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Open a file from explorer to start editing.
            </div>
          ) : diffMode ? (
            <MonacoDiffViewer
              filePath={activePath}
              original={activeDocument.savedContent}
              modified={activeDocument.content}
            />
          ) : (
            <MonacoWorkspaceEditor
              filePath={activePath}
              content={activeDocument.content}
              viewState={getPersistedViewState(activePath)}
              onContentChange={(value) => {
                updateFileContent(activePath, value);
              }}
              onViewStateChange={(nextState) => {
                updateEditorViewState(activePath, nextState);
              }}
            />
          )}
        </div>
        <ExplainPanel
          activeFilePath={state.activeFilePath}
          symbols={state.symbols}
          routes={state.routes}
        />
      </section>
    </main>
  );
};
