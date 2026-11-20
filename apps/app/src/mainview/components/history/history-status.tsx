import { SwapText } from "@/components/motion/swap-text";

interface HistoryStatusProps {
  failure: string | null;
  message: string | null;
  hint: string | null;
}

export function HistoryStatus({ failure, message, hint }: HistoryStatusProps) {
  const text = failure ?? message ?? hint;
  return (
    <span className="flex min-w-0 items-center" role="status">
      {text ? (
        <SwapText
          className={failure ? "truncate text-danger-ink" : "truncate"}
          value={text}
        />
      ) : null}
    </span>
  );
}
