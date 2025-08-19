const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const morgan = require("morgan");

dotenv.config();

/* =========================
   0) Guards (env required)
========================= */
const {
  PORT = 8080,
  MONGODB_URI,
  JWT_SECRET,
  CORS_ORIGIN,
  ADMIN_EMAIL,
  ADMIN_PASSWORD
} = process.env;

if (!MONGODB_URI) throw new Error("MONGODB_URI missing in env");
if (!JWT_SECRET) throw new Error("JWT_SECRET missing in env");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD missing in env");

/* =========================
   1) DB & Models
========================= */
mongoose.connect(MONGODB_URI, {})
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error", err);
    process.exit(1);
  });

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true }, // URL or data URL (base64)
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

/* =========================
   2) Seed admin (idempotent)
========================= */
async function seedAdmin() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) return;

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({ email: ADMIN_EMAIL, passwordHash, role: "admin" });
  console.log("✅ Admin seeded:", ADMIN_EMAIL);
}
seedAdmin();

/* =========================
   3) App & Security
========================= */
const app = express();

// Helmet (secure headers)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// CORS allowlist from env (CSV)
const allowlist = (CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowlist.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    }
  })
);

// Body parsing
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging (dev only)
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Global rate-limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(apiLimiter);

// Login brute-force limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts, try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

/* =========================
   4) Auth helpers
========================= */
function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, JWT_SECRET, { expiresIn: "10m" });
}

async function adminGuard(req, res, next) {
  try {
    const headerPass = req.header("x-admin-password");
    if (headerPass) {
      const admin = await User.findOne({ email: ADMIN_EMAIL });
      if (admin && (await bcrypt.compare(headerPass, admin.passwordHash))) {
        req.admin = { id: admin._id.toString(), via: "header" };
        return next();
      }
      return res.status(401).json({ error: "Unauthorized (invalid admin password)" });
    }

    const auth = req.header("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role !== "admin") return res.status(403).json({ error: "Forbidden" });
        req.admin = { id: payload.sub, via: "jwt" };
        return next();
      } catch (e) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
    }

    return res.status(401).json({ error: "Unauthorized" });
  } catch (err) {
    next(err);
  }
}

/* =========================
   5) Routes
========================= */
app.get("/", (req, res) => {
  res.json({ ok: true, service: "Herbal API", time: new Date().toISOString() });
});

app.post("/api/auth/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user);
    res.json({ token, role: user.role, expiresIn: 600 });
  } catch (err) {
    next(err);
  }
});

// Products
app.get("/products", async (req, res, next) => {
  try {
    const list = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

app.post("/products", adminGuard, async (req, res, next) => {
  try {
    const { name, category, price, image, details } = req.body || {};
    if (!name || !category || typeof price !== "number" || !image) {
      return res.status(400).json({ error: "name, category, price (number), image are required" });
    }
    const created = await Product.create({ name, category, price, image, details: details || "" });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

app.put("/products/:id", adminGuard, async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = {};
    ["name", "category", "price", "image", "details"].forEach((k) => {
      if (req.body[k] !== undefined) payload[k] = req.body[k];
    });

    const updated = await Product.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) return res.status(404).json({ error: "Product not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete("/products/:id", adminGuard, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* =========================
   6) Errors
========================= */
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error("❌", err);
  const code = err.status || 500;
  res.status(code).json({
    error: err.message || "Server error",
    code
  });
});

/* =========================
   7) Start
========================= */
app.listen(PORT, () => {
  console.log(`✅ API running on :${PORT}`);
  console.log(`CORS allowlist: ${allowlist.join(", ") || "(none)"}`);
});
