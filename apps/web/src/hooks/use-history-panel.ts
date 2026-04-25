import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

type Search = Record<string, unknown>;

const HISTORY_FLAG = "history";

export const useHistoryPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const open = useMemo(() => {
    const raw = (location.search as Search)[HISTORY_FLAG];
    return raw === "open";
  }, [location.search]);

  const setOpen = useCallback(
    (next: boolean) => {
      navigate({
        replace: true,
        search: (prev: Search) => {
          const { [HISTORY_FLAG]: _removed, ...rest } = prev;
          return next ? { ...rest, [HISTORY_FLAG]: "open" } : rest;
        },
        to: ".",
      });
    },
    [navigate]
  );

  const toggle = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  return { open, setOpen, toggle };
};
