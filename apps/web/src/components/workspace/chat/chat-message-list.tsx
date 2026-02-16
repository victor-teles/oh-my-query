import { MessageSquare } from "lucide-react";
import { useEffect, useRef } from "react";

import type { ChatMessage as ChatMessageType } from "@/hooks/use-ai-chat";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ChatMessage } from "./chat-message";

interface ChatMessageListProps {
  messages: ChatMessageType[];
  connectionName: string;
  onInsertSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
}

export const ChatMessageList = ({
  messages,
  connectionName,
  onInsertSql,
  onRunSql,
}: ChatMessageListProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquare />
            </EmptyMedia>
            <EmptyTitle>Ask a question about your data</EmptyTitle>
            <EmptyDescription>
              Describe what you need in plain English and get SQL queries for{" "}
              {connectionName}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-4 p-4">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onInsertSql={onInsertSql}
            onRunSql={onRunSql}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
};
