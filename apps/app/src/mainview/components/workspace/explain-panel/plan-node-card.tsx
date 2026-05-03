import { AlertTriangle, ChevronDown, ChevronRight, Flame } from "lucide-react";
import { useCallback } from "react";

import type { ExplainDensity } from "@/lib/query-types";
import type { PlanNode } from "@/lib/tauri";

import { cn } from "@/lib/utils";

import { formatMsShort, formatRowsShort } from "./format";
import { costTier, relativeCostFraction } from "./use-plan-analysis";

type CostTier = ReturnType<typeof costTier>;

interface PlanNodeCardProps {
  node: PlanNode;
  maxCost: number;
  isOnHotPath: boolean;
  isHotPathLeaf: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  density: ExplainDensity;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

export const PlanNodeCard = ({
  node,
  maxCost,
  isOnHotPath,
  isHotPathLeaf,
  isSelected,
  hasChildren,
  isExpanded,
  density,
  onSelect,
  onToggleExpand,
}: PlanNodeCardProps) => {
  const tier = costTier(relativeCostFraction(node, maxCost));
  const isCompact = density === "compact";

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
    <div
      className={cn(
        "group relative flex items-center gap-1.5 rounded-md px-1.5 transition-colors",
        isCompact ? "py-0.5" : "py-1.5",
        isOnHotPath && "bg-warning/[0.07]",
        isSelected && "ring-1 ring-primary/45 ring-inset",
        !isSelected && "hover:bg-foreground/[0.045]"
      )}
    >
      <ChevronToggle
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={handleToggle}
      />
      <button aria-pressed={isSelected} className={cn(`
            flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none
            focus-visible:ring-2 focus-visible:ring-primary/60
            focus-visible:ring-inset
          `)} onClick={handleSelect} type="button">
        <NodeSummary compact={isCompact} node={node} />
        <NodeMetric isHotPathLeaf={isHotPathLeaf} node={node} tier={tier} />
      </button>
    </div>
  );
};

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
    return <span aria-hidden="true" className="size-3.5 shrink-0" />;
  }
  return (
    <button
      aria-expanded={isExpanded}
      aria-label={isExpanded ? "Collapse" : "Expand"}
      className="
        flex size-3.5 shrink-0 items-center justify-center rounded-sm
        text-muted-foreground/70 transition-colors outline-none
        hover:bg-foreground/10 hover:text-foreground
        focus-visible:ring-2 focus-visible:ring-primary/60
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
  compact,
}: {
  node: PlanNode;
  compact: boolean;
}) => {
  const rowsEst = formatRowsShort(node.rows.estimated);
  const rowsActual = formatRowsShort(node.rows.actual);
  const hasRows = Boolean(rowsEst || rowsActual);
  const [warning] = node.warnings;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[13px] font-medium tracking-tight text-foreground">
          {node.label}
        </span>
        {warning && (
          <span
            aria-label={
              node.warnings.length > 1
                ? `${node.warnings.length} warnings: ${node.warnings.join(", ")}`
                : warning
            }
            className="inline-flex shrink-0 items-center gap-0.5 text-warning/90"
            title={node.warnings.join("\n")}
          >
            <AlertTriangle aria-hidden="true" className="size-3" />
            {node.warnings.length > 1 && (
              <span className="font-mono text-[10px]">
                {node.warnings.length}
              </span>
            )}
          </span>
        )}
      </div>
      {!compact && hasRows && (
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
  <div className="flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground/80">
    {rowsActual && rowsEst ? (
      <span>
        <span className="text-foreground/70">{rowsActual}</span>
        <span className="mx-1 text-muted-foreground/50">/</span>
        <span>{rowsEst} est</span>
      </span>
    ) : (
      <span>{rowsActual ?? rowsEst} rows</span>
    )}
  </div>
);

const NodeMetric = ({
  node,
  tier,
  isHotPathLeaf,
}: {
  node: PlanNode;
  tier: CostTier;
  isHotPathLeaf: boolean;
}) => {
  const selfMs = formatMsShort(
    node.cost.selfMs ?? node.cost.actualTotalMs ?? node.timing.actualTotalMs
  );
  const costEstimate =
    node.cost.total !== null && node.cost.actualTotalMs === null
      ? node.cost.total.toFixed(1)
      : null;

  if (!(selfMs || costEstimate)) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums">
      {isHotPathLeaf && (
        <Flame aria-label="Hottest node" className="size-3 text-warning/80" />
      )}
      <CostDot tier={tier} />
      {selfMs ? (
        <span
          className={cn(
            "font-medium",
            tier === "high" && "text-destructive",
            tier === "medium" && "text-warning",
            tier === "low" && "text-foreground/70"
          )}
        >
          {selfMs}
        </span>
      ) : (
        costEstimate && (
          <span className="text-foreground/55">≈{costEstimate}</span>
        )
      )}
    </div>
  );
};

const CostDot = ({ tier }: { tier: CostTier }) => (
  <span
    aria-hidden="true"
    className={cn(
      "size-1.5 shrink-0 rounded-full",
      tier === "high" && "bg-destructive/80",
      tier === "medium" && "bg-warning/80",
      tier === "low" && "bg-success/50"
    )}
  />
);
