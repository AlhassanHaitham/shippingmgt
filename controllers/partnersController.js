import {
  getPartner,
  getPartnerLedger,
  getMerchantsData,
  getDriversData,
  getPartners,
  createPartner,
  deletePartnerByID,
  updatePartner,
} from "../models/db.js";

// Per-partner ledger page. Linkable from /merchants, /drivers, /accounting.
export async function ledger(req, res) {
  try {
    const partnerID = Number(req.params.id);
    const [partner, ledgerRows] = await Promise.all([
      getPartner(partnerID),
      getPartnerLedger(partnerID),
    ]);
    if (!partner) return res.status(404).send("Partner not found");
    res.render("partner", { partner, ledger: ledgerRows });
  } catch (err) {
    console.error("partner ledger error:", err);
    res.status(500).send("Partner ledger error");
  }
}

// Merchants directory.
export async function merchants(req, res) {
  try {
    const merchants = await getMerchantsData();
    res.render("merchants", { merchants });
  } catch (err) {
    console.error("Merchants error:", err);
    res.status(500).send("Merchants error");
  }
}

// Drivers directory.
export async function drivers(req, res) {
  try {
    const drivers = await getDriversData();
    res.render("drivers", { drivers });
  } catch (err) {
    console.error("Drivers error:", err);
    res.status(500).send("Drivers error");
  }
}

// ─── partners C.R.U.D (JSON API) ────────────────────────────────────────
export async function list(req, res) {
  try {
    const partners = await getPartners();

    console.log("here are the partners", partners);

    res.json({ partners, message: "partners returned" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "getting partners failed" });
  }
}

export async function create(req, res) {
  try {
    const { partner_name, partner_type, default_commission, return_to } =
      req.body || {};

    if (!partner_name || !partner_name.trim()) {
      return res.status(400).send("partner_name is required");
    }
    if (!partner_type) {
      return res.status(400).send("partner_type is required");
    }

    // Only honour default_commission for drivers — partners table accepts it
    // for any row but it's only meaningful for drivers.
    let commission = null;
    if (
      partner_type === "driver" &&
      default_commission !== undefined &&
      default_commission !== ""
    ) {
      const parsed = Number(default_commission);
      if (Number.isNaN(parsed) || parsed < 0) {
        return res
          .status(400)
          .send("default_commission must be a non-negative number");
      }
      commission = parsed;
    }

    const newPartner = await createPartner(
      partner_name.trim(),
      partner_type,
      commission,
    );

    if (typeof return_to === "string" && return_to.startsWith("/")) {
      return res.redirect(return_to);
    }
    res.json({ newPartner, message: "new partner created" });
  } catch (err) {
    console.error("partner create error:", err);
    res.status(500).send("Creating partner failed: " + err.message);
  }
}

export async function remove(req, res) {
  try {
    const { id } = req.params;

    const deletedPartner = await deletePartnerByID(id);

    res.json({
      deletedPartner,
      message: "partner deleted",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "deleting partner failed" });
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params;

    const { partner_name, partner_type } = req.body || {};

    console.log("body", req.body);
    console.log("id", id);

    const updatedPartner = await updatePartner(
      id,
      partner_name ?? null,
      partner_type ?? null,
    );

    console.log("updated partner", updatedPartner);

    res.json({
      updatedPartner,
      message: "partner updated",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "updating partner failed" });
  }
}
