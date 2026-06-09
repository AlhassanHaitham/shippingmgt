import { ensureDefaults } from "../models/db.js";

// Cached IDs of the default "Owner" merchant and "Headquarters" location used
// to auto-fill new orders. Populated once on boot by initDefaults().
//
// Mutated IN PLACE (Object.assign) rather than reassigned, so every module that
// imported this object — e.g. the order wizard in ordersController — sees the
// populated values without re-importing.
export const DEFAULTS = {
  ownerPartnerID: null,
  hqLocationID: null,
  ownerName: "Owner",
  hqName: "Headquarters (parent company)",
};

export async function initDefaults() {
  const d = await ensureDefaults();
  Object.assign(DEFAULTS, d);
  return DEFAULTS;
}
