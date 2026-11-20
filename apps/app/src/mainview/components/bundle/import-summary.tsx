import type { ImportIssue, ImportResult } from "@/lib/ipc";

import { CheckDraw } from "@/components/motion/check-draw";
import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

import { importedLabel } from "./bundle-labels";

interface IssueListProps {
  title: string;
  issues: readonly ImportIssue[];
  tone: "failed" | "skipped";
}

function IssueList({ title, issues, tone }: IssueListProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h2 className="type-micro text-panel-muted">{title}</h2>
      <ul className="flex flex-col gap-1">
        {issues.map((issue) => (
          <li
            className="flex min-w-0 items-baseline gap-2 type-meta"
            key={`${issue.kind}-${issue.ref}`}
          >
            <span className="shrink-0 text-panel-muted">
              {issue.kind === "board" ? "Board" : "Widget"}
            </span>
            <span className="truncate text-foreground">{issue.name}</span>
            <span
              className={cn(
                "min-w-0 flex-1 break-words",
                tone === "failed" ? "text-danger-ink" : "text-panel-muted"
              )}
            >
              {issue.reason}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface ImportSummaryProps {
  result: ImportResult;
  onDone: () => void;
}

export function ImportSummary({ result, onDone }: ImportSummaryProps) {
  const imported = result.widgets + result.boards > 0;
  return (
    <Reveal className="flex flex-col gap-3 px-4 pt-3 pb-4">
      <p
        className="flex items-center gap-2 type-body text-foreground"
        role="status"
      >
        {imported ? <CheckDraw label="Imported" /> : null}
        {importedLabel(result)}
      </p>
      {result.failed.length > 0 ? (
        <IssueList issues={result.failed} title="Didn't import" tone="failed" />
      ) : null}
      {result.skipped.length > 0 ? (
        <IssueList issues={result.skipped} title="Skipped" tone="skipped" />
      ) : null}
      <Pressable
        autoFocus
        className="h-7 self-start rounded-[7px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        onClick={onDone}
      >
        Done
      </Pressable>
    </Reveal>
  );
}
