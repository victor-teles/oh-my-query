import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useCallback } from "react";

import type { PlanNode } from "@/lib/tauri";

import { cn } from "@/lib/utils";

import { costTier, relativeCostFraction } from "./use-plan-analysis";

type CostTier = ReturnType<typeof costTier>;

const formatMsShort = (ms: number | null): string | null => {
  if (ms === null) {
    return null;
  }
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}µs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatRowsShort = (rows: number | null): string | null => {
  if (rows === null) {
    return null;
  }
  if (rows >= 1_000_000) {
    return `${(rows / 1_000_000).toFixed(1)}M`;
  }
  if (rows >= 1000) {
    return `${(rows / 1000).toFixed(1)}k`;
  }
  return Math.round(rows).toString();
};

interface PlanNodeCardProps {
  node: PlanNode;
  maxCost: number;
  isOnHotPath: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

export const PlanNodeCard = ({
  node,
  maxCost,
  isOnHotPath,
  isSelected,
  hasChildren,
  isExpanded,
  onSelect,
  onToggleExpand,
}: PlanNodeCardProps) => {
  const fraction = relativeCostFraction(node, maxCost);
  const tier = costTier(fraction);
  const barWidthPct = Math.round(fraction * 100);

  const handleSelect = useCallback(() => {
    onSelect(node.id);
  }, [onSelect, node.id]);
  const handleToggle = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      onToggleExpand(node.id);
    },
    [onToggleExpand, node.id]
  );

  return (
    <div className={cn(`
          group relative overflow-hidden rounded-md border transition-all
          duration-150
        `, isSelected ? "border-primary/50 bg-card shadow-sm" : `
            border-border/60 bg-card/60
            hover:border-border hover:bg-card
          `, isOnHotPath && !isSelected && "border-warning/40")}>
      <div className="relative flex items-center gap-1 p-2">
        <TierAccent tier={tier} />
        <ChevronToggle
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          onToggle={handleToggle}
        />
        <button
          aria-pressed={isSelected}
          className="
            flex min-w-0 flex-1 items-center gap-2 text-left outline-none
            focus-visible:ring-2 focus-visible:ring-ring/60
            focus-visible:ring-inset
          "
          onClick={handleSelect}
          type="button"
        >
          <NodeSummary isOnHotPath={isOnHotPath} node={node} />
          <NodeMetric node={node} tier={tier} />
        </button>
      </div>
      <CostBar tier={tier} widthPct={barWidthPct} />
    </div>
  );
};

const TierAccent = ({ tier }: { tier: CostTier }) => (
  <span
    aria-hidden="true"
    className={cn(
      "absolute inset-y-1 left-0 w-[3px] rounded-r-sm",
      tier === "high" && "bg-destructive",
      tier === "medium" && "bg-warning",
      tier === "low" && "bg-success/70"
    )}
  />
);

const ChevronToggle = ({
  hasChildren,
  isExpanded,
  onToggle,
}: {
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: (e: React.MouseEvent) => void;
}) => {
  if (!hasChildren) {
    return <span aria-hidden="true" className="size-4 shrink-0" />;
  }
  return (
    <button
      aria-expanded={isExpanded}
      aria-label={isExpanded ? "Collapse" : "Expand"}
      className="
        flex size-4 shrink-0 items-center justify-center rounded-sm
        text-muted-foreground transition-colors outline-none
        hover:bg-accent hover:text-foreground
        focus-visible:ring-2 focus-visible:ring-ring/60
      "
      onClick={onToggle}
      type="button"
    >
      {isExpanded ? (
        <ChevronDown className="size-3" />
      ) : (
        <ChevronRight className="size-3" />
      )}
    </button>
  );
};

const NodeSummary = ({
  node,
  isOnHotPath,
}: {
  node: PlanNode;
  isOnHotPath: boolean;
}) => {
  const rowsEst = formatRowsShort(node.rows.estimated);
  const rowsActual = formatRowsShort(node.rows.actual);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-[12px] font-medium text-foreground">
          {node.label}
        </span>
        {isOnHotPath && (
          <span
            className="
              shrink-0 rounded-sm bg-warning/15 px-1 py-px text-[9px]
              font-medium tracking-wide text-warning uppercase
            "
          >
            hot
          </span>
        )}
        {node.warnings.length > 0 && (
          <span
            aria-label={`${node.warnings.length} warning(s): ${node.warnings.join(", ")}`}
            className="
              inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-warning/15
              px-1 py-px text-[10px] font-medium text-warning
            "
          >
            <AlertTriangle aria-hidden="true" className="size-2.5" />
            {node.warnings[0]?.split(" ")[0]?.toLowerCase() ??
              node.warnings.length}
          </span>
        )}
      </div>
      {(rowsEst || rowsActual) && (
        <RowsLine rowsActual={rowsActual} rowsEst={rowsEst} />
      )}
    </div>
  );
};

const RowsLine = ({
  rowsActual,
  rowsEst,
}: {
  rowsActual: string | null;
  rowsEst: string | null;
}) => (
  <div
    className="
      flex items-center gap-2 font-mono text-[10px] text-muted-foreground
    "
  >
    {rowsActual && rowsEst ? (
      <span>
        <span className="text-foreground/70">{rowsActual}</span>
        <span className="mx-1 text-muted-foreground/60">/</span>
        <span>{rowsEst} est</span>
      </span>
    ) : (
      <span>{rowsActual ?? rowsEst} rows</span>
    )}
  </div>
);

const NodeMetric = ({ node, tier }: { node: PlanNode; tier: CostTier }) => {
  const selfMs = formatMsShort(
    node.cost.selfMs ?? node.cost.actualTotalMs ?? node.timing.actualTotalMs
  );
  const costEstimate =
    node.cost.total !== null && node.cost.actualTotalMs === null
      ? node.cost.total.toFixed(1)
      : null;

  return (
    <div
      className="
        flex shrink-0 items-baseline gap-2 font-mono text-[11px] tabular-nums
      "
    >
      {selfMs && (
        <span
          className={cn(
            "font-semibold",
            tier === "high" && "text-destructive",
            tier === "medium" && "text-warning",
            tier === "low" && "text-foreground/70"
          )}
        >
          {selfMs}
        </span>
      )}
      {!selfMs && costEstimate && (
        <span className="text-foreground/60">≈{costEstimate}</span>
      )}
    </div>
  );
};

const CostBar = ({ tier, widthPct }: { tier: CostTier; widthPct: number }) => (
  <div aria-hidden="true" className="h-[2px] w-full bg-muted/40">
    <div
      className={cn(
        "h-full transition-[width] duration-300 ease-out",
        tier === "high" && "bg-destructive/80",
        tier === "medium" && "bg-warning/80",
        tier === "low" && "bg-success/60"
      )}
      style={{ width: `${widthPct}%` }}
    />
  </div>
);
