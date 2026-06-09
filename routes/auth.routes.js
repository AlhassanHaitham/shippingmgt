import { Router } from "express";
import * as auth from "../controllers/authController.js";

const router = Router();

router.get("/set-lang/:lang", auth.setLang);
router.get("/login", auth.loginForm);
router.post("/login", auth.login);
router.post("/logout", auth.logout);

export default router;
