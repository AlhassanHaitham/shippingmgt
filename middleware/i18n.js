import { translations } from "../translations.js";

// Resolves the active language from ?lang or the session (default "en") and
// exposes the translation dictionary + direction to every view:
//   res.locals.t    — the strings dictionary (t.* in EJS)
//   res.locals.lang — "en" | "ar" | "ku"
//   res.locals.dir  — "rtl" for ar/ku, else "ltr"
//   res.locals.currentPath — so the language switcher can return to this page
export function i18n(req, res, next) {
  const sessionLang = req.session && req.session.lang;
  const lang = (req.query.lang || sessionLang || "en").toString();
  const dict = translations[lang] || translations.en;
  res.locals.lang = translations[lang] ? lang : "en";
  res.locals.dir =
    res.locals.lang === "ar" || res.locals.lang === "ku" ? "rtl" : "ltr";
  res.locals.t = dict;
  res.locals.currentPath = req.originalUrl;
  next();
}
