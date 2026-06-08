import { useMemo, useState } from "react";
import type { RepositoryFileRecord } from "../../types/repository";

interface FileExplorerPanelProps {
  files: RepositoryFileRecord[];
  folders: string[];
  activeFilePath: string | null;
  expandedFolders: Set<string>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onToggleFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
}

interface ExplorerRow {
  key: string;
  label: string;
  depth: number;
  type: "folder" | "file";
  path: string;
}

const ROW_HEIGHT = 28;
const OVERSCAN = 8;

const getLabel = (path: string): string => {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
};

const buildRows = (
  files: RepositoryFileRecord[],
  folders: string[],
  expandedFolders: Set<string>,
  searchQuery: string,
): ExplorerRow[] => {
  const folderSet = new Set(folders);
  for (const file of files) {
    const parts = file.path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      folderSet.add(parts.slice(0, index).join("/"));
    }
  }

  const folderList = [...folderSet].sort((a, b) => a.localeCompare(b));
  const filesByFolder = new Map<string, string[]>();
  for (const file of files) {
    const folder = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
    const list = filesByFolder.get(folder) ?? [];
    list.push(file.path);
    filesByFolder.set(folder, list);
  }
  for (const [folder, list] of filesByFolder) {
    filesByFolder.set(
      folder,
      list.sort((a, b) => a.localeCompare(b)),
    );
  }

  const search = searchQuery.trim().toLowerCase();
  const visibleFiles = search.length
    ? files
        .map((item) => item.path)
        .filter((path) => path.toLowerCase().includes(search))
        .sort((a, b) => a.localeCompare(b))
    : null;

  if (visibleFiles) {
    return visibleFiles.map((path) => ({
      key: `file:${path}`,
      label: path,
      depth: 0,
      type: "file",
      path,
    }));
  }

  const childrenByFolder = new Map<string, string[]>();
  for (const folder of folderList) {
    const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
    const list = childrenByFolder.get(parent) ?? [];
    list.push(folder);
    childrenByFolder.set(parent, list);
  }
  for (const [parent, list] of childrenByFolder) {
    childrenByFolder.set(
      parent,
      list.sort((a, b) => a.localeCompare(b)),
    );
  }

  const rows: ExplorerRow[] = [];
  const walk = (folder: string, depth: number) => {
    const childFolders = childrenByFolder.get(folder) ?? [];
    const folderFiles = filesByFolder.get(folder) ?? [];

    for (const childFolder of childFolders) {
      rows.push({
        key: `folder:${childFolder}`,
        label: getLabel(childFolder),
        depth,
        type: "folder",
        path: childFolder,
      });
      if (expandedFolders.has(childFolder)) {
        walk(childFolder, depth + 1);
      }
    }

    for (const filePath of folderFiles) {
      rows.push({
        key: `file:${filePath}`,
        label: getLabel(filePath),
        depth,
        type: "file",
        path: filePath,
      });
    }
  };

  walk("", 0);
  return rows;
};

export const FileExplorerPanel = ({
  files,
  folders,
  activeFilePath,
  expandedFolders,
  searchQuery,
  onSearchChange,
  onToggleFolder,
  onOpenFile,
}: FileExplorerPanelProps) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(480);

  const rows = useMemo(
    () => buildRows(files, folders, expandedFolders, searchQuery),
    [expandedFolders, files, folders, searchQuery],
  );
  const totalHeight = rows.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(startIndex, endIndex);
  const offsetY = startIndex * ROW_HEIGHT;

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 p-2">
        <input
          value={searchQuery}
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-500"
          placeholder="Search files..."
        />
      </div>
      <div
        className="relative min-h-0 flex-1 overflow-auto"
        onScroll={(event) => {
          setScrollTop(event.currentTarget.scrollTop);
          setHeight(event.currentTarget.clientHeight);
        }}
      >
        <div style={{ height: totalHeight }} className="relative">
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleRows.map((row) => {
              const isFolderOpen = expandedFolders.has(row.path);
              const isActive = row.type === "file" && row.path === activeFilePath;
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => {
                    if (row.type === "folder") {
                      onToggleFolder(row.path);
                    } else {
                      onOpenFile(row.path);
                    }
                  }}
                  className={`flex h-7 w-full items-center gap-2 px-2 text-left text-xs ${
                    isActive ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300 hover:bg-slate-900"
                  }`}
                  style={{ paddingLeft: `${8 + row.depth * 14}px` }}
                >
                  <span className="w-4 text-center text-slate-400">
                    {row.type === "folder" ? (isFolderOpen ? "▾" : "▸") : "•"}
                  </span>
                  <span className="truncate">{row.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
