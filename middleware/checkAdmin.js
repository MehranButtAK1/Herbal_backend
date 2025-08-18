export function checkAdmin(req, res, next) {
  const header = req.headers["x-admin-password"];
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) {
    return res
      .status(500)
      .json({ error: "Server misconfigured: ADMIN_PASSWORD not set" });
  }
  if (header && header === expected) return next();
  return res.status(401).json({ error: "Unauthorized: Invalid admin password" });
}
