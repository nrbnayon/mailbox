// backend/src/config/models.ts
export interface AIModel {
  id: string;
  name: string;
  developer: string;
  contextWindow: number;
  maxCompletionTokens?: number;
  description?: string;
  isDefault?: boolean;
  apiType: "groq" | "deepseek"; 
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
    name: "Gemma 2 9B",
    developer: "Google",
    contextWindow: 8192,
    apiType: "groq",
    description: "Latest iteration of Google's open language model family",
  },
  {
    id: "deepseek-coder",
    name: "DeepSeek Coder",
    developer: "DeepSeek",
    contextWindow: 64000,
    maxCompletionTokens: 8000,
    apiType: "deepseek",
    description: "Specialized model for coding assistance and technical tasks",
    isDefault: true,
  },
  {
    id: "deepseek-llm",
    name: "DeepSeek Chat",
    developer: "DeepSeek",
    contextWindow: 64000,
    maxCompletionTokens: 8000,
    apiType: "deepseek",
    description: "Versatile model for conversational AI and general tasks",
  },
];

// Helper to get the default model
export const getDefaultModel = (): AIModel => {
  const defaultModel = availableModels.find((model) => model.isDefault);
  return defaultModel || availableModels[0]; // Fallback to first model if no default is set
};

// Helper to get model by ID
export const getModelById = (id: string): AIModel | undefined => {
  return availableModels.find((model) => model.id === id);
};
