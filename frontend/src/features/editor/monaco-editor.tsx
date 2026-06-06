import Editor, { type OnMount } from "@monaco-editor/react";
import { getMonacoLanguage } from "./monaco-languages";
import type { EditorViewState } from "../workspace/workspace.types";
import { editorEventBus } from "../editor-events/editor-events";

interface MonacoWorkspaceEditorProps {
  filePath: string;
  content: string;
  viewState?: EditorViewState;
  onContentChange: (value: string) => void;
  onViewStateChange: (state: EditorViewState) => void;
}

const readEditorState = (editor: Parameters<OnMount>[0]): EditorViewState => {
  const position = editor.getPosition();
  const selection = editor.getSelection();
  return {
    lineNumber: position?.lineNumber ?? 1,
    column: position?.column ?? 1,
    scrollTop: editor.getScrollTop(),
    scrollLeft: editor.getScrollLeft(),
    selection: selection
      ? {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        }
      : null,
  };
};

export const MonacoWorkspaceEditor = ({
  filePath,
  content,
  viewState,
  onContentChange,
  onViewStateChange,
}: MonacoWorkspaceEditorProps) => {
  const handleMount: OnMount = (editor) => {
    if (viewState) {
      editor.setPosition({ lineNumber: viewState.lineNumber, column: viewState.column });
      if (viewState.selection) {
        editor.setSelection(viewState.selection);
      }
      editor.setScrollPosition({
        scrollTop: viewState.scrollTop,
        scrollLeft: viewState.scrollLeft,
      });
    }

    const emitViewState = () => {
      onViewStateChange(readEditorState(editor));
    };
    emitViewState();
    editor.onDidChangeCursorPosition(emitViewState);
    editor.onDidChangeCursorSelection(emitViewState);
    editor.onDidScrollChange(emitViewState);

    editor.onMouseDown((event) => {
      const position = event.target.position;
      if (!position) {
        return;
      }
      const model = editor.getModel();
      if (!model) {
        return;
      }
      const word = model.getWordAtPosition(position);
      if (!word?.word) {
        return;
      }
      editorEventBus.emit("symbolSelected", {
        path: filePath,
        symbol: word.word,
      });
    });
  };

  return (
    <Editor
      key={filePath}
      path={filePath}
      language={getMonacoLanguage(filePath)}
      value={content}
      onChange={(value) => {
        onContentChange(value ?? "");
      }}
      onMount={handleMount}
      theme="vs-dark"
      options={{
        fontSize: 13,
        minimap: { enabled: false },
        automaticLayout: true,
        tabSize: 2,
        scrollBeyondLastLine: false,
      }}
    />
  );
};
