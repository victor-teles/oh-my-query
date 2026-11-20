import { RotateCwIcon } from "lucide-react";

import { useConnections } from "@/components/launcher/connections/connections-provider";
import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

function LoadingRows() {
  return (
    <div aria-label="Loading connections" className="px-2 pb-1" role="status">
      <div className="px-2.5 pt-1 pb-1.5 type-micro text-panel-muted">
        Connections
      </div>
      {["w-32", "w-24"].map((width) => (
        <div className="flex h-10 items-center gap-3 px-2.5" key={width}>
          <span className="size-6 animate-pulse rounded-[7px] bg-row-hover motion-reduce:animate-none" />
          <span
            className={`h-3 ${width} animate-pulse rounded-[4px] bg-row-hover motion-reduce:animate-none`}
          />
        </div>
      ))}
    </div>
  );
}

export function ConnectionsLoadState() {
  const { state, reload } = useConnections();
  const showLoading = useDelayedVisibility(state.load.status === "loading");

  if (state.load.status === "error") {
    return (
      <Reveal className="mx-2 mb-2 flex items-center gap-3 rounded-[10px] bg-destructive/8 px-2.5 py-2">
        <div className="flex min-w-0 flex-1 flex-col" role="alert">
          <span className="type-body text-foreground">
            Connections could not load
          </span>
          <span className="truncate type-meta text-danger-ink">
            {state.load.message}
          </span>
        </div>
        <Pressable
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground"
          onClick={reload}
        >
          <RotateCwIcon aria-hidden className="size-3" />
          Retry
        </Pressable>
      </Reveal>
    );
  }
  return showLoading && state.load.status === "loading" ? (
    <LoadingRows />
  ) : null;
}
