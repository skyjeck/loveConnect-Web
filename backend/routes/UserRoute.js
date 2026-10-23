import express from "express";
import authMiddleware from "../middleware/AuthMiddleware.js";

import { registerUser, loginUser, getUserProfile, completeOnboarding } from "../controllers/UserController.js";

import upload from "../middleware/uploadMiddleware.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.put("/onboarding", authMiddleware, upload.array("photos", 6), completeOnboarding);
userRouter.post("/login", loginUser);

// Protected route
userRouter.get("/profile", authMiddleware, getUserProfile);
userRouter.get("/me", authMiddleware, getUserProfile);

export default userRouter;