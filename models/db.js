import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config();

const db = mysql
  .createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,

    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
  })
  .promise();

export async function getorders() {
  const [rows] = await db.query("select * from orders");

  return rows;
}

export async function getorderByID(id) {
  const [rows] = await db.query("select * from orders where ?", [id]);

  return rows[0];
}

// find address by id

export async function pickAddress(city_id, address_id) {
  // Get all addresses for the city
  const [cityAddresses] = await db.query(
    "SELECT address_id, address_name FROM address WHERE city_id = ?",
    [city_id],
  );

  // Check if selected address belongs to the city
  const [selectedAddress] = await db.query(
    "SELECT address_id, address_name FROM address WHERE address_id = ? AND city_id = ?",
    [address_id, city_id],
  );

  if (selectedAddress.length === 0) {
    throw new Error("Address does not belong to the selected city");
  }

  return {
    /* availableAddresses: cityAddresses, */
    selected: selectedAddress[0],
  };
}

export async function inserOrder(
  receiptnum,
  phone,
  second_phone,
  retrievevalue,
  notes,
  order_value,
) {
  const [result] = await db.query(
    "insert into orders (receiptnum, phone, second_phone, retrieve, notes, order_value) values (?,?,?,?,?,?)",
    [receiptnum, phone, second_phone, retrievevalue, notes, order_value ?? null],
  );
  return result;
}

export async function listCompanies() {
  const [rows] = await db.query(
    "SELECT partner_id, partner_name FROM partners WHERE partner_type = 'company' ORDER BY partner_name",
  );
  return rows;
}

export async function getLocations() {
  const [locations] = await db.query(`
    SELECT l.location_id, l.location_name, l.type, p.partner_name
    FROM inventory_locations l
    LEFT JOIN partners p ON l.partner_id = p.partner_id
    ORDER BY l.location_name
  `);

  return locations;
}

export async function createLocation(location_name, type, partner_id) {
  const [result] = await db.query(
    "INSERT INTO inventory_locations (location_name, type, partner_id) VALUES (?, ?, ?)",
    [location_name, type || null, partner_id || null],
  );
  return result;
}

export async function listPartners() {
  const [rows] = await db.query(
    "SELECT partner_id, partner_name, partner_type FROM partners ORDER BY partner_name",
  );
  return rows;
}

export async function createordermovment(
  orderID,
  movement_type,
  from_location_id,
  to_location_id,
  movement_status,
) {
  const result = db.query(
    `INSERT INTO order_movements
    (order_id, movement_date, movement_type, from_location_id, to_location_id, movement_status)
    VALUES (?, NOW(), ?, ?, ?, ?)`,
    [orderID, movement_type, from_location_id, to_location_id, movement_status],
  );

  return result;
}

export async function allPartners() {
  const [resultMerchant] = await db.query(
    "select * from partners where partner_type='supplier'",
  );
  const [resultDriver] = await db.query(
    "select * from partners where partner_type='driver'",
  );
  const [resultshippment] = await db.query("select * from shipments");

  return {
    merchants: resultMerchant,
    drivers: resultDriver,
    shipments: resultshippment,
  };
}

//posting merchant, driver and shippment

export async function postingAllPartners(
  merchant_partner_id,
  driver_partner_id,
  shippment_id,
  orderID,
) {
  db.query("UPDATE orders SET merchant_partner_id=? WHERE order_id=?", [
    merchant_partner_id,
    orderID,
  ]);
  (db.query("UPDATE orders SET assigned_driver_id=? WHERE order_id=?"),
    [driver_partner_id, orderID]);
  db.query("UPDATE orders SET shipment_id=? WHERE order_id=?", [
    shippment_id,
    orderID,
  ]);
}

export async function createCommissions(
  delivery_price,
  driver_commission,
  merchant_commission,
  orderID,
) {
  await db.query(
    "INSERT INTO commissions(order_id,commission_type,amount) VALUES(?,?,?)",
    [orderID, "incoming", delivery_price],
  );

  await db.query(
    "INSERT INTO commissions(order_id,commission_type,amount) VALUES(?,?,?)",
    [orderID, "outgoing", driver_commission],
  );

  await db.query(
    "INSERT INTO commissions(order_id,commission_type,amount) VALUES(?,?,?)",
    [orderID, "outgoing", merchant_commission],
  );
}
//update order

export async function updateOrder(
  order_id,
  receiptnum,
  phone,
  second_phone,
  retrieve,
  notes,
) {
  const sql = `
  UPDATE orders
  SET receiptnum = COALESCE(?, receiptnum),
      phone = COALESCE(?, phone),
      second_phone = COALESCE(?, second_phone),
      retrieve = COALESCE(?, retrieve),
      notes = COALESCE(?, notes)
  WHERE order_id = ?
`;

  return db.query(sql, [
    receiptnum,
    phone,
    second_phone,
    retrieve,
    notes,
    order_id,
  ]);
}

export async function updateOrderLocations(
  from_location_id,
  to_location_id,
  movement_status,
  orderID,
) {
  const sql = `UPDATE order_movements SET from_location_id= ?,to_location_id=?,movement_status=? WHERE order_id=? 
  `;

  return db.query(sql, [
    from_location_id,
    to_location_id,
    movement_status,
    orderID,
  ]);
}
export async function updateOrderPartners(
  /* assigned_driver_id = COALESCE(?, assigned_driver_id), */
  order_id,
  merchant_partner_id,
  assigned_driver_id,
  shipment_id,
) {
  const sql = `
    UPDATE orders
    SET merchant_partner_id = COALESCE(?, merchant_partner_id),
       assigned_driver_id = COALESCE(?, assigned_driver_id), 
        shipment_id = COALESCE(?, shipment_id)
    WHERE order_id = ?
  `;

  return db.query(sql, [
    merchant_partner_id ?? null,
    assigned_driver_id ?? null,
    shipment_id ?? null,
    order_id,
  ]);
}

