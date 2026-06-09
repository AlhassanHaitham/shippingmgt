import db, {
  getAllOrdersDetails,
  allPartners,
  listCompanies,
  bulkAssignShipment,
  bulkAssignDriver,
  getDriverDefaultCommission,
  updateOrderFull,
  updateOrderStatus,
  getLocations,
  inserOrder,
  createordermovment,
  setOrderCommissionPlan,
  deleteByID,
} from "../models/db.js";
import { DEFAULTS } from "../config/defaults.js";

// Orders list (renders the orders.ejs table view with merchant/driver joined).
export async function list(req, res) {
  try {
    const [orders, partnersAll, companies] = await Promise.all([
      getAllOrdersDetails(),
      allPartners(),
      listCompanies(),
    ]);
    const merchants = partnersAll.merchants.map((m) => ({
      id: m.partner_id,
      name: m.partner_name,
    }));
    const drivers = partnersAll.drivers.map((d) => ({
      id: d.partner_id,
      name: d.partner_name,
    }));
    const shipments = partnersAll.shipments.map((s) => ({
      id: s.shippment_id,
      name: `Shipment #${s.shippment_id}`,
    }));
    const companiesList = companies.map((c) => ({
      id: c.partner_id,
      name: c.partner_name,
    }));
    res.render("orders", {
      orders,
      merchants,
      drivers,
      shipments,
      companies: companiesList,
    });
  } catch (err) {
    console.error("Orders error:", err);
    res.status(500).send("Orders error");
  }
}

// Bulk-assign a shipment to selected orders from /orders.
export async function assignShipment(req, res) {
  try {
    const { shipment_id } = req.body || {};
    let orderIDs = req.body && req.body.order_ids;
    if (typeof orderIDs === "string") orderIDs = [orderIDs];
    if (!Array.isArray(orderIDs) || orderIDs.length === 0) {
      return res.status(400).send("Select at least one order");
    }
    if (!shipment_id) {
      return res.status(400).send("shipment_id is required");
    }
    await bulkAssignShipment(orderIDs, shipment_id);
    res.redirect("/orders");
  } catch (err) {
    console.error("bulk shipment assign error:", err);
    res.status(400).send("Bulk assign failed: " + err.message);
  }
}

// Bulk-assign a driver to selected orders from /orders.
export async function assignDriver(req, res) {
  try {
    const { driver_partner_id } = req.body || {};
    let orderIDs = req.body && req.body.order_ids;
    if (typeof orderIDs === "string") orderIDs = [orderIDs];
    if (!Array.isArray(orderIDs) || orderIDs.length === 0) {
      return res.status(400).send("Select at least one order");
    }
    if (!driver_partner_id) {
      return res.status(400).send("driver_partner_id is required");
    }
    await bulkAssignDriver(orderIDs, driver_partner_id);
    res.redirect("/orders");
  } catch (err) {
    console.error("bulk driver assign error:", err);
    res.status(400).send("Bulk assign failed: " + err.message);
  }
}

// Update order — used by the inline edit modal on /orders.
// Browser form submits via POST with `_method=PUT` (method-override middleware).
export async function update(req, res) {
  try {
    const orderID = Number(req.params.id);
    const b = req.body || {};

    // Numeric fields: convert empty strings to null
    const num = (v) =>
      v === undefined || v === null || v === "" ? null : Number(v);
    let retrieve = null;
    if (b.retrieve !== undefined) {
      retrieve =
        b.retrieve === "on" ||
        b.retrieve === "1" ||
        b.retrieve === 1 ||
        b.retrieve === true
          ? 1
          : 0;
    }

    // Auto-default driver_commission to that driver's default_commission when
    // a driver is being assigned and the admin left the field blank. Keeps
    // explicit overrides.
    let driverCommission = num(b.driver_commission);
    const newDriverID = num(b.driver_partner_id);
    if (driverCommission === null && newDriverID != null) {
      const [[cur]] = await db.query(
        "SELECT driver_commission FROM orders WHERE order_id = ?",
        [orderID],
      );
      const existing = cur ? Number(cur.driver_commission) || 0 : 0;
      if (!existing)
        driverCommission = await getDriverDefaultCommission(newDriverID);
    }

    await updateOrderFull(orderID, {
      receiptnum: num(b.receiptnum),
      phone: b.phone || null,
      second_phone: b.second_phone || null,
      retrieve,
      notes: b.notes || null,
      order_value: num(b.order_value),
      profit: num(b.profit),
      driver_commission: driverCommission,
      company_commission: num(b.company_commission),
      merchant_partner_id: num(b.merchant_partner_id),
      assigned_driver_id: newDriverID,
      company_partner_id: num(b.company_partner_id),
      shipment_id: num(b.shippment_id),
      status: b.status || null, // triggers updateOrderStatus side-effects
    });

    if (typeof b.return_to === "string" && b.return_to.startsWith("/")) {
      return res.redirect(b.return_to);
    }
    res.json({ message: "order updated" });
  } catch (err) {
    console.error("update order error:", err);
    res.status(400).send("Could not update order: " + err.message);
  }
}

