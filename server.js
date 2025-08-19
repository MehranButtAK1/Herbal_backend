// .env example (Railway me set karo)
// CORS_ORIGIN=https://mehranbuttak1.github.io

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

/* =========================
   0) Guards (env required)
========================= */
const {
  PORT = 8080,
  MONGODB_URI,
  JWT_SECRET,
  CORS_ORIGIN, // 👈 ye env me set hoga
  ADMIN_EMAIL,
  ADMIN_PASSWORD
} = process.env;

if (!MONGODB_URI) throw new Error("MONGODB_URI missing in env");
if (!JWT_SECRET) throw new Error("JWT_SECRET missing in env");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD missing in env");

/* =========================
   1) DB & Models
========================= */
await mongoose.connect(MONGODB_URI, {});
...
// (baaki sara code same as yours)

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

// ✅ CORS allowlist from env (comma separated if multiple domains)
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
...
/* =========================
   7) Start
========================= */
app.listen(PORT, () => {
  console.log(`✅ API running on :${PORT}`);
  console.log(`CORS allowlist: ${allowlist.join(", ") || "(none)"}`);
});
