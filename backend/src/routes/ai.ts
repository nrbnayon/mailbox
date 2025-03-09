import express from "express";
import { Groq } from "groq-sdk";
import { auth, AuthRequest } from "../middleware/auth.js";
import { getModelById } from "../config/models.js";
import { OpenAI } from "openai";
import axios from "axios";

const router = express.Router();

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Process email with AI
router.post("/process", auth, async (req: AuthRequest, res) => {
  try {
    const { content, action, modelId, context } = req.body;
    console.log("All processed", context, {
      action,
      modelId,
      context,
      content,
    });
    const provider = "email";

    // Get model configuration
    const model = getModelById(modelId);
    if (!model) {
      return res.status(400).json({ error: "Invalid model selected" });
    }

    let aiResponse = "";
    let usedFallback = false;
    let fallbackReason = "";
    let actualModelUsed = model;

    // Process based on model API type
    switch (model.apiType) {
      case "deepseek":
        if (!process.env.DEEPSEEK_API_KEY) {
          fallbackReason = "DeepSeek API key not configured";
          break;
        }

        console.log("Processing api type deepseek");
        try {
          // Use the OpenAI SDK with DeepSeek's API
          const deepseek = new OpenAI({
            baseURL: "https://api.deepseek.com",
            apiKey: process.env.DEEPSEEK_API_KEY,
          });

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
        } catch (deepseekError: any) {
          console.error("DeepSeek API error:", deepseekError);

          if (
            deepseekError.status === 402 ||
            (deepseekError.error &&
              deepseekError.error.message === "Insufficient Balance")
          ) {
            fallbackReason = "DeepSeek insufficient balance";
          } else {
            fallbackReason = `DeepSeek API error: ${
              deepseekError.message || "Unknown error"
            }`;
          }
          break;
        }
        break;

      case "meta":
        if (!process.env.META_API_KEY) {
          fallbackReason = "Meta API key not configured";
          break;
        }

        console.log("Processing api type meta");
        try {
          // Using axios for Meta's API
          const metaResponse = await axios.post(
            "https://api.meta.ai/v1/chat/completions",
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
              max_tokens: model.maxCompletionTokens || 4096,
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.META_API_KEY}`,
              },
            }
          );

          aiResponse =
            metaResponse.data.choices[0]?.message?.content ||
            "I couldn't process that request with Meta's API.";
        } catch (metaError: any) {
          console.error("Meta API error:", metaError);
          fallbackReason = `Meta API error: ${
            metaError.message || "Unknown error"
          }`;
          break;
        }
        break;

      case "openai":
        if (!openai) {
          fallbackReason = "OpenAI API key not configured";
          break;
        }

        console.log("Processing api type openai");
        try {
          const openaiResponse = await openai.chat.completions.create({
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
            max_tokens: model.maxCompletionTokens || 4096,
          });

          aiResponse =
            openaiResponse.choices[0]?.message?.content ||
            "I couldn't process that request with OpenAI.";
        } catch (openaiError: any) {
          console.error("OpenAI API error:", openaiError);
          fallbackReason = `OpenAI API error: ${
            openaiError.message || "Unknown error"
          }`;
          break;
        }
        break;

      case "huggingface":
        if (!process.env.HUGGINGFACE_API_KEY) {
          fallbackReason = "HuggingFace API key not configured";
          break;
        }

        console.log("Processing api type huggingface");
        try {
          // Using axios for HuggingFace's API
          const huggingfaceResponse = await axios.post(
            `https://api-inference.huggingface.co/models/${model.id}`,
            {
              inputs: {
                text: `${action}: ${content}`,
                parameters: {
                  max_new_tokens: model.maxCompletionTokens || 1024,
                  temperature: 0.5,
                },
              },
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              },
            }
          );

          // HuggingFace response format varies by model type
          aiResponse =
            typeof huggingfaceResponse.data === "string"
              ? huggingfaceResponse.data
              : huggingfaceResponse.data[0]?.generated_text ||
                "I couldn't process that request with HuggingFace.";
        } catch (huggingfaceError: any) {
          console.error("HuggingFace API error:", huggingfaceError);
          fallbackReason = `HuggingFace API error: ${
            huggingfaceError.message || "Unknown error"
          }`;
          break;
        }
        break;

      case "groq":
        // Default case - will also be used as fallback
        break;

      default:
        fallbackReason = `Unsupported model type: ${model.apiType}`;
        break;
    }

    // If we need to use Groq as fallback or it's the primary choice
    if (fallbackReason || model.apiType === "groq") {
      if (fallbackReason) {
        console.log(`Falling back to Groq API due to: ${fallbackReason}`);
        usedFallback = true;
      }

      try {
        const groqModelMap: Record<string, string> = {
          "mixtral-8x7b-32768": "mixtral-8x7b-32768",
          "llama-3-70b": "llama-3-70b-instruct",
          "llama-3.1-8b-instant": "llama-3.1-8b-instant",
          "gemma-7b": "gemma-7b-it",
          "gemma2-9b-it": "gemma2-9b-it",
          "deepseek-coder": "mixtral-8x7b-32768",
          "deepseek-chat": "mixtral-8x7b-32768",
          "llama-3.3-70b-versatile": "llama-3-70b-instruct", // Mapping Meta model to closest Groq equivalent
          "llama-guard-3-8b": "llama-3.1-8b-instant", // Mapping Meta model to closest Groq equivalent
          "llama3-70b-8192": "llama-3-70b-instruct", // Mapping Meta model to closest Groq equivalent
          "llama3-8b-8192": "llama-3.1-8b-instant", // Mapping Meta model to closest Groq equivalent
          "whisper-large-v3": "mixtral-8x7b-32768", // Text fallback for transcription model
          "whisper-large-v3-turbo": "mixtral-8x7b-32768", // Text fallback for transcription model
          "distil-whisper-large-v3-en": "mixtral-8x7b-32768", // Text fallback for transcription model
        };

        // Use fallback or original model ID
        const fallbackModel = "mixtral-8x7b-32768";
        const groqModel = usedFallback
          ? fallbackModel
          : groqModelMap[model.id] || "llama-3.1-8b-instant";

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

        if (usedFallback) {
          // If we're using a fallback, update the actual model used
          actualModelUsed = {
            id: groqModel,
            name:
              groqModel === "mixtral-8x7b-32768"
                ? "Mixtral-8x7b (Fallback)"
                : groqModel === "llama-3.1-8b-instant"
                ? "Llama 3.1 8B (Fallback)"
                : groqModel === "llama-3-70b-instruct"
                ? "Llama 3 70B (Fallback)"
                : "Groq Fallback Model",
            developer: groqModel.includes("mixtral")
              ? "Mistral"
              : groqModel.includes("llama")
              ? "Meta"
              : groqModel.includes("gemma")
              ? "Google"
              : "Groq",
            contextWindow: model.contextWindow,
            apiType: "groq",
          };
        }
      } catch (groqError) {
        console.error("Groq API error:", groqError);
        return res.status(500).json({
          error: "Failed to process with Groq API",
          details: String(groqError),
          original_error: fallbackReason || null,
        });
      }
    }

    // Prepare the response
    const responseObject: any = {
      response: aiResponse,
      model: {
        id: actualModelUsed.id,
        name: actualModelUsed.name,
        developer: actualModelUsed.developer,
      },
    };

    // Add fallback note if applicable
    if (usedFallback) {
      responseObject.note = `Used fallback model due to: ${fallbackReason}`;
    }

    res.json(responseObject);
  } catch (error) {
    console.error("AI processing error:", error);
    res.status(500).json({
      error: "Failed to process with AI",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