export async function updateOrderCommissions({
  order_id,
  driver_partner_id,
  merchant_partner_id,
  driver_commission,
  merchant_commission,
}) {
  // 1. Driver commission (outgoing)
  if (driver_partner_id && driver_commission != null) {
    await db.query(
      `
      INSERT INTO commissions (order_id, partner_id, commission_type, amount)
      VALUES (?, ?, 'outgoing', ?)
      ON DUPLICATE KEY UPDATE amount = VALUES(amount)
      `,
      [order_id, driver_partner_id, driver_commission],
    );
  }

  // 2. Merchant commission (incoming)
  if (merchant_partner_id && merchant_commission != null) {
    await db.query(
      `
      INSERT INTO commissions (order_id, partner_id, commission_type, amount)
      VALUES (?, ?, 'incoming', ?)
      ON DUPLICATE KEY UPDATE amount = VALUES(amount)
      `,
      [order_id, merchant_partner_id, merchant_commission],
    );
  }
}

//deleting
//-- delete by id
export async function deleteByID(orderID) {
  const sql = `DELETE FROM orders WHERE order_id =?`;
  return await db.query(sql, [orderID]);
}

//C.R.U.D shippment

export async function getShippments() {
  const sql = `select * from shipments`;

  return await db.query(sql);
}

export async function createshippments(
  shippment_date,
  receiver_partner_id,
  sender_partner_id,
) {
  const sql = `INSERT INTO shipments (shippment_date,receiver_partner_id,
  sender_partner_id) values(?,?,?)`;
  return await db.query(sql, [
    shippment_date,
    receiver_partner_id,
    sender_partner_id,
  ]);
}

export async function deleteShippmentByID(shippment_id) {
  const sql = `delete from shipments where shippment_id=?`;

  const deletedShippment = await db.query(sql, [shippment_id]);

  return deletedShippment;
}

export async function updateShippment(
  shippment_id,
  shippment_date,
  receiver_partner_id,
  sender_partner_id,
) {
  const sql = `UPDATE shipments
SET
  shippment_date = COALESCE(?, shippment_date),
  receiver_partner_id = COALESCE(?, receiver_partner_id),
  sender_partner_id = COALESCE(?, sender_partner_id)
WHERE shippment_id = ?;`;
  const updatedShippment = await db.query(sql, [
    shippment_id,
    shippment_date,
    receiver_partner_id,
    sender_partner_id,
  ]);
  return updatedShippment;
}

// C.R.U.D partners
// partners

export async function getPartners() {
  const sql = `SELECT * FROM partners`;

  return await db.query(sql);
}

export async function createPartner(partner_name, partner_type, default_commission = null) {
  // default_commission only applies to drivers; the column has DEFAULT 5 so
  // non-driver rows still get a valid value if we pass NULL.
  const sql = `
    INSERT INTO partners
    (partner_name, partner_type, default_commission)
    VALUES (?, ?, COALESCE(?, 5))
  `;

  return await db.query(sql, [partner_name, partner_type, default_commission]);
}

export async function deletePartnerByID(partner_id) {
  const sql = `
    DELETE FROM partners
    WHERE partner_id = ?
  `;

  const deletedPartner = await db.query(sql, [partner_id]);

  return deletedPartner;
}

export async function updatePartner(partner_id, partner_name, partner_type) {
  const sql = `
    UPDATE partners
    SET
      partner_name = COALESCE(?, partner_name),
      partner_type = COALESCE(?, partner_type)
    WHERE partner_id = ?
  `;

  const updatedPartner = await db.query(sql, [
    partner_name,
    partner_type,
    partner_id,
  ]);

  return updatedPartner;
}

// C.R.U.D partners

// users / auth

export async function getUserByUsername(username) {
  const [rows] = await db.query(
    "SELECT user_id, username, password_hash, role, partner_id FROM users WHERE username = ?",
    [username],
  );
  return rows[0] || null;
}

export async function createUser(username, password_hash, role, partner_id = null) {
  const [result] = await db.query(
    "INSERT IGNORE INTO users (username, password_hash, role, partner_id) VALUES (?, ?, ?, ?)",
    [username, password_hash, role, partner_id],
  );
  return result;
}

// Idempotent schema bootstrap. Applies the driver-portal additions on top of a
// database created from the original database.sql. Catches "already exists"
// errors so a second boot is a no-op.
const IGNORABLE_MIGRATION_CODES = new Set([
  "ER_DUP_FIELDNAME",   // column already exists
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_KEYNAME",
  "ER_FK_DUP_NAME",
  "ER_CANT_CREATE_TABLE", // FK already exists
]);

async function runStep(sql) {
  try {
    await db.query(sql);
  } catch (err) {
    if (IGNORABLE_MIGRATION_CODES.has(err.code)) return;
    if (err.code === "ER_DUP_FIELDNAME" || /Duplicate (column|key)/i.test(err.message)) return;
    throw err;
  }
}

