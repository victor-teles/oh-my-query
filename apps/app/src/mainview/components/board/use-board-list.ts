import { useCallback, useEffect, useState } from "react";

import type { Board } from "@/lib/ipc";

import { listBoards, onBoardChanged } from "@/lib/ipc";

export const useBoardList = () => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await listBoards();
        if (!cancelled) {
          setBoards(next);
        }
      } catch (error) {
        console.error("[boards] could not load", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => onBoardChanged(reload), [reload]);

  return { boards, reload };
};
