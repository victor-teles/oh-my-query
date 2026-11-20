import type { ReactNode } from "react";

import { useId } from "react";

interface SettingsGroupProps {
  title: string;
  children: ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="pt-3">
      <h2 className="px-4 pb-1 type-micro text-panel-muted" id={headingId}>
        {title}
      </h2>
      <div className="divide-y divide-panel-border">{children}</div>
    </section>
  );
}
