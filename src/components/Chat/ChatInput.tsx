import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  selectedModel: string;
  placeholder?: string;
  disabled?: boolean;
  onAttachmentRequest?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading,
  selectedModel,
  placeholder = "Message AI assistant...",
  disabled = false,
  onAttachmentRequest,
}) => {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      onSend(message.trim());
      setMessage("");

      // Reset textarea height after submit
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  // Get model display info for footer
  const getModelDisplayInfo = () => {
    const modelMap: Record<string, { name: string; developer: string }> = {
      "mixtral-8x7b-32768": {
        name: "Mixtral-8x7b-32768",
        developer: "Mistral",
      },
      "llama-3-70b": { name: "Llama 3 70B", developer: "Meta" },
      "llama-3.1-8b-instant": {
        name: "Llama 3.1 8B Instant",
        developer: "Meta",
      },
      "gemma-7b": { name: "Gemma 7B", developer: "Google" },
      "gemma2-9b-it": { name: "Gemma 2 9B", developer: "Google" },
      "deepseek-coder": { name: "DeepSeek Coder", developer: "DeepSeek" },
      "deepseek-llm": { name: "DeepSeek Chat", developer: "DeepSeek" },
    };


    const model = modelMap[selectedModel];
    return model
      ? `Using ${model.name} (${model.developer})`
      : `Using ${selectedModel}`;
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
          <span>{getModelDisplayInfo()}</span>
        </div>
        <div>Press ⇧ + ↵ for new line</div>
      </div>
    </form>
  );
};

export default ChatInput;
