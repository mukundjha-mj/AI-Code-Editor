import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import type { ExplainService } from "./explain.service";
import type { ExplanationTarget } from "./explain.types";

const explainBodySchema = z.object({
  path: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  route: z.string().min(1).optional(),
  mode: z.enum(["quick", "deep"]).default("quick"),
});

const parseTarget = (target: string): ExplanationTarget | null => {
  if (
    target === "file" ||
    target === "component" ||
    target === "function" ||
    target === "class" ||
    target === "module" ||
    target === "route"
  ) {
    return target;
  }
  return null;
};

const buildExplainHandler =
  (service: ExplainService, target: ExplanationTarget) => async (req: Request, res: Response) => {
    const parsed = explainBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const result = await service.explain({
        target,
        mode: parsed.data.mode,
        path: parsed.data.path,
        symbol: parsed.data.symbol,
        route: parsed.data.route,
      });
      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to explain code";
      res.status(400).json({ error: message });
    }
  };

const buildStreamHandler =
  (service: ExplainService, target: ExplanationTarget) => async (req: Request, res: Response) => {
    const parsed = explainBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      const stream = service.stream({
        target,
        mode: parsed.data.mode,
        path: parsed.data.path,
        symbol: parsed.data.symbol,
        route: parsed.data.route,
      });

      for await (const event of stream) {
        if (event.type === "token") {
          res.write(`data: ${JSON.stringify({ type: "token", value: event.token })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Streaming failed";
      res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    } finally {
      res.end();
    }
  };

const attachEndpoints = (router: Router, service: ExplainService, targetName: string) => {
  const target = parseTarget(targetName);
  if (!target) {
    return;
  }
  router.post(`/${target}`, buildExplainHandler(service, target));
  router.post(`/${target}/stream`, buildStreamHandler(service, target));
};

export const createExplainRouter = (service: ExplainService) => {
  const router = Router();

  for (const target of ["file", "component", "function", "class", "module", "route"]) {
    attachEndpoints(router, service, target);
  }

  return router;
};
