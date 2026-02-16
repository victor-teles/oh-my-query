import { Bot, User } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatMessage as ChatMessageType } from "@/hooks/use-ai-chat";

import { cn } from "@/lib/utils";

import { SqlCodeBlock } from "./sql-code-block";

interface ChatMessageProps {
  message: ChatMessageType;
  onInsertSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
}

const ChatMessageInner = ({
  message,
  onInsertSql,
  onRunSql,
}: ChatMessageProps) => {
  if (message.role === "user") {
    return <UserMessage content={message.content} />;
  }

  return (
    <AssistantMessage
      content={message.content}
      onInsertSql={onInsertSql}
      onRunSql={onRunSql}
    />
  );
};

export const ChatMessage = memo(ChatMessageInner);

const UserMessage = ({ content }: { content: string }) => (
  <div className="flex justify-end gap-2">
    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
      {content}
    </div>
    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <User className="size-3.5 text-primary" />
    </div>
  </div>
);

interface AssistantMessageProps {
  content: string;
  onInsertSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
}

const AssistantMessage = ({
  content,
  onInsertSql,
  onRunSql,
}: AssistantMessageProps) => {
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

      if (lang) {
        return (
          <div className="my-2 overflow-hidden rounded-lg border bg-secondary/30">
            <div className="border-b px-3 py-1.5">
              <span className="text-xs text-muted-foreground">{lang}</span>
            </div>
            <pre className="overflow-x-auto p-3 text-sm">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      return (
        <code className="rounded bg-secondary/50 px-1.5 py-0.5 text-sm">
          {children}
        </code>
      );
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

  return (
    <div className="flex gap-2">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bot className="size-3.5 text-muted-foreground" />
      </div>
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-[80%]",
          "prose-p:leading-relaxed prose-p:my-1",
          "prose-ul:my-1 prose-ol:my-1",
          "prose-li:my-0",
          "prose-headings:my-2"
        )}
      >
        {content ? (
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
          </Markdown>
        ) : (
          <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground/50" />
        )}
      </div>
    </div>
  );
};
