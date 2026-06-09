# ShipFlow — Architecture Guide

A short tour of how this shipping/logistics admin app is organized, so you can
find your way around quickly. The app was refactored from a single ~1,340-line
`app.js` into a clean **MVC** layout.

## What the app does

It manages delivery **orders** for a logistics company operating in Iraq. Orders
link to **partners** (merchant / driver / supplier / company / customer), move
between **inventory locations**, get grouped into **shipments**, and generate
**commissions** that post to a double-entry **accounting** ledger. There is a
driver portal, an admin dashboard, tri-lingual UI (English / Arabic / Kurdish),
and an AI **support** assistant.

## Tech stack

- **Express 5** (web server) · **EJS** (server-rendered views) · **MySQL2** (DB)
- **express-session** (cookie auth) · **bcrypt** (password hashing)
- **OpenRouter** via `services/ai.js` (the AI assistant)
- No build step. `npm run dev` (nodemon) or `node app.js`. Server: http://localhost:3000

## Folder structure

```
app.js                 # entry point — middleware wiring, mount routes, bootstrap, listen
config/
  session.js           # express-session configuration
  defaults.js          # DEFAULTS (Owner/HQ ids) + initDefaults()
  bootstrap.js         # startup: migrations → defaults → seeds
middleware/
  auth.js              # attachUser, requireAuth, requireDriver, blockDriver
  i18n.js              # language resolution → res.locals.t / lang / dir
controllers/           # request handlers, one file per feature (the "C")
  authController.js        # login, logout, language switch
  dashboardController.js   # GET / (guest page / dashboard / driver redirect)
  driverController.js      # driver portal + status/report/clearance actions
  ordersController.js      # orders list, bulk assign, edit, + 5-step create wizard
  partnersController.js    # partner ledger, merchants/drivers directories, CRUD
  shipmentsController.js   # shipments CRUD (JSON API)
  locationsController.js   # create inventory location
  accountingController.js  # accounting dashboard, chart of accounts, payments
  supportController.js     # /support page + /api/chat (AI)
  reportsController.js     # static reports page
routes/                # thin routers: URL + method → controller fn (one per controller)
  index.js             # mountRoutes(app) — registers every router
  *.routes.js
models/
  db.js                # ALL data access + SQL lives here (the "M")
views/                 # EJS templates (the "V") + views/partials/
services/
  ai.js                # OpenRouter assistant (Iraqi-law system prompt, web grounding)
seed/
  seed.js              # idempotent admin + demo-driver seeding
translations.js        # en/ar/ku string dictionary (used by middleware/i18n.js)
```

## Request lifecycle

```
HTTP request
  → express.json / urlencoded         (parse body)
  → methodOverride                    (form _method → PUT/DELETE)
  → sessionMiddleware                 (load req.session)
  → attachUser                        (res.locals.user)
  → i18n                              (res.locals.t / lang / dir)
  → router (routes/*.routes.js)       (match URL+method)
      → requireAuth / requireDriver   (guard)
      → controller fn                 (controllers/*.js)
          → model fn (models/db.js)   (SQL)
          → res.render(view) / res.json(...)
```

## The layers

- **Model — `models/db.js`.** The single source of all SQL. ~60 exported async
  functions grouped by domain: orders (`inserOrder`, `getAllOrdersDetails`,
  `updateOrderFull`, `updateOrderStatus`…), partners (`getPartners`,
  `createPartner`, `getPartnerLedger`…), shipments, locations, commissions,
  drivers (`getDriverOrdersByBucket`, `driverChangeOrderStatus`…), accounting/
  ledger (`recordPayment`, `getAccountingSummary`, `createTransactionWithLines`…),
  users, and `runMigrations` / `ensureDefaults`. Default export is the connection
  pool (`db`) for the few raw queries in `ordersController`/`seed`.
- **View — `views/*.ejs`.** Tailwind (CDN) + Phosphor icons. Every authenticated
  page includes `partials/header.ejs` and pulls strings from `t.*` (never hardcode
  English). `res.locals` (user/t/lang/dir) is available in every template.
