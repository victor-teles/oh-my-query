import type { DialectType } from "@oh-my-query/core/client";

import { isSqlDialect } from "@oh-my-query/core/client";
import { useCallback, useEffect, useReducer, useRef } from "react";

import type { CardViewKind } from "@/lib/card-data";
import type { AskEvent, LookupHit, LookupValue } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { ask, cancelAsk, describeSql, onAskEvent, runSql } from "@/lib/ipc";

import type { AskAction, AskSource } from "./ask-reducer";

import { refineContextOf } from "./ask-chain";
import { askReducer, canRefine, initialAskState } from "./ask-reducer";

export interface AskTarget {
  connectionId: string;
  database: string | null;
}

interface Session {
  askId: string;
  unsubscribe: () => void;
}

const SEND_FAILED: Record<AskSource, string> = {
  match: "The rows could not be opened.",
  question: "The question could not be sent.",
  sql: "The query could not be sent.",
};

const isTerminal = (event: AskEvent): boolean =>
  event.type === "done" || event.type === "error";

const stopOnBun = async (askId: string): Promise<void> => {
  try {
    await cancelAsk(askId);
  } catch (error) {
    console.error("[ask] cancel failed", error);
  }
};

const describeAnswer = async (
  sql: string,
  dialect: DialectType,
  dispatch: (action: AskAction) => void
): Promise<void> => {
  try {
    const value = await describeSql(sql, dialect);
    dispatch({ sql, type: "assumptions", value });
  } catch (error) {
    console.error("[ask] describing the SQL failed", error);
  }
};

export const useAsk = () => {
  const [state, dispatch] = useReducer(askReducer, initialAskState);
  const session = useRef<Session | null>(null);

  const release = useCallback((askId: string) => {
    if (session.current?.askId !== askId) {
      return;
    }
    session.current.unsubscribe();
    session.current = null;
  }, []);

  const abandon = useCallback(() => {
    const { current } = session;
    if (!current) {
      return false;
    }
    release(current.askId);
    stopOnBun(current.askId);
    return true;
  }, [release]);

  const cancel = useCallback(() => {
    if (abandon()) {
      dispatch({ type: "cancel" });
    }
  }, [abandon]);

  const subscribe = useCallback(
    async (askId: string, source: AskSource, send: () => Promise<void>) => {
      const unsubscribe = onAskEvent(askId, (event) => {
        dispatch(event);
        if (event.type === "sqlDone" && isSqlDialect(event.dialect)) {
          describeAnswer(event.sql, event.dialect, dispatch);
        }
        if (isTerminal(event)) {
          release(askId);
        }
      });
      session.current = { askId, unsubscribe };
      try {
        await send();
      } catch (error) {
        if (session.current?.askId !== askId) {
          return;
        }
        release(askId);
        dispatch({
          code: "QUERY_FAILED",
          message: getErrorMessage(error, SEND_FAILED[source]),
          phase: source === "question" ? "schema" : "run",
          type: "error",
        });
      }
    },
    [release]
  );

  const begin = useCallback(
    (
      prompt: string,
      source: AskSource,
      send: (askId: string) => Promise<void>
    ) => {
      abandon();
      const askId = crypto.randomUUID();
      dispatch({ askId, prompt, source, type: "start" });
      return subscribe(askId, source, () => send(askId));
    },
    [abandon, subscribe]
  );

  const refine = useCallback(
    (prompt: string, target: AskTarget) => {
      const context = refineContextOf(state);
      if (!(context && canRefine(state))) {
        return Promise.resolve();
      }
      const askId = crypto.randomUUID();
      dispatch({ prompt, type: "refine" });
      return subscribe(askId, "question", () =>
        ask({ askId, ...target, prompt, refine: context })
      );
    },
    [state, subscribe]
  );

  const start = useCallback(
    (prompt: string, target: AskTarget) =>
      begin(prompt, "question", (askId) => ask({ askId, ...target, prompt })),
    [begin]
  );

  const startSql = useCallback(
    (sql: string, target: AskTarget, title?: string) =>
      begin(sql, "sql", (askId) =>
        runSql({ askId, ...target, source: { kind: "sql", sql, title } })
      ),
    [begin]
  );

  const startMatch = useCallback(
    (hit: LookupHit, value: LookupValue, target: AskTarget) =>
      begin(`${hit.table} · ${hit.column}`, "match", (askId) =>
        runSql({
          askId,
          ...target,
          source: {
            column: hit.column,
            kind: "match",
            schema: hit.schema,
            table: hit.table,
            value,
          },
        })
      ),
    [begin]
  );

  const selectView = useCallback(
    (view: CardViewKind) => dispatch({ type: "selectView", view }),
    []
  );
  const toggleSql = useCallback(() => dispatch({ type: "toggleSql" }), []);
  const stepTurn = useCallback(
    (to: number) => dispatch({ to, type: "stepTurn" }),
    []
  );
  const restore = useCallback(() => dispatch({ type: "restore" }), []);

  useEffect(
    () => () => {
      abandon();
    },
    [abandon]
  );

  return {
    cancel,
    refine,
    restore,
    selectView,
    start,
    startMatch,
    startSql,
    state,
    stepTurn,
    toggleSql,
  };
};

export type AskSession = ReturnType<typeof useAsk>;
