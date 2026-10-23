import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    dateOfBirth: { type: Date, required: true },
    password: { type: String, required: true },

    isOnboarded: { type: Boolean, default: false },

    displayName: { type: String, default: "" },
    gender: { type: String, enum: ["Man", "Woman", "Non-binary", ""] },
    interestedIn: { type: String, enum: ["Women", "Men", "Everyone", ""] },
    photos: [{ type: String }],
    bio: { type: String, default: "" },
    height: { type: Number },
    lifestyleTags: [{ type: String }],
    prompts: [
      {
        question: { type: String },
        answer: { type: String },
      },
    ],

    // NEW LOCATION / NATIONALITY FIELDS
    nationality: { type: String, default: "" },
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    address: { type: String, default: "" },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });

const userModel = mongoose.models.User || mongoose.model("User", userSchema);
export default userModel;