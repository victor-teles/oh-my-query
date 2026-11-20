import { useState } from "react";

interface Identified {
  id: string;
}

export const useListSelection = <T extends Identified>(
  items: readonly T[],
  initialId: string | null = null
) => {
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId)
  );
  const selected = items[index] ?? null;

  const move = (delta: number) => {
    if (items.length === 0) {
      return;
    }
    const next = (index + delta + items.length) % items.length;
    setSelectedId(items[next]?.id ?? null);
  };

  return { move, select: setSelectedId, selected };
};
