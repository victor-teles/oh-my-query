import { MessageSquare, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { SchemaInfo } from "@/lib/tauri";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { AISettingsDialog } from "@/components/workspace/ai-settings-dialog";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useAiChat } from "@/hooks/use-ai-chat";
import { hasAISettings } from "@/lib/ai-settings";

import { ChatInput } from "./chat-input";
import { ChatMessageList } from "./chat-message-list";

const SQL_SUGGESTIONS = [
  "Show all tables",
  "Count rows in each table",
  "Describe the schema",
];

interface ChatSidebarProps {
  connection: DatabaseConnection;
  schema: SchemaInfo | null;
  onClose: () => void;
}

export const ChatSidebar = ({
  connection,
  schema,
  onClose,
}: ChatSidebarProps) => {
  const { messages, isStreaming, sendMessage, stopStreaming } = useAiChat({
    databaseType: connection.type,
    schema,
  });

  const { insertAtCursor, openQuery } = useEditorInsert();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const checkSettings = async () => {
      const configured = await hasAISettings();
      setIsConfigured(configured);
    };
    checkSettings();
  }, [settingsOpen]);

  const handleInsertSql = useCallback(
    (sql: string) => {
      insertAtCursor(sql);
    },
    [insertAtCursor]
  );

  const handleRunSql = useCallback(
    (sql: string) => {
      openQuery(sql);
    },
    [openQuery]
  );

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">AI Chat</span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="Close AI Chat"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <ChatMessageList
        messages={messages}
        connectionName={connection.name}
        onInsertSql={handleInsertSql}
        onRunSql={handleRunSql}
      />
      {messages.length === 0 && (
        <Suggestions className="flex-wrap justify-center px-3 pb-2">
          {SQL_SUGGESTIONS.map((s) => (
            <Suggestion key={s} suggestion={s} onClick={sendMessage} />
          ))}
        </Suggestions>
      )}
      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        onOpenSettings={handleOpenSettings}
        isStreaming={isStreaming}
        isConfigured={isConfigured}
      />
      <AISettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};
