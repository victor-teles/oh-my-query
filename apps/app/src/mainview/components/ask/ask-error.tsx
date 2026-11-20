import type { AskErrorCode } from "@/lib/ipc";

import type { AskFailure, AskSource } from "./ask-reducer";

import { ErrorNotice } from "./error-notice";

export type ErrorAction = "settings" | "retry" | null;

interface ErrorCopy {
  title: string;
  showDetail: boolean;
  action: ErrorAction;
}

const COPY: Record<AskErrorCode, ErrorCopy> = {
  AI_AUTH: {
    action: "settings",
    showDetail: true,
    title: "The AI provider rejected the key or model.",
  },
  AI_NETWORK: {
    action: "retry",
    showDetail: true,
    title: "The AI provider could not be reached.",
  },
  AI_RATE_LIMIT: {
    action: "retry",
    showDetail: false,
    title: "The AI provider is limiting requests. Try again in a moment.",
  },
  CANCELLED: { action: null, showDetail: false, title: "Stopped." },
  INVALID_SPEC: {
    action: "retry",
    showDetail: false,
    title: "The answer could not be shaped into a card.",
  },
  NOT_READ_ONLY: {
    action: null,
    showDetail: true,
    title: "This would change data. Conch only runs read-only questions.",
  },
  NO_AI_SETTINGS: {
    action: "settings",
    showDetail: false,
    title: "Add an AI provider to ask questions.",
  },
  QUERY_FAILED: {
    action: "retry",
    showDetail: true,
    title: "The query failed.",
  },
  TIMEOUT: {
    action: "retry",
    showDetail: false,
    title: "The query took longer than 30 seconds.",
  },
  UNSUPPORTED_ENGINE: {
    action: null,
    showDetail: false,
    title: "Asking questions doesn't work with this database yet.",
  },
};

const SQL_COPY: Partial<Record<AskErrorCode, ErrorCopy>> = {
  NOT_READ_ONLY: {
    action: null,
    showDetail: true,
    title: "This would change data. The launcher only runs read-only queries.",
  },
  UNSUPPORTED_ENGINE: {
    action: null,
    showDetail: false,
    title: "Running SQL works with SQL databases for now.",
  },
};

const copyFor = (failure: AskFailure, source: AskSource): ErrorCopy =>
  (source === "question" ? undefined : SQL_COPY[failure.code]) ??
  COPY[failure.code];

const ACTION_LABELS: Record<Exclude<ErrorAction, null>, string> = {
  retry: "Retry",
  settings: "Open Settings",
};

const OFFENDING_KEYWORD = /\b([A-Z]{3,}(?:\s+INTO)?)\b/;
const LEADING_TOKEN = /^(\$[A-Za-z]+|[A-Z][A-Z_]{2,})(?=\s)/;

// Pipeline and command refusals name the token first ("$merge writes data");
// SQL refusals name the statement anywhere in the sentence.
export const offendingKeyword = (failure: AskFailure): string | null => {
  if (failure.code !== "NOT_READ_ONLY") {
    return null;
  }
  const leading = LEADING_TOKEN.exec(failure.message)?.[1];
  return (
    leading ??
    OFFENDING_KEYWORD.exec(failure.message)?.[1]?.split(/\s+/)[0] ??
    null
  );
};

interface AskErrorProps {
  failure: AskFailure;
  source: AskSource;
  onAction: (action: Exclude<ErrorAction, null>) => void;
}

export function AskError({ failure, source, onAction }: AskErrorProps) {
  const copy = copyFor(failure, source);
  const { action } = copy;
  return (
    <ErrorNotice
      action={
        action
          ? { label: ACTION_LABELS[action], onRun: () => onAction(action) }
          : null
      }
      detail={copy.showDetail ? failure.message : null}
      title={copy.title}
    />
  );
}
