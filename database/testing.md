updating order

put http://localhost:3000/orders/update/1

Content-Type: application/json

{
"receiptnum": 123,
"phone": "07500000000",
"second_phone": "07511111111",
"retrieve": true,
"notes": "Updated order"

}

deleting by id

DELETE http://localhost:3000/orders/deleteByID/1

getting shippments

GET http://localhost:3000/shippments

creating shippments

POST http://localhost:3000/shippments/new
Content-Type: application/json

{
"shippment_date":"2026-05-05 14:30:00",
"receiver_partner_id":1,
"sender_partner_id":2
}

uPDATING

PUT http://localhost:3000/shippments/update/2

Content-Type: application/json

{
"receiver_partner_id":2
}

HERE IS HOW I TESTING PUT http://localhost:3000/shippments/update/2

Content-Type: application/json

{
"receiver_partner_id":2
}i only want to update receiver partner so i leave the rest null .here is the route
app.put("/shippments/update/:id", async (req, res) => {
try {
const { id } = req.params;
const { shippment_date, receiver_partner_id, sender_partner_id } =
req.body || {};

    const updatedShippment = await updateShippment(
      shippment_date ?? null,
      receiver_partner_id ?? null,
      sender_partner_id ?? null,
      id,
    );

    res.json({ updatedShippment, massage: " shippment updated " });

} catch (err) {
console.log(err);
res.status(500).json({ error: "updating shippments failed" });
}
}); and here is the sql export async function updateShippment(
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
return updateShippment;
} it says shippment updated but i dno't think it is
