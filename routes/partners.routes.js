import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as partners from "../controllers/partnersController.js";

const router = Router();

// Page views
router.get("/partners/:id", requireAuth, partners.ledger); // per-partner ledger
router.get("/merchants", requireAuth, partners.merchants);
router.get("/drivers", requireAuth, partners.drivers);

// C.R.U.D (JSON API). GET /partners (exact) can't be shadowed by /partners/:id.
router.get("/partners", requireAuth, partners.list);
router.post("/partners/new", requireAuth, partners.create);
router.delete("/partners/delete/:id", requireAuth, partners.remove);
router.put("/partners/update/:id", requireAuth, partners.update);

export default router;
