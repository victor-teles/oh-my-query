import { MessageSquare } from "lucide-react";

import type { ChatMessage as ChatMessageType } from "@/hooks/use-ai-chat";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

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
}: ChatMessageListProps) => (
  <Conversation className="flex-1">
    <ConversationContent>
      {messages.length === 0 ? (
        <ConversationEmptyState
          icon={<MessageSquare className="size-6" />}
          title="Ask a question about your data"
          description={`Describe what you need in plain English and get SQL queries for ${connectionName}`}
        />
      ) : (
        messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onInsertSql={onInsertSql}
            onRunSql={onRunSql}
          />
        ))
      )}
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
);