export async function runMigrations() {
  await runStep(`ALTER TABLE users ADD COLUMN partner_id INT NULL`);
  await runStep(
    `ALTER TABLE users ADD CONSTRAINT fk_users_partner
     FOREIGN KEY (partner_id) REFERENCES partners(partner_id)`,
  );
  await runStep(
    `ALTER TABLE partners ADD COLUMN availability
     ENUM('available','not_available') NOT NULL DEFAULT 'available'`,
  );
  // Per-driver flat commission. Used when a driver gets assigned to an order
  // and the order's driver_commission hasn't been set yet.
  await runStep(
    `ALTER TABLE partners ADD COLUMN default_commission DECIMAL(12,2) NOT NULL DEFAULT 5`,
  );
  // Distinguishes who cancelled an order, surfaced as a bucket on the driver
  // portal. NULL for non-cancelled orders.
  await runStep(
    `ALTER TABLE orders ADD COLUMN cancelled_by ENUM('driver','customer') NULL`,
  );
  await runStep(`
    CREATE TABLE road_reports (
      report_id INT AUTO_INCREMENT PRIMARY KEY,
      partner_id INT NOT NULL,
      report_type ENUM('traffic','checkpoint','weather','accident') NOT NULL,
      location VARCHAR(120),
      details VARCHAR(500),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_report_partner FOREIGN KEY (partner_id) REFERENCES partners(partner_id)
    )
  `);
  await runStep(`
    CREATE TABLE legal_clearances (
      clearance_id INT AUTO_INCREMENT PRIMARY KEY,
      partner_id INT NOT NULL,
      checkpoint VARCHAR(80),
      manifest_code VARCHAR(80),
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_clearance_partner FOREIGN KEY (partner_id) REFERENCES partners(partner_id)
    )
  `);
}

// ─── driver portal helpers ──────────────────────────────────────────────

export async function getDriverInfo(partnerID) {
  const [[row]] = await db.query(
    "SELECT partner_id, partner_name, availability FROM partners WHERE partner_id = ?",
    [partnerID],
  );
  return row || null;
}

export async function setDriverAvailability(partnerID, availability) {
  if (availability !== "available" && availability !== "not_available") {
    throw new Error(`invalid availability: ${availability}`);
  }
  await db.query(
    "UPDATE partners SET availability = ? WHERE partner_id = ?",
    [availability, partnerID],
  );
}

export async function getDriverOrders(partnerID) {
  const [rows] = await db.query(
    `SELECT o.order_id, o.receiptnum, o.phone, o.notes, o.order_value, o.status,
            o.cancelled_by,
            m.partner_name AS merchant_name
       FROM orders o
       LEFT JOIN partners m ON o.merchant_partner_id = m.partner_id
       WHERE o.assigned_driver_id = ?
       ORDER BY
         CASE o.status WHEN 'Pending' THEN 0 ELSE 1 END,
         o.order_id DESC`,
    [partnerID],
  );
  return rows;
}

// Three filtered views used by the driver portal checklists.
export async function getDriverOrdersByBucket(partnerID, bucket) {
  let where;
  if (bucket === "pending") {
    where = "o.status = 'Pending'";
  } else if (bucket === "delivered") {
    where = "o.status = 'Delivered'";
  } else if (bucket === "cancelled_by_driver") {
    where = "o.status = 'Cancelled' AND o.cancelled_by = 'driver'";
  } else if (bucket === "cancelled_by_customer") {
    where = "o.status = 'Cancelled' AND o.cancelled_by = 'customer'";
  } else {
    throw new Error(`Unknown bucket: ${bucket}`);
  }
  const [rows] = await db.query(
    `SELECT o.order_id, o.receiptnum, o.phone, o.notes, o.order_value, o.status,
            o.cancelled_by,
            m.partner_name AS merchant_name
       FROM orders o
       LEFT JOIN partners m ON o.merchant_partner_id = m.partner_id
       WHERE o.assigned_driver_id = ? AND ${where}
       ORDER BY o.order_id DESC`,
    [partnerID],
  );
  return rows;
}

// Verifies the order is assigned to the given driver, then updates status
// (+ cancelled_by where applicable) through updateOrderStatus so ledger
// side-effects fire. Throws if the order isn't theirs.
export async function driverChangeOrderStatus(partnerID, orderID, newStatus, cancelledBy = null) {
  const [[row]] = await db.query(
    "SELECT assigned_driver_id FROM orders WHERE order_id = ?",
    [orderID],
  );
  if (!row) throw new Error(`Order #${orderID} not found`);
  if (Number(row.assigned_driver_id) !== Number(partnerID)) {
    throw new Error(`Order #${orderID} is not assigned to you`);
  }
  await updateOrderStatus(orderID, newStatus);
  // cancelled_by is meaningful only for cancellations; clear it otherwise so
  // a re-delivered order doesn't keep stale "cancelled by" data.
  if (newStatus === "Cancelled") {
    if (cancelledBy !== "driver" && cancelledBy !== "customer") {
      throw new Error("cancelledBy must be 'driver' or 'customer'");
    }
    await db.query(
      "UPDATE orders SET cancelled_by = ? WHERE order_id = ?",
      [cancelledBy, orderID],
    );
  } else {
    await db.query(
      "UPDATE orders SET cancelled_by = NULL WHERE order_id = ?",
      [orderID],
    );
  }
}

export async function createRoadReport({ partner_id, report_type, location, details }) {
  const [result] = await db.query(
    `INSERT INTO road_reports (partner_id, report_type, location, details)
     VALUES (?, ?, ?, ?)`,
    [partner_id, report_type, location || null, details || null],
  );
  return result.insertId;
}

