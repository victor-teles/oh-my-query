import type { ReactNode } from "react";

import { useEffect, useState } from "react";

import { Reveal } from "@/components/motion/reveal";

const seen = new Map<string, string>();

export const resetSeenReveals = () => seen.clear();

interface RevealWhenChangedProps {
  slot: string;
  contentKey: string;
  children: ReactNode;
}

// Reveals a section only when its content changed since it was last shown,
// so summoning the launcher again doesn't replay the same entrance.
export function RevealWhenChanged({
  slot,
  contentKey,
  children,
}: RevealWhenChangedProps) {
  const [reveal] = useState(() => seen.get(slot) !== contentKey);

  useEffect(() => {
    seen.set(slot, contentKey);
  }, [contentKey, slot]);

  return reveal ? <Reveal>{children}</Reveal> : <div>{children}</div>;
}
