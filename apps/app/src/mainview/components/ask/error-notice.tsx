import type { ReactNode } from "react";

import { CircleAlertIcon } from "lucide-react";

import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";

export interface NoticeAction {
  label: string;
  onRun: () => void;
}

interface ErrorNoticeProps {
  title: string;
  detail: string | null;
  action: NoticeAction | null;
  children?: ReactNode;
}

export function ErrorNotice({
  title,
  detail,
  action,
  children,
}: ErrorNoticeProps) {
  const handleAction = action?.onRun;
  return (
    <Reveal className="px-4 pt-1 pb-4">
      <div
        className="flex gap-3 rounded-[10px] border border-danger-ink/25 bg-destructive/[0.07] px-3 py-2.5"
        role="alert"
      >
        <CircleAlertIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-danger-ink"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="type-body text-foreground">{title}</p>
          {detail ? (
            <p className="type-meta break-words text-panel-muted">{detail}</p>
          ) : null}
          {children}
        </div>
        {action ? (
          <Pressable
            className="h-7 shrink-0 self-start rounded-[7px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active"
            onClick={handleAction}
          >
            {action.label}
          </Pressable>
        ) : null}
      </div>
    </Reveal>
  );
}
