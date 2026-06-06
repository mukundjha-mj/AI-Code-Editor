import { Router } from "express";

export const createHealthRouter = () => {
  const router = Router();

  router.get("/", (_req, res) => {
    res.status(200).json({ status: "ok", service: "backend" });
  });

  return router;
};
