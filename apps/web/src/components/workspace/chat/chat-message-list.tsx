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
  onReplaceSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
  hasSelection?: boolean;
}

export const ChatMessageList = ({
  messages,
  connectionName,
  onInsertSql,
  onReplaceSql,
  onRunSql,
  hasSelection = false,
}: ChatMessageListProps) => (
  <Conversation className="flex-1">
    <ConversationContent>
      {messages.length === 0 ? (
        <ConversationEmptyState
          title={`Query assistant for ${connectionName}`}
          description="Generate SQL, explain queries, or fix errors"
        />
      ) : (
        messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onInsertSql={onInsertSql}
            onReplaceSql={onReplaceSql}
            onRunSql={onRunSql}
            hasSelection={hasSelection}
          />
        ))
      )}
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
);
