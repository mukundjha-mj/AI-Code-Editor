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

  router.get("/files", (req: Request, res: Response) => {
    const query = parseQuery(req, res);
    if (!query) {
      return;
    }
    res.status(200).json(service.getFileGraph(query));
  });

  router.get("/components", (req: Request, res: Response) => {
    const query = parseQuery(req, res);
    if (!query) {
      return;
    }
    res.status(200).json(service.getComponentGraph(query));
  });

  router.get("/routes", (req: Request, res: Response) => {
    const query = parseQuery(req, res);
    if (!query) {
      return;
    }
    res.status(200).json(service.getRouteGraph(query));
  });

  router.get("/modules", (req: Request, res: Response) => {
    const query = parseQuery(req, res);
    if (!query) {
      return;
    }
    res.status(200).json(service.getModuleGraph(query));
  });

  return router;
};