export async function getDriverReports(partnerID, limit = 10) {
  const [rows] = await db.query(
    `SELECT report_id, report_type, location, details, created_at
       FROM road_reports
       WHERE partner_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    [partnerID, limit],
  );
  return rows;
}

export async function createLegalClearance({ partner_id, checkpoint, manifest_code }) {
  const [result] = await db.query(
    `INSERT INTO legal_clearances (partner_id, checkpoint, manifest_code)
     VALUES (?, ?, ?)`,
    [partner_id, checkpoint || null, manifest_code || null],
  );
  return result.insertId;
}

export async function getDriverClearances(partnerID, limit = 10) {
  const [rows] = await db.query(
    `SELECT clearance_id, checkpoint, manifest_code, status, created_at
       FROM legal_clearances
       WHERE partner_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    [partnerID, limit],
  );
  return rows;
}

// ─── default "Headquarters" + "Owner" used to auto-fill new orders ─────

const DEFAULT_HQ_NAME = "Headquarters (parent company)";
const DEFAULT_OWNER_NAME = "Owner";

export async function ensureDefaults() {
  // Owner merchant — uses 'supplier' since the existing allPartners() query
  // already treats supplier rows as merchants.
  const [ownerMatches] = await db.query(
    "SELECT partner_id FROM partners WHERE partner_name = ? LIMIT 1",
    [DEFAULT_OWNER_NAME],
  );
  let ownerPartnerID;
  if (ownerMatches.length > 0) {
    ownerPartnerID = ownerMatches[0].partner_id;
  } else {
    const [ins] = await db.query(
      "INSERT INTO partners (partner_name, partner_type) VALUES (?, 'supplier')",
      [DEFAULT_OWNER_NAME],
    );
    ownerPartnerID = ins.insertId;
  }

  // HQ location — type='company' so it's distinguishable.
  const [hqMatches] = await db.query(
    "SELECT location_id FROM inventory_locations WHERE location_name = ? LIMIT 1",
    [DEFAULT_HQ_NAME],
  );
  let hqLocationID;
  if (hqMatches.length > 0) {
    hqLocationID = hqMatches[0].location_id;
  } else {
    const [ins] = await db.query(
      "INSERT INTO inventory_locations (location_name, type, partner_id) VALUES (?, 'company', ?)",
      [DEFAULT_HQ_NAME, ownerPartnerID],
    );
    hqLocationID = ins.insertId;
  }

  return { ownerPartnerID, hqLocationID, ownerName: DEFAULT_OWNER_NAME, hqName: DEFAULT_HQ_NAME };
}

// ─── bulk-assign helpers (called from the /orders page) ───────────────

export async function bulkAssignShipment(orderIDs, shipmentID) {
  if (!Array.isArray(orderIDs) || orderIDs.length === 0) {
    throw new Error("orderIDs must be a non-empty array");
  }
  const sid = shipmentID === "" || shipmentID == null ? null : Number(shipmentID);
  await db.query(
    "UPDATE orders SET shipment_id = ? WHERE order_id IN (?)",
    [sid, orderIDs.map(Number)],
  );
}

export async function bulkAssignDriver(orderIDs, driverPartnerID) {
  if (!Array.isArray(orderIDs) || orderIDs.length === 0) {
    throw new Error("orderIDs must be a non-empty array");
  }
  const did = driverPartnerID === "" || driverPartnerID == null ? null : Number(driverPartnerID);
  // Unassigning leaves driver_commission alone.
  if (did === null) {
    await db.query(
      "UPDATE orders SET assigned_driver_id = NULL WHERE order_id IN (?)",
      [orderIDs.map(Number)],
    );
    return;
  }
  // Assigning a driver also copies that driver's default_commission into
  // any order where driver_commission hasn't been set yet (0 or NULL).
  // Existing non-zero commissions are preserved.
  const defaultComm = await getDriverDefaultCommission(did);
  await db.query(
    `UPDATE orders
        SET assigned_driver_id = ?,
            driver_commission = CASE
              WHEN driver_commission IS NULL OR driver_commission = 0 THEN ?
              ELSE driver_commission
            END
      WHERE order_id IN (?)`,
    [did, defaultComm, orderIDs.map(Number)],
  );
}

// Fetch a driver's default_commission, falling back to 5 if the partner row
// is missing or the column hasn't been backfilled.
export async function getDriverDefaultCommission(driverPartnerID) {
  if (!driverPartnerID) return 5;
  const [[row]] = await db.query(
    "SELECT default_commission FROM partners WHERE partner_id = ?",
    [driverPartnerID],
  );
  const val = row && row.default_commission;
  return val == null ? 5 : Number(val);
}

// dashboards / listings — joined views for EJS pages

export async function getAllOrdersDetails() {
  const [rows] = await db.query(`
    SELECT
      o.order_id,
      o.receiptnum,
      o.phone,
      o.second_phone,
      o.notes,
      o.retrieve,
      o.order_value,
      o.profit,
      o.driver_commission,
      o.company_commission,
      o.status,
      o.merchant_partner_id,
      o.assigned_driver_id,
      o.company_partner_id,
      o.shipment_id,
      m.partner_name AS merchant_name,
      d.partner_name AS driver_name,
      c.partner_name AS company_name
    FROM orders o
    LEFT JOIN partners m ON o.merchant_partner_id = m.partner_id
    LEFT JOIN partners d ON o.assigned_driver_id = d.partner_id
    LEFT JOIN partners c ON o.company_partner_id = c.partner_id
    ORDER BY o.order_id DESC
  `);
  return rows;
}

