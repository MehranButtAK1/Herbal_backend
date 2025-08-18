const mongoose = require("mongoose");

async function connectDB(uri) {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    console.log("✅ MongoDB connected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected");
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000, // avoid ENOTFOUND loops
    maxPoolSize: 10
  });
}

module.exports = connectDB;
