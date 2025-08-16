const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Data file path
const dataFile = path.join(__dirname, "data.json");

// Read products
function readProducts() {
  try {
    const data = fs.readFileSync(dataFile, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Write products
function writeProducts(products) {
  fs.writeFileSync(dataFile, JSON.stringify(products, null, 2), "utf-8");
}

// Root route
app.get("/", (req, res) => {
  res.send("✅ Herbal Backend is running!");
});

// Get all products
app.get("/products", (req, res) => {
  const products = readProducts();
  res.json(products);
});

// Add a new product
app.post("/products", (req, res) => {
  const products = readProducts();
  const newProduct = req.body;
  products.push(newProduct);
  writeProducts(products);
  res.json({ message: "Product added successfully!", products });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
