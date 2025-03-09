// src\components\Chat\ModelSelector.tsx
import React, { useEffect, useState, useRef } from "react";
import { Check, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { getModels, getDefaultModel } from "@/lib/api";

export interface AIModel {
  id: string;
  name: string;
  developer: string;
  contextWindow: number;
  maxCompletionTokens?: number;
  description?: string;
  isDefault?: boolean;
  apiType?: string;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch models from the API
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsLoading(true);
        const modelsList = await getModels();
        console.log("Models fetched successfully:", modelsList);
        setModels(modelsList);

        // If no model is selected or the selected model isn't in the list, set the default
        if (!selectedModel || !modelsList.find((m) => m.id === selectedModel)) {
          try {
            const defaultModel = await getDefaultModel();
            console.log("Default model:", defaultModel);
            onModelChange(defaultModel.id);
          } catch (defaultError) {
            console.error("Error fetching default model:", defaultError);
            // If default model fetch fails, use the first model in the list
            if (modelsList.length > 0) {
              onModelChange(modelsList[0].id);
            }
          }
        }

        setError(null);
      } catch (err) {
        console.error("Error fetching models:", err);
        setError("Failed to load models");
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, [onModelChange, selectedModel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        isOpen
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Find the currently selected model data
  const selectedModelData = models.find((m) => m.id === selectedModel);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border bg-background">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading models...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border bg-background text-red-500">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  // If models array is empty after loading
  if (models.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border bg-background text-amber-500">
        <AlertCircle className="h-4 w-4" />
        <span>No models available</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm border rounded-md bg-background hover:bg-accent/10 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="model-selector"
      >
        <div className="flex items-center gap-2">
          {selectedModelData ? (
            <>
              <span className="font-medium">{selectedModelData.name}</span>
              <span className="text-xs text-muted-foreground">
                {selectedModelData.developer}
              </span>
            </>
          ) : (
            "Select a model"
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-full bg-background border rounded-md shadow-lg z-10 max-h-60 overflow-auto">
          <ul className="py-1" role="listbox" id="model-selector">
            {models.map((model) => (
              <li
                key={model.id}
                role="option"
                aria-selected={selectedModel === model.id}
                onClick={() => {
                  console.log("Selected model:", model.id);
                  onModelChange(model.id);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-accent/10 transition-colors ${
                  selectedModel === model.id ? "bg-accent/20" : ""
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {model.developer}
                    {model.contextWindow > 0 &&
                      ` · ${model.contextWindow.toLocaleString()} tokens`}
                  </span>
                </div>
                {selectedModel === model.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;