// backend/src/routes/models.ts
import express from "express";
import { availableModels, getDefaultModel } from "../config/models.js";

const router = express.Router();

// Debugging console log
console.log("Initializing /api/models route");

// Get all available models
router.get("/", (req, res) => {
  res.json(availableModels);
});

// Get default model
router.get("/default", (req, res) => {
  const defaultModel = getDefaultModel();
  res.json(defaultModel);
});

export default router;
