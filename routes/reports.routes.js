import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as reports from "../controllers/reportsController.js";

const router = Router();

router.get("/reports", requireAuth, reports.page);

export default router;
