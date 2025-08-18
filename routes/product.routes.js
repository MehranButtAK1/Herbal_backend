const router = require("express").Router();
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// Public: list & single
router.get("/", async (req, res, next) => {
  try {
    const items = await Product.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const item = await Product.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Product not found" });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

// Admin: create
router.post("/", auth, requireAdmin, async (req, res, next) => {
  try {
    const { name, price } = req.body || {};
    if (!name || price == null) return res.status(400).json({ error: "name & price required" });
    const item = await Product.create(req.body);
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

// Admin: update
router.put("/:id", auth, requireAdmin, async (req, res, next) => {
  try {
    const item = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: "Product not found" });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

// Admin: delete
router.delete("/:id", auth, requireAdmin, async (req, res, next) => {
  try {
    const item = await Product.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
