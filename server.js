const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "123"; // 🔑 ENV VAR from Railway

const dataFile = path.join(__dirname, "data.json");

app.use(cors());
app.use(bodyParser.json());

// 📂 Helper: Read JSON file
async function readData() {
  try {
    const data = await fs.readFile(dataFile, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return { products: [] };
  }
}

// 📂 Helper: Save JSON file
async function saveData(data) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

// ✅ Get all products
app.get("/api/products", async (req, res) => {
  const db = await readData();
  res.json(db.products);
});

// ✅ Add product
app.post("/api/products", async (req, res) => {
  if (req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { name, category, price, image } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  const db = await readData();
  const newProduct = {
    id: Date.now(),
    name,
    category,
    price,
    image,
  };
  db.products.push(newProduct);
  await saveData(db);

  res.json(newProduct);
});

// ✅ Update product
app.put("/api/products/:id", async (req, res) => {
  if (req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const db = await readData();
  const id = parseInt(req.params.id);
  const productIndex = db.products.findIndex(p => p.id === id);

  if (productIndex === -1) return res.status(404).json({ error: "Not found" });

  db.products[productIndex] = { ...db.products[productIndex], ...req.body };
  await saveData(db);

  res.json(db.products[productIndex]);
});

// ✅ Delete product
app.delete("/api/products/:id", async (req, res) => {
  if (req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const db = await readData();
  const id = parseInt(req.params.id);
  const filtered = db.products.filter(p => p.id !== id);

  if (db.products.length === filtered.length) {
    return res.status(404).json({ error: "Not found" });
  }

  db.products = filtered;
  await saveData(db);

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
