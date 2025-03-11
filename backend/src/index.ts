// backend\src\index.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import env from "./config/env.js";
import authRoutes from "./routes/auth.js";
import emailRoutes from "./routes/emails.js";
import aiRoutes from "./routes/ai.js";
import modelsRoutes from "./routes/models.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin:
      env.NODE_ENV === "production"
        ? env.FRONTEND_LIVE_URL || "https://ai-assistant-jade-rho.vercel.app"
        : env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("Hello developer! How can I help you?");
});
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/models", modelsRoutes);

// Error handling
app.use(errorHandler);

// Database connection
mongoose
  .connect(env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Start server
app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
