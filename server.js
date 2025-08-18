// server.js
import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

// ---------- Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "products.json");

// ---------- App ----------
const app = express();
const PORT = process.env.PORT || 8080;

// ---------- Security / Perf Middlewares ----------
app.set("trust proxy", 1); // Railway/Proxies
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // (API only; no HTML)
}));
app.use(compression());

// CORS: allow your front-end origin (set CORS_ORIGIN in env; fallback * in dev)
const allowOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({
  origin: allowOrigin,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false,
}));

// Logging (dev only)
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Body parsing
app.use(express.json({ limit: process.env.JSON_LIMIT || "10mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_LIMIT || "10mb" }));

// ---------- Rate Limits ----------
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,            // 120 req/min/ip
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,             // 10 logins/min/ip
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------- Tiny Mutex for file I/O (avoid concurrent writes) ----------
let lock = Promise.resolve();
function withLock(fn) {
  lock = lock.then(() => fn()).catch(() => {}).finally(() => {});
  return lock;
}

// Ensure data file exists
async function ensureDataFile() {
  try {
    await fsp.access(DATA_FILE, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(DATA_FILE, "[]", "utf8");
  }
}

// Read products safely
async function readProducts() {
  await ensureDataFile();
  const raw = await fsp.readFile(DATA_FILE, "utf8");
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    // corrupted file recovery
    await fsp.writeFile(DATA_FILE, "[]", "utf8");
    return [];
  }
}

// Atomic write
async function writeProducts(products) {
  const tmp = DATA_FILE + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify(products, null, 2), "utf8");
  await fsp.rename(tmp, DATA_FILE);
}

// ---------- Validation ----------
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function isValidImage(v) {
  if (!isNonEmptyString(v)) return false;
  // allow http(s) URLs OR data URI
  return /^https?:\/\/.+/i.test(v) || /^data:image\/[a-zA-Z+.-]+;base64,/.test(v) || /^[^/\\]+?\.(jpg|jpeg|png|webp|gif|svg)$/i.test(v);
}
function validateProduct(payload, forUpdate = false) {
  const errs = [];

  const fields = ["name","category","price","image","details"];
  if (!forUpdate) {
    // create: all required
    if (!isNonEmptyString(payload.name)) errs.push("name required");
    if (!isNonEmptyString(payload.category)) errs.push("category required");
    if (typeof payload.price !== "number" || isNaN(payload.price) || payload.price < 0) errs.push("price must be >= 0");
    if (!isValidImage(payload.image)) errs.push("image must be URL, filename, or data URI");
    if (!isNonEmptyString(payload.details)) errs.push("details required");
  } else {
    // update: if present, must be valid
    if (payload.name !== undefined && !isNonEmptyString(payload.name)) errs.push("name invalid");
    if (payload.category !== undefined && !isNonEmptyString(payload.category)) errs.push("category invalid");
    if (payload.price !== undefined && (typeof payload.price !== "number" || isNaN(payload.price) || payload.price < 0)) errs.push("price invalid");
    if (payload.image !== undefined && !isValidImage(payload.image)) errs.push("image invalid");
    if (payload.details !== undefined && !isNonEmptyString(payload.details)) errs.push("details invalid");
  }

  return errs;
}

// ---------- Auth (single admin) ----------
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change";
const TOKEN_TTL = process.env.TOKEN_TTL || "2d";

// Store a bcrypt hash in env (ADMIN_HASH). If not set, fall back to ADMIN_PASSWORD (will be hashed at runtime).
let ADMIN_HASH = process.env.ADMIN_HASH || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123";

// Lazy init hash if only plain password provided (for dev)
if (!ADMIN_HASH && ADMIN_PASSWORD) {
  const salt = bcrypt.genSaltSync(10);
  ADMIN_HASH = bcrypt.hashSync(ADMIN_PASSWORD, salt);
  if (process.env.NODE_ENV !== "production") {
    console.log("ℹ️  Using volatile ADMIN_PASSWORD (dev). Set ADMIN_HASH for production.");
  }
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---------- Routes ----------
app.get("/", (_req, res) => {
  res.json({ ok: true, message: "✅ Herbal Backend running", endpoints: ["/products", "/auth/login"] });
});

// Auth
app.post("/auth/login", authLimiter, express.json(), async (req, res) => {
  const { username, password } = req.body || {};
  // single admin username (optional check); accept any if not provided
  if (username && username !== (process.env.ADMIN_USERNAME || "admin")) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!isNonEmptyString(password)) {
    return res.status(400).json({ error: "Password required" });
  }
  const ok = await bcrypt.compare(password, ADMIN_HASH);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken({ role: "admin" });
  res.json({ token, role: "admin", expiresIn: TOKEN_TTL });
});

app.get("/auth/verify", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// Products (public GET)
app.get("/products", async (_req, res) => {
  const data = await readProducts();
  res.json(data);
});

// Create (admin)
app.post("/products", requireAuth, async (req, res) => {
  const body = req.body || {};
  const errs = validateProduct(body, false);
  if (errs.length) return res.status(400).json({ error: "Validation failed", details: errs });

  await withLock(async () => {
    const list = await readProducts();
    const newProduct = {
      id: Date.now(), // simple id
      name: body.name.trim(),
      category: body.category.trim(),
      price: Number(body.price),
      image: body.image,
      details: body.details.trim(),
    };
    list.push(newProduct);
    await writeProducts(list);
    res.status(201).json(newProduct);
  });
});

// Update (admin)
app.put("/products/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const body = req.body || {};
  const errs = validateProduct(body, true);
  if (errs.length) return res.status(400).json({ error: "Validation failed", details: errs });

  await withLock(async () => {
    const list = await readProducts();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "Product not found" });

    const updated = { ...list[idx], ...body };
    list[idx] = updated;
    await writeProducts(list);
    res.json(updated);
  });
});

// Delete (admin)
app.delete("/products/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  await withLock(async () => {
    const list = await readProducts();
    const next = list.filter(p => p.id !== id);
    if (next.length === list.length) return res.status(404).json({ error: "Product not found" });
    await writeProducts(next);
    res.json({ success: true });
  });
});

// ---------- 404 + Error Handler ----------
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal error" });
});

// ---------- Boot ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Data file: ${DATA_FILE}`);
});
