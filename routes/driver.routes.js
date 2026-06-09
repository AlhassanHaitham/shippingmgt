import { Router } from "express";
import { requireDriver } from "../middleware/auth.js";
import * as driver from "../controllers/driverController.js";

const router = Router();

router.get("/driver", requireDriver, driver.portal);
router.post("/driver/orders/:id/deliver", requireDriver, driver.deliver);
router.post("/driver/orders/:id/cancel-mine", requireDriver, driver.cancelMine);
router.post(
  "/driver/orders/:id/cancel-customer",
  requireDriver,
  driver.cancelCustomer,
);
router.post("/driver/status", requireDriver, driver.setAvailability);
router.post("/driver/reports", requireDriver, driver.createReport);
router.post("/driver/clearance", requireDriver, driver.createClearance);

export default router;
