import {
  getAccountingSummary,
  getMerchantBalances,
  getDriverBalances,
  getPayments,
  getAccounts,
  recordPayment,
} from "../models/db.js";

// Accounting dashboard — real numbers from the double-entry ledger.
export async function dashboard(req, res) {
  try {
    const [summary, balances, driverBalances, payments] = await Promise.all([
      getAccountingSummary(),
      getMerchantBalances(),
      getDriverBalances(),
      getPayments(10),
    ]);
    res.render("accounting", { summary, balances, driverBalances, payments });
  } catch (err) {
    console.error("Accounting error:", err);
    res.status(500).send("Accounting error");
  }
}

// Chart of accounts (JSON for now — useful for inspection).
export async function accounts(req, res) {
  try {
    const accounts = await getAccounts();
    res.json({ accounts });
  } catch (err) {
    console.error("Accounts error:", err);
    res.status(500).json({ error: "Accounts failed" });
  }
}

// Record a payment — also writes the offsetting double-entry transaction.
export async function createPaymentHandler(req, res) {
  try {
    const amount = parseFloat(req.body.amount);
    const payment_type = req.body.payment_type;
    const partner_id = req.body.partner_id ? Number(req.body.partner_id) : null;
    const order_id = req.body.order_id ? Number(req.body.order_id) : null;
    const notes = req.body.notes || null;
    if (
      !amount ||
      amount <= 0 ||
      !["incoming", "outgoing"].includes(payment_type)
    ) {
      return res.status(400).send("Invalid payment fields");
    }
    if (payment_type === "outgoing" && !partner_id) {
      return res.status(400).send("Outgoing payment requires partner_id");
    }
    await recordPayment({ amount, payment_type, partner_id, order_id, notes });
    res.redirect("/accounting");
  } catch (err) {
    console.error("payment error:", err);
    res.status(500).send("Payment failed: " + err.message);
  }
}
