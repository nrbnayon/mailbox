import React from "react";
import ChatContainer from "@/components/Chat/ChatContainer";

const Chat: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-4">
        <h1 className="text-2xl font-bold">AI Email Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask me anything about your emails or let me help you compose new ones
        </p>
      </div>
      <div className="flex-1">
        <ChatContainer />
      </div>
    </div>
  );
};

export default Chat;
