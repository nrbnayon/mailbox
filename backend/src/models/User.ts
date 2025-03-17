import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  name: String,
  image: String,
  provider: {
    type: String,
    enum: ["gmail", "outlook", "yahoo"],
    default: "outlook",
  },
  googleId: String,
  microsoftId: String,
  yahooId: String,
  googleAccessToken: String,
  microsoftAccessToken: String,
  yahooAccessToken: String,
  refreshToken: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastSync: Date,
  isActive: {
    type: Boolean,
    default: true,
  },
});

export const User = mongoose.model("User", userSchema);
