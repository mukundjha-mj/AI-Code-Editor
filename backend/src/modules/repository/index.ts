import type { Router } from "express";
import { createRepositoryRouter } from "./repository.routes";
import { getRepositoryIntelligenceService } from "./repository.runtime";

export const createRepositoryModuleRouter = (): Router => {
  const service = getRepositoryIntelligenceService();
  return createRepositoryRouter(service);
};