// Status-only change. Used by the inline status dropdown on /orders.
export async function changeStatus(req, res) {
  try {
    const orderID = Number(req.params.id);
    const newStatus = (req.body && req.body.status) || "";
    const result = await updateOrderStatus(orderID, newStatus);
    if (
      typeof req.body.return_to === "string" &&
      req.body.return_to.startsWith("/")
    ) {
      return res.redirect(req.body.return_to);
    }
    res.json({ message: "status updated", ...result });
  } catch (err) {
    console.error("status change error:", err);
    res.status(400).send("Could not change status: " + err.message);
  }
}

// ─── new-order wizard ───────────────────────────────────────────────────
// Step 0 — pick the sender merchant. Sits before the customer-details form
// so the rest of the wizard knows who's sending. Stored on the session so
// the chain-create button on step 4 can keep reusing it.
export async function senderForm(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT partner_id AS id, partner_name AS name
         FROM partners
         WHERE partner_type IN ('supplier','merchant')
           AND (? IS NULL OR partner_id <> ?)
         ORDER BY partner_name`,
      [DEFAULTS.ownerPartnerID, DEFAULTS.ownerPartnerID],
    );
    const selectedSenderID =
      (req.session.pendingSender && req.session.pendingSender.id) || null;
    res.render("order_step0", { senders: rows, selectedSenderID });
  } catch (err) {
    console.error("step0 render error:", err);
    res.status(500).send("Could not load sender picker: " + err.message);
  }
}

export async function saveSender(req, res) {
  try {
    const senderID = Number(req.body && req.body.sender_partner_id);
    if (!senderID) return res.status(400).send("sender_partner_id is required");
    const [[partner]] = await db.query(
      "SELECT partner_id, partner_name FROM partners WHERE partner_id = ?",
      [senderID],
    );
    if (!partner) return res.status(400).send("Sender merchant not found");
    req.session.pendingSender = {
      id: partner.partner_id,
      name: partner.partner_name,
    };
    res.redirect("/orders/new");
  } catch (err) {
    console.error("step0 save error:", err);
    res.status(500).send("Could not save sender: " + err.message);
  }
}

// Clears the chained sender from the session — used by the "Change sender"
// link on step 1.
export function clearSender(req, res) {
  req.session.pendingSender = null;
  res.redirect("/orders/new/sender");
}

export async function newForm(req, res) {
  try {
    if (!req.session.pendingSender || !req.session.pendingSender.id) {
      return res.redirect("/orders/new/sender");
    }
    res.render("stepOneOrder", { sender: req.session.pendingSender });
  } catch (err) {
    console.error("Database error:", err);
    res.send("Database error");
  }
}

// create an order
export async function create(req, res) {
  const { receiptnum, phone, second_phone, retrieve, notes, order_value } =
    req.body;
  const retrievevalue = retrieve ? 1 : 0;
  const orderValue =
    order_value && order_value !== "" ? parseFloat(order_value) : null;
  if (orderValue !== null && (isNaN(orderValue) || orderValue < 0)) {
    return res.status(400).send("order_value must be a non-negative number");
  }
  const senderID = req.session.pendingSender && req.session.pendingSender.id;
  if (!senderID) {
    return res.redirect("/orders/new/sender");
  }
  const result = await inserOrder(
    receiptnum,
    phone,
    second_phone,
    retrievevalue,
    notes,
    orderValue,
  );
  const orderID = result.insertId;
  // Set the picked sender as merchant_partner_id and apply the owner's
  // default 5 flat profit. Driver + shipment are assigned later from /orders.
  try {
    await db.query(
      "UPDATE orders SET merchant_partner_id = ?, profit = 5 WHERE order_id = ?",
      [senderID, orderID],
    );
  } catch (err) {
    console.error("apply sender/profit-default failed:", err);
  }
  res.redirect(`/orders/${orderID}/location`);
}

export async function locationForm(req, res) {
  const orderID = req.params.id;
  const rawLocations = await getLocations();
  // Exclude the HQ from the TO dropdown — it's already the FROM by default.
  const locations = rawLocations
    .filter((l) => l.location_id !== DEFAULTS.hqLocationID)
    .map((l) => ({
      id: l.location_id,
      name:
        l.location_name +
        (l.partner_name ? ` — ${l.partner_name}` : "") +
        (l.type ? ` (${l.type})` : ""),
    }));
  res.render(`order_step2`, {
    orderID,
    locations,
    defaults: DEFAULTS,
    sender: req.session.pendingSender || null,
  });
}

export async function saveLocation(req, res) {
  const orderID = req.params.id;
  const { to_location_id } = req.body;
  if (!to_location_id) {
    return res.status(400).send("to_location_id is required");
  }
  // FROM defaults to the seeded HQ; movement_type is no longer collected
  // (the field has been removed from the form).
  await createordermovment(
    orderID,
    null,
    DEFAULTS.hqLocationID,
    to_location_id,
    "Pending",
  );
  res.redirect(`/orders/${orderID}/commissions`);
}

// Legacy step-3 route — kept to avoid 404s for anything that still links here,
// but the new creation flow skips straight from step 2 to step 4.
export async function merchantForm(req, res) {
  const orderID = req.params.id;
  const [raw, companies] = await Promise.all([allPartners(), listCompanies()]);
  const merchants = raw.merchants.map((m) => ({
    id: m.partner_id,
    name: m.partner_name,
  }));
  const drivers = raw.drivers.map((d) => ({
    id: d.partner_id,
    name: d.partner_name,
  }));
  const shipments = raw.shipments.map((s) => ({
    id: s.shippment_id,
    name: `Shipment #${s.shippment_id}`,
  }));
  const companyOptions = companies.map((c) => ({
    id: c.partner_id,
    name: c.partner_name,
  }));
  res.render("order_step3", {
    orderID,
    merchants,
    drivers,
    shipments,
    companies: companyOptions,
  });
}

