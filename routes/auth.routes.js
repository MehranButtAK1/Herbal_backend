import { Router } from "express";
import bcrypt from "bcryptjs";

const router = Router();

/** POST /auth/login  {password} -> {ok:true} (no session; just a check) */
router.post("/login", async (req, res) => {
  const pwd = String(req.body?.password || "");
  const plain = process.env.ADMIN_PASSWORD || "";
  const hash = process.env.ADMIN_PASSWORD_HASH || "";

  let ok = false;
  if (hash) ok = await bcrypt.compare(pwd, hash);
  else if (plain) ok = pwd && pwd === plain;

  return ok ? res.json({ ok: true }) : res.status(401).json({ ok: false });
});

export default router;
