require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./utils/db");
const errorHandler = require("./middleware/error");
const notFound = require("./middleware/notFound");

const User = require("./models/User");

const app = express();

// ---------- Security & Parsers ----------
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    credentials: false,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("tiny"));
app.set("trust proxy", 1);
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---------- Routes ----------
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/users", require("./routes/user.routes"));

app.use(notFound);
app.use(errorHandler);

// ---------- Start ----------
const PORT = process.env.PORT || 8080;

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("❌ MONGODB_URI missing in env");
      process.exit(1);
    }
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET missing in env");
      process.exit(1);
    }

    await connectDB(process.env.MONGODB_URI);

    // Seed first admin (runs once)
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const existing = await User.findOne({ email: process.env.ADMIN_EMAIL });
      if (!existing) {
        await User.create({
          name: "Admin",
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
          role: "admin",
        });
        console.log("👑 Seeded admin user:", process.env.ADMIN_EMAIL);
      }
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("🔥 Boot error:", err.message);
    process.exit(1);
  }
})();
