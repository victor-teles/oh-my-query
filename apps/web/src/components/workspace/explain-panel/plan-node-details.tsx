import type { PlanNode } from "@/lib/tauri";

const formatMs = (ms: number | null): string => {
  if (ms === null) {
    return "—";
  }
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}µs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatRows = (rows: number | null): string => {
  if (rows === null) {
    return "—";
  }
  if (rows >= 1_000_000) {
    return `${(rows / 1_000_000).toFixed(1)}M`;
  }
  if (rows >= 1000) {
    return `${(rows / 1000).toFixed(1)}k`;
  }
  return Math.round(rows).toString();
};

export const PlanNodeDetails = ({ node }: { node: PlanNode }) => (
  <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
    <div>
      <div className="font-semibold text-foreground text-xs tracking-wide">
        {node.label}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        {node.nodeType}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
      <DetailRow label="Rows (est.)" value={formatRows(node.rows.estimated)} />
      <DetailRow label="Rows (actual)" value={formatRows(node.rows.actual)} />
      <DetailRow
        label="Self time"
        value={formatMs(node.cost.selfMs ?? node.timing.actualTotalMs)}
      />
      <DetailRow
        label="Total time"
        value={formatMs(node.cost.actualTotalMs ?? node.timing.actualTotalMs)}
      />
      {node.cost.total !== null && (
        <DetailRow label="Cost (est.)" value={node.cost.total.toFixed(2)} />
      )}
      {node.timing.loops !== null && node.timing.loops > 1 && (
        <DetailRow label="Loops" value={node.timing.loops.toString()} />
      )}
    </div>

    {node.warnings.length > 0 && (
      <div className="flex flex-col gap-1 rounded-md border border-warning/30 bg-warning/5 p-2 text-[11px]">
        {node.warnings.map((warning) => (
          <div className="flex items-start gap-1.5 text-warning" key={warning}>
            <span aria-hidden="true">•</span>
            <span>{warning}</span>
          </div>
        ))}
      </div>
    )}

    {node.details.length > 0 && (
      <dl className="flex flex-col gap-1 border-border/50 border-t pt-2 font-mono text-[10px]">
        {node.details.map(([key, value]) => (
          <div className="flex items-start gap-2" key={key}>
            <dt className="w-1/3 shrink-0 truncate text-muted-foreground">
              {key}
            </dt>
            <dd className="flex-1 break-words text-foreground/80">{value}</dd>
          </div>
        ))}
      </dl>
    )}
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono text-foreground tabular-nums">{value}</span>
  </div>
);
