import { useCallback, useEffect, useReducer, useRef } from "react";

import type { LookupValue } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { cancelLookup, lookup, onLookupEvent } from "@/lib/ipc";

import { initialLookupState, lookupReducer } from "./lookup-reducer";

interface Session {
  lookupId: string;
  unsubscribe: () => void;
}

const stopOnBun = async (lookupId: string): Promise<void> => {
  try {
    await cancelLookup(lookupId);
  } catch (error) {
    console.error("[lookup] cancel failed", error);
  }
};

export const useLookup = () => {
  const [state, dispatch] = useReducer(lookupReducer, initialLookupState);
  const session = useRef<Session | null>(null);

  const release = useCallback((lookupId: string) => {
    if (session.current?.lookupId !== lookupId) {
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
    release(current.lookupId);
    stopOnBun(current.lookupId);
    return true;
  }, [release]);

  const cancel = useCallback(() => {
    if (abandon()) {
      dispatch({ type: "cancel" });
    }
  }, [abandon]);

  const start = useCallback(
    async (value: LookupValue, connectionId: string) => {
      abandon();
      const lookupId = crypto.randomUUID();
      dispatch({ connectionId, lookupId, type: "start", value });
      const unsubscribe = onLookupEvent(lookupId, (event) => {
        dispatch({ event, lookupId, type: "event" });
        if (event.type === "done" || event.type === "error") {
          release(lookupId);
        }
      });
      session.current = { lookupId, unsubscribe };
      try {
        await lookup({ connectionId, database: null, lookupId, value });
      } catch (error) {
        if (session.current?.lookupId !== lookupId) {
          return;
        }
        release(lookupId);
        dispatch({
          event: {
            code: "FAILED",
            message: getErrorMessage(error, "The search could not start."),
            type: "error",
          },
          lookupId,
          type: "event",
        });
      }
    },
    [abandon, release]
  );

  useEffect(
    () => () => {
      abandon();
    },
    [abandon]
  );

  return { cancel, start, state };
};

export type LookupSession = ReturnType<typeof useLookup>;
