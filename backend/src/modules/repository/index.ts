import type { Router } from "express";
import { RepositoryIntelligenceService } from "./repository-intelligence.service";
import { createRepositoryRouter } from "./repository.routes";

export const createRepositoryModuleRouter = (): Router => {
  const service = new RepositoryIntelligenceService();
  return createRepositoryRouter(service);
};
