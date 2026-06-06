import { createContext } from "react";
import type { WorkspaceStore } from "./workspace.types";

export const WorkspaceContext = createContext<WorkspaceStore | null>(null);
