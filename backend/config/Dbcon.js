import mongoose from "mongoose";
import userModel from "../models/UserModel.js";

export const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
    // Ensure 2dsphere and other schema indexes are created in MongoDB
    await userModel.createIndexes();
    console.log("MongoDB indexes created/verified");
  } catch (err) {
    console.error("MongoDB connection / index error:", err.message);
  }
};