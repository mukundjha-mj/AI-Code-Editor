import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import type { GraphService } from "./graph.service";

const graphQuerySchema = z.object({
  query: z.string().optional(),
  focusNodeId: z.string().optional(),
  offset: z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number().int().nonnegative())
    .optional(),
  limit: z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number().int().positive())
    .optional(),
});

const parseQuery = (req: Request, res: Response) => {
  const parsed = graphQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid graph query parameters",
      details: parsed.error.flatten().fieldErrors,
    });
    return null;
  }
  return parsed.data;
};

export const createGraphRouter = (service: GraphService) => {
  const router = Router();

  router.get("/files", async (req: Request, res: Response) => {
    const query = parseQuery(req, res);
    if (!query) {
      return;
    }
    try {
      const result = await service.getFileGraph(query);
      res.status(200).json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load files graph";
      res.status(500).json({ error: msg });
    }
  });

  router.get("/components", async (req: Request, res: Response) => {
    const query = parseQuery(req, res);
    if (!query) {
      return;
    }
    try {
      const result = await service.getComponentGraph(query);
      res.status(200).json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load components graph";
      res.status(500).json({ error: msg });
    }
  });

  router.get("/routes", async (req: Request, res: Response) => {
    const query = parseQuery(req, res);
    if (!query) {
      return;
    }
    try {
      const result = await service.getRouteGraph(query);
      res.status(200).json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load routes graph";
      res.status(500).json({ error: msg });
    }
  });

  router.get("/modules", async (req: Request, res: Response) => {
    const query = parseQuery(req, res);
    if (!query) {
      return;
    }
    try {
      const result = await service.getModuleGraph(query);
      res.status(200).json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load modules graph";
      res.status(500).json({ error: msg });
    }
  });

  return router;
};
