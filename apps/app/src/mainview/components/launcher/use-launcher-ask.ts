import { useCallback, useMemo } from "react";

import type { AskTarget } from "@/components/ask/use-ask";
import type { LookupHit, LookupValue } from "@/lib/ipc";

import { useAsk } from "@/components/ask/use-ask";

import type { LauncherView } from "./use-launcher-stack";

const ASK: LauncherView = { kind: "ask" };

// The session lives above the view stack so the last answer survives going
// back to root and can be reopened without asking again.
export const useLauncherAsk = (push: (view: LauncherView) => void) => {
  const session = useAsk();
  const { restore, start, startMatch, startSql } = session;
  const hasAnswer = session.state.status !== "idle";

  const startAndShow = useCallback(
    (prompt: string, target: AskTarget) => {
      start(prompt, target);
      push(ASK);
    },
    [push, start]
  );
  const runSqlAndShow = useCallback(
    (sql: string, target: AskTarget, title?: string) => {
      startSql(sql, target, title);
      push(ASK);
    },
    [push, startSql]
  );
  const openMatch = useCallback(
    (hit: LookupHit, value: LookupValue, target: AskTarget) => {
      startMatch(hit, value, target);
      push(ASK);
    },
    [push, startMatch]
  );
  const reopen = useCallback(() => {
    restore();
    push(ASK);
  }, [push, restore]);

  const rootAsk = useMemo(
    () => ({
      reopen: hasAnswer ? reopen : null,
      start: startAndShow,
      startSql: runSqlAndShow,
    }),
    [hasAnswer, reopen, runSqlAndShow, startAndShow]
  );

  return { openMatch, rootAsk, session };
};
