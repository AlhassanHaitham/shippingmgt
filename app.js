import express from "express";
import bodyParser from "body-parser";
import methodOverride from "method-override";
import {
  getorders,
  getorderByID,
  pickAddress,
  inserOrder,
  allPartners,
  createordermovment,
  createCommissions,
  getLocations,
} from "./db.js";

import db from "./db.js";

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

//list all orders
app.get("/", async (req, res) => {
  try {
    const results = await getorders();
    res.render("index", { orders: results });
  } catch (err) {
    console.error("Database error:", err);
    res.send("Database error");
  }

  // order info form
});
app.get("/orders/new", async (req, res) => {
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

app.post("/orders/new", async (req, res) => {
  const { receiptnum, phone, second_phone, retrieve, notes } = req.body;
  const retrievevalue = retrieve ? 1 : 0;
  console.log("here", retrieve, "vs", retrievevalue);
  const result = await inserOrder(
    receiptnum,
    phone,
    second_phone,
    retrievevalue,
    notes,
  );
  const orderID = result.insertId;
  console.log("order is is here", orderID);
  //you must redirect to step two
  res.redirect(`/orders/${orderID}/location`);
});

app.get("/orders/:id/location", async (req, res) => {
  const orderID = req.params.id;

  /*   await createordermovment(
    movement_type,
    from_location_id,
    to_location_id,
    movement_status,
  ); */
  const locations = await getLocations();

  res.render(`order_step2`, { orderID, locations });
});

app.post("/orders/:id/location", async (req, res) => {
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
app.get("/orders/:id/merchant", async (req, res) => {
  const orderID = req.params.id;
  const { merchants, drivers, shipments } = await allPartners();

  res.render("order_step3", { orderID, merchants, drivers, shipments });
});

app.post("/orders/:id/merchant", async (req, res) => {
  const orderID = req.params.id;
  const { merchant_partner_id, driver_partner_id, shippment_id } = req.body;
  console.log("2order is is: ", orderID);
  res.redirect(`/orders/${orderID}/commissions`);
});

app.get("/orders/:id/commissions", async (req, res) => {
  const orderID = req.params.id;
  res.render("order_step4", { orderID });
});

app.post("/orders/:id/commissions", async (req, res) => {
  const orderID = req.params.id;
  console.log(req.body);
  const delivery_price = parseFloat(req.body.delivery_price) || 0;
  const driver_commission = parseFloat(req.body.driver_commission) || 0;
  const merchant_commission = parseFloat(req.body.merchant_commission) || 0;
  console.log("orderID is:", orderID);

  await createCommissions(
    delivery_price,
    driver_commission,
    merchant_commission,
    orderID,
  );

  res.redirect("/");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
//sdfg
