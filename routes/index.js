import authRoutes from "./auth.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import driverRoutes from "./driver.routes.js";
import locationsRoutes from "./locations.routes.js";
import ordersRoutes from "./orders.routes.js";
import partnersRoutes from "./partners.routes.js";
import accountingRoutes from "./accounting.routes.js";
import supportRoutes from "./support.routes.js";
import reportsRoutes from "./reports.routes.js";
import shipmentsRoutes from "./shipments.routes.js";

// Mounts every feature router on the app. Each router declares absolute paths,
// and the routers own distinct path prefixes, so mount order is not significant.
export function mountRoutes(app) {
  app.use(authRoutes);
  app.use(dashboardRoutes);
  app.use(driverRoutes);
  app.use(locationsRoutes);
  app.use(ordersRoutes);
  app.use(partnersRoutes);
  app.use(accountingRoutes);
  app.use(supportRoutes);
  app.use(reportsRoutes);
  app.use(shipmentsRoutes);
}