export async function getMerchantsData() {
  const [rows] = await db.query(`
    SELECT
      p.partner_id AS id,
      COALESCE(p.partner_name, CONCAT('Partner #', p.partner_id)) AS name,
      COUNT(o.order_id) AS total_orders
    FROM partners p
    LEFT JOIN orders o ON p.partner_id = o.merchant_partner_id
    WHERE p.partner_type IN ('supplier', 'merchant')
    GROUP BY p.partner_id, p.partner_name
    ORDER BY name
  `);
  return rows;
}

export async function getDriversData() {
  const [rows] = await db.query(`
    SELECT
      p.partner_id AS id,
      COALESCE(p.partner_name, CONCAT('Partner #', p.partner_id)) AS name,
      p.default_commission,
      COUNT(o.order_id) AS total_orders
    FROM partners p
    LEFT JOIN orders o ON p.partner_id = o.assigned_driver_id
    WHERE p.partner_type = 'driver'
    GROUP BY p.partner_id, p.partner_name, p.default_commission
    ORDER BY name
  `);
  return rows;
}

export async function getDriverBalances() {
  const [rows] = await db.query(`
    SELECT
      a.partner_id,
      COALESCE(p.partner_name, CONCAT('Partner #', p.partner_id)) AS partner_name,
      COALESCE(SUM(tl.credit - tl.debit), 0) AS total_owed,
      COUNT(DISTINCT t.order_id) AS orders_completed
    FROM accounts a
    JOIN partners p ON a.partner_id = p.partner_id
    LEFT JOIN transaction_lines tl ON tl.account_id = a.account_id
    LEFT JOIN transactions t ON tl.transaction_id = t.transaction_id
    WHERE a.account_type = 'AP' AND p.partner_type = 'driver'
    GROUP BY a.partner_id, p.partner_name
    HAVING total_owed > 0
    ORDER BY partner_name
  `);
  return rows.map((r) => ({
    ...r,
    total_owed: Number(r.total_owed),
  }));
}

export async function getDashboardStats() {
  const [[{ totalOrders }]] = await db.query(
    "SELECT COUNT(*) AS totalOrders FROM orders",
  );
  const [[{ delivered }]] = await db.query(`
    SELECT COUNT(DISTINCT om.order_id) AS delivered
    FROM order_movements om
    WHERE om.movement_status = 'Delivered'
  `);
  const [[{ onTheRoad }]] = await db.query(`
    SELECT COUNT(DISTINCT om.order_id) AS onTheRoad
    FROM order_movements om
    WHERE om.movement_status = 'In Transit'
  `);
  const [[{ activePartners }]] = await db.query(
    "SELECT COUNT(*) AS activePartners FROM partners",
  );
  return { totalOrders, delivered, onTheRoad, activePartners };
}

export async function getRecentOrders(limit = 5) {
  const [rows] = await db.query(
    `
    SELECT
      o.order_id,
      o.receiptnum,
      o.phone,
      m.partner_name AS merchant_name
    FROM orders o
    LEFT JOIN partners m ON o.merchant_partner_id = m.partner_id
    ORDER BY o.order_id DESC
    LIMIT ?
  `,
    [limit],
  );
  return rows;
}

// accounting — accounts, transactions, lines, payments

export async function getOrCreateAccount(account_type, partner_id, name) {
  const [existing] = await db.query(
    `SELECT account_id FROM accounts
     WHERE account_type = ? AND ((? IS NULL AND partner_id IS NULL) OR partner_id = ?)`,
    [account_type, partner_id, partner_id],
  );
  if (existing.length > 0) return existing[0].account_id;
  const [result] = await db.query(
    "INSERT INTO accounts (account_name, account_type, partner_id) VALUES (?, ?, ?)",
    [name, account_type, partner_id],
  );
  return result.insertId;
}

