import session from "express-session";

// Express session middleware. Cookie-based, 8h expiry. Secret comes from .env;
// a loud warning (not a crash) is emitted in dev when it's missing.
if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET not set in .env — using insecure dev default");
}

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "dev-only-insecure-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8,
  },
});
