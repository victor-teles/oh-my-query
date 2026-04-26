import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";

import type { DatabaseConnection } from "@/lib/connections";

interface HomeHotkeysInput {
  enabled: boolean;
  flatList: DatabaseConnection[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  onOpenAdd: () => void;
  onLaunch: (connection: DatabaseConnection) => void;
  onDelete: (connection: DatabaseConnection) => void;
}

export const useHomeHotkeys = ({
  enabled,
  flatList,
  selectedId,
  setSelectedId,
  onOpenAdd,
  onLaunch,
  onDelete,
}: HomeHotkeysInput) => {
  const navigate = useNavigate();

  useHotkey("Mod+N", () => {
    if (flatList.length > 0) {
      onOpenAdd();
    }
  });

  useHotkey("Mod+,", () => {
    navigate({ to: "/settings" });
  });

  useHotkey("ArrowDown", () => {
    if (!enabled || flatList.length === 0) {
      return;
    }
    const currentIndex = flatList.findIndex((c) => c.id === selectedId);
    const nextIndex = Math.min(currentIndex + 1, flatList.length - 1);
    const next = flatList[nextIndex];
    if (next) {
      setSelectedId(next.id);
    }
  });

  useHotkey("ArrowUp", () => {
    if (!enabled || flatList.length === 0) {
      return;
    }
    const currentIndex = flatList.findIndex((c) => c.id === selectedId);
    const prevIndex = Math.max(currentIndex - 1, 0);
    const prev = flatList[prevIndex];
    if (prev) {
      setSelectedId(prev.id);
    }
  });

  useHotkey("Enter", () => {
    if (!enabled) {
      return;
    }
    const selected = flatList.find((c) => c.id === selectedId);
    if (selected) {
      onLaunch(selected);
    }
  });

  useHotkey("Mod+Backspace", () => {
    if (!enabled) {
      return;
    }
    const selected = flatList.find((c) => c.id === selectedId);
    if (selected) {
      onDelete(selected);
    }
  });
};
