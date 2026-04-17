import type { ReactNode } from "react";

import { createContext, use, useCallback, useMemo, useState } from "react";

import type { ExecuteResult } from "@/lib/tauri";

export type ResultSource = "manual" | "auto";

export interface MessageResultRecord {
  result: ExecuteResult;
  source: ResultSource;
}

interface MessageResultContextValue {
  record: MessageResultRecord | null;
  result: ExecuteResult | null;
  publish: (result: ExecuteResult, source: ResultSource) => void;
  clear: () => void;
}

const MessageResultContext = createContext<MessageResultContextValue | null>(
  null
);

export const MessageResultProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [record, setRecord] = useState<MessageResultRecord | null>(null);

  const publish = useCallback((result: ExecuteResult, source: ResultSource) => {
    setRecord((prev) =>
      prev && prev.result === result && prev.source === source
        ? prev
        : { result, source }
    );
  }, []);

  const clear = useCallback(() => {
    setRecord(null);
  }, []);

  const value = useMemo<MessageResultContextValue>(
    () => ({
      clear,
      publish,
      record,
      result: record?.result ?? null,
    }),
    [clear, publish, record]
  );

  return <MessageResultContext value={value}>{children}</MessageResultContext>;
};

export const useOptionalMessageResult = (): MessageResultContextValue | null =>
  use(MessageResultContext);
