import { useCallback, useEffect, useRef, useState } from "react";

import { copyText } from "@/lib/clipboard";

export const COPIED_FOR_MS = 1200;

export const useCopyFeedback = () => {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  const copy = useCallback(async (text: string) => {
    if (!(await copyText(text))) {
      return;
    }
    window.clearTimeout(timer.current);
    setCopied(true);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { copied, copy };
};
