import express from "express";
import bodyParser from "body-parser";
import methodOverride from "method-override";
import session from "express-session";
import bcrypt from "bcrypt";
import "dotenv/config";
import {
  getorders,
  getorderByID,
  pickAddress,
  inserOrder,
  allPartners,
  createordermovment,
  createCommissions,
  getLocations,
  updateOrder,
  updateOrderCommissions,
  updateOrderLocations,
  updateOrderPartners,
  deleteByID,
  getShippments,
  createshippments,
  deleteShippmentByID,
  updateShippment,
  getPartners,
  createPartner,
  deletePartnerByID,
  updatePartner,
  getUserByUsername,
  createUser,
  getAllOrdersDetails,
  getMerchantsData,
  getDriversData,
  getDashboardStats,
  getRecentOrders,
  getAccountingSummary,
  getMerchantBalances,
  getDriverBalances,
  recordPayment,
  recordCommissionsBookkeeping,
  getPayments,
  getAccounts,
  postingAllPartners,
  createLocation,
  listPartners,
  listCompanies,
  getOrderById,
  setOrderCommissionPlan,
  updateOrderFull,
  updateOrderStatus,
  getPartner,
  getPartnerLedger,
} from "./db.js";
import { translations } from "./translations.js";

import db from "./db.js";

const app = express();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// method-override: read _method from query string OR from form body
// (browser <form> can't natively PUT/DELETE, so
//  use a hidden _method field)
app.use(
  methodOverride(function (req) {
    if (req.body && typeof req.body === "object" && "_method" in req.body) {
      const m = req.body._method;
      delete req.body._method;
      return m;
    }
    if (req.query && req.query._method) {
      return req.query._method;
    }
  }),
);

if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET not set in .env — using insecure dev default");
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-only-insecure-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use((req, res, next) => {
  const sessionLang = req.session && req.session.lang;
  const lang = (req.query.lang || sessionLang || "en").toString();
  const dict = translations[lang] || translations.en;
  res.locals.lang = translations[lang] ? lang : "en";
  res.locals.dir =
    res.locals.lang === "ar" || res.locals.lang === "ku" ? "rtl" : "ltr";
  res.locals.t = dict;
  next();
});

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

// Language picker — shown before login on the first visit, and any time the
// user clicks "Change Language" from the login screen.
app.get("/language", (req, res) => {
  res.render("language");
});

