import cors from "cors";
import express from "express";
import helmet from "helmet";
import { registerRoutes } from "./api/routes";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  registerRoutes(app);

  return app;
};
