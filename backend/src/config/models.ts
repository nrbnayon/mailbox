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
  apiType: "groq";
}

export const availableModels: AIModel[] = [
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
    apiType: "groq",
    description:
      "Meta's advanced 70B parameter model with versatile capabilities",
    isDefault: true,
  },
  {
    id: "llama-guard-3-8b",
    name: "Llama Guard 3 8B",
    developer: "Meta",
    contextWindow: 8192,
    apiType: "groq",
    description: "Specialized safety model from Meta's Llama 3 family",
  },
  {
    id: "llama3-70b-8192",
    name: "Llama 3 70B (8K)",
    developer: "Meta",
    contextWindow: 8192,
    apiType: "groq",
    description: "Meta's 70B parameter model with 8K context window",
  },
  {
    id: "llama3-8b-8192",
    name: "Llama 3 8B (8K)",
    developer: "Meta",
    contextWindow: 8192,
    apiType: "groq",
    description: "Meta's efficient 8B parameter model with 8K context window",
  },
  {
    id: "whisper-large-v3",
    name: "Whisper Large v3",
    developer: "OpenAI",
    contextWindow: 0,
    maxInputSize: "25 MB",
    apiType: "groq",
    description: "OpenAI's advanced speech recognition model for transcription",
  },
  {
    id: "whisper-large-v3-turbo",
    name: "Whisper Large v3 Turbo",
    developer: "OpenAI",
    contextWindow: 0,
    maxInputSize: "25 MB",
    apiType: "groq",
    description:
      "Faster version of OpenAI's Whisper Large v3 transcription model",
  },
];

export const getDefaultModel = (): AIModel => {
  const defaultModel = availableModels.find((model) => model.isDefault);
  return defaultModel || availableModels[0]; 
};

export const getModelById = (id: string): AIModel | undefined => {
  return availableModels.find((model) => model.id === id);
};