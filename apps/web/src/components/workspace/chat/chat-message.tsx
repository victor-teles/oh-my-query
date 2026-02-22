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
  onRunSql?: (sql: string) => void;
}

const LoadingIndicator = () => (
  <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground/50" />
);

const AssistantContent = ({
  content,
  onInsertSql,
  onRunSql,
}: {
  content: string;
  onInsertSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
}) => {
  const renderCode = useCallback(
    (props: React.ComponentProps<"code">) => {
      const { children, className } = props;
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1];
      const code = String(children).replace(/\n$/, "");

      if (lang === "sql") {
        return (
          <SqlCodeBlock code={code} onInsert={onInsertSql} onRun={onRunSql} />
        );
      }

      if (lang === "jsonrender") {
        return <UIRenderBlock code={code} />;
      }

      return <code className={className}>{children}</code>;
    },
    [onInsertSql, onRunSql]
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
  onRunSql,
}: ChatMessageProps) => (
  <Message from={message.role}>
    <MessageContent>
      {message.role === "user" ? (
        message.content
      ) : (
        <AssistantContent
          content={message.content}
          onInsertSql={onInsertSql}
          onRunSql={onRunSql}
        />
      )}
    </MessageContent>
  </Message>
);

export const ChatMessage = memo(ChatMessageInner);
