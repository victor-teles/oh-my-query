import type { ChatMessage as ChatMessageType } from "@/hooks/use-ai-chat";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

import type { InlineRunContext } from "./chat-message";

import { ChatMessage } from "./chat-message";

interface ChatMessageListProps {
  messages: ChatMessageType[];
  connectionName: string;
  onInsertSql?: (sql: string) => void;
  onReplaceSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
  hasSelection?: boolean;
  inlineRun?: InlineRunContext;
}

export const ChatMessageList = ({
  messages,
  connectionName,
  onInsertSql,
  onReplaceSql,
  onRunSql,
  hasSelection = false,
  inlineRun,
}: ChatMessageListProps) => (
  <Conversation className="flex-1">
    <ConversationContent>
      {messages.length === 0 ? (
        <ConversationEmptyState
          description="Generate SQL, explain queries, or fix errors"
          title={`Query assistant for ${connectionName}`}
        />
      ) : (
        messages.map((msg) => (
          <ChatMessage
            hasSelection={hasSelection}
            inlineRun={inlineRun}
            key={msg.id}
            message={msg}
            onInsertSql={onInsertSql}
            onReplaceSql={onReplaceSql}
            onRunSql={onRunSql}
          />
        ))
      )}
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
);
