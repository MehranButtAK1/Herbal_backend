const express = require("express");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware (fix payload too large error)
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// JSON file for products storage
const DATA_FILE = "products.json";

// 🔹 Utility function: read products
function readData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

// 🔹 Utility function: write products
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ✅ Root Route
app.get("/", (req, res) => {
  res.send("🚀 Herbal Store Backend is Running...");
});

// ✅ Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ Get all products
app.get("/api/products", (req, res) => {
  res.json(readData());
});

// ✅ Add new product (Admin only)
app.post("/api/products", (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const products = readData();
  const newProduct = { id: Date.now(), ...req.body };
  products.push(newProduct);
  writeData(products);
  res.json(newProduct);
});

// ✅ Update product (Admin only)
app.put("/api/products/:id", (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  let products = readData();
  const index = products.findIndex(p => p.id == req.params.id);
  if (index === -1) return res.status(404).json({ error: "Product not found" });
  products[index] = { ...products[index], ...req.body };
  writeData(products);
  res.json(products[index]);
});

// ✅ Delete product (Admin only)
app.delete("/api/products/:id", (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  let products = readData();
  products = products.filter(p => p.id != req.params.id);
  writeData(products);
  res.json({ success: true });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
