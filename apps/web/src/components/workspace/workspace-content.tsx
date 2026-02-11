import { MessageSquare, Send } from "lucide-react";
import { useCallback, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";

interface WorkspaceContentProps {
  connection: DatabaseConnection;
}

export const WorkspaceContent = ({ connection }: WorkspaceContentProps) => {
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) {
        return;
      }
      // Future: send query to AI / database
    },
    [query]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Canvas / Results area */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquare />
            </EmptyMedia>
            <EmptyTitle>Ask a question about your data</EmptyTitle>
            <EmptyDescription>
              Type a query below to get started with {connection.name}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>

      {/* Chat input */}
      <div className="border-t p-3">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your database..."
            className="min-h-[44px] max-h-[200px] flex-1 resize-none"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!query.trim()}
            aria-label="Send query"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};
