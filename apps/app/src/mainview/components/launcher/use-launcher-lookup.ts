import { useCallback, useMemo } from "react";

import type { AskTarget } from "@/components/ask/use-ask";
import type { LookupHit, LookupValue } from "@/lib/ipc";

import { useLookup } from "@/components/lookup/use-lookup";

import type { LauncherView } from "./use-launcher-stack";

interface UseLauncherLookupOptions {
  offer: LookupValue | null;
  push: (view: LauncherView) => void;
  openMatch: (hit: LookupHit, value: LookupValue, target: AskTarget) => void;
}

// Owned above the view stack so the results survive opening a table's rows.
export const useLauncherLookup = ({
  offer,
  push,
  openMatch,
}: UseLauncherLookupOptions) => {
  const session = useLookup();
  const { start } = session;
  const { value, connectionId } = session.state;

  const startAndShow = useCallback(
    (next: LookupValue, target: string) => {
      start(next, target);
      push({ connectionId: target, kind: "lookup", value: next });
    },
    [push, start]
  );
  const openRows = useCallback(
    (hit: LookupHit) => {
      if (value && connectionId) {
        openMatch(hit, value, { connectionId, database: null });
      }
    },
    [connectionId, openMatch, value]
  );
  const root = useMemo(
    () => ({ offer, start: startAndShow }),
    [offer, startAndShow]
  );

  return { openRows, root, session };
};
