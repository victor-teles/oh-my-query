import { memo, useCallback, useMemo } from "react";

import type { ChatMessage as ChatMessageType } from "@/hooks/use-ai-chat";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";

import { SqlCodeBlock } from "./sql-code-block";
import { UIRenderBlock } from "./ui-render-block";

interface ChatMessageProps {
  message: ChatMessageType;
  onInsertSql?: (sql: string) => void;
  onReplaceSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
  hasSelection?: boolean;
}

const LoadingIndicator = () => (
  <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground/50" />
);

const AssistantContent = ({
  content,
  onInsertSql,
  onReplaceSql,
  onRunSql,
  hasSelection = false,
}: {
  content: string;
  onInsertSql?: (sql: string) => void;
  onReplaceSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
  hasSelection?: boolean;
}) => {
  const renderCode = useCallback(
    (props: React.ComponentProps<"code">) => {
      const { children, className } = props;
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1];
      const code = String(children).replace(/\n$/, "");

      if (lang === "sql") {
        return (
          <SqlCodeBlock
            code={code}
            onInsert={onInsertSql}
            onReplace={onReplaceSql}
            onRun={onRunSql}
            hasSelection={hasSelection}
          />
        );
      }

      if (lang === "jsonrender") {
        return <UIRenderBlock code={code} />;
      }

      return <code className={className}>{children}</code>;
    },
    [onInsertSql, onReplaceSql, onRunSql, hasSelection]
  );

  const components = useMemo(
    () => ({
      code: renderCode,
      pre: ({ children }: React.ComponentProps<"pre">) => children,
    }),
    [renderCode]
  );

  if (!content) {
    return <LoadingIndicator />;
  }

  return <MessageResponse components={components}>{content}</MessageResponse>;
};

const ChatMessageInner = ({
  message,
  onInsertSql,
  onReplaceSql,
  onRunSql,
  hasSelection = false,
}: ChatMessageProps) => (
  <Message from={message.role}>
    <MessageContent>
      {message.role === "user" ? (
        message.content
      ) : (
        <AssistantContent
          content={message.content}
          onInsertSql={onInsertSql}
          onReplaceSql={onReplaceSql}
          onRunSql={onRunSql}
          hasSelection={hasSelection}
        />
      )}
    </MessageContent>
  </Message>
);

export const ChatMessage = memo(ChatMessageInner);
