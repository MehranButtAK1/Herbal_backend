import express from "express";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_FILE = "./products.json";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "ButtBoss";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Helper: read products
function readProducts() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]");
  }
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

// Helper: write products
function writeProducts(products) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

// Middleware: check admin auth
function checkAdmin(req, res, next) {
  const secret = req.headers["x-admin-secret"];
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

// Default route
app.get("/", (req, res) => {
  res.send("✅ Herbal Backend is running. Use /products");
});

// Public: Get all products
app.get("/products", (req, res) => {
  res.json(readProducts());
});

// Admin: Add product
app.post("/products", checkAdmin, (req, res) => {
  const products = readProducts();
  const newProduct = { id: Date.now(), ...req.body };
  products.push(newProduct);
  writeProducts(products);
  res.json(newProduct);
});

// Admin: Delete product
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

// Admin: Update product
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
