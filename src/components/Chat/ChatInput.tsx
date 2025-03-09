// src\components\Chat\ChatInput.tsx
import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip } from "lucide-react";
import { getModelById } from "@/lib/api";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  selectedModel: string;
  placeholder?: string;
  disabled?: boolean;
  onAttachmentRequest?: () => void;
  modelData?: any; // Allow passing model data directly
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading,
  selectedModel,
  placeholder = "Message AI assistant...",
  disabled = false,
  onAttachmentRequest,
  modelData,
}) => {
  const [message, setMessage] = useState("");
  const [displayModelInfo, setDisplayModelInfo] =
    useState<string>("Loading model...");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch model data if not provided directly
  useEffect(() => {
    const fetchModelInfo = async () => {
      try {
        if (modelData) {
          // Use provided model data
          setDisplayModelInfo(
            `Using ${modelData.name} (${modelData.developer})`
          );
        } else if (selectedModel) {
          // If we need to fetch model data
          const modelInfo = await getModelById(selectedModel);
          if (modelInfo) {
            setDisplayModelInfo(
              `Using ${modelInfo.name} (${modelInfo.developer})`
            );
          } else {
            setDisplayModelInfo(`Using ${selectedModel}`);
          }
        } else {
          setDisplayModelInfo("No model selected");
        }
      } catch (error) {
        console.error("Error fetching model info:", error);
        setDisplayModelInfo(`Using ${selectedModel}`);
      }
    };

    fetchModelInfo();
  }, [selectedModel, modelData]);

  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      console.log(`Submitting message with model: ${selectedModel}`);
      onSend(message.trim());
      setMessage("");

      // Reset textarea height after submit
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t bg-background p-4"
      aria-disabled={disabled || isLoading}
    >
      <div className="relative flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            className={`w-full resize-none rounded-lg border bg-background px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary min-h-[56px] max-h-[200px] transition-colors ${
              disabled ? "opacity-60 cursor-not-allowed" : ""
            }`}
            rows={1}
            disabled={disabled || isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            aria-label="Message input"
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <button
              type="button"
              className={`text-muted-foreground hover:text-foreground transition-colors ${
                disabled || !onAttachmentRequest
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
              onClick={onAttachmentRequest}
              disabled={disabled || isLoading || !onAttachmentRequest}
              aria-label="Attach file"
              title="Attach file"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={!message.trim() || isLoading || disabled}
          className={`flex h-[56px] w-[56px] items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity ${
            !message.trim() || isLoading || disabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:opacity-90"
          }`}
          aria-label="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-primary rounded-full"></div>
          <span>{displayModelInfo}</span>
        </div>
        <div>Press ⇧ + ↵ for new line</div>
      </div>
    </form>
  );
};

export default ChatInput;