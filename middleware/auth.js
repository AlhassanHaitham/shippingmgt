// Auth/session middleware and route guards.

// Exposes the logged-in user (or null) to every view via res.locals.user.
export function attachUser(req, res, next) {
  res.locals.user = req.session.user || null;
  next();
}

// Gate: any authenticated user. Guests are redirected to /login.
export function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

// Gate: only users with the "driver" role (the driver portal).
export function requireDriver(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "driver") {
    return next();
  }
  return res.redirect("/login");
}

// Block drivers from admin-only pages (orders list, merchants, accounting…).
// Pair after requireAuth so guests are still sent to /login first.
export function blockDriver(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "driver") {
    return res.redirect("/driver");
  }
  return next();
}
