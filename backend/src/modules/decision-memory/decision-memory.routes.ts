import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import type { DecisionMemoryService } from "./decision-memory.service";
import { decisionEntityTypes, decisionTypes } from "./decision-memory.types";

const decisionEntitySchema = z.object({
  type: z.enum(decisionEntityTypes),
  value: z.string().min(1),
  filePath: z.string().min(1).optional(),
});

const createDecisionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  decisionType: z.enum(decisionTypes).optional(),
  reason: z.string().min(1),
  tradeOffs: z.array(z.string()).optional(),
  expectedBenefits: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  author: z.string().min(1),
  linkedEntities: z.array(decisionEntitySchema).min(1),
  followUpToDecisionId: z.string().min(1).optional().nullable(),
  replacesDecisionId: z.string().min(1).optional().nullable(),
  supersedesDecisionId: z.string().min(1).optional().nullable(),
  aiAssist: z
    .object({
      summarize: z.boolean().optional(),
      categorize: z.boolean().optional(),
    })
    .optional(),
});

const listQuerySchema = z.object({
  file: z.string().optional(),
  symbol: z.string().optional(),
  component: z.string().optional(),
  route: z.string().optional(),
  module: z.string().optional(),
  type: z.enum(decisionTypes).optional(),
  author: z.string().optional(),
  query: z.string().optional(),
});

const entityQuerySchema = z.object({
  type: z.enum(decisionEntityTypes),
  value: z.string().min(1),
  filePath: z.string().optional(),
});

const historyQuerySchema = z.object({
  id: z.string().optional(),
  type: z.enum(decisionEntityTypes).optional(),
  value: z.string().optional(),
});

export const createDecisionMemoryRouter = (service: DecisionMemoryService) => {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const parsed = createDecisionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid decision payload",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const decision = await service.createDecision(parsed.data);
      res.status(201).json(decision);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create decision";
      res.status(400).json({ error: message });
    }
  });

  router.get("/", async (req: Request, res: Response) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid decision query parameters",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const decisions = await service.listDecisions(parsed.data);
    res.status(200).json({ decisions });
  });

  router.get("/entity", async (req: Request, res: Response) => {
    const parsed = entityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid entity query parameters",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const context = await service.getByEntity({
      type: parsed.data.type,
      value: parsed.data.value,
      ...(parsed.data.filePath ? { filePath: parsed.data.filePath } : {}),
    });
    res.status(200).json(context);
  });

  router.get("/history", async (req: Request, res: Response) => {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid history query parameters",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const history = await service.getHistory({
      decisionId: parsed.data.id,
      entity:
        parsed.data.type && parsed.data.value
          ? {
              type: parsed.data.type,
              value: parsed.data.value,
            }
          : undefined,
    });
    res.status(200).json(history);
  });

  router.get("/:id", async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Missing decision ID" });
      return;
    }
    const decision = await service.getDecisionById(id);
    if (!decision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }
    res.status(200).json(decision);
  });

  return router;
};
