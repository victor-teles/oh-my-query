import type { ReactNode } from "react";

import { createContext, use, useMemo, useState } from "react";

import type { ExecuteResult } from "@/lib/tauri";

interface MessageResultContextValue {
  result: ExecuteResult | null;
  setResult: (result: ExecuteResult | null) => void;
}

const MessageResultContext = createContext<MessageResultContextValue | null>(
  null
);

export const MessageResultProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const value = useMemo(() => ({ result, setResult }), [result]);
  return <MessageResultContext value={value}>{children}</MessageResultContext>;
};

export const useOptionalMessageResult = (): MessageResultContextValue | null =>
  use(MessageResultContext);
