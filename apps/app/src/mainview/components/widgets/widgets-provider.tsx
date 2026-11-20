import type { ReactNode } from "react";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { RecentAsk, Widget, WidgetDraft } from "@/lib/ipc";

import { RECENTS_SHOWN } from "@/components/launcher/views/root-items";
import {
  deleteWidget,
  listRecentAsks,
  listWidgets,
  saveWidget,
} from "@/lib/ipc";

export type WidgetsStatus = "loading" | "ready" | "error";

interface WidgetsContextValue {
  widgets: Widget[];
  recents: RecentAsk[];
  status: WidgetsStatus;
  freshId: string | null;
  refresh: () => Promise<void>;
  save: (draft: WidgetDraft) => Promise<Widget>;
  remove: (widgetId: string) => Promise<void>;
  markFresh: (widgetId: string | null) => void;
}

const WidgetsContext = createContext<WidgetsContextValue | null>(null);

interface WidgetsProviderProps {
  children: ReactNode;
}

export function WidgetsProvider({ children }: WidgetsProviderProps) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [recents, setRecents] = useState<RecentAsk[]>([]);
  const [status, setStatus] = useState<WidgetsStatus>("loading");
  const [freshId, setFreshId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextWidgets, nextRecents] = await Promise.all([
        listWidgets(),
        listRecentAsks(RECENTS_SHOWN),
      ]);
      setWidgets(nextWidgets);
      setRecents(nextRecents);
      setStatus("ready");
    } catch (error) {
      console.error("[widgets] could not load", error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (draft: WidgetDraft) => {
    const saved = await saveWidget(draft);
    setWidgets((current) => [
      saved,
      ...current.filter((widget) => widget.id !== saved.id),
    ]);
    return saved;
  }, []);

  const remove = useCallback(async (widgetId: string) => {
    await deleteWidget(widgetId);
    setWidgets((current) => current.filter((widget) => widget.id !== widgetId));
  }, []);

  const value = useMemo(
    () => ({
      freshId,
      markFresh: setFreshId,
      recents,
      refresh,
      remove,
      save,
      status,
      widgets,
    }),
    [freshId, recents, refresh, remove, save, status, widgets]
  );

  return <WidgetsContext value={value}>{children}</WidgetsContext>;
}

export const useWidgets = (): WidgetsContextValue => {
  const value = use(WidgetsContext);
  if (!value) {
    throw new Error("useWidgets must be used inside WidgetsProvider");
  }
  return value;
};
