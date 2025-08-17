const express = require("express");
const fs = require("fs");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const DATA_FILE = "./products.json";

// Helper: Read products
function readProducts() {
  if (!fs.existsSync(DATA_FILE)) return [];
  const data = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(data || "[]");
}

// Helper: Write products
function writeProducts(products) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

// ✅ Get all products
app.get("/products", (req, res) => {
  const products = readProducts();
  res.json(products);
});

// ✅ Add new product
app.post("/products", (req, res) => {
  const products = readProducts();
  const newProduct = { id: Date.now().toString(), ...req.body };
  products.push(newProduct);
  writeProducts(products);
  res.json(newProduct);
});

// ✅ Update product
app.put("/products/:id", (req, res) => {
  const products = readProducts();
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Product not found" });

  products[idx] = { ...products[idx], ...req.body };
  writeProducts(products);
  res.json(products[idx]);
});

// ✅ Delete product
app.delete("/products/:id", (req, res) => {
  let products = readProducts();
  const newProducts = products.filter((p) => p.id !== req.params.id);

  if (products.length === newProducts.length) {
    return res.status(404).json({ error: "Product not found" });
  }

  writeProducts(newProducts);
  res.json({ success: true });
});

// ✅ Run server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
