import userModel from "../models/UserModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";

// Generate JWT token
const createToken = (id) => {
    return jwt.sign(
        { id },
        process.env.JWT_SECRET || "loveconnect_secret",
        {
            expiresIn: "7d",
        }
    );
};

// ===============================
// REGISTER USER
// ===============================
export const registerUser = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            dateOfBirth,
            password,
        } = req.body;

        // 1. Check required fields (added dateOfBirth)
        if (!firstName || !lastName || !email || !password || !dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields",
            });
        }

        // 2. Validate email format BEFORE making DB queries
        if (!validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address",
            });
        }

        // 3. Check password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }

        // 4. Server-side age validation (18+)
        const birthDate = new Date(dateOfBirth);
        if (isNaN(birthDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format provided.",
            });
        }

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (
            monthDiff < 0 ||
            (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
            age--;
        }

        if (age < 18) {
            return res.status(400).json({
                success: false,
                message: "You must be at least 18 years old to join.",
            });
        }

        // 5. Check for existing user (performed after basic validation)
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "An account with this email already exists.",
            });
        }

        // 6. Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 7. Create user
        const user = await userModel.create({
            firstName,
            lastName,
            email,
            dateOfBirth: birthDate,
            password: hashedPassword,
            isOnboarded: false, // Ensures new users start with onboarding
        });

        // 8. Generate auth token
        const token = createToken(user._id);

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            token,
            userId: user._id, // Convenient for frontend storage
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                dateOfBirth: user.dateOfBirth, // Fixed typo (was user.birthDate)
                isOnboarded: user.isOnboarded,
            },
        });

    } catch (error) {
        console.error("Register Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error during registration",
            error: error.message,
        });
    }
};


// LOGIN USER

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        // Find user
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Generate token
        const token = createToken(user._id);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                date: user.date,
            },
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error during login",
            error: error.message,
        });
    }
};


// ===============================
// GET USER PROFILE
// ===============================
export const getUserProfile = async (req, res) => {
    try {
        const user = await userModel
            .findById(req.user.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            user,
        });

    } catch (error) {
        console.error("Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve profile",
            error: error.message,
        });
    }
};



//onboarding user 

export const completeOnboarding = async (req, res) => {
  try {
    const targetUserId = req.user?.id || req.body?.userId;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required for onboarding. Please provide auth token or userId.",
      });
    }

    const {
      displayName,
      gender,
      interestedIn,
      bio,
      height,
      lifestyleTags,
      prompts,
      coordinates,
      nationality,
      state,
      city,
      address,
    } = req.body || {};

    // Handle photo URLs from file upload middleware (Multer / Cloudinary) OR body
    let photoUrls = [];
    if (req.files && req.files.length > 0) {
      photoUrls = req.files.map((file) => file.path || `/uploads/${file.filename}`);
    } else if (req.body?.photos) {
      if (Array.isArray(req.body.photos)) {
        photoUrls = req.body.photos;
      } else if (typeof req.body.photos === "string") {
        try {
          const parsed = JSON.parse(req.body.photos);
          photoUrls = Array.isArray(parsed) ? parsed : [req.body.photos];
        } catch {
          photoUrls = req.body.photos.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    // Helper functions for flexible parsing
    const parseLifestyle = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [val];
        } catch {
          return val.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      return [];
    };

    const parsePrompts = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      if (typeof val === "object") return [val];
      return [];
    };

    const parseCoordinates = (val, body) => {
      if (val) {
        if (Array.isArray(val)) return val.map(Number);
        if (typeof val === "string") {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed.map(Number);
          } catch {
            if (val.includes(",")) {
              return val.split(",").map((v) => Number(v.trim()));
            }
          }
        }
      }
      if (body?.longitude !== undefined && body?.latitude !== undefined) {
        return [Number(body.longitude), Number(body.latitude)];
      }
      if (body?.lng !== undefined && body?.lat !== undefined) {
        return [Number(body.lng), Number(body.lat)];
      }
      return [0, 0];
    };

    const normalizeGender = (g) => {
      if (!g) return undefined;
      const str = String(g).trim().toLowerCase();
      if (str === "man" || str === "male") return "Man";
      if (str === "woman" || str === "female") return "Woman";
      if (str === "non-binary" || str === "nonbinary") return "Non-binary";
      return g;
    };

    const normalizeInterestedIn = (i) => {
      if (!i) return undefined;
      const str = String(i).trim().toLowerCase();
      if (str === "women" || str === "female" || str === "woman") return "Women";
      if (str === "men" || str === "male" || str === "man") return "Men";
      if (str === "everyone" || str === "all" || str === "both") return "Everyone";
      return i;
    };

    const parsedCoordinates = parseCoordinates(coordinates, req.body);
    const parsedLifestyle = parseLifestyle(lifestyleTags);
    const parsedPrompts = parsePrompts(prompts);

    // Build $set update payload
    const setFields = {
      isOnboarded: true,
    };

    if (displayName !== undefined) setFields.displayName = displayName;
    if (gender !== undefined) setFields.gender = normalizeGender(gender);
    if (interestedIn !== undefined) setFields.interestedIn = normalizeInterestedIn(interestedIn);
    if (bio !== undefined) setFields.bio = bio;
    if (height !== undefined && height !== "") setFields.height = Number(height);
    if (lifestyleTags !== undefined) setFields.lifestyleTags = parsedLifestyle;
    if (prompts !== undefined) setFields.prompts = parsedPrompts;
    if (nationality !== undefined) setFields.nationality = nationality;
    if (state !== undefined) setFields.state = state;
    if (city !== undefined) setFields.city = city;
    if (address !== undefined) setFields.address = address;

    if (coordinates !== undefined || req.body?.longitude || req.body?.lng) {
      setFields.location = {
        type: "Point",
        coordinates: parsedCoordinates,
      };
    }

    // Build update query with $set and conditional $push
    const updateQuery = { $set: setFields };

    if (photoUrls.length > 0) {
      updateQuery.$push = { photos: { $each: photoUrls } };
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      targetUserId,
      updateQuery,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Onboarding updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save profile",
      error: error.message,
    });
  }
};