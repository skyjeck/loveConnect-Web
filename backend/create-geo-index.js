/**
 * One-time script: creates the 2dsphere index on loveConnect.users.location
 * Run with: node create-geo-index.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/loveConnect";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB:", MONGO_URI);

    const db = mongoose.connection.db;
    const collection = db.collection("users");

    // Drop old partial/invalid index if it exists under a different name
    const existingIndexes = await collection.indexes();
    console.log("\nExisting indexes on users collection:");
    existingIndexes.forEach((idx) => console.log(" -", JSON.stringify(idx.key), "name:", idx.name));

    const alreadyExists = existingIndexes.some(
      (idx) => idx.key && idx.key.location === "2dsphere"
    );

    if (alreadyExists) {
      console.log("\n✅ 2dsphere index already exists on 'location'. Nothing to do.");
    } else {
      console.log("\n⚡ Creating 2dsphere index on 'location'...");
      await collection.createIndex(
        { location: "2dsphere" },
        { name: "location_2dsphere", sparse: true }
      );
      console.log("✅ 2dsphere index created successfully!");
    }

    await mongoose.disconnect();
    console.log("✅ Done. You can restart your backend server now.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
