// backend\src\routes\ai.ts
import express from "express";
import { Groq } from "groq-sdk";
import { auth, AuthRequest } from "../middleware/auth.js";

const router = express.Router();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Process email with AI
router.post("/process", auth, async (req: AuthRequest, res) => {
  try {
    const { content, action } = req.body;

    console.log("first email", content, action);

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an AI email assistant. Help the user process and respond to emails professionally.",
        },
        {
          role: "user",
          content: `${action}: ${content}`,
        },
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.5,
      max_tokens: 1024,
    });

    res.json({ response: completion.choices[0]?.message?.content });
  } catch (error) {
    console.error("AI processing error:", error);
    res.status(500).json({ error: "Failed to process with AI" });
  }
});

export default router;
