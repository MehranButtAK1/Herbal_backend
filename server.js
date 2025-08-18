import express from "express";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_FILE = "./products.json";

// 🔑 Admin password sirf ENV se aayega
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.warn("⚠️ WARNING: ADMIN_PASSWORD not set in .env file!");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ apitool folder serve
app.use("/apitool", express.static(path.join(__dirname, "apitool")));

function readProducts() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]");
  }
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function writeProducts(products) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

app.get("/", (req, res) => {
  res.send("✅ Herbal Backend is running. Use /products API or /apitool/apitest.html");
});

app.get("/products", (req, res) => {
  res.json(readProducts());
});

// 🔒 Middleware: Admin check
function checkAdmin(req, res, next) {
  const password = req.headers["x-admin-password"];
  if (password === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(403).json({ error: "Unauthorized: Invalid admin password" });
}

app.post("/products", checkAdmin, (req, res) => {
  const products = readProducts();
  const newProduct = { id: Date.now(), ...req.body };
  products.push(newProduct);
  writeProducts(products);
  res.json(newProduct);
});

app.delete("/products/:id", checkAdmin, (req, res) => {
  let products = readProducts();
  const id = parseInt(req.params.id, 10);
  const initialLength = products.length;
  products = products.filter((p) => p.id !== id);

  if (products.length === initialLength) {
    return res.status(404).json({ error: "Product not found" });
  }

  writeProducts(products);
  res.json({ success: true });
});

app.put("/products/:id", checkAdmin, (req, res) => {
  let products = readProducts();
  const id = parseInt(req.params.id, 10);
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Product not found" });
  }

  products[index] = { ...products[index], ...req.body };
  writeProducts(products);
  res.json(products[index]);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
