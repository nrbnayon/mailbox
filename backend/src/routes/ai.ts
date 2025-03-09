import express from "express";
import { Groq } from "groq-sdk";
import { auth, AuthRequest } from "../middleware/auth.js";
import { getModelById } from "../config/models.js";
import { OpenAI } from "openai";

const router = express.Router();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

router.post("/process", auth, async (req: AuthRequest, res) => {
  try {
    const { content, action, modelId, context } = req.body;
    const provider = "email";

    const model = getModelById(modelId);
    if (!model) {
      return res.status(400).json({ error: "Invalid model selected" });
    }

    let aiResponse = "";
    if (model.apiType === "deepseek" && process.env.DEEPSEEK_API_KEY) {
      console.log("Processing api type ", model.apiType);

      try {
        if (!process.env.DEEPSEEK_API_KEY) {
          throw new Error("DeepSeek API key not configured");
        }
        const deepseek = new OpenAI({
          baseURL: "https://api.deepseek.com",
          apiKey: process.env.DEEPSEEK_API_KEY,
        });

        try {
          const deepseekResponse = await deepseek.chat.completions.create({
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
          });

          aiResponse =
            deepseekResponse.choices[0]?.message?.content ||
            "I couldn't process that request with DeepSeek.";
        } catch (specificError: any) {
          if (
            specificError.status === 402 ||
            (specificError.error &&
              specificError.error.message === "Insufficient Balance")
          ) {
            console.log(
              "DeepSeek account has insufficient balance. Falling back to Groq."
            );
            throw new Error("DeepSeek insufficient balance");
          }
          throw specificError;
        }
      } catch (deepseekError) {
        try {
          const fallbackModel = "llama-3.1-8b-instant";

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
            model: fallbackModel,
            temperature: 0.5,
            max_tokens: model.maxCompletionTokens || 1024,
          });

          aiResponse =
            completion.choices[0]?.message?.content ||
            "I couldn't process that request.";

          return res.json({
            response: aiResponse,
            model: {
              id: fallbackModel,
              name: "Mixtral-8x7b (Fallback)",
              developer: "Mistral",
            },
            note:
              deepseekError instanceof Error &&
              deepseekError.message.includes("insufficient balance")
                ? "Used fallback model due to DeepSeek insufficient balance"
                : "Used fallback model due to DeepSeek API error",
          });
        } catch (groqError) {
          console.error("Groq fallback error:", groqError);
          return res.status(500).json({
            error: "Failed to process with both DeepSeek and Groq APIs",
            details: String(deepseekError),
          });
        }
      }
    } else {
      const groqModelMap: Record<string, string> = {
        "mixtral-8x7b-32768": "mixtral-8x7b-32768",
        "llama-3-70b": "llama-3-70b-instruct",
        "llama-3.1-8b-instant": "llama-3.1-8b-instant",
        "gemma-7b": "gemma-7b-it",
        "gemma2-9b-it": "gemma2-9b-it",
        "deepseek-coder": "mixtral-8x7b-32768",
        "deepseek-chat": "deepseek-chat",
      };

      const groqModel = groqModelMap[model.id] || "llama-3.1-8b-instant";

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
    res.status(500).json({
      error: "Failed to process with AI",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
