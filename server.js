// server.js (Final – frontend untouched)
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import morgan from "morgan";

dotenv.config();

/* ============ ENV ============ */
const {
  PORT = 8080,
  MONGODB_URI,
  JWT_SECRET,
  CORS_ORIGIN,             // comma-separated allowlist (optional)
  ADMIN_EMAIL,             // e.g. admin@herbal.store
  ADMIN_PASSWORD           // plain text in Railway vars
} = process.env;

if (!MONGODB_URI) throw new Error("MONGODB_URI missing in env");
if (!JWT_SECRET) throw new Error("JWT_SECRET missing in env");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD missing in env");

/* ============ DB ============ */
await mongoose.connect(MONGODB_URI, {});
console.log("✅ MongoDB connected");

/* ============ MODELS ============ */
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true }, // URL or data URL
    details: { type: String, default: "" }
  },
  { timestamps: true }
);
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin"], default: "admin" }
  },
  { timestamps: true }
);
const Product = mongoose.model("Product", productSchema);
const User = mongoose.model("User", userSchema);

/* ============ SEED ADMIN (idempotent) ============ */
async function seedAdmin() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) return;
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({ email: ADMIN_EMAIL, passwordHash, role: "admin" });
  console.log("🟢 Admin seeded:", ADMIN_EMAIL);
}
await seedAdmin();

/* ============ APP & SECURITY ============ */
const app = express();

// important for Railway proxies (fixes rate-limit X-Forwarded-For error)
app.set("trust proxy", 1);

// Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// CORS allowlist
const defaultAllow = ["https://mehranbuttak1.github.io", "http://localhost:5173", "http://localhost:3000"];
const allowlist = (CORS_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const origins = allowlist.length ? allowlist : defaultAllow;

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || origins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    }
  })
);

// Body parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// Global rate limit
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
  })
);

/* ============ AUTH HELPERS ============ */
function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, JWT_SECRET, { expiresIn: "10m" });
}

/**
 * adminGuard supports BOTH:
 *  - x-admin-password: compares with DB admin hash; if admin missing, falls back to env ADMIN_PASSWORD
 *  - Authorization: Bearer <JWT>
 * This keeps your existing frontend 100% working.
 */
async function adminGuard(req, res, next) {
  try {
    // Option A: header password (your frontend)
    const headerPass = req.header("x-admin-password");
    if (headerPass) {
      const admin = await User.findOne({ email: ADMIN_EMAIL }).lean();
      // if admin exists -> bcrypt compare; if not, fallback to env
      if (admin?.passwordHash) {
        const ok = await bcrypt.compare(headerPass, admin.passwordHash);
        if (ok) return next();
      } else if (headerPass === ADMIN_PASSWORD) {
        return next();
      }
      return res.status(401).json({ error: "Unauthorized (invalid admin password)" });
    }

    // Option B: Bearer JWT (optional for future)
    const auth = req.header("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role !== "admin") return res.status(403).json({ error: "Forbidden" });
        return next();
      } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
    }

    return res.status(401).json({ error: "Unauthorized" });
  } catch (err) {
    next(err);
  }
}

/* ============ ROUTES ============ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Herbal API",
    time: new Date().toISOString(),
    cors: origins
  });
});

// Optional login (for future panel via JWT)
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user);
    res.json({ token, role: user.role, expiresIn: 600 });
  } catch (e) {
    next(e);
  }
});

// Public list
app.get("/products", async (req, res, next) => {
  try {
    const list = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (e) {
    next(e);
  }
});

// Create
app.post("/products", adminGuard, async (req, res, next) => {
  try {
    const { name, category, price, image, details } = req.body || {};
    if (!name || !category || typeof price !== "number" || !image) {
      return res.status(400).json({ error: "name, category, price(number), image required" });
    }
    const created = await Product.create({ name, category, price, image, details: details || "" });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// Update
app.put("/products/:id", adminGuard, async (req, res, next) => {
  try {
    const payload = {};
    ["name", "category", "price", "image", "details"].forEach((k) => {
      if (req.body[k] !== undefined) payload[k] = req.body[k];
    });
    const updated = await Product.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) return res.status(404).json({ error: "Product not found" });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Delete
app.delete("/products/:id", adminGuard, async (req, res, next) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

/* ============ ERRORS ============ */
app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("❌", err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

/* ============ START ============ */
app.listen(PORT, () => {
  console.log(`✅ API running on :${PORT}`);
  console.log(`CORS allowlist: ${origins.join(", ")}`);
});
