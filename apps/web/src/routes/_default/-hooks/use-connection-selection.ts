import { useEffect, useMemo, useRef, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";

export const useConnectionSelection = (flatList: DatabaseConnection[]) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flatList.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && flatList.some((c) => c.id === current)) {
        return current;
      }
      return flatList[0]?.id ?? null;
    });
  }, [flatList]);

  const selectedConnection = useMemo(
    () => flatList.find((c) => c.id === selectedId) ?? null,
    [flatList, selectedId]
  );

  return { listboxRef, selectedConnection, selectedId, setSelectedId };
};
