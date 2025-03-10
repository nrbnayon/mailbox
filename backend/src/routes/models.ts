// backend/src/routes/models.ts
import express from "express";
import {
  availableModels,
  getDefaultModel,
  getModelById,
} from "../config/models.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(availableModels);
});

// Get default model
router.get("/default", (req, res) => {
  const defaultModel = getDefaultModel();
  res.json(defaultModel);
});

// Get model by ID
router.get("/:id", (req, res) => {
  const { id } = req.params;

  const model = getModelById(id);

  if (model) {
    res.json(model);
  } else {
    res.status(404).json({ error: `Model with ID ${id} not found` });
  }
});

export default router;
