import { DiffEditor } from "@monaco-editor/react";
import { getMonacoLanguage } from "../editor/monaco-languages";

interface MonacoDiffViewerProps {
  filePath: string;
  original: string;
  modified: string;
}

export const MonacoDiffViewer = ({ filePath, original, modified }: MonacoDiffViewerProps) => {
  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={getMonacoLanguage(filePath)}
      theme="vs-dark"
      options={{
        renderSideBySide: true,
        readOnly: true,
        automaticLayout: true,
        minimap: {
          enabled: false,
        },
      }}
    />
  );
};
