import { Router } from "express";
import Product from "../models/Product.js";
import admin from "../middleware/admin.js";

const router = Router();

/** GET /products — list (supports simple query params) */
router.get("/", async (req, res, next) => {
  try {
    const { q, category, min, max, sort } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (q) {
      const rx = new RegExp(q, "i");
      filter.$or = [{ name: rx }, { category: rx }, { details: rx }];
    }
    if (min || max) {
      filter.price = {};
      if (min) filter.price.$gte = Number(min);
      if (max) filter.price.$lte = Number(max);
    }

    let query = Product.find(filter);

    // sort: price-asc | price-desc | name-asc | name-desc
    const sortMap = {
      "price-asc": { price: 1 },
      "price-desc": { price: -1 },
      "name-asc": { name: 1 },
      "name-desc": { name: -1 }
    };
    if (sort && sortMap[sort]) query = query.sort(sortMap[sort]);

    const items = await query.lean();
    res.json(items);
  } catch (e) {
    next(e);
  }
});

/** POST /products — create (admin only) */
router.post("/", admin, async (req, res, next) => {
  try {
    const { name, category, price, image, details } = req.body;
    if (!name || !category || price == null || !image) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const created = await Product.create({ name, category, price, image, details });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

/** PUT /products/:id — update (admin only) */
router.put("/:id", admin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = (({ name, category, price, image, details }) => ({
      name, category, price, image, details
    }))(req.body);

    const updated = await Product.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/** DELETE /products/:id — delete (admin only) */
router.delete("/:id", admin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
