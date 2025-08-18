const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// helper: sign token with id + role + email
function signUserToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Register (creates normal user)
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password)
      return res.status(400).json({ error: "Missing fields" });

    // optional: block registering with reserved admin email
    if (process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ error: "This email is reserved for admin" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email in use" });

    // role will default to "user" in schema
    const user = await User.create({ name, email, password });

    const token = signUserToken(user);
    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (e) {
    next(e);
  }
});

// Login (works for both user & admin)
// NOTE: Only the single admin (ADMIN_EMAIL) will have admin permissions via middleware.
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: "Invalid credentials" });

    const token = signUserToken(user);
    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
