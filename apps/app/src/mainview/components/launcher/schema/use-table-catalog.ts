import { useCallback, useEffect, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { SchemaPeek } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { peekSchema } from "@/lib/ipc";

export type TableCatalog =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; peek: SchemaPeek }
  | { status: "error"; message: string };

type Settled =
  | { key: string; status: "ready"; peek: SchemaPeek }
  | { key: string; status: "error"; message: string };

const IDLE: TableCatalog = { status: "idle" };
const LOADING: TableCatalog = { status: "loading" };

export const useTableCatalog = (connection: DatabaseConnection | null) => {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const connectionId = connection?.id ?? null;
  const key = connectionId ? `${connectionId}:${attempt}` : null;

  useEffect(() => {
    if (!(key && connectionId)) {
      return;
    }
    let live = true;
    const load = async () => {
      let next: Settled;
      try {
        next = { key, peek: await peekSchema(connectionId), status: "ready" };
      } catch (error) {
        next = {
          key,
          message: getErrorMessage(error, "The tables could not be read."),
          status: "error",
        };
      }
      if (live) {
        setSettled(next);
      }
    };
    load();
    return () => {
      live = false;
    };
  }, [connectionId, key]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  let catalog: TableCatalog = IDLE;
  if (key) {
    catalog = settled?.key === key ? settled : LOADING;
  }
  return { catalog, retry };
};
