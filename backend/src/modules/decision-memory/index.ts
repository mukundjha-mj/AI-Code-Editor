import type { Router } from "express";
import { createDecisionMemoryRouter } from "./decision-memory.routes";
import { getDecisionMemoryService } from "./decision-memory.runtime";

export const createDecisionMemoryModuleRouter = (): Router =>
  createDecisionMemoryRouter(getDecisionMemoryService());
