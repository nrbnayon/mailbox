// backend\src\routes\ai.ts
import express, { Router, Response } from "express";
import { Groq } from "groq-sdk";
import { auth, AuthRequest } from "../middleware/auth.js";
import { getModelById, AIModel } from "../config/models.js";

const router: Router = express.Router();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Type definitions for better type safety
type EmailData = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  date: string;
  preview: string;
  // content?: string;
};

type MessageData = {
  id: string;
  role: string;
  content: string;
  timestamp: string;
};

type ProcessedEmail = {
  subject: string;
  from: string;
  to: string;
  date: string;
  content: string;
};

interface AIContext {
  emails: EmailData[];
  previousMessages: MessageData[];
}

interface AIProcessingRequest {
  content: string;
  action: string;
  modelId: string;
  context: AIContext;
}

interface AIResponse {
  success: boolean;
  response?: string;
  error?: string;
  model: string;
  timestamp: string;
  fallbackUsed?: boolean;
}

// Model configuration with fallback chain
const modelConfig = {
  primary: "mixtral-8x7b-32768",
  fallbackChain: ["llama3-70b-8192", "llama-3.1-8b-instant", "gemma2-9b-it"],
} as const;

const groqModelMap: Record<string, string> = {
  "mixtral-8x7b-32768": "mixtral-8x7b-32768",
  "llama-3-70b": "llama3-70b-8192",
  "llama-3.3-70b-versatile": "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant": "llama-3.1-8b-instant",
  "gemma-7b": "gemma2-9b-it",
  "gemma2-9b-it": "gemma2-9b-it",
  "llama-guard-3-8b": "llama-guard-3-8b",
  "llama3-70b-8192": "llama3-70b-8192",
  "llama3-8b-8192": "llama3-8b-8192",
  "whisper-large-v3": "whisper-large-v3",
  "whisper-large-v3-turbo": "whisper-large-v3-turbo",
  "distil-whisper-large-v3-en": "distil-whisper-large-v3-en",
} as const;

const systemMessage = `
You are an AI assistant specialized in email analysis and communication.
Your primary role is to help users understand, organize, and respond to their emails effectively.

## Core Responsibilities:
1. Analyze email content thoroughly
2. Provide accurate, relevant information from emails
3. Help draft responses
4. Identify important information and action items
5. Organize and categorize email content
6. Answer queries about email content

## Guidelines:
- Only use information present in the provided emails
- Be precise and accurate in your responses
- If information isn't available in the emails, clearly state: "I cannot find this information in the provided emails"
- Never fabricate or assume information
- Maintain user privacy and security
- Format responses clearly using markdown
- NEVER use asterisks (*) for emphasis or formatting
- Use proper markdown formatting (e.g., bold with **, italics with _)
- Provide clear, direct responses without placeholders

## Response Structure:
1. Direct answer to the query
2. Supporting information from emails (if relevant)
3. Additional context or suggestions (when appropriate)
4. Action items or next steps (if applicable)

## Response Format:
- Always be **helpful, clear, and concise**.  
- Use **structured markdown** formatting when appropriate.  
- For **data summaries**, present information in **tables** for clarity.

## Email Drafting Guidelines:
- When drafting emails, provide complete, properly formatted content
- Include all necessary parts (subject, greeting, body, closing)
- Use professional language and tone
- Never use placeholders or asterisks
- Be specific and clear in the message
`;

const processEmailContext = (emails: EmailData[]): ProcessedEmail[] => {
  return emails.map((email) => ({
    subject: email.subject,
    from: email.from,
    to: email.to,
    date: email.date,
    content: email.preview,
  }));
};

const createPrompt = (query: string, context: AIContext): string => {
  const emailContext = processEmailContext(context.emails);
  const conversationHistory = context.previousMessages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");

  return `
${systemMessage}

## Available Emails:
${JSON.stringify(emailContext, null, 2)}

## Conversation History:
${conversationHistory}

## Current Query:
${query}

Please analyze the emails and provide a response based on the query. Remember to never use asterisks (*) for formatting and always provide complete, properly formatted responses.
`;
};

const tryModel = async (
  modelId: string,
  prompt: string
): Promise<string | null> => {
  try {
    const groqModel = groqModelMap[modelId as keyof typeof groqModelMap];
    if (!groqModel) return null;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      model: groqModel,
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 1,
      stream: false,
    });

    const response = completion.choices[0]?.message?.content || null;

    if (response) {
      return response.replace(/\*/g, "");
    }

    return null;
  } catch (error) {
    console.error(`Error with model ${modelId}:`, error);
    return null;
  }
};

const handleEmailQuery = async (
  query: string,
  modelId: string,
  context: AIContext
): Promise<{ response: string; modelUsed: string; fallbackUsed: boolean }> => {
  const prompt = createPrompt(query, context);
  let response: string | null = null;
  let modelUsed = modelId;
  let fallbackUsed = false;

  response = await tryModel(modelId, prompt);

  if (!response) {
    fallbackUsed = true;
    for (const fallbackModel of modelConfig.fallbackChain) {
      response = await tryModel(fallbackModel, prompt);
      if (response) {
        modelUsed = fallbackModel;
        break;
      }
    }
  }

  if (!response) {
    return {
      response:
        "I apologize, but I'm currently unable to process your request. Please try again later.",
      modelUsed: "none",
      fallbackUsed: true,
    };
  }

  return { response, modelUsed, fallbackUsed };
};

const validateRequest = (req: AIProcessingRequest): string | null => {
  if (!req.content?.trim()) {
    return "Query is required";
  }
  if (!req.context?.emails?.length) {
    return "Email context is required";
  }
  return null;
};

router.post("/process", auth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      content: query,
      action,
      modelId = modelConfig.primary,
      context,
    } = req.body as AIProcessingRequest;

    console.log("Get emails::", context);
    console.log("Get content::", query);

    // Validate request
    const validationError = validateRequest({
      content: query,
      action: "",
      modelId,
      context,
    });
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError,
        timestamp: new Date().toISOString(),
      } as AIResponse);
    }

    // Process the query with fallback handling
    const { response, modelUsed, fallbackUsed } = await handleEmailQuery(
      query,
      modelId,
      context
    );

    // Send response
    res.json({
      success: true,
      response,
      model: modelUsed,
      fallbackUsed,
      timestamp: new Date().toISOString(),
    } as AIResponse);
  } catch (error) {
    console.error("Error in AI processing:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process the request",
      model: modelConfig.primary,
      timestamp: new Date().toISOString(),
    } as AIResponse);
  }
});

export default router;
