// backend/src/routes/ai.ts
import express, { Router, Response } from "express";
import { Groq } from "groq-sdk";
import { auth, AuthRequest } from "../middleware/auth.js";
import { getModelById, AIModel } from "../config/models.js";
const router: Router = express.Router();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const systemMessage = `
You are an AI assistant that helps users analyze their emails.  
Your job is to find information from emails and answer user queries.  

## Guidelines:
- Carefully analyze emails to find the correct answer.  
- Only respond with information that exists in the given emails.  
- If the answer is not found, say: **"I could not find the information in the emails."**  
- **Never** make up information.  

## Capabilities:
1. **Read and analyze emails**  
2. **Summarize email content**  
3. **Extract key information and action items**  
4. **Help compose responses**  
5. **Organize emails by topic or importance**  
6. **Search for specific email content or topics**  

## Response Format:
- Always be **helpful, clear, and concise**.  
- Use **structured markdown** formatting when appropriate.  
- For **data summaries**, present information in **tables** for clarity.  
`;

interface AIProcessingRequest {
  content: string;
  action: string;
  modelId: string;
  context: any;
}

// Updated Groq model mapping based on currently available models
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
  // Audio models kept separate for special handling
  "whisper-large-v3": "whisper-large-v3",
  "whisper-large-v3-turbo": "whisper-large-v3-turbo",
  "distil-whisper-large-v3-en": "distil-whisper-large-v3-en",
};

router.post("/process", auth, async (req: AuthRequest, res: Response) => {
  const {
    content: query,
    action,
    modelId = "llama-3.1-8b-instant",
    context,
  } = req.body as AIProcessingRequest;

  const model = getModelById(modelId);
  console.log("Get content::", query);
  console.log("Get model::", model);
  console.log("Get action::", action);
  console.log("Get modelId::", modelId);
  console.log("Get context::", context);
});

export default router;
