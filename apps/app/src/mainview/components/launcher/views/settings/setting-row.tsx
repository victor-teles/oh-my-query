import type { ReactNode } from "react";

interface SettingRowProps {
  label: string;
  description: ReactNode;
  children: ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 px-4 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="type-body text-foreground">{label}</span>
        <span className="type-meta text-panel-muted">{description}</span>
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}
