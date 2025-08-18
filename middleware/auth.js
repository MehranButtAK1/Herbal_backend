const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token" });

    // verify token (contains id, role, email)
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // fetch fresh user from DB (ensures still exists / role not removed)
    const user = await User.findById(payload.id).select("-password");
    if (!user) return res.status(401).json({ error: "Invalid token" });

    // attach a lean object to req.user
    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};
