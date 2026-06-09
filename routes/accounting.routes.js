import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as accounting from "../controllers/accountingController.js";

const router = Router();

router.get("/accounting", requireAuth, accounting.dashboard);
router.get("/accounts", requireAuth, accounting.accounts);
router.post("/payments/new", requireAuth, accounting.createPaymentHandler);

export default router;
