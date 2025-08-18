import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

import Product from "./models/Product.js";
import { checkAdmin } from "./middleware/checkAdmin.js";
import { asyncHandler } from "./utils/asyncHandler.js";

dotenv.config();

/* ---------- Config ---------- */
const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ---------- Middlewares ---------- */
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: false
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("tiny"));

/* ---------- DB Connect ---------- */
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI missing in env");
  process.exit(1);
}
mongoose
  .connect(MONGODB_URI, { autoIndex: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

/* ---------- Routes ---------- */

// health / root
app.get("/", (_req, res) => {
  res.send("✅ Herbal Backend (Mongo) running. Use /products");
});
app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// GET all products
app.get(
  "/products",
  asyncHandler(async (_req, res) => {
    const items = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(items.map((p) => Product.hydrate(p).toJSON()));
  })
);

// CREATE product (admin)
app.post(
  "/products",
  checkAdmin,
  asyncHandler(async (req, res) => {
    const { name, category, price, image, details } = req.body || {};

    if (!name || !category || typeof price !== "number" || !image) {
      return res.status(400).json({
        error: "Validation error",
        fields: {
          name: !name ? "required" : undefined,
          category: !category ? "required" : undefined,
          price: typeof price !== "number" ? "number required" : undefined,
          image: !image ? "required" : undefined
        }
      });
    }

    const created = await Product.create({ name, category, price, image, details });
    res.status(201).json(created.toJSON());
  })
);

// UPDATE product (admin)
app.put(
  "/products/:id",
  checkAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const update = {};

    ["name", "category", "price", "image", "details"].forEach((k) => {
      if (req.body?.[k] !== undefined) update[k] = req.body[k];
    });

    const doc = await Product.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: "Product not found" });
    res.json(doc.toJSON());
  })
);

// DELETE product (admin)
app.delete(
  "/products/:id",
  checkAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doc = await Product.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true });
  })
);

/* ---------- Error Handler ---------- */
app.use((err, _req, res, _next) => {
  console.error("💥 Error:", err.message);
  const status =
    err.name === "CastError" ? 400 :
    err.name === "ValidationError" ? 400 :
    err.message?.includes("CORS") ? 403 : 500;

  res.status(status).json({
    error: err.message || "Server error"
  });
});

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
