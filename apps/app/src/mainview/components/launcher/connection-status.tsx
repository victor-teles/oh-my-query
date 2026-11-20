import { useConnections } from "@/components/launcher/connections/connections-provider";
import { SwapText } from "@/components/motion/swap-text";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const { activeConnection, state } = useConnections();
  const live =
    activeConnection !== null && state.liveIds.includes(activeConnection.id);

  return (
    <>
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          live ? "bg-success-ink" : "bg-panel-muted opacity-60"
        )}
      />
      <SwapText
        className="min-w-0 truncate"
        value={activeConnection?.name ?? "No connection"}
      />
    </>
  );
}
