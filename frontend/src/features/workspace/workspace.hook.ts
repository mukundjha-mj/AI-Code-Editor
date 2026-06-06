import { useContext } from "react";
import { WorkspaceContext } from "./workspace.context";
import type { WorkspaceStore } from "./workspace.types";

export const useWorkspace = (): WorkspaceStore => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
};
