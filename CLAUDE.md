# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install deps (run inside whichever tree you're editing)
npm run dev          # nodemon app.js — server on http://localhost:3000
node app.js          # plain start (no auto-reload)
```

No lint, test, or build scripts are wired up. The `npm test` script is a placeholder. `nodemon` is only declared in `shippingmgt/shippingmgt/package.json`; in the root `package.json` it is referenced by `npm run dev` but not listed as a dependency, so install it manually (`npm i -D nodemon`) if running from the root.

Database bootstrap: import `database/database.sql` into MySQL once. The file is *not* idempotent (no `IF NOT EXISTS` on tables/columns), so re-running it on an existing DB will error. There is commented-out auto-load code in `db.js` — leave it disabled.

`.env` (root) is required by both trees:

```
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
```

`.rest` and `testing.md` under `database/` contain curl/REST-client snippets used for manual endpoint testing.

## Architecture

This is an Express 5 + EJS + MySQL2 shipping/logistics admin app. The domain model is: **orders** (one per delivery receipt) link to **partners** (role = merchant/driver/supplier/customer/company), move between **inventory_locations** via **order_movements**, are grouped into **shipments**, and generate **commissions** (incoming = customer pays, outgoing = paid to driver/merchant). An **accounts/transactions/transaction_lines** ledger exists in the schema but is not yet wired into the app.

### Two parallel trees — read this before editing

The repo contains two copies of the app:

- **Root** (`./app.js`, `./db.js`, `./views/`) — legacy. Per `git status`, most root `views/*.ejs` have been deleted; only `accounting.ejs` remains. Routes here do not use i18n, AI, or auth. Treat this tree as deprecated.
- **`./shippingmgt/`** — active. Same routes plus: i18n middleware (en/ar/ku via `translations.js` and a `lang` cookie, RTL handling), client-side gate using `sessionStorage.shipflow_auth` (no server-side session — the header just redirects to `/language` if missing), Gemini AI `/support` chat (`POST /api/chat`), and new aggregation endpoints `/orders`, `/merchants`, `/accounting`.

When asked to change behavior, edit the `shippingmgt/` copy unless the user explicitly points at the root. If both need to change, change both — neither imports from the other.

`db.js` differs between the two trees. The nested copy has additional exports (`getMerchantsData`, `getAllOrdersDetails`, `getAccountingSummary`, `getMerchantBalances`) and uses a `role` column on `partners`, while the root copy uses `partner_type`. See *Schema drift* below.

### Order creation flow

A new order walks through four sequential pages, each `GET` rendering a form that `POST`s to the same path and redirects to the next step:

1. `GET/POST /orders/new` → creates the `orders` row, redirects to step 2 with the new `order_id`.
2. `GET/POST /orders/:id/location` → loads locations, inserts an `order_movements` row.
3. `GET/POST /orders/:id/merchant` → renders selects for merchant/driver/shipment. **Note:** in both trees the `POST` handler is a no-op redirect; the form values are *not* persisted here. The intended writer is `postingAllPartners` in `db.js` (root) or the partner-update path. If wiring this up, use `updateOrderPartners` / `postingAllPartners` rather than re-implementing.
4. `GET/POST /orders/:id/commissions` → inserts three `commissions` rows (one incoming, two outgoing), then redirects to `/`.

### Update endpoint

`PUT /orders/update/:id` is a fan-out: it calls `updateOrder` + `updateOrderLocations` + `updateOrderPartners` + `updateOrderCommissions` in sequence, each using `COALESCE(?, col)` so omitted fields preserve existing values. `retrieve` is coerced from `true`/`"true"`/`"on"` to `1`, else `0`, with `null` meaning "don't change" — preserve this three-state convention.

### Views

EJS with Tailwind (CDN) and Phosphor icons (CDN). All authenticated pages `<%- include('partials/header') %>` which provides nav, language-aware `dir="rtl|ltr"`, and the sessionStorage auth gate. New views should follow the same partial pattern and pull strings from `t.*` (the translations dictionary), not hardcode English.

## Sharp edges to know about before changing code

- **Schema drift, not just typo drift.** `database/database.sql` defines `partners.partner_type ENUM('company','driver','supplier','customer')`. The nested `shippingmgt/db.js` queries `WHERE role='merchant'` against the same table — the column and one of the enum values both differ. Either migrate the schema (add `role`, rename `supplier`→`merchant`) or change the queries before this code runs. `getAccountingSummary` similarly filters `commission_type IN ('delivery_price','driver_commission','merchant_commission')` but `createCommissions` inserts `'incoming'`/`'outgoing'`, so the accounting page currently returns zeros.
- **Typo: `shippment` vs `shipment`.** The SQL table is `shipments` but its PK column is `shippment_id` and date is `shippment_date`. App code uses `shippment*` throughout. `todo.md` flags this for cleanup; until then, match the existing spelling.
- **`updateOrderCommissions` parameter mismatch.** The function destructures `{ order_id, ... }` but `app.js` passes `{ orderID, ... }` — `order_id` ends up `undefined` and the upsert no-ops silently. Fix the caller (or rename the param) when touching this path.
- **`updateShippment` argument order.** In `db.js` the function signature is `(shippment_id, shippment_date, receiver, sender)` but the SQL placeholders are bound as `[shippment_id, shippment_date, receiver, sender]` against a query whose `?` order is `date, receiver, sender, id` — the values are shifted. `testing.md` documents that the user already noticed the update appears to succeed but doesn't change rows.
- **Hardcoded Gemini API key.** `shippingmgt/app.js` contains a literal `AIzaSy...` key for `@google/generative-ai`. Treat this as already-leaked: if you touch that file, move the key to `.env` (e.g. `GEMINI_API_KEY`) and ask the user to rotate it. Do not commit a new value.
- **No real auth.** `users` is an in-memory array in the root `app.js`. The nested tree relies on a client-side `sessionStorage` flag. Neither protects routes server-side — every endpoint is public. Don't assume `req.user` exists.
- **`pickAddress` is defined but unused.** The step-1 form does not collect city/address; the function will be called when address selection is added to the flow.
