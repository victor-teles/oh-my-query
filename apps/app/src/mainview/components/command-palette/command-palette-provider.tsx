import type { ReactNode } from "react";

import { useHotkey } from "@tanstack/react-hotkeys";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import type { CommandAction } from "@/components/command-palette/types";

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  actions: CommandAction[];
  register: (actions: CommandAction[]) => () => void;
  recordUse: (id: string) => void;
  recentIds: string[];
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
);

const RECENT_STORAGE_KEY = "oh-my-query.command-palette.recent";
const RECENT_LIMIT = 3;

function loadRecentIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function saveRecentIds(ids: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota / privacy-mode failures
  }
}

export const CommandPaletteProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>(loadRecentIds);
  const registryRef = useRef<Map<symbol, CommandAction[]>>(new Map());
  const [version, setVersion] = useState(0);

  useHotkey("Mod+K", (event) => {
    event?.preventDefault?.();
    setOpen((prev) => !prev);
  });

  const register = useCallback((incoming: CommandAction[]) => {
    const token = Symbol("command-actions");
    registryRef.current.set(token, incoming);
    setVersion((v) => v + 1);
    return () => {
      registryRef.current.delete(token);
      setVersion((v) => v + 1);
    };
  }, []);

  const recordUse = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((existing) => existing !== id)].slice(
        0,
        RECENT_LIMIT
      );
      saveRecentIds(next);
      return next;
    });
  }, []);

  const actions = useMemo<CommandAction[]>(() => {
    const flat: CommandAction[] = [];
    const seen = new Set<string>();
    for (const bucket of registryRef.current.values()) {
      for (const action of bucket) {
        if (seen.has(action.id)) {
          continue;
        }
        seen.add(action.id);
        flat.push(action);
      }
    }
    return flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ actions, open, recentIds, recordUse, register, setOpen }),
    [open, actions, register, recordUse, recentIds]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
};

export const useCommandPalette = (): CommandPaletteContextValue => {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      "useCommandPalette must be used inside CommandPaletteProvider"
    );
  }
  return ctx;
};
