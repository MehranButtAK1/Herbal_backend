import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true }, // URL or base64 data URI
    details: { type: String, default: "" }
  },
  { timestamps: true }
);

// Virtual: map _id → id for frontend
productSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  }
});

export default mongoose.model("Product", productSchema);
