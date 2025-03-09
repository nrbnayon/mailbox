// backend\src\routes\ai.ts
import express from "express";
import { Groq } from "groq-sdk";
import { auth, AuthRequest } from "../middleware/auth.js";
import { getModelById } from "../config/models.js";
import axios from "axios";

const router = express.Router();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Process email with AI
router.post("/process", auth, async (req: AuthRequest, res) => {
  try {
    const { content, action, modelId, context } = req.body;
    const provider = "email";

    console.log(`Processing with model: ${modelId}`, content, action, context);

    // Get model configuration
    const model = getModelById(modelId);
    if (!model) {
      return res.status(400).json({ error: "Invalid model selected" });
    }

    let aiResponse = "";

    // Process based on model API type
    if (model.apiType === "deepseek" && process.env.DEEPSEEK_API_KEY) {
      // DeepSeek API implementation
      try {
        const deepseekResponse = await axios.post(
          "https://api.deepseek.com/v1/chat/completions",
          {
            model: model.id,
            messages: [
              {
                role: "system",
                content: `You are an AI email assistant that helps users manage their ${provider} inbox. You can:
1. Read and analyze emails
2. Summarize email content
3. Extract key information and action items
4. Help compose responses
5. Organize emails by topic or importance
6. Search for specific email content or topics

Always be helpful, clear, and concise. Format responses in a structured way using markdown when appropriate.
For data summaries, use tables to present information clearly.`,
              },
              {
                role: "user",
                content: `${action}: ${content}`,
              },
            ],
            temperature: 0.5,
            max_tokens: model.maxCompletionTokens || 8000,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            },
          }
        );

        aiResponse =
          deepseekResponse.data.choices[0]?.message?.content ||
          "I couldn't process that request with DeepSeek.";
      } catch (error) {
        console.error("DeepSeek API error:", error);
        return res
          .status(500)
          .json({ error: "Failed to process with DeepSeek API" });
      }
    } else {
      // Use Groq API
      // Model mapping for Groq API (models on Groq might have different names)
      const groqModelMap: Record<string, string> = {
        "mixtral-8x7b-32768": "mixtral-8x7b-32768",
        "llama-3-70b": "llama-3-70b-instruct",
        "llama-3.1-8b-instant": "llama-3.1-8b-instant",
        "gemma-7b": "gemma-7b-it",
        "gemma2-9b-it": "gemma2-9b-it",
        // Fallbacks for non-Groq models if needed
        "deepseek-coder": "mixtral-8x7b-32768",
        "deepseek-llm": "mixtral-8x7b-32768",
      };

      const groqModel = groqModelMap[model.id] || "mixtral-8x7b-32768"; // Default fallback

      try {
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `You are an AI email assistant that helps users manage their ${provider} inbox. You can:
1. Read and analyze emails
2. Summarize email content
3. Extract key information and action items
4. Help compose responses
5. Organize emails by topic or importance
6. Search for specific email content or topics

Always be helpful, clear, and concise. Format responses in a structured way using markdown when appropriate.
For data summaries, use tables to present information clearly.`,
            },
            {
              role: "user",
              content: `${action}: ${content}`,
            },
          ],
          model: groqModel,
          temperature: 0.5,
          max_tokens: model.maxCompletionTokens || 1024,
        });

        aiResponse =
          completion.choices[0]?.message?.content ||
          "I couldn't process that request with Groq.";
      } catch (error) {
        console.error("Groq API error:", error);
        return res
          .status(500)
          .json({ error: "Failed to process with Groq API" });
      }
    }

    res.json({
      response: aiResponse,
      model: {
        id: model.id,
        name: model.name,
        developer: model.developer,
      },
    });
  } catch (error) {
    console.error("AI processing error:", error);
    res.status(500).json({ error: "Failed to process with AI" });
  }
});

export default router;

// Example backend/src/routes/ai.ts implementation
// import express from "express";
// import { getModelById } from "../config/models.js";

// const router = express.Router();

// router.post("/process", async (req, res) => {
//   try {
//     const { content, action, modelId, context } = req.body;

//     // Validate model ID
//     const model = getModelById(modelId);
//     if (!model) {
//       console.error(`Model with ID ${modelId} not found`);
//       return res.status(400).json({ error: "Invalid model ID" });
//     }

//     console.log(`Processing request with model: ${model.name} (${model.developer})`);

//     // Process with the selected model
//     // Your AI processing logic here

//     // For demonstration, just return a simple response
//     res.json({
//       response: `Processed with ${model.name}: ${content.substring(0, 30)}...`,
//       model: model.id,
//       timestamp: new Date()
//     });
//   } catch (error) {
//     console.error("Error processing AI request:", error);
//     res.status(500).json({ error: "Failed to process request" });
//   }
// });

// export default router;
