import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as locations from "../controllers/locationsController.js";

const router = Router();

router.post("/locations/new", requireAuth, locations.create);

export default router;
