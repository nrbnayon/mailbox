// src\components\Chat\ChatMessage.tsx
import React from "react";
import {
  User,
  Bot,
  Copy,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

interface MessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  loading?: boolean;
}

interface ChatMessageProps {
  message: MessageData;
  onRetry?: () => void;
  onCopy?: () => void;
  onFeedback?: (type: "positive" | "negative") => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onRetry,
  onCopy,
  onFeedback,
}) => {
  const isUser = message.role === "user";

  return (
    <div
      className={`py-6 transition-opacity ${
        isUser ? "bg-accent/10" : "bg-background"
      }`}
      style={{ opacity: message.loading ? 0.7 : 1 }}
    >
      <div className="container max-w-full mx-auto">
        <div className="flex gap-4">
          {/* User / Assistant Avatar */}
          <div className="flex-shrink-0">
            {isUser ? (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Message Content */}
          <div className="flex-1 space-y-2">
            {/* Sender Name & Timestamp */}
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {isUser ? "You" : "Assistant"}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(message.timestamp, "h:mm a")}
              </span>
            </div>

            {/* Scrollable Message Content */}
            <div className="prose prose-sm max-w-none dark:prose-invert overflow-y-auto max-h-64 p-2 rounded-md border border-gray-200 dark:border-gray-700">
              {message.loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              ) : (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              )}
            </div>

            {/* Action Buttons (Only for Assistant Messages) */}
            {!isUser && !message.loading && (
              <div className="flex items-center gap-2 pt-2">
                {/* Copy Button */}
                <button
                  onClick={onCopy}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  aria-label="Copy message"
                  title="Copy message"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>

                {/* Retry Button */}
                <button
                  onClick={onRetry}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  aria-label="Retry request"
                  title="Retry request"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </button>

                {/* Feedback Buttons (Thumbs Up / Down) */}
                <div className="flex items-center gap-1">
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent/10"
                    onClick={() => onFeedback?.("positive")}
                    aria-label="Thumbs up"
                    title="Thumbs up"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent/10"
                    onClick={() => onFeedback?.("negative")}
                    aria-label="Thumbs down"
                    title="Thumbs down"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
