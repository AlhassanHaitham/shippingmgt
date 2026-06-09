import {
  getShippments,
  createshippments,
  deleteShippmentByID,
  updateShippment,
} from "../models/db.js";

// NOTE: the schema/codebase spell it "shippment" (double-p). Kept as-is to
// match the DB columns (shippment_id, shippment_date). See todo.md.

export async function list(req, res) {
  try {
    const shippments = await getShippments();
    console.log("here the shippmaets", shippments);
    res.json({ shippments, message: "shippments retuned" });
  } catch (err) {
    res.status(500).json({ error: "getting shippments failed" });
  }
}

export async function create(req, res) {
  try {
    const { shippment_date, receiver_partner_id, sender_partner_id, return_to } =
      req.body || {};

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
}

export async function remove(req, res) {
  try {
    const shippment_id = req.params;

    const deletedShippment = await deleteShippmentByID(shippment_id);
    res.json({ deletedShippment, massage: " shippment deleted " });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "deleting shippments failed" });
  }
}

export async function update(req, res) {
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
}
