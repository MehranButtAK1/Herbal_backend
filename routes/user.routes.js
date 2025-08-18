const router = require("express").Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// List users (admin)
router.get("/", auth, requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

// Delete user (admin)
router.delete("/:id", auth, requireAdmin, async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
