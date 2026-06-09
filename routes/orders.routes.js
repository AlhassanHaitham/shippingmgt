import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as orders from "../controllers/ordersController.js";

const router = Router();

// list + bulk actions + inline edits
router.get("/orders", requireAuth, orders.list);
router.post("/orders/assign/shipment", requireAuth, orders.assignShipment);
router.post("/orders/assign/driver", requireAuth, orders.assignDriver);
router.put("/orders/update/:id", requireAuth, orders.update);
router.post("/orders/:id/status", requireAuth, orders.changeStatus);

// new-order wizard (step 0 → 4). More specific /orders/new* paths are declared
// before the /orders/:id/* ones so they aren't shadowed by the :id param.
router.get("/orders/new/sender", requireAuth, orders.senderForm);
router.post("/orders/new/sender", requireAuth, orders.saveSender);
router.post("/orders/new/sender/clear", requireAuth, orders.clearSender);
router.get("/orders/new", requireAuth, orders.newForm);
router.post("/orders/new", requireAuth, orders.create);
router.get("/orders/:id/location", requireAuth, orders.locationForm);
router.post("/orders/:id/location", requireAuth, orders.saveLocation);
router.get("/orders/:id/merchant", requireAuth, orders.merchantForm);
router.post("/orders/:id/merchant", requireAuth, orders.saveMerchant);
router.get("/orders/:id/commissions", requireAuth, orders.commissionsForm);
router.post("/orders/:id/commissions", requireAuth, orders.saveCommissions);

router.delete("/orders/deleteByID/:id", requireAuth, orders.remove);

export default router;
