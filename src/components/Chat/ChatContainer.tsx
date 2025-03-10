// src\components\Chat\ChatContainer.tsx
import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import ModelSelector from "./ModelSelector";
import { processWithAI, getEmails, getDefaultModel } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  loading?: boolean;
}

const ChatContainer: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modelData, setModelData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch emails for context
  const { data: emails, isLoading: emailsLoading } = useQuery({
    queryKey: ["emails"],
    queryFn: () => getEmails(),
  });

  // Fetch default model on component mount
  useEffect(() => {
    const fetchDefaultModel = async () => {
      try {
        const defaultModel = await getDefaultModel();
        setSelectedModel(defaultModel.id);
        setModelData(defaultModel);
      } catch (error) {
        console.error("Error fetching default model:", error);
        toast.error("Failed to load default AI model");
      }
    };

    if (!selectedModel) {
      fetchDefaultModel();
    }
  }, [selectedModel]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100); // Add a small delay to ensure DOM updates complete
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const aiMutation = useMutation({
    mutationFn: processWithAI,
    onMutate: (variables) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Thinking...",
          timestamp: new Date(),
          loading: true,
        },
      ]);
    },
    onSuccess: (response) => {
      setMessages((prev) => {
        const newMessages = [...prev];
        const loadingIndex = newMessages.findIndex((msg) => msg.loading);
        if (loadingIndex !== -1) {
          newMessages[loadingIndex] = {
            id: Date.now().toString(),
            role: "assistant",
            content: response.response,
            timestamp: new Date(),
          };
        }
        return newMessages;
      });
    },
    onError: (error) => {
      setMessages((prev) => prev.filter((msg) => !msg.loading));
      toast.error("Failed to process message");
      console.error("AI processing error:", error);
    },
  });

  const handleSendMessage = (content: string) => {
    if (!selectedModel) {
      toast.error("No AI model selected");
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    aiMutation.mutate({
      content,
      action: "process",
      model: selectedModel,
      context: {
        emails: emails?.messages || [],
        previousMessages: messages,
      },
    });
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const handleRetry = (messageIndex: number) => {
    const messageToRetry = messages[messageIndex];
    if (messageToRetry.role === "user") {
      aiMutation.mutate({
        content: messageToRetry.content,
        action: "process",
        model: selectedModel,
        context: {
          emails: emails?.messages || [], 
          previousMessages: messages.slice(0, messageIndex),
        },
      });
    }
  };

  if (emailsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">
            Loading your emails...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-background overflow-hidden"
      ref={containerRef}
    >
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-h-[calc(100vh-200px)]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div className="max-w-md space-y-4">
              <h2 className="text-2xl font-bold">
                Welcome to AI Email Assistant
              </h2>
              <p className="text-muted-foreground">
                I can help you manage your emails, draft responses, find
                specific messages, and more. Just ask me anything!
              </p>
              <div className="text-sm text-muted-foreground">
                Try asking:
                <ul className="mt-2 space-y-2">
                  <li>"Show my unread emails"</li>
                  <li>"Find emails from [sender]"</li>
                  <li>"Draft a response to [subject]"</li>
                  <li>"Summarize my recent emails"</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              onCopy={() => handleCopy(message.content)}
              onRetry={() => handleRetry(index)}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ">
        <div className="p-4 border-b">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
          />
        </div>
        <ChatInput
          onSend={handleSendMessage}
          isLoading={aiMutation.isPending}
          selectedModel={selectedModel}
          modelData={modelData}
        />
      </div>
    </div>
  );
};

export default ChatContainer;
