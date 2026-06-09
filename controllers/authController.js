import bcrypt from "bcrypt";
import { translations } from "../translations.js";
import { getUserByUsername } from "../models/db.js";

// Persists the chosen language on the session. Safe-redirects only to internal
// paths via return_to to avoid open-redirect.
export function setLang(req, res) {
  const lang = req.params.lang;
  if (translations[lang]) {
    req.session.lang = lang;
  }
  const rt = req.query.return_to;
  if (typeof rt === "string" && rt.startsWith("/")) {
    return res.redirect(rt);
  }
  return res.redirect("/");
}

export function loginForm(req, res) {
  if (req.session.user) return res.redirect("/");
  res.render("login", { error: null });
}

export async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .render("login", { error: "Username and password are required" });
  }
  try {
    const user = await getUserByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).render("login", { error: "Invalid credentials" });
    }
    req.session.user = {
      id: user.user_id,
      username: user.username,
      role: user.role,
      partner_id: user.partner_id || null,
    };
    if (user.role === "driver") return res.redirect("/driver");
    res.redirect("/");
  } catch (err) {
    console.error("login error:", err);
    res.status(500).render("login", { error: "Server error, try again" });
  }
}

export function logout(req, res) {
  req.session.destroy(() => res.redirect("/login"));
}
