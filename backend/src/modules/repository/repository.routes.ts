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

const fileQuerySchema = z.object({
  path: z.string().min(1),
});

const saveFileBodySchema = z.object({
  path: z.string().min(1),
  content: z.string(),
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

  router.get("/file", async (req: Request, res: Response) => {
    const parsed = fileQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid query parameters",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const file = await service.getFileContent(parsed.data.path);
      res.status(200).json(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read file";
      res.status(400).json({ error: message });
    }
  });

  router.put("/file", async (req: Request, res: Response) => {
    const parsed = saveFileBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const file = await service.saveFileContent(parsed.data.path, parsed.data.content);
      res.status(200).json(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save file";
      res.status(400).json({ error: message });
    }
  });

  return router;
};
