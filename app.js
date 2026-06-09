// Entry point. Wires up global middleware, mounts the feature routers, runs the
// startup bootstrap (migrations + seeds), then starts listening.
//
// The app follows an MVC layout:
//   models/      data access (db.js — the only place SQL lives)
//   views/       EJS templates
//   controllers/ request handlers (one file per feature)
//   routes/      thin routers mapping URLs → controller functions
//   middleware/  auth guards + i18n
//   config/      session, defaults, startup bootstrap
//   services/    ai.js (OpenRouter assistant)
//   seed/        idempotent demo-user seeding
// See ARCHITECTURE.md for the full tour.

import "dotenv/config";
import express from "express";
import methodOverride from "method-override";

import { sessionMiddleware } from "./config/session.js";
import { attachUser } from "./middleware/auth.js";
import { i18n } from "./middleware/i18n.js";
import { mountRoutes } from "./routes/index.js";
import { bootstrap } from "./config/bootstrap.js";

const app = express();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// method-override: read _method from the query string OR a form body field, so
// browser <form>s can issue PUT/DELETE via a hidden _method input.
app.use(
  methodOverride(function (req) {
    if (req.body && typeof req.body === "object" && "_method" in req.body) {
      const m = req.body._method;
      delete req.body._method;
      return m;
    }
    if (req.query && req.query._method) {
      return req.query._method;
    }
  }),
);

app.use(sessionMiddleware);
app.use(attachUser); // res.locals.user for views
app.use(i18n); // res.locals.t / lang / dir

mountRoutes(app);

// Run migrations + seeds, then start listening regardless of their outcome
// (bootstrap isolates each step, so a DB hiccup still lets the server boot).
bootstrap().finally(() => {
  app.listen(3000, () => {
    console.log("Server running on port 3000");
  });
});
