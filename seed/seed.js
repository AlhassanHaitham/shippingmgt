import bcrypt from "bcrypt";
import db, { getUserByUsername, createUser } from "../models/db.js";

// Seeds the admin user from ADMIN_USERNAME / ADMIN_PASSWORD in .env. No-op if
// the user already exists or the env vars are missing.
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

// Creates a test driver partner + user pair on boot. Idempotent — if the user
// already exists we just make sure they're linked to a driver partner.
async function seedDriver() {
  const username = "driver1";
  const password = "DriverPass123";

  const existing = await getUserByUsername(username);
  if (existing && existing.partner_id) return;

  // Reuse an existing driver partner if one exists with the same display name,
  // otherwise create one. Avoids piling up "Test Driver" rows on each boot.
  const [matches] = await db.query(
    "SELECT partner_id FROM partners WHERE partner_name = ? AND partner_type = 'driver'",
    ["Test Driver"],
  );
  let partnerID;
  if (matches.length > 0) {
    partnerID = matches[0].partner_id;
  } else {
    const [ins] = await db.query(
      "INSERT INTO partners (partner_name, partner_type) VALUES (?, 'driver')",
      ["Test Driver"],
    );
    partnerID = ins.insertId;
  }

  if (existing) {
    await db.query("UPDATE users SET partner_id = ? WHERE user_id = ?", [
      partnerID,
      existing.user_id,
    ]);
    console.log(`Linked existing user ${username} to partner #${partnerID}`);
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await createUser(username, hash, "driver", partnerID);
  console.log(
    `Seeded driver user: ${username} (password: ${password}) linked to partner #${partnerID}`,
  );
}

// Idempotent seed for the "driver one" demo account. Mirrors seedDriver() but
// uses different identifiers so both can coexist.
async function seedDriverOne() {
  const username = "driverone";
  const password = "DriverOne123";
  const partnerName = "driver one";

  const existing = await getUserByUsername(username);
  if (existing && existing.partner_id) return;

  const [matches] = await db.query(
    "SELECT partner_id FROM partners WHERE partner_name = ? AND partner_type = 'driver'",
    [partnerName],
  );
  let partnerID;
  if (matches.length > 0) {
    partnerID = matches[0].partner_id;
  } else {
    const [ins] = await db.query(
      "INSERT INTO partners (partner_name, partner_type, default_commission) VALUES (?, 'driver', 5)",
      [partnerName],
    );
    partnerID = ins.insertId;
  }

  if (existing) {
    await db.query("UPDATE users SET partner_id = ? WHERE user_id = ?", [
      partnerID,
      existing.user_id,
    ]);
    console.log(`Linked existing user ${username} to partner #${partnerID}`);
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await createUser(username, hash, "driver", partnerID);
  console.log(
    `Seeded driver user: ${username} (password: ${password}) linked to partner #${partnerID}`,
  );
}

// Runs all seeds. Each is isolated so one failure doesn't block the others.
export async function seedAll() {
  try {
    await seedAdmin();
  } catch (err) {
    console.error("Admin seed failed:", err);
  }
  try {
    await seedDriver();
  } catch (err) {
    console.error("Driver seed failed:", err);
  }
  try {
    await seedDriverOne();
  } catch (err) {
    console.error("Driver-one seed failed:", err);
  }
}
