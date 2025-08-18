import bcrypt from "bcryptjs";

/**
 * Admin check via header: x-admin-password
 * Supports either:
 *  - ADMIN_PASSWORD (plain text)
 *  - ADMIN_PASSWORD_HASH (bcrypt hash)
 */
export default async function admin(req, res, next) {
  try {
    const clientPwd = req.header("x-admin-password") || "";
    const plain = process.env.ADMIN_PASSWORD || "";
    const hash = process.env.ADMIN_PASSWORD_HASH || "";

    let ok = false;
    if (hash) ok = await bcrypt.compare(clientPwd, hash);
    else if (plain) ok = clientPwd && clientPwd === plain;

    if (!ok) return res.status(401).json({ error: "Unauthorized" });
    next();
  } catch (e) {
    next(e);
  }
}
