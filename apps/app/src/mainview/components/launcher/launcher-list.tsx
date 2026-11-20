import type { ReactNode } from "react";

import { AnimatePresence } from "motion/react";
import { useId } from "react";

interface LauncherListboxProps {
  id: string;
  label: string;
  children: ReactNode;
}

export function LauncherListbox({ id, label, children }: LauncherListboxProps) {
  return (
    <div
      aria-label={label}
      className="flex flex-col gap-1 px-2 pb-2"
      id={id}
      role="listbox"
    >
      {children}
    </div>
  );
}

interface LauncherSectionProps {
  label: string;
  children: ReactNode;
}

export function LauncherSection({ label, children }: LauncherSectionProps) {
  const headingId = useId();
  return (
    <div aria-labelledby={headingId} role="group">
      <div
        className="px-2.5 pt-1 pb-1.5 type-micro text-panel-muted"
        id={headingId}
      >
        {label}
      </div>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  );
}
