import { createLocation } from "../models/db.js";

// Add a new inventory location (used from the dashboard and order step 2).
export async function create(req, res) {
  try {
    const { location_name, type, partner_id, return_to } = req.body || {};
    if (!location_name || !location_name.trim()) {
      return res.status(400).send("location_name is required");
    }
    const partnerId =
      partner_id && partner_id !== "" ? Number(partner_id) : null;
    await createLocation(location_name.trim(), type || null, partnerId);
    // Only redirect to internal paths to avoid open-redirect.
    const safeReturn =
      typeof return_to === "string" && return_to.startsWith("/")
        ? return_to
        : "/";
    res.redirect(safeReturn);
  } catch (err) {
    console.error("location create error:", err);
    res.status(500).send("Failed to create location: " + err.message);
  }
}
