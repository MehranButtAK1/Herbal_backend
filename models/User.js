import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true },
    role: { type: String, default: "user", enum: ["user", "admin"] }
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
