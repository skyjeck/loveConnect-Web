import userModel from "../models/UserModel.js";
import matchModel from "../models/MatchModel.js";
import mongoose from "mongoose";

// Cache: true = 2dsphere index confirmed present, false = missing, null = not checked yet
let geoIndexConfirmed = null;

/**
 * Returns true if the users collection has a 2dsphere index on location.
 * Result is cached for the lifetime of the server process.
 */
async function hasGeoIndex() {
  if (geoIndexConfirmed !== null) return geoIndexConfirmed;
  try {
    const indexes = await userModel.collection.indexes();
    geoIndexConfirmed = indexes.some(
      (idx) => idx.key && idx.key.location === "2dsphere"
    );
    if (!geoIndexConfirmed) {
      console.warn(
        "[MatchController] WARNING: No 2dsphere index found on users.location. " +
        "Geospatial $near queries are disabled. Run `node create-geo-index.js` to fix."
      );
    }
  } catch {
    geoIndexConfirmed = false;
  }
  return geoIndexConfirmed;
}


// GET DISCOVERY FEED

export const getDiscoveryFeed = async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user.id);

    // 1. Fetch current user to determine preferences
    const currentUser = await userModel.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Pagination & Radius Query Params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const maxDistanceInKm = req.query.maxDistance === "any" || !req.query.maxDistance
      ? null
      : parseInt(req.query.maxDistance);
    const skip = (page - 1) * limit;

    // Age filter params
    const minAge = parseInt(req.query.minAge) || 18;
    const maxAge = parseInt(req.query.maxAge) || 80;

    // Optional gender override from query
    const genderOverride = req.query.gender || null;
    const includeSwiped = req.query.includeSwiped !== "false";

    // 3. Get all user IDs current user has ALREADY swiped on
    const existingSwipes = await matchModel.find({ sender: currentUserId }).select("receiver");
    const swipedUserIds = existingSwipes.map((swipe) => swipe.receiver);

    // Exclude self, and optionally exclude swiped users
    let excludedUserIds = [currentUserId];
    if (!includeSwiped) {
      excludedUserIds = [...excludedUserIds, ...swipedUserIds];
    }

    // 4. Build Gender Match Filter
    let genderFilter = {};
    if (genderOverride === "Women" || genderOverride === "Woman") {
      genderFilter = { gender: { $in: ["Woman", "Women"] } };
    } else if (genderOverride === "Men" || genderOverride === "Man") {
      genderFilter = { gender: { $in: ["Man", "Men"] } };
    } else if (genderOverride && genderOverride !== "Everyone" && genderOverride !== "All") {
      genderFilter = { gender: genderOverride };
    }

    // 5. Build age range filter using dateOfBirth (support users without DOB explicitly set)
    const today = new Date();
    const maxDOB = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
    const minDOB = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate());

    // 6. Query MongoDB for candidate profiles (showing all registered users on the platform)
    const baseQuery = {
      _id: { $nin: excludedUserIds },
      $or: [
        { dateOfBirth: { $gte: minDOB, $lte: maxDOB } },
        { dateOfBirth: { $exists: false } },
        { dateOfBirth: null },
      ],
      ...genderFilter,
    };

    // Geospatial Radial Distance Filter (only if user has real coordinates, geo index exists, and distance is specified)
    const [lng, lat] = currentUser.location?.coordinates || [0, 0];
    const userHasLocation = lng !== 0 || lat !== 0;
    const indexExists = await hasGeoIndex();

    if (userHasLocation && indexExists && maxDistanceInKm !== null) {
      baseQuery.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: maxDistanceInKm * 1000, // Convert km to meters
        },
      };
    }

    let feedUsers = await userModel
      .find(baseQuery)
      .select("-password -email -updatedAt")
      .skip(skip)
      .limit(limit);

    // Fallback: If no unswiped users remain and includeSwiped was not explicitly requested, query without swiped exclusion
    if (feedUsers.length === 0 && !includeSwiped && swipedUserIds.length > 0) {
      const fallbackQuery = {
        _id: { $ne: currentUserId },
        $or: [
          { dateOfBirth: { $gte: minDOB, $lte: maxDOB } },
          { dateOfBirth: { $exists: false } },
          { dateOfBirth: null },
        ],
        ...genderFilter,
      };
      feedUsers = await userModel
        .find(fallbackQuery)
        .select("-password -email -updatedAt")
        .skip(skip)
        .limit(limit);
    }

    return res.status(200).json({
      success: true,
      count: feedUsers.length,
      page,
      hasMore: feedUsers.length === limit,
      users: feedUsers,
    });
  } catch (error) {
    console.error("Get Feed Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching discovery feed",
      error: error.message,
    });
  }
};

// ===============================
// PROCESS SWIPE (LIKE / PASS / SUPERLIKE)
// ===============================
export const processSwipe = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { targetUserId, action } = req.body;

    if (!targetUserId || !action) {
      return res.status(400).json({
        success: false,
        message: "Target User ID and action (like, pass, superlike) are required",
      });
    }

    if (!["like", "pass", "superlike"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'like', 'pass', or 'superlike'",
      });
    }

    if (senderId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot swipe on yourself",
      });
    }

    // 1. Check if swipe already exists
    const existingSwipe = await matchModel.findOne({
      sender: senderId,
      receiver: targetUserId,
    });

    if (existingSwipe) {
      return res.status(400).json({
        success: false,
        message: "You have already swiped on this user",
      });
    }

    // 2. Check if the target user has already liked the sender
    let isMutual = false;
    if (action === "like" || action === "superlike") {
      const targetUserSwipe = await matchModel.findOne({
        sender: targetUserId,
        receiver: senderId,
        action: { $in: ["like", "superlike"] },
      });

      if (targetUserSwipe) {
        isMutual = true;
        // Mark their swipe as mutual as well
        targetUserSwipe.isMutual = true;
        await targetUserSwipe.save();
      }
    }

    // 3. Record current user's swipe
    const newSwipe = await matchModel.create({
      sender: senderId,
      receiver: targetUserId,
      action,
      isMutual,
    });

    // 4. Fetch details of matched user if mutual
    let matchedUser = null;
    if (isMutual) {
      matchedUser = await userModel
        .findById(targetUserId)
        .select("firstName lastName displayName photos bio city state");
    }

    return res.status(201).json({
      success: true,
      isMatch: isMutual,
      message: isMutual ? "It's a Match!" : `User ${action}d successfully`,
      swipe: newSwipe,
      matchedUser,
    });
  } catch (error) {
    console.error("Swipe Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing swipe",
      error: error.message,
    });
  }
};

// ===============================
// GET MUTUAL MATCHES LIST
// ===============================
export const getMatches = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all mutual matches involving the user
    const matches = await matchModel
      .find({
        $or: [{ sender: userId }, { receiver: userId }],
        isMutual: true,
      })
      .populate({
        path: "sender receiver",
        select: "firstName lastName displayName photos bio city state location",
      })
      .sort({ updatedAt: -1 });

    // Map to get only the profiles of the other person in each match
    const matchProfiles = matches.map((match) => {
      const otherUser =
        match.sender._id.toString() === userId ? match.receiver : match.sender;
      return {
        matchId: match._id,
        matchedAt: match.updatedAt,
        user: otherUser,
      };
    });

    return res.status(200).json({
      success: true,
      count: matchProfiles.length,
      matches: matchProfiles,
    });
  } catch (error) {
    console.error("Get Matches Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching matches",
      error: error.message,
    });
  }
};