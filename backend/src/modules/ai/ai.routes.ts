import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import type { AiService } from "./ai.service";
import type { AiCapability } from "./ai.types";

const aiRequestSchema = z.object({
  input: z.string().min(1),
});

const buildHandler =
  (service: AiService, capability: AiCapability) => async (req: Request, res: Response) => {
    const parsed = aiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const response = await service.execute(
      {
        capability,
        userText: parsed.data.input,
      },
      "mock",
    );

    res.status(200).json(response);
  };

export const createAiRouter = (service: AiService) => {
  const router = Router();

  router.post("/chat", buildHandler(service, "chat"));
  router.post("/explain-code", buildHandler(service, "codeExplanation"));
  router.post("/intent-mode", buildHandler(service, "intentOptimization"));
  router.post("/repository-analysis", buildHandler(service, "repositoryAnalysis"));
  router.post("/decision-memory", buildHandler(service, "decisionMemory"));

  return router;
};
