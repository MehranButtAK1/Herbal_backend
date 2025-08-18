import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true }, // URL or base64 data URL
    details: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Product", ProductSchema);
