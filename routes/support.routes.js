import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as support from "../controllers/supportController.js";

const router = Router();

router.get("/support", requireAuth, support.page);
router.post("/api/chat", requireAuth, support.chat);
router.post("/api/chat/reset", requireAuth, support.reset);

export default router;