- **Controller — `controllers/*.js`.** One file per feature. Each exports plain
  `(req, res)` handler functions. Controllers validate input, call model
  functions, and render a view or return JSON. No SQL here (except a few raw
  `db.query` calls in the order wizard).
- **Routes — `routes/*.routes.js`.** Each builds an Express `Router`, maps
  `method + path` to a controller function, and attaches the guard. `routes/index.js`
  exposes `mountRoutes(app)` which registers them all.
- **Middleware / Config / Services / Seed** as described in the tree above.

## Conventions & gotchas worth knowing

- **Auth is session-based.** `req.session.user = { id, username, role, partner_id }`.
  Guards live in `middleware/auth.js`: `requireAuth` (any user), `requireDriver`
  (role === 'driver'). There's no per-route role table — admin vs driver is decided
  by which guard a route uses.
- **`DEFAULTS` (config/defaults.js)** caches the seeded "Owner" partner id and "HQ"
  location id used to auto-fill new orders. It is populated once on boot by
  `initDefaults()` and **mutated in place** so the order wizard sees the values.
- **i18n.** Language comes from `?lang` or `req.session.lang` (persisted via
  `/set-lang/:lang`). `middleware/i18n.js` sets `res.locals.t` (dictionary),
  `lang`, and `dir` (`rtl` for ar/ku). Add new UI strings to all three languages
  in `translations.js`.
- **`shippment` spelling.** The DB columns and code use the double-p spelling
  (`shippment_id`, `shippment_date`). Kept intentionally to match the schema —
  see `todo.md`.
- **AI provider.** `services/ai.js` calls **OpenRouter** (OpenAI-compatible), not
  Google Gemini — the Gemini account was anti-abuse flagged. Config in `.env`:
  `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_WEB_SEARCH`,
  `OPENROUTER_BASE_URL` (point at Groq to swap providers). 429s surface as a
  friendly localized "busy" message.
- **Startup never hard-fails on the DB.** `config/bootstrap.js` isolates each step
  (migrations / defaults / seeds) in its own try/catch, and `app.listen` runs in
  `.finally`, so the server still boots if MySQL is momentarily unreachable.

## Adding a new feature (the pattern)

1. Add the data function(s) to `models/db.js`.
2. Add a handler to the relevant `controllers/xController.js` (or a new one).
3. Map the route in `routes/x.routes.js` with the right guard, and ensure the
   router is registered in `routes/index.js`.
4. Add/adjust the EJS view and any `t.*` strings in `translations.js` (all 3 langs).

## Running locally

```bash
npm install
# create .env (see .env.example): MYSQL_*, ADMIN_*, SESSION_SECRET, OPENROUTER_API_KEY
npm run dev          # http://localhost:3000
```

Seeded logins: admin (`ADMIN_USERNAME`/`ADMIN_PASSWORD` from `.env`), driver
(`driver1` / `DriverPass123`).

## Most important files — quick reference

| File | What it does |
|------|--------------|
| `app.js` | Thin entry point: global middleware → `mountRoutes` → `bootstrap` → listen. |
| `routes/index.js` | `mountRoutes(app)` — registers every feature router. Best map of all URLs. |
| `models/db.js` | The data layer. Every SQL query + the connection pool. ~60 functions. |
| `controllers/ordersController.js` | The richest controller: orders list, bulk assign, inline edit, and the 5-step order-creation wizard. |
| `controllers/accountingController.js` | Accounting dashboard, chart of accounts, payment recording (double-entry ledger). |
| `controllers/supportController.js` | AI chat endpoint — validation, session memory, error/rate-limit handling. |
| `services/ai.js` | OpenRouter assistant: Iraqi-law system prompt, optional web grounding, citation extraction. |
| `middleware/auth.js` | Session guards (`requireAuth`, `requireDriver`) + `attachUser`. |
| `middleware/i18n.js` | Language resolution and `res.locals.t / lang / dir`. |
| `config/defaults.js` | Cached Owner/HQ ids used to auto-fill new orders. |
| `config/bootstrap.js` | Startup sequence: migrations → defaults → seeds. |
| `translations.js` | en/ar/ku string dictionary. |
