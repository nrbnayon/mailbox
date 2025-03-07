import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSend(message);
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className='border-t bg-background p-4'>
      <div className='relative flex items-end gap-2'>
        <div className='relative flex-1'>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='Message Claude...'
            className='w-full resize-none rounded-lg border bg-background px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary min-h-[56px] max-h-[200px]'
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <div className='absolute right-3 bottom-3 flex items-center gap-2'>
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground'
              onClick={() => {}}
            >
              <Paperclip className='h-5 w-5' />
            </button>
          </div>
        </div>
        <button
          type='submit'
          disabled={!message.trim() || isLoading}
          className='flex h-[56px] w-[56px] items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50'
        >
          <Send className='h-5 w-5' />
        </button>
      </div>
      <div className='mt-2 flex items-center justify-between text-xs text-muted-foreground'>
        <div className='flex items-center gap-2'>
          <Sparkles className='h-4 w-4' />
          <span>Using Mixtral-8x7b-32768 (Default)</span>
        </div>
        <div>Press ⇧ + ↵ for new line</div>
      </div>
    </form>
  );
};

export default ChatInput;
