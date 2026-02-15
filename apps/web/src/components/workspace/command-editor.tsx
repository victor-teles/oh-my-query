import { useCallback } from "react";

import type { DatabaseType } from "@/lib/connections";

const PLACEHOLDERS: Partial<Record<DatabaseType, string>> = {
  mongodb: 'db.collection.find({"field": "value"})',
  redis: "GET mykey",
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
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onExecute();
      }
    },
    [onExecute]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <textarea
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      readOnly={readOnly}
      placeholder={PLACEHOLDERS[databaseType] ?? "Enter command..."}
      className="h-full w-full resize-none bg-background p-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
      spellCheck={false}
    />
  );
};
