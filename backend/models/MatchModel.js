import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["like", "pass", "superlike"],
      required: true,
    },
    isMutual: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Ensure a user can only swipe on another user once
matchSchema.index({ sender: 1, receiver: 1 }, { unique: true });
matchSchema.index({ sender: 1, action: 1 });
matchSchema.index({ receiver: 1, isMutual: 1 });

const matchModel = mongoose.models.Match || mongoose.model("Match", matchSchema);
export default matchModel;