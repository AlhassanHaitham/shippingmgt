import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as shipments from "../controllers/shipmentsController.js";

const router = Router();

// Paths keep the legacy "shippment" (double-p) spelling to match the DB columns.
router.get("/shippments", requireAuth, shipments.list);
router.post("/shippments/new", requireAuth, shipments.create);
router.delete("/shippments/delete/:id", requireAuth, shipments.remove);
router.put("/shippments/update/:id", requireAuth, shipments.update);

export default router;
