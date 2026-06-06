import type { Router } from "express";
import { createGraphRouter } from "./graph.routes";
import { getGraphService } from "./graph.runtime";

export const createGraphModuleRouter = (): Router => createGraphRouter(getGraphService());