export async function saveMerchant(req, res) {
  const orderID = req.params.id;
  const {
    merchant_partner_id,
    driver_partner_id,
    shippment_id,
    company_partner_id,
  } = req.body;
  // Assigning a driver also copies that driver's default_commission into
  // driver_commission when it hasn't been set yet on the order.
  const driverIDNum = driver_partner_id ? Number(driver_partner_id) : null;
  const driverDefault = driverIDNum
    ? await getDriverDefaultCommission(driverIDNum)
    : null;
  await db.query(
    `UPDATE orders
        SET merchant_partner_id = ?,
            assigned_driver_id = ?,
            shipment_id = ?,
            company_partner_id = ?,
            driver_commission = CASE
              WHEN ? IS NOT NULL AND (driver_commission IS NULL OR driver_commission = 0) THEN ?
              ELSE driver_commission
            END
      WHERE order_id = ?`,
    [
      merchant_partner_id || null,
      driverIDNum,
      shippment_id || null,
      company_partner_id || null,
      driverIDNum,
      driverDefault,
      orderID,
    ],
  );
  res.redirect(`/orders/${orderID}/commissions`);
}

export async function commissionsForm(req, res) {
  const orderID = req.params.id;
  const [[order]] = await db.query(
    `SELECT o.order_value,
            o.profit,
            o.driver_commission,
            o.company_commission,
            o.assigned_driver_id,
            m.partner_name AS merchant_name,
            d.partner_name AS driver_name,
            c.partner_name AS company_name,
            o.company_partner_id
       FROM orders o
       LEFT JOIN partners m ON o.merchant_partner_id = m.partner_id
       LEFT JOIN partners d ON o.assigned_driver_id = d.partner_id
       LEFT JOIN partners c ON o.company_partner_id = c.partner_id
       WHERE o.order_id = ?`,
    [orderID],
  );
  res.render("order_step4", {
    orderID,
    order: order || {},
    sender: req.session.pendingSender || null,
  });
}

export async function saveCommissions(req, res) {
  const orderID = req.params.id;
  const profit = parseFloat(req.body.profit) || 0;
  const company_commission = parseFloat(req.body.company_commission) || 0;
  const nextAction = (req.body && req.body.next_action) || "done";

  try {
    const [[order]] = await db.query(
      "SELECT order_value, driver_commission FROM orders WHERE order_id = ?",
      [orderID],
    );
    if (!order || !order.order_value || Number(order.order_value) <= 0) {
      return res
        .status(400)
        .send(
          "This order has no order_value set. Go back to step 1 and enter the merchant's price.",
        );
    }
    const orderValue = Number(order.order_value);
    // Driver commission is auto-applied on driver assignment (not on this form),
    // so we preserve whatever's already on the row.
    const driver_commission = Number(order.driver_commission) || 0;
    if (profit + driver_commission + company_commission > orderValue + 0.005) {
      return res
        .status(400)
        .send(
          `Allocations exceed order_value (${profit + driver_commission + company_commission} > ${orderValue})`,
        );
    }

    // Store the planned split. No transaction posted yet —
    // that happens when the order's status moves to "Delivered".
    await setOrderCommissionPlan(
      Number(orderID),
      profit,
      driver_commission,
      company_commission,
    );

    // "Create another for this sender" keeps the session sender so step 1
    // reuses it. "Done" clears it.
    if (nextAction === "chain" && req.session.pendingSender) {
      return res.redirect("/orders/new");
    }
    req.session.pendingSender = null;
    res.redirect("/orders");
  } catch (err) {
    console.error("commissions error:", err);
    res.status(400).send("Could not save commission plan: " + err.message);
  }
}

// Delete order
export async function remove(req, res) {
  const orderID = req.params.id;
  try {
    await deleteByID(orderID);
    res.json({ message: `Deleting order ${orderID}` });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "delete by Id failed" });
  }
}