// Persists the chosen language on the session and bounces back. Safe-redirects
// only to internal paths via return_to to avoid open-redirect.
app.get("/set-lang/:lang", (req, res) => {
  const lang = req.params.lang;
  if (translations[lang]) {
    req.session.lang = lang;
  }
  const rt = req.query.return_to;
  if (typeof rt === "string" && rt.startsWith("/")) {
    return res.redirect(rt);
  }
  if (req.session && req.session.user) return res.redirect("/");
  return res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  if (!req.session.lang) return res.redirect("/language");
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .render("login", { error: "Username and password are required" });
  }
  try {
    const user = await getUserByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).render("login", { error: "Invalid credentials" });
    }
    req.session.user = {
      id: user.user_id,
      username: user.username,
      role: user.role,
    };
    res.redirect("/");
  } catch (err) {
    console.error("login error:", err);
    res.status(500).render("login", { error: "Server error, try again" });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// dashboard
app.get("/", requireAuth, async (req, res) => {
  try {
    const [stats, recentOrders, partners] = await Promise.all([
      getDashboardStats(),
      getRecentOrders(5),
      listPartners(),
    ]);
    res.render("index", { stats, recentOrders, partners });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Dashboard error");
  }
});

// add a new inventory location (used from dashboard and order step 2)
app.post("/locations/new", requireAuth, async (req, res) => {
  try {
    const { location_name, type, partner_id, return_to } = req.body || {};
    if (!location_name || !location_name.trim()) {
      return res.status(400).send("location_name is required");
    }
    const partnerId =
      partner_id && partner_id !== "" ? Number(partner_id) : null;
    await createLocation(location_name.trim(), type || null, partnerId);
    // Only redirect to internal paths to avoid open-redirect.
    const safeReturn =
      typeof return_to === "string" && return_to.startsWith("/")
        ? return_to
        : "/";
    res.redirect(safeReturn);
  } catch (err) {
    console.error("location create error:", err);
    res.status(500).send("Failed to create location: " + err.message);
  }
});

// orders list (renders the orders.ejs table view with merchant/driver joined)
app.get("/orders", requireAuth, async (req, res) => {
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
});

// Update order — used by the inline edit modal on /orders.
// Browser form submits via POST with `_method=PUT` (method-override middleware).
app.put("/orders/update/:id", requireAuth, async (req, res) => {
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

    await updateOrderFull(orderID, {
      receiptnum: num(b.receiptnum),
      phone: b.phone || null,
      second_phone: b.second_phone || null,
      retrieve,
      notes: b.notes || null,
      order_value: num(b.order_value),
      profit: num(b.profit),
      driver_commission: num(b.driver_commission),
      company_commission: num(b.company_commission),
      merchant_partner_id: num(b.merchant_partner_id),
      assigned_driver_id: num(b.driver_partner_id),
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
});

// Status-only change. Used by the inline status dropdown on /orders.
app.post("/orders/:id/status", requireAuth, async (req, res) => {
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
});

// Per-partner ledger page. Linkable from /merchants, /drivers, /accounting.
app.get("/partners/:id", requireAuth, async (req, res) => {
  try {
    const partnerID = Number(req.params.id);
    const [partner, ledger] = await Promise.all([
      getPartner(partnerID),
      getPartnerLedger(partnerID),
    ]);
    if (!partner) return res.status(404).send("Partner not found");
    res.render("partner", { partner, ledger });
  } catch (err) {
    console.error("partner ledger error:", err);
    res.status(500).send("Partner ledger error");
  }
});

// merchants directory
app.get("/merchants", requireAuth, async (req, res) => {
  try {
    const merchants = await getMerchantsData();
    res.render("merchants", { merchants });
  } catch (err) {
    console.error("Merchants error:", err);
    res.status(500).send("Merchants error");
  }
});

// drivers directory
app.get("/drivers", requireAuth, async (req, res) => {
  try {
    const drivers = await getDriversData();
    res.render("drivers", { drivers });
  } catch (err) {
    console.error("Drivers error:", err);
    res.status(500).send("Drivers error");
  }
});

// accounting dashboard — real numbers from the double-entry ledger
app.get("/accounting", requireAuth, async (req, res) => {
  try {
    const [summary, balances, driverBalances, payments] = await Promise.all([
      getAccountingSummary(),
      getMerchantBalances(),
      getDriverBalances(),
      getPayments(10),
    ]);
    res.render("accounting", { summary, balances, driverBalances, payments });
  } catch (err) {
    console.error("Accounting error:", err);
    res.status(500).send("Accounting error");
  }
});

// chart of accounts (JSON for now — useful for inspection)
app.get("/accounts", requireAuth, async (req, res) => {
  try {
    const accounts = await getAccounts();
    res.json({ accounts });
  } catch (err) {
    console.error("Accounts error:", err);
    res.status(500).json({ error: "Accounts failed" });
  }
});

// record a payment — also writes the offsetting double-entry transaction
app.post("/payments/new", requireAuth, async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const payment_type = req.body.payment_type;
    const partner_id = req.body.partner_id ? Number(req.body.partner_id) : null;
    const order_id = req.body.order_id ? Number(req.body.order_id) : null;
    const notes = req.body.notes || null;
    if (
      !amount ||
      amount <= 0 ||
      !["incoming", "outgoing"].includes(payment_type)
    ) {
      return res.status(400).send("Invalid payment fields");
    }
    if (payment_type === "outgoing" && !partner_id) {
      return res.status(400).send("Outgoing payment requires partner_id");
    }
    await recordPayment({ amount, payment_type, partner_id, order_id, notes });
    res.redirect("/accounting");
  } catch (err) {
    console.error("payment error:", err);
    res.status(500).send("Payment failed: " + err.message);
  }
});

// support page (AI chat UI — backend is a stub until GEMINI_API_KEY is configured)
app.get("/support", requireAuth, (req, res) => {
  res.render("support");
});

app.post("/api/chat", requireAuth, (req, res) => {
  res.json({
    reply:
      "AI is not configured yet. Set GEMINI_API_KEY in .env to enable the assistant.",
  });
});

// road reports (static for now — no DB schema for road reports yet)
app.get("/reports", requireAuth, (req, res) => {
  res.render("reports");
});

app.get("/orders/new", requireAuth, async (req, res) => {
  try {
    res.render("stepOneOrder");
  } catch (err) {
    console.error("Database error:", err);
    res.send("Database error");
  }
});
/* 
   const { city_id, address_id } = req.params.id;

    const address = await pickAddress(city_id, address_id);

    res.render("order_step2", { address }); */
//create an order

app.post("/orders/new", requireAuth, async (req, res) => {
  const { receiptnum, phone, second_phone, retrieve, notes, order_value } =
    req.body;
  const retrievevalue = retrieve ? 1 : 0;
  const orderValue =
    order_value && order_value !== "" ? parseFloat(order_value) : null;
  if (orderValue !== null && (isNaN(orderValue) || orderValue < 0)) {
    return res.status(400).send("order_value must be a non-negative number");
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
  res.redirect(`/orders/${orderID}/location`);
});

app.get("/orders/:id/location", requireAuth, async (req, res) => {
  const orderID = req.params.id;
  const [rawLocations, partners] = await Promise.all([
    getLocations(),
    listPartners(),
  ]);
  const locations = rawLocations.map((l) => ({
    id: l.location_id,
    name:
      l.location_name +
      (l.partner_name ? ` — ${l.partner_name}` : "") +
      (l.type ? ` (${l.type})` : ""),
  }));
  res.render(`order_step2`, { orderID, locations, partners });
});

app.post("/orders/:id/location", requireAuth, async (req, res) => {
  const orderID = req.params.id;
  const { movement_type, from_location_id, to_location_id, movement_status } =
    req.body;
  const result = await createordermovment(
    orderID,
    movement_type,
    from_location_id,
    to_location_id,
    movement_status,
  );
  res.redirect(`/orders/${orderID}/merchant`);
});

//merchant shippment and driver
app.get("/orders/:id/merchant", requireAuth, async (req, res) => {
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
});

app.post("/orders/:id/merchant", requireAuth, async (req, res) => {
  const orderID = req.params.id;
  const {
    merchant_partner_id,
    driver_partner_id,
    shippment_id,
    company_partner_id,
  } = req.body;
  await db.query(
    "UPDATE orders SET merchant_partner_id = ?, assigned_driver_id = ?, shipment_id = ?, company_partner_id = ? WHERE order_id = ?",
    [
      merchant_partner_id || null,
      driver_partner_id || null,
      shippment_id || null,
      company_partner_id || null,
      orderID,
    ],
  );
  res.redirect(`/orders/${orderID}/commissions`);
});

app.get("/orders/:id/commissions", requireAuth, async (req, res) => {
  const orderID = req.params.id;
  const [[order]] = await db.query(
    `SELECT o.order_value,
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
  res.render("order_step4", { orderID, order: order || {} });
});

app.post("/orders/:id/commissions", requireAuth, async (req, res) => {
  const orderID = req.params.id;
  const profit = parseFloat(req.body.profit) || 0;
  const driver_commission = parseFloat(req.body.driver_commission) || 0;
  const company_commission = parseFloat(req.body.company_commission) || 0;

  try {
    const [[order]] = await db.query(
      "SELECT order_value FROM orders WHERE order_id = ?",
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

    res.redirect("/orders");
  } catch (err) {
    console.error("commissions error:", err);
    res.status(400).send("Could not save commission plan: " + err.message);
  }
});

//Delete order

app.delete("/orders/deleteByID/:id", requireAuth, async (req, res) => {
  const orderID = req.params.id;
  try {
    await deleteByID(orderID);
    res.json({ message: `Deleting order ${orderID}` });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "delete by Id failed" });
  }
}); //C.R.U.D shippment

app.get("/shippments", requireAuth, async (req, res) => {
  try {
    const shippments = await getShippments();
    console.log("here the shippmaets", shippments);
    res.json({ shippments, message: "shippments retuned" });
  } catch (err) {
    res.status(500).json({ error: "getting shippments failed" });
  }
});

app.post("/shippments/new", requireAuth, async (req, res) => {
  try {
    const {
      shippment_date,
      receiver_partner_id,
      sender_partner_id,
      return_to,
    } = req.body || {};

    if (!shippment_date) {
      return res.status(400).send("shippment_date is required");
    }

    const newShippment = await createshippments(
      shippment_date,
      receiver_partner_id || null,
      sender_partner_id || null,
    );

    if (typeof return_to === "string" && return_to.startsWith("/")) {
      return res.redirect(return_to);
    }
    res.json({ newShippment, message: "new shippment created" });
  } catch (err) {
    console.error("shippment create error:", err);
    res.status(500).send("Creating shippment failed: " + err.message);
  }
});

app.delete("/shippments/delete/:id", requireAuth, async (req, res) => {
  try {
    const shippment_id = req.params;

    const deletedShippment = await deleteShippmentByID(shippment_id);
    res.json({ deletedShippment, massage: " shippment deleted " });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "deleting shippments failed" });
  }
});

app.put("/shippments/update/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { shippment_date, receiver_partner_id, sender_partner_id } =
      req.body || {};

    console.log("body", req.body);
    console.log("id", req.params, id);

    const updatedShippment = await updateShippment(
      id,
      shippment_date ?? null,
      receiver_partner_id ?? null,
      sender_partner_id ?? null,
    );
    console.log(
      "this is new reciver partner id",
      receiver_partner_id,
      shippment_date,
      sender_partner_id,
    );

    console.log("here is the new shippmented updated", updatedShippment);

    res.json({ updatedShippment, massage: " shippment updated " });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "updating shippments failed" });
  }
});

//C.R.U.D partners

// C.R.U.D partners

app.get("/partners", requireAuth, async (req, res) => {
  try {
    const partners = await getPartners();

    console.log("here are the partners", partners);

    res.json({ partners, message: "partners returned" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "getting partners failed" });
  }
});

app.post("/partners/new", requireAuth, async (req, res) => {
  try {
    const { partner_name, partner_type, return_to } = req.body || {};

    if (!partner_name || !partner_name.trim()) {
      return res.status(400).send("partner_name is required");
    }
    if (!partner_type) {
      return res.status(400).send("partner_type is required");
    }

    const newPartner = await createPartner(partner_name.trim(), partner_type);

    if (typeof return_to === "string" && return_to.startsWith("/")) {
      return res.redirect(return_to);
    }
    res.json({ newPartner, message: "new partner created" });
  } catch (err) {
    console.error("partner create error:", err);
    res.status(500).send("Creating partner failed: " + err.message);
  }
});

app.delete("/partners/delete/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPartner = await deletePartnerByID(id);

    res.json({
      deletedPartner,
      message: "partner deleted",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "deleting partner failed" });
  }
});

app.put("/partners/update/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { partner_name, partner_type } = req.body || {};

    console.log("body", req.body);
    console.log("id", id);

    const updatedPartner = await updatePartner(
      id,
      partner_name ?? null,
      partner_type ?? null,
    );

    console.log("updated partner", updatedPartner);

    res.json({
      updatedPartner,
      message: "partner updated",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "updating partner failed" });
  }
});

// C.R.U.D partners

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn(
      "ADMIN_USERNAME / ADMIN_PASSWORD not set in .env — skipping admin seed",
    );
    return;
  }
  const existing = await getUserByUsername(username);
  if (existing) return;
  const hash = await bcrypt.hash(password, 10);
  await createUser(username, hash, "admin");
  console.log(`Seeded admin user: ${username}`);
}

seedAdmin().catch((err) => console.error("Admin seed failed:", err));

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
