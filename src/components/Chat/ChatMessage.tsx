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

interface ChatMessageProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    loading?: boolean;
  };
  onRetry?: () => void;
  onCopy?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onRetry,
  onCopy,
}) => {
  const isUser = message.role === "user";

  return (
    <div
      className={`py-6 ${isUser ? "bg-accent/10" : "bg-background"}`}
      style={{ opacity: message.loading ? 0.7 : 1 }}
    >
      <div className='container max-w-3xl mx-auto'>
        <div className='flex gap-4'>
          <div className='flex-shrink-0'>
            {isUser ? (
              <div className='h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center'>
                <User className='h-5 w-5 text-primary' />
              </div>
            ) : (
              <div className='h-8 w-8 rounded-full bg-primary flex items-center justify-center'>
                <Bot className='h-5 w-5 text-primary-foreground' />
              </div>
            )}
          </div>
          <div className='flex-1 space-y-2'>
            <div className='flex items-center gap-2'>
              <span className='font-medium'>
                {isUser ? "You" : "Assistant"}
              </span>
              <span className='text-xs text-muted-foreground'>
                {format(message.timestamp, "h:mm a")}
              </span>
            </div>
            <div className='prose prose-sm max-w-none dark:prose-invert'>
              {message.loading ? (
                <div className='flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  <span>Thinking...</span>
                </div>
              ) : (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              )}
            </div>
            {!isUser && !message.loading && (
              <div className='flex items-center gap-2 pt-2'>
                <button
                  onClick={onCopy}
                  className='text-xs text-muted-foreground hover:text-foreground flex items-center gap-1'
                >
                  <Copy className='h-3 w-3' />
                  Copy
                </button>
                <button
                  onClick={onRetry}
                  className='text-xs text-muted-foreground hover:text-foreground flex items-center gap-1'
                >
                  <RotateCcw className='h-3 w-3' />
                  Retry
                </button>
                <div className='flex items-center gap-1'>
                  <button className='text-muted-foreground hover:text-foreground'>
                    <ThumbsUp className='h-3 w-3' />
                  </button>
                  <button className='text-muted-foreground hover:text-foreground'>
                    <ThumbsDown className='h-3 w-3' />
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
