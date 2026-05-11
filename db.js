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
) {
  const [result] = await db.query(
    "insert into orders (receiptnum, phone, second_phone, retrieve, notes) values (?,?,?,?,?)",
    [receiptnum, phone, second_phone, retrievevalue, notes],
  );
  console.log(retrievevalue);
  return result;
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

export async function createPartner(partner_name, partner_type) {
  const sql = `
    INSERT INTO partners
    (partner_name, partner_type)
    VALUES (?, ?)
  `;

  return await db.query(sql, [partner_name, partner_type]);
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
    "SELECT user_id, username, password_hash, role FROM users WHERE username = ?",
    [username],
  );
  return rows[0] || null;
}

export async function createUser(username, password_hash, role) {
  const [result] = await db.query(
    "INSERT IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)",
    [username, password_hash, role],
  );
  return result;
}

// dashboards / listings — joined views for EJS pages

export async function getAllOrdersDetails() {
  const [rows] = await db.query(`
    SELECT
      o.order_id,
      o.receiptnum,
      o.phone,
      o.notes,
      m.partner_name AS merchant_name,
      d.partner_name AS driver_name,
      o.shipment_id
    FROM orders o
    LEFT JOIN partners m ON o.merchant_partner_id = m.partner_id
    LEFT JOIN partners d ON o.assigned_driver_id = d.partner_id
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
      COUNT(o.order_id) AS total_orders
    FROM partners p
    LEFT JOIN orders o ON p.partner_id = o.assigned_driver_id
    WHERE p.partner_type = 'driver'
    GROUP BY p.partner_id, p.partner_name
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

export async function recordCommissionsBookkeeping({
  orderID,
  delivery_price,
  driver_commission,
  merchant_commission,
  driver_partner_id,
  merchant_partner_id,
}) {
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
  const expenseAccount = await getOrCreateAccount(
    "expense",
    null,
    "Delivery Expense",
  );

  // 1. Customer owes us the delivery fee: DR AR, CR Revenue
  if (delivery_price > 0) {
    await createTransactionWithLines({
      description: `Order #${orderID} delivery fee`,
      order_id: orderID,
      lines: [
        { account_id: arAccount, debit: delivery_price, credit: 0 },
        { account_id: revenueAccount, debit: 0, credit: delivery_price },
      ],
    });
  }

  // 2. We owe the driver their commission: DR Expense, CR AP-Driver
  if (driver_commission > 0 && driver_partner_id) {
    const [[driver]] = await db.query(
      "SELECT partner_name FROM partners WHERE partner_id = ?",
      [driver_partner_id],
    );
    const apDriver = await getOrCreateAccount(
      "AP",
      driver_partner_id,
      `AP - ${driver ? driver.partner_name : "Driver"}`,
    );
    await createTransactionWithLines({
      description: `Order #${orderID} driver commission`,
      order_id: orderID,
      lines: [
        { account_id: expenseAccount, debit: driver_commission, credit: 0 },
        { account_id: apDriver, debit: 0, credit: driver_commission },
      ],
    });
  }

  // 3. We owe the merchant their commission: DR Expense, CR AP-Merchant
  if (merchant_commission > 0 && merchant_partner_id) {
    const [[merchant]] = await db.query(
      "SELECT partner_name FROM partners WHERE partner_id = ?",
      [merchant_partner_id],
    );
    const apMerchant = await getOrCreateAccount(
      "AP",
      merchant_partner_id,
      `AP - ${merchant ? merchant.partner_name : "Merchant"}`,
    );
    await createTransactionWithLines({
      description: `Order #${orderID} merchant commission`,
      order_id: orderID,
      lines: [
        { account_id: expenseAccount, debit: merchant_commission, credit: 0 },
        { account_id: apMerchant, debit: 0, credit: merchant_commission },
      ],
    });
  }
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

export default db;
