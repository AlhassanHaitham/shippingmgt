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
    SELECT l.location_id, l.location_name, p.partner_name
    FROM inventory_locations l
    JOIN partners p ON l.partner_id = p.partner_id
  `);

  return locations;
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

export default db;

/* const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "shippingmgt",
  password: "135791",
  multipleStatements: true,
}); */
/* const sql = fs.readFileSync("./database/database.sql").toString();
console.log("here is the sql ", sql); */

/* db.query(sql, (err) => {
  if (err) {
    console.log("Error running SQL file:", err);
  } else {
    console.log("Database initialized");
  }
});
 */
/* db.connect((err) => {
  if (err) {
    console.log("Database db failes", err);
  } else {
    console.log("Connected to MySQL");
  }
});

db.query("USE shippingmgt", (err) => {
  if (err) {
    console.log("Error selecting database:", err);
  } else {
    console.log("Database selected");
  }
});
 */