export async function createTransactionWithLines({
  description,
  order_id = null,
  lines,
}) {
  // lines: [{ account_id, debit, credit }, ...] — must balance
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new Error(
      `Unbalanced transaction: debit=${totalDebit} credit=${totalCredit}`,
    );
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [txResult] = await conn.query(
      "INSERT INTO transactions (description, order_id) VALUES (?, ?)",
      [description, order_id],
    );
    const txID = txResult.insertId;
    for (const line of lines) {
      await conn.query(
        "INSERT INTO transaction_lines (transaction_id, account_id, debit, credit) VALUES (?, ?, ?, ?)",
        [txID, line.account_id, line.debit || 0, line.credit || 0],
      );
    }
    await conn.commit();
    return txID;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Profit-split bookkeeping for an order.
//
// Model: the merchant sets order_value (what the customer pays). We split it:
//   profit              -> Revenue (ours)
//   driver_commission   -> AP-Driver  (owed to the driver)
//   company_commission  -> AP-Company (owed to the other company, if any)
//   merchant_payout     -> AP-Merchant (the remainder we owe back to the merchant)
//
// One balanced transaction per order:
//   DR AR order_value
//   CR Revenue        profit
//   CR AP-Driver      driver_commission
//   CR AP-Company     company_commission
//   CR AP-Merchant    order_value - profit - driver_commission - company_commission
export async function recordCommissionsBookkeeping({
  orderID,
  profit = 0,
  driver_commission = 0,
  company_commission = 0,
  driver_partner_id = null,
  merchant_partner_id = null,
  company_partner_id = null,
}) {
  const [[order]] = await db.query(
    "SELECT order_value FROM orders WHERE order_id = ?",
    [orderID],
  );
  const orderValue = Number(order?.order_value || 0);
  if (orderValue <= 0) {
    throw new Error(
      `Order #${orderID} has no order_value set; cannot record commissions`,
    );
  }

  const profitNum = Number(profit) || 0;
  const driverComm = Number(driver_commission) || 0;
  const companyComm = Number(company_commission) || 0;
  const merchantPayout = orderValue - profitNum - driverComm - companyComm;

  if (merchantPayout < -0.005) {
    throw new Error(
      `Allocations exceed order_value (profit ${profitNum} + driver ${driverComm} + company ${companyComm} = ${profitNum + driverComm + companyComm} > order_value ${orderValue})`,
    );
  }
  if (merchantPayout > 0 && !merchant_partner_id) {
    throw new Error(
      `Order #${orderID} has remainder ${merchantPayout} but no merchant_partner_id to credit`,
    );
  }

  const arAccount = await getOrCreateAccount(
    "AR",
    null,
    "Accounts Receivable - Customers",
  );
  const revenueAccount = await getOrCreateAccount(
    "revenue",
    null,
    "Delivery Revenue",
  );

  const lines = [
    { account_id: arAccount, debit: orderValue, credit: 0 },
  ];

  if (profitNum > 0) {
    lines.push({ account_id: revenueAccount, debit: 0, credit: profitNum });
  }

  if (driverComm > 0 && driver_partner_id) {
    const [[driver]] = await db.query(
      "SELECT partner_name FROM partners WHERE partner_id = ?",
      [driver_partner_id],
    );
    const apDriver = await getOrCreateAccount(
      "AP",
      driver_partner_id,
      `AP - ${driver ? driver.partner_name : "Driver"}`,
    );
    lines.push({ account_id: apDriver, debit: 0, credit: driverComm });
  }

  if (companyComm > 0 && company_partner_id) {
    const [[company]] = await db.query(
      "SELECT partner_name FROM partners WHERE partner_id = ?",
      [company_partner_id],
    );
    const apCompany = await getOrCreateAccount(
      "AP",
      company_partner_id,
      `AP - ${company ? company.partner_name : "Company"}`,
    );
    lines.push({ account_id: apCompany, debit: 0, credit: companyComm });
  }

  if (merchantPayout > 0) {
    const [[merchant]] = await db.query(
      "SELECT partner_name FROM partners WHERE partner_id = ?",
      [merchant_partner_id],
    );
    const apMerchant = await getOrCreateAccount(
      "AP",
      merchant_partner_id,
      `AP - ${merchant ? merchant.partner_name : "Merchant"}`,
    );
    lines.push({ account_id: apMerchant, debit: 0, credit: merchantPayout });
  }

  await createTransactionWithLines({
    description: `Order #${orderID} financial split`,
    order_id: orderID,
    lines,
  });

  return { orderValue, profit: profitNum, driverComm, companyComm, merchantPayout };
}

export async function getAccountingSummary() {
  // Receivables = sum of (debit - credit) on AR accounts (still owed to us)
  const [[{ receivables }]] = await db.query(`
    SELECT COALESCE(SUM(tl.debit - tl.credit), 0) AS receivables
    FROM transaction_lines tl
    JOIN accounts a ON tl.account_id = a.account_id
    WHERE a.account_type = 'AR'
  `);
  // Payables = sum of (credit - debit) on AP accounts (still owed by us)
  const [[{ payables }]] = await db.query(`
    SELECT COALESCE(SUM(tl.credit - tl.debit), 0) AS payables
    FROM transaction_lines tl
    JOIN accounts a ON tl.account_id = a.account_id
    WHERE a.account_type = 'AP'
  `);
  // Revenue = sum of (credit - debit) on revenue accounts
  const [[{ revenue }]] = await db.query(`
    SELECT COALESCE(SUM(tl.credit - tl.debit), 0) AS revenue
    FROM transaction_lines tl
    JOIN accounts a ON tl.account_id = a.account_id
    WHERE a.account_type = 'revenue'
  `);
  // Expense = sum of (debit - credit) on expense accounts
  const [[{ expense }]] = await db.query(`
    SELECT COALESCE(SUM(tl.debit - tl.credit), 0) AS expense
    FROM transaction_lines tl
    JOIN accounts a ON tl.account_id = a.account_id
    WHERE a.account_type = 'expense'
  `);
  return {
    receivables: Number(receivables),
    payables: Number(payables),
    profit: Number(revenue) - Number(expense),
  };
}

export async function getMerchantBalances() {
  const [rows] = await db.query(`
    SELECT
      a.partner_id,
      COALESCE(p.partner_name, CONCAT('Partner #', p.partner_id)) AS partner_name,
      COALESCE(SUM(tl.credit - tl.debit), 0) AS total_owed,
      COUNT(DISTINCT t.order_id) AS orders_completed
    FROM accounts a
    JOIN partners p ON a.partner_id = p.partner_id
    LEFT JOIN transaction_lines tl ON tl.account_id = a.account_id
    LEFT JOIN transactions t ON tl.transaction_id = t.transaction_id
    WHERE a.account_type = 'AP' AND p.partner_type IN ('supplier','merchant')
    GROUP BY a.partner_id, p.partner_name
    HAVING total_owed > 0
    ORDER BY partner_name
  `);
  return rows.map((r) => ({
    ...r,
    total_owed: Number(r.total_owed),
  }));
}

export async function recordPayment({
  amount,
  payment_type,
  partner_id = null,
  order_id = null,
  notes = null,
}) {
  const cashAccount = await getOrCreateAccount("cash", null, "Cash");

  let lines;
  let description;

  if (payment_type === "incoming") {
    // Customer pays us: DR Cash, CR AR
    const arAccount = await getOrCreateAccount(
      "AR",
      null,
      "Accounts Receivable - Customers",
    );
    lines = [
      { account_id: cashAccount, debit: amount, credit: 0 },
      { account_id: arAccount, debit: 0, credit: amount },
    ];
    description = `Incoming payment${order_id ? ` for order #${order_id}` : ""}`;
  } else if (payment_type === "outgoing") {
    if (!partner_id) {
      throw new Error("Outgoing payment requires partner_id");
    }
    const [[partner]] = await db.query(
      "SELECT partner_name FROM partners WHERE partner_id = ?",
      [partner_id],
    );
    const apAccount = await getOrCreateAccount(
      "AP",
      partner_id,
      `AP - ${partner ? partner.partner_name : "Partner"}`,
    );
    // Pay partner: DR AP-partner, CR Cash
    lines = [
      { account_id: apAccount, debit: amount, credit: 0 },
      { account_id: cashAccount, debit: 0, credit: amount },
    ];
    description = `Outgoing payment to ${partner ? partner.partner_name : `partner #${partner_id}`}`;
  } else {
    throw new Error(`Unknown payment_type: ${payment_type}`);
  }

  const transaction_id = await createTransactionWithLines({
    description,
    order_id,
    lines,
  });

  const [result] = await db.query(
    `INSERT INTO payment (amount, payment_type, partner_id, order_id, transaction_id, payment_notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [amount, payment_type, partner_id, order_id, transaction_id, notes],
  );
  return { payment_id: result.insertId, transaction_id };
}

export async function getPayments(limit = 50) {
  const [rows] = await db.query(
    `
    SELECT
      pay.payment_id,
      pay.payment_date,
      pay.amount,
      pay.payment_type,
      pay.payment_notes,
      pay.order_id,
      p.partner_name
    FROM payment pay
    LEFT JOIN partners p ON pay.partner_id = p.partner_id
    ORDER BY pay.payment_date DESC
    LIMIT ?
  `,
    [limit],
  );
  return rows;
}

export async function getAccounts() {
  const [rows] = await db.query(`
    SELECT
      a.account_id,
      a.account_name,
      a.account_type,
      a.partner_id,
      p.partner_name,
      COALESCE(SUM(
        CASE
          WHEN a.account_type IN ('AR','expense','cash') THEN tl.debit - tl.credit
          ELSE tl.credit - tl.debit
        END
      ), 0) AS balance
    FROM accounts a
    LEFT JOIN transaction_lines tl ON tl.account_id = a.account_id
    LEFT JOIN partners p ON a.partner_id = p.partner_id
    GROUP BY a.account_id, a.account_name, a.account_type, a.partner_id, p.partner_name
    ORDER BY a.account_type, a.account_name
  `);
  return rows;
}

// ─── order edit / status / per-partner ledger ────────────────────────────

export async function getOrderById(orderID) {
  const [[order]] = await db.query(
    `SELECT
       o.*,
       m.partner_name AS merchant_name,
       d.partner_name AS driver_name,
       c.partner_name AS company_name
     FROM orders o
     LEFT JOIN partners m ON o.merchant_partner_id = m.partner_id
     LEFT JOIN partners d ON o.assigned_driver_id = d.partner_id
     LEFT JOIN partners c ON o.company_partner_id = c.partner_id
     WHERE o.order_id = ?`,
    [orderID],
  );
  return order || null;
}

// Store the planned commission split on the order row; do NOT post a transaction.
// Posting happens on status → Delivered.
export async function setOrderCommissionPlan(
  orderID,
  profit,
  driver_commission,
  company_commission,
) {
  await db.query(
    "UPDATE orders SET profit = ?, driver_commission = ?, company_commission = ? WHERE order_id = ?",
    [
      Number(profit) || 0,
      Number(driver_commission) || 0,
      Number(company_commission) || 0,
      orderID,
    ],
  );
}

// Update arbitrary order fields with COALESCE so unspecified ones keep their value.
// Pass `null` (not `undefined`) to skip a field.
// status, if provided, goes through updateOrderStatus so accounting side-effects fire.
export async function updateOrderFull(orderID, f) {
  await db.query(
    `UPDATE orders SET
      receiptnum         = COALESCE(?, receiptnum),
      phone              = COALESCE(?, phone),
      second_phone       = COALESCE(?, second_phone),
      retrieve           = COALESCE(?, retrieve),
      notes              = COALESCE(?, notes),
      order_value        = COALESCE(?, order_value),
      profit             = COALESCE(?, profit),
      driver_commission  = COALESCE(?, driver_commission),
      company_commission = COALESCE(?, company_commission),
      merchant_partner_id  = COALESCE(?, merchant_partner_id),
      assigned_driver_id   = COALESCE(?, assigned_driver_id),
      company_partner_id   = COALESCE(?, company_partner_id),
      shipment_id          = COALESCE(?, shipment_id)
     WHERE order_id = ?`,
    [
      f.receiptnum ?? null,
      f.phone ?? null,
      f.second_phone ?? null,
      f.retrieve ?? null,
      f.notes ?? null,
      f.order_value ?? null,
      f.profit ?? null,
      f.driver_commission ?? null,
      f.company_commission ?? null,
      f.merchant_partner_id ?? null,
      f.assigned_driver_id ?? null,
      f.company_partner_id ?? null,
      f.shipment_id ?? null,
      orderID,
    ],
  );
  if (f.status) {
    await updateOrderStatus(orderID, f.status);
  }
}

// Reverse the order's existing non-reversed transactions by posting a new
// transaction whose lines have swapped debit/credit. is_reversal=1 marks it.
export async function reverseOrderBookkeeping(orderID) {
  const [originals] = await db.query(
    "SELECT transaction_id FROM transactions WHERE order_id = ? AND is_reversal = 0",
    [orderID],
  );
  if (originals.length === 0) return null;

  const [reversals] = await db.query(
    "SELECT COUNT(*) AS n FROM transactions WHERE order_id = ? AND is_reversal = 1",
    [orderID],
  );
  if (reversals[0].n >= originals.length) return null; // already reversed

  const txIds = originals.map((t) => t.transaction_id);
  const [lines] = await db.query(
    "SELECT account_id, debit, credit FROM transaction_lines WHERE transaction_id IN (?)",
    [txIds],
  );

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [txRes] = await conn.query(
      "INSERT INTO transactions (description, order_id, is_reversal) VALUES (?, ?, 1)",
      [`Order #${orderID} reversal (returned / cancelled)`, orderID],
    );
    const txID = txRes.insertId;
    for (const l of lines) {
      // swap debit and credit
      await conn.query(
        "INSERT INTO transaction_lines (transaction_id, account_id, debit, credit) VALUES (?, ?, ?, ?)",
        [txID, l.account_id, Number(l.credit), Number(l.debit)],
      );
    }
    await conn.commit();
    return txID;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Change order status, firing the right accounting side-effect:
//   * → Delivered  : post the commission split (idempotent, skips if already posted)
//   * → Returned   : post a reversal (idempotent, skips if no open posting)
//   * → Cancelled  : post a reversal (idempotent, skips if no open posting)
//   anything else  : just update status, no accounting
export async function updateOrderStatus(orderID, newStatus) {
  const [[order]] = await db.query(
    `SELECT order_id, status, order_value, profit, driver_commission, company_commission,
            merchant_partner_id, assigned_driver_id, company_partner_id
       FROM orders WHERE order_id = ?`,
    [orderID],
  );
  if (!order) throw new Error(`Order ${orderID} not found`);

  const oldStatus = order.status;
  if (oldStatus === newStatus) return { changed: false, oldStatus, newStatus };

  // open_count = originals not yet reversed
  const [[{ open_count }]] = await db.query(
    `SELECT
       SUM(CASE WHEN is_reversal = 0 THEN 1 ELSE 0 END) -
       SUM(CASE WHEN is_reversal = 1 THEN 1 ELSE 0 END) AS open_count
     FROM transactions WHERE order_id = ?`,
    [orderID],
  );
  const hasOpenPosting = Number(open_count) > 0;

  if (newStatus === "Delivered" && !hasOpenPosting) {
    if (!order.order_value || Number(order.order_value) <= 0) {
      throw new Error(
        `Cannot deliver order #${orderID}: order_value is not set`,
      );
    }
    await recordCommissionsBookkeeping({
      orderID,
      profit: Number(order.profit) || 0,
      driver_commission: Number(order.driver_commission) || 0,
      company_commission: Number(order.company_commission) || 0,
      driver_partner_id: order.assigned_driver_id || null,
      merchant_partner_id: order.merchant_partner_id || null,
      company_partner_id: order.company_partner_id || null,
    });
  } else if (
    (newStatus === "Returned" || newStatus === "Cancelled") &&
    hasOpenPosting
  ) {
    await reverseOrderBookkeeping(orderID);
  }

  await db.query("UPDATE orders SET status = ? WHERE order_id = ?", [
    newStatus,
    orderID,
  ]);
  return { changed: true, oldStatus, newStatus };
}

export async function getPartner(partnerID) {
  const [[p]] = await db.query(
    "SELECT partner_id, partner_name, partner_type FROM partners WHERE partner_id = ?",
    [partnerID],
  );
  return p || null;
}

// Per-partner ledger: balances on all of their accounts + a transaction history
// involving any of those accounts.
export async function getPartnerLedger(partnerID) {
  const [accounts] = await db.query(
    `SELECT a.account_id, a.account_name, a.account_type,
       COALESCE(SUM(CASE WHEN tl.transaction_id IS NULL THEN 0
                         WHEN a.account_type IN ('AR','expense','cash')
                           THEN tl.debit - tl.credit
                         ELSE tl.credit - tl.debit END), 0) AS balance
     FROM accounts a
     LEFT JOIN transaction_lines tl ON tl.account_id = a.account_id
     WHERE a.partner_id = ?
     GROUP BY a.account_id, a.account_name, a.account_type
     ORDER BY a.account_type, a.account_name`,
    [partnerID],
  );

  let arBalance = 0;
  let apBalance = 0;
  for (const a of accounts) {
    if (a.account_type === "AR") arBalance += Number(a.balance);
    else if (a.account_type === "AP") apBalance += Number(a.balance);
  }

  let lines = [];
  if (accounts.length > 0) {
    const accountIds = accounts.map((a) => a.account_id);
    const [rows] = await db.query(
      `SELECT tl.transaction_line_id, tl.transaction_id, tl.debit, tl.credit,
              t.transaction_date, t.description, t.order_id, t.is_reversal,
              a.account_name, a.account_type
         FROM transaction_lines tl
         JOIN transactions t ON tl.transaction_id = t.transaction_id
         JOIN accounts a ON tl.account_id = a.account_id
         WHERE tl.account_id IN (?)
         ORDER BY t.transaction_date DESC, tl.transaction_line_id DESC`,
      [accountIds],
    );
    lines = rows.map((r) => ({
      ...r,
      debit: Number(r.debit),
      credit: Number(r.credit),
    }));
  }

  return {
    accounts: accounts.map((a) => ({ ...a, balance: Number(a.balance) })),
    ar_balance: arBalance,
    ap_balance: apBalance,
    transactions: lines,
  };
}

export default db;
