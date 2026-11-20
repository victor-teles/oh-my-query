import { useConnections } from "@/components/launcher/connections/connections-provider";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { useWidgets } from "@/components/widgets/widgets-provider";

import { WatchPanel } from "./watch-panel";
import { useWatches, watchForWidget } from "./watches-provider";

const BACK_KEYS = ["esc"] as const;

interface WatchViewProps {
  widgetId: string;
  onBack: () => void;
}

function WatchMessage({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onBack={onBack} title="Watch" />
      <p
        className="border-t border-panel-border px-4 py-6 type-body text-panel-muted"
        role="status"
      >
        {text}
      </p>
      <LauncherFooter actionKeys={BACK_KEYS} actionLabel="Back" status={null} />
    </div>
  );
}

export function WatchView({ widgetId, onBack }: WatchViewProps) {
  const { widgets, status } = useWidgets();
  const { watches, statuses, load } = useWatches();
  const { state } = useConnections();
  const widget = widgets.find((item) => item.id === widgetId);
  if (!widget) {
    return (
      <WatchMessage
        onBack={onBack}
        text={
          status === "loading"
            ? "Loading widget…"
            : "This widget no longer exists."
        }
      />
    );
  }
  if (load === "loading") {
    return <WatchMessage onBack={onBack} text="Loading watch…" />;
  }
  const watch = watchForWidget(watches, widgetId);
  return (
    <WatchPanel
      connection={
        state.connections.find((item) => item.id === widget.connectionId) ??
        null
      }
      onDone={onBack}
      status={watch ? statuses[watch.id] : undefined}
      watch={watch}
      widget={widget}
    />
  );
}
