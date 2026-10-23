import express from "express";
import authMiddleware from "../middleware/AuthMiddleware.js";
import {
  getDiscoveryFeed,
  processSwipe,
  getMatches,
} from "../controllers/MatchController.js";

const matchRouter = express.Router();

matchRouter.get("/feed", authMiddleware, getDiscoveryFeed);
matchRouter.post("/swipe", authMiddleware, processSwipe);
matchRouter.get("/", authMiddleware, getMatches);

export default matchRouter;