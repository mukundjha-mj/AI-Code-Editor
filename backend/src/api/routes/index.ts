import type { Express } from "express";
import { createHealthRouter } from "../../modules/health/health.routes";
import { createAiModuleRouter } from "../../modules/ai";
import { createExplainModuleRouter } from "../../modules/explain";
import { createGraphModuleRouter } from "../../modules/graph";
import { createRepositoryModuleRouter } from "../../modules/repository";
import { createDecisionMemoryModuleRouter } from "../../modules/decision-memory";

export const registerRoutes = (app: Express) => {
  app.use("/api/v1/health", createHealthRouter());
  app.use("/api/v1/ai", createAiModuleRouter());
  app.use("/api/v1/repository", createRepositoryModuleRouter());
  app.use("/api/v1/explain", createExplainModuleRouter());
  app.use("/api/v1/graph", createGraphModuleRouter());
  app.use("/api/v1/decision-memory", createDecisionMemoryModuleRouter());
};
