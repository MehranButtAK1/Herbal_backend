import express from "express";
import fs from "fs";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_FILE = "./products.json";

app.use(cors());

// JSON aur form-data dono ke liye limit set
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

// Default route
app.get("/", (req, res) => {
  res.send("✅ Herbal Backend is running. Use /products");
});

// Get all products
app.get("/products", (req, res) => {
  res.json(readProducts());
});

// Add product
app.post("/products", (req, res) => {
  const products = readProducts();
  const newProduct = { id: Date.now(), ...req.body };
  products.push(newProduct);
  writeProducts(products);
  res.json(newProduct);
});

// Delete product
app.delete("/products/:id", (req, res) => {
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

// Update product
app.put("/products/:id", (req, res) => {
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
