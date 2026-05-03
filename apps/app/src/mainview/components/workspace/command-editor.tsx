import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useRef } from "react";

import type { DatabaseType } from "@/lib/connections";

const PLACEHOLDERS: Partial<Record<DatabaseType, string>> = {
  mongodb: 'db.collection.find({"field": "value"})',
  redis: [
    "# Try any Redis command — ⌘+Enter to run",
    "GET mykey",
    "HGETALL user:1",
    "ZRANGE leaderboard 0 9 WITHSCORES",
    "SCAN 0 MATCH user:* COUNT 100",
    "INFO keyspace",
  ].join("\n"),
};

interface CommandEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  databaseType: DatabaseType;
  readOnly?: boolean;
}

export const CommandEditor = ({
  value,
  onChange,
  onExecute,
  databaseType,
  readOnly = false,
}: CommandEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useHotkey(
    "Mod+Enter",
    () => {
      onExecute();
    },
    { target: textareaRef }
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      readOnly={readOnly}
      placeholder={PLACEHOLDERS[databaseType] ?? "Enter command..."}
      className="
        size-full resize-none bg-background p-3 font-mono text-sm
        text-foreground outline-none
        placeholder:text-muted-foreground
      "
      spellCheck={false}
    />
  );
};
