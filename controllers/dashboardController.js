import {
  getDashboardStats,
  getRecentOrders,
  listPartners,
} from "../models/db.js";

// Root: landing page for guests, admin/merchant dashboard for logged-in
// non-drivers, driver portal for drivers.
export async function home(req, res) {
  if (!req.session.user) return res.render("driverInterface");
  if (req.session.user.role === "driver") return res.redirect("/driver");
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
}
