import { memo, useCallback, useMemo } from "react";

import type { ChatMessage as ChatMessageType } from "@/hooks/use-ai-chat";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";

import { RunnableSqlBlock } from "./runnable-sql-block";
import { SqlCodeBlock } from "./sql-code-block";
import { UIRenderBlock } from "./ui-render-block";

export interface InlineRunContext {
  connectionId: string;
  schema?: string;
}

const looksLikeRenderSpec = (code: string): boolean => {
  const trimmed = code.trim();
  if (!trimmed.startsWith("{")) {
    return false;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }
    const candidate = parsed as Record<string, unknown>;
    return (
      typeof candidate.root === "string" &&
      typeof candidate.elements === "object" &&
      candidate.elements !== null
    );
  } catch {
    return false;
  }
};

interface ChatMessageProps {
  message: ChatMessageType;
  onInsertSql?: (sql: string) => void;
  onReplaceSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
  hasSelection?: boolean;
  inlineRun?: InlineRunContext;
}

const LoadingIndicator = () => (
  <span
    className="inline-flex items-center gap-1"
    aria-label="Generating response"
  >
    <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
    <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
    <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
  </span>
);

const AssistantContent = ({
  content,
  onInsertSql,
  onReplaceSql,
  onRunSql,
  hasSelection = false,
  inlineRun,
}: {
  content: string;
  onInsertSql?: (sql: string) => void;
  onReplaceSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
  hasSelection?: boolean;
  inlineRun?: InlineRunContext;
}) => {
  const renderCode = useCallback(
    (props: React.ComponentProps<"code">) => {
      const { children, className } = props;
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1];
      const code = String(children).replace(/\n$/, "");

      if (lang === "sql") {
        if (inlineRun) {
          return (
            <RunnableSqlBlock
              code={code}
              connectionId={inlineRun.connectionId}
              schema={inlineRun.schema}
            />
          );
        }
        return (
          <SqlCodeBlock
            code={code}
            hasSelection={hasSelection}
            onInsert={onInsertSql}
            onReplace={onReplaceSql}
            onRun={onRunSql}
          />
        );
      }

      if (lang === "jsonrender") {
        return <UIRenderBlock code={code} />;
      }

      if ((lang === "json" || !lang) && looksLikeRenderSpec(code)) {
        return <UIRenderBlock code={code} />;
      }

      return <code className={className}>{children}</code>;
    },
    [onInsertSql, onReplaceSql, onRunSql, hasSelection, inlineRun]
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
  inlineRun,
}: ChatMessageProps) => (
  <Message from={message.role}>
    <MessageContent>
      {message.role === "user" ? (
        message.content
      ) : (
        <AssistantContent
          content={message.content}
          hasSelection={hasSelection}
          inlineRun={inlineRun}
          onInsertSql={onInsertSql}
          onReplaceSql={onReplaceSql}
          onRunSql={onRunSql}
        />
      )}
    </MessageContent>
  </Message>
);

export const ChatMessage = memo(ChatMessageInner);
