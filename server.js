import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { connectDB } from "./utils/db.js";
import productRoutes from "./routes/product.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json({ limit: "10mb" }));      // base64 images supported
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "tiny" : "dev"));

// Health
app.get("/", (_req, res) => res.json({ ok: true, service: "herbal-backend" }));

// Routes — NOTE: no "/api" prefix to match your frontend script
app.use("/products", productRoutes);
app.use("/auth", authRoutes);

// 404 + Errors
app.use(notFound);
app.use(errorHandler);

// Boot
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI;

connectDB(MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`🚀 Server on :${PORT}`)))
  .catch((e) => {
    console.error("Mongo connection failed", e);
    process.exit(1);
  });
