// backend\src\config\models.ts
export interface AIModel {
  id: string;
  name: string;
  developer: string;
  contextWindow: number;
  maxCompletionTokens?: number;
  maxInputSize?: string;
  description?: string;
  isDefault?: boolean;
  apiType: "groq" | "deepseek" | "openai" | "huggingface" | "meta";
}

export const availableModels: AIModel[] = [
  // Existing models
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral-8x7b-32768",
    developer: "Mistral",
    contextWindow: 32768,
    apiType: "groq",
    description:
      "Powerful open-source mixture-of-experts model with exceptional reasoning capabilities",
  },
  {
    id: "llama-3-70b",
    name: "Llama 3 70B",
    developer: "Meta",
    contextWindow: 128000,
    maxCompletionTokens: 32768,
    apiType: "groq",
    description:
      "Meta's largest open LLM offering best-in-class performance and reasoning",
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    developer: "Meta",
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    apiType: "groq",
    description: "Efficient and responsive model for quick interactions",
  },
  {
    id: "gemma-7b",
    name: "Gemma 7B",
    developer: "Google",
    contextWindow: 8192,
    apiType: "groq",
    description: "Google's lightweight yet powerful open model",
  },
  // Removing duplicate gemma2-9b-it entry that appears twice in the original
  {
    id: "deepseek-coder",
    name: "DeepSeek Coder",
    developer: "DeepSeek",
    contextWindow: 64000,
    maxCompletionTokens: 8000,
    apiType: "deepseek",
    description: "Specialized model for coding assistance and technical tasks",
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    developer: "DeepSeek",
    contextWindow: 64000,
    maxCompletionTokens: 8000,
    apiType: "deepseek",
    description: "Versatile model for conversational AI and general tasks",
  },
  {
    id: "distil-whisper-large-v3-en",
    name: "Distil Whisper Large v3 (English)",
    developer: "HuggingFace",
    contextWindow: 0,
    maxInputSize: "25 MB",
    apiType: "huggingface",
    description:
      "Distilled version of Whisper optimized for English audio transcription",
  },
  {
    id: "gemma2-9b-it",
    name: "Gemma 2 9B IT",
    developer: "Google",
    contextWindow: 8192,
    apiType: "groq",
    description: "Instruction-tuned version of Google's Gemma 2 9B model",
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    developer: "Meta",
    contextWindow: 128000,
    maxCompletionTokens: 32768,
    apiType: "meta",
    description:
      "Meta's advanced 70B parameter model with versatile capabilities",
    isDefault: true,
  },
  {
    id: "llama-guard-3-8b",
    name: "Llama Guard 3 8B",
    developer: "Meta",
    contextWindow: 8192,
    apiType: "meta",
    description: "Specialized safety model from Meta's Llama 3 family",
  },
  {
    id: "llama3-70b-8192",
    name: "Llama 3 70B (8K)",
    developer: "Meta",
    contextWindow: 8192,
    apiType: "meta",
    description: "Meta's 70B parameter model with 8K context window",
  },
  {
    id: "llama3-8b-8192",
    name: "Llama 3 8B (8K)",
    developer: "Meta",
    contextWindow: 8192,
    apiType: "meta",
    description: "Meta's efficient 8B parameter model with 8K context window",
  },
  {
    id: "whisper-large-v3",
    name: "Whisper Large v3",
    developer: "OpenAI",
    contextWindow: 0,
    maxInputSize: "25 MB",
    apiType: "openai",
    description: "OpenAI's advanced speech recognition model for transcription",
  },
  {
    id: "whisper-large-v3-turbo",
    name: "Whisper Large v3 Turbo",
    developer: "OpenAI",
    contextWindow: 0,
    maxInputSize: "25 MB",
    apiType: "openai",
    description:
      "Faster version of OpenAI's Whisper Large v3 transcription model",
  },
];

// Helper to get the default model
export const getDefaultModel = (): AIModel => {
  const defaultModel = availableModels.find((model) => model.isDefault);
  return defaultModel || availableModels[0]; 
};

// Helper to get model by ID
export const getModelById = (id: string): AIModel | undefined => {
  return availableModels.find((model) => model.id === id);
};