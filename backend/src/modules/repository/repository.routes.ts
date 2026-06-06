import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import type { RepositoryIntelligenceService } from "./repository-intelligence.service";

const scanRequestSchema = z.object({
  rootPath: z.string().min(1).optional(),
  watch: z.boolean().optional(),
});

const symbolsQuerySchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  file: z.string().optional(),
});

export const createRepositoryRouter = (service: RepositoryIntelligenceService) => {
  const router = Router();

  router.post("/scan", async (req: Request, res: Response) => {
    const parsed = scanRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await service.scanRepository(parsed.data);
    res.status(200).json(result);
  });

  router.get("/files", (_req: Request, res: Response) => {
    res.status(200).json(service.getFiles());
  });

  router.get("/symbols", (req: Request, res: Response) => {
    const parsed = symbolsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid query parameters",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    res.status(200).json(service.getSymbols(parsed.data));
  });

  router.get("/dependencies", (_req: Request, res: Response) => {
    res.status(200).json(service.getDependencies());
  });

  router.get("/components", (_req: Request, res: Response) => {
    res.status(200).json(service.getComponents());
  });

  return router;
};
