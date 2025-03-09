// backend/src/routes/models.ts
import express from "express";
import {
  availableModels,
  getDefaultModel,
  getModelById,
} from "../config/models.js";

const router = express.Router();

console.log("Initializing /api/models route");
router.get("/", (req, res) => {
  console.log("Returning all available models");
  res.json(availableModels);
});

// Get default model
router.get("/default", (req, res) => {
  console.log("Current default model:", getDefaultModel().id);
  const defaultModel = getDefaultModel();
  res.json(defaultModel);
});

// Get model by ID
router.get("/:id", (req, res) => {
  const { id } = req.params;
  console.log(`Fetching model with ID: ${id}`);

  const model = getModelById(id);

  if (model) {
    res.json(model);
  } else {
    res.status(404).json({ error: `Model with ID ${id} not found` });
  }
});

export default router;
