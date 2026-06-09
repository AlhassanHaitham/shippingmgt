import { runMigrations } from "../models/db.js";
import { initDefaults } from "./defaults.js";
import { seedAll } from "../seed/seed.js";

// Runs once on startup, before the server starts listening: schema migrations →
// default Owner/HQ rows → seed users. Each step is isolated so one failure
// (e.g. DB not reachable) doesn't prevent the others or block app.listen().
export async function bootstrap() {
  try {
    await runMigrations();
  } catch (err) {
    console.error("Migration failed:", err);
  }
  try {
    const d = await initDefaults();
    console.log(
      `Defaults ready: Owner partner #${d.ownerPartnerID}, HQ location #${d.hqLocationID}`,
    );
  } catch (err) {
    console.error("Defaults bootstrap failed:", err);
  }
  await seedAll();
}
