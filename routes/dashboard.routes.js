import { Router } from "express";
import * as dashboard from "../controllers/dashboardController.js";

const router = Router();

// Public entry point — the controller itself decides guest vs dashboard vs driver.
router.get("/", dashboard.home);

export default router;
