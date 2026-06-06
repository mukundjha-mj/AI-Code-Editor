import type { Express } from "express";
import { createHealthRouter } from "../../modules/health/health.routes";
import { createAiModuleRouter } from "../../modules/ai";
import { createExplainModuleRouter } from "../../modules/explain";
import { createRepositoryModuleRouter } from "../../modules/repository";

export const registerRoutes = (app: Express) => {
  app.use("/api/v1/health", createHealthRouter());
  app.use("/api/v1/ai", createAiModuleRouter());
  app.use("/api/v1/repository", createRepositoryModuleRouter());
  app.use("/api/v1/explain", createExplainModuleRouter());
};
