// Only allow the single admin whose email matches ADMIN_EMAIL (and role must be 'admin')
module.exports = function requireAdmin(req, res, next) {
  const envEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const userEmail = (req.user?.email || "").toLowerCase();

  if (req.user?.role === "admin" && envEmail && userEmail === envEmail) {
    return next();
  }
  return res.status(403).json({ error: "Admin only" });
};
