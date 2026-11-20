import type { KeyboardEvent } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionForm } from "@/components/connection-form";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { CheckDraw } from "@/components/motion/check-draw";
import { useMotionPreset } from "@/lib/motion";

export const POP_AFTER_SAVE_MS = 450;
const SUBMIT_KEYS = ["⌘", "↩"] as const;

const isSubmitShortcut = (event: KeyboardEvent) =>
  event.key === "Enter" && event.metaKey;

const saveLabel = (missing: boolean, saved: boolean): string | null => {
  if (missing) {
    return null;
  }
  return saved ? "Saved" : "Save";
};

function MissingConnection() {
  return (
    <p className="px-4 pt-2 pb-6 type-body text-panel-muted" role="status">
      This connection no longer exists.
    </p>
  );
}

interface ConnectionEditViewProps {
  connectionId: string | null;
  onBack: () => void;
}

export function ConnectionEditView({
  connectionId,
  onBack,
}: ConnectionEditViewProps) {
  const { state, saved } = useConnections();
  const { reduced } = useMotionPreset();
  const [isSaved, setIsSaved] = useState(false);
  const formHost = useRef<HTMLDivElement>(null);
  const connection = connectionId
    ? state.connections.find((item) => item.id === connectionId)
    : undefined;
  const missing = connectionId !== null && !connection;

  const handleSuccess = useCallback(
    (next: DatabaseConnection) => {
      saved(next, connection);
      setIsSaved(true);
    },
    [connection, saved]
  );

  useEffect(() => {
    if (!isSaved) {
      return;
    }
    const timer = window.setTimeout(onBack, reduced ? 0 : POP_AFTER_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [isSaved, onBack, reduced]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!isSubmitShortcut(event)) {
      return;
    }
    event.preventDefault();
    formHost.current?.querySelector("form")?.requestSubmit();
  }, []);

  const title = connection ? `Edit ${connection.name}` : "New Connection";

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- ⌘↵ submits from any field inside the form
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      <ViewHeader onBack={onBack} title={missing ? "Edit Connection" : title} />
      <div
        className="min-h-0 flex-1 overflow-y-auto border-t border-panel-border px-4 pt-3 pb-4"
        ref={formHost}
      >
        {missing ? (
          <MissingConnection />
        ) : (
          <ConnectionForm
            connection={connection}
            key={connectionId ?? "new"}
            onSuccess={handleSuccess}
          />
        )}
      </div>
      <LauncherFooter
        actionKeys={SUBMIT_KEYS}
        actionLabel={saveLabel(missing, isSaved)}
        status={
          isSaved ? <CheckDraw label="Saved" /> : <span>esc to go back</span>
        }
      />
    </div>
  );
}
