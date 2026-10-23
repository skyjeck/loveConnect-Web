import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDb } from "./config/Dbcon.js";
import userRouter from "./routes/userRoute.js";
import matchRouter from "./routes/MatchRoute.js";

import path from "path";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

connectDb();


app.use("/api/users", userRouter);
app.use("/api/matches", matchRouter);

app.get("/", (req, res) => {
  res.json({
    message: "Server is running successfully"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});