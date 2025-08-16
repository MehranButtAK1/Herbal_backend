const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "123";

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // allow large payloads (images etc.)

// Path to products.json
const dataFile = path.join(__dirname, "products.json");

// Utility: read + write
function readProducts() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(dataFile));
}

function writeProducts(products) {
  fs.writeFileSync(dataFile, JSON.stringify(products, null, 2));
}

// Routes

// 1. Get all products
app.get("/api/products", (req, res) => {
  res.json(readProducts());
});

// 2. Add new product (Admin only)
app.post("/api/products", (req, res) => {
  const { secret, product } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const products = readProducts();
  product.id = Date.now().toString();
  products.push(product);
  writeProducts(products);

  res.json({ success: true, product });
});

// 3. Delete product (Admin only)
app.delete("/api/products/:id", (req, res) => {
  const secret = req.headers["x-admin-secret"];
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const products = readProducts();
  const filtered = products.filter(p => p.id !== req.params.id);
  writeProducts(filtered);

  res.json({ success: true });
});

// Health check
app.get("/", (req, res) => {
  res.send("✅ Herbal Backend is running!");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
