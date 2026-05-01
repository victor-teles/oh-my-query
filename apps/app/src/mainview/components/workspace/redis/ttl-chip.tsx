import { cn } from "@/lib/utils";

interface TtlChipProps {
  ttlSecs: number | null;
  className?: string;
}

const WARNING_THRESHOLD = 60;

const formatTtl = (secs: number): string => {
  if (secs < 60) {
    return `${secs}s`;
  }
  if (secs < 3600) {
    return `${Math.round(secs / 60)}m`;
  }
  if (secs < 86_400) {
    return `${Math.round(secs / 3600)}h`;
  }
  return `${Math.round(secs / 86_400)}d`;
};

export const TtlChip = ({ ttlSecs, className }: TtlChipProps) => {
  if (ttlSecs === null) {
    return (
      <span aria-hidden="true" className={cn(`
            inline-flex min-w-[26px] justify-end font-mono text-[10px]
            text-muted-foreground/35 tabular-nums
          `, className)} title="No expiry">
        —
      </span>
    );
  }

  const isExpiring = ttlSecs < WARNING_THRESHOLD;

  return (
    <span className={cn(`
          inline-flex min-w-[26px] justify-end font-mono text-[10px]
          tabular-nums
        `, isExpiring ? "font-medium text-amber-500" : "font-normal text-muted-foreground/70", className)} title={`Expires in ${ttlSecs}s`}>
      {formatTtl(ttlSecs)}
    </span>
  );
};
