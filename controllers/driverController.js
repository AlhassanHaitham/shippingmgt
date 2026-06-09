import {
  getDriverInfo,
  getDriverOrdersByBucket,
  getDriverReports,
  getDriverClearances,
  driverChangeOrderStatus,
  setDriverAvailability,
  createRoadReport,
  createLegalClearance,
} from "../models/db.js";

// Driver portal home — the driver's own orders bucketed by status, plus their
// recent road reports and legal clearances.
export async function portal(req, res) {
  try {
    const partnerID = req.session.user.partner_id;
    if (!partnerID) {
      return res
        .status(400)
        .send("Driver user has no partner_id linked. Contact an admin.");
    }
    const [
      driver,
      pending,
      delivered,
      cancelledByMe,
      cancelledByCustomer,
      reports,
      clearances,
    ] = await Promise.all([
      getDriverInfo(partnerID),
      getDriverOrdersByBucket(partnerID, "pending"),
      getDriverOrdersByBucket(partnerID, "delivered"),
      getDriverOrdersByBucket(partnerID, "cancelled_by_driver"),
      getDriverOrdersByBucket(partnerID, "cancelled_by_customer"),
      getDriverReports(partnerID, 5),
      getDriverClearances(partnerID, 5),
    ]);
    if (!driver) return res.status(404).send("Driver not found");
    res.render("translation", {
      driver,
      pending,
      delivered,
      cancelledByMe,
      cancelledByCustomer,
      // Back-compat with the existing "orders" reference in the view —
      // mirrors the pending bucket so older sections still render.
      orders: pending,
      reports,
      clearances,
    });
  } catch (err) {
    console.error("driver portal error:", err);
    res.status(500).send("Driver portal error");
  }
}

// Driver-side status actions. Each verifies the order is assigned to the
// logged-in driver before flipping status.
export async function deliver(req, res) {
  try {
    await driverChangeOrderStatus(
      req.session.user.partner_id,
      Number(req.params.id),
      "Delivered",
    );
    res.redirect("/driver");
  } catch (err) {
    console.error("driver deliver error:", err);
    res.status(400).send("Could not mark delivered: " + err.message);
  }
}

export async function cancelMine(req, res) {
  try {
    await driverChangeOrderStatus(
      req.session.user.partner_id,
      Number(req.params.id),
      "Cancelled",
      "driver",
    );
    res.redirect("/driver");
  } catch (err) {
    console.error("driver cancel-mine error:", err);
    res.status(400).send("Could not cancel: " + err.message);
  }
}

export async function cancelCustomer(req, res) {
  try {
    await driverChangeOrderStatus(
      req.session.user.partner_id,
      Number(req.params.id),
      "Cancelled",
      "customer",
    );
    res.redirect("/driver");
  } catch (err) {
    console.error("driver cancel-customer error:", err);
    res.status(400).send("Could not cancel: " + err.message);
  }
}

export async function setAvailability(req, res) {
  try {
    const partnerID = req.session.user.partner_id;
    const next =
      req.body && req.body.availability === "not_available"
        ? "not_available"
        : "available";
    await setDriverAvailability(partnerID, next);
    res.json({ availability: next });
  } catch (err) {
    console.error("driver status error:", err);
    res.status(400).json({ error: err.message });
  }
}

export async function createReport(req, res) {
  try {
    const partnerID = req.session.user.partner_id;
    const { report_type, location, details } = req.body || {};
    const allowed = ["traffic", "checkpoint", "weather", "accident"];
    if (!allowed.includes(report_type)) {
      return res.status(400).send("Invalid report_type");
    }
    await createRoadReport({
      partner_id: partnerID,
      report_type,
      location,
      details,
    });
    res.redirect("/driver");
  } catch (err) {
    console.error("driver report error:", err);
    res.status(400).send("Could not record report: " + err.message);
  }
}

export async function createClearance(req, res) {
  try {
    const partnerID = req.session.user.partner_id;
    const { checkpoint, manifest_code } = req.body || {};
    if (!checkpoint && !manifest_code) {
      return res.status(400).send("Checkpoint or manifest code required");
    }
    await createLegalClearance({
      partner_id: partnerID,
      checkpoint,
      manifest_code,
    });
    res.redirect("/driver");
  } catch (err) {
    console.error("driver clearance error:", err);
    res.status(400).send("Could not record clearance: " + err.message);
  }
}
