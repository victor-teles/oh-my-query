import { Info, TriangleAlert } from "lucide-react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";

export const ExplainIdleState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
    <p className="max-w-sm text-muted-foreground text-sm">
      See how the database plans to run your query — estimated costs, join
      order, and which nodes dominate.
    </p>
    <div className="flex items-center gap-2 text-muted-foreground/75 text-xs">
      <span>Run EXPLAIN with</span>
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>⇧</Kbd>
        <Kbd>E</Kbd>
      </KbdGroup>
    </div>
  </div>
);

export const ExplainUnsupportedState = ({ engine }: { engine: string }) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
    <Info aria-hidden="true" className="size-5 text-muted-foreground" />
    <p className="max-w-sm text-muted-foreground text-sm">
      EXPLAIN is not yet supported for{" "}
      <span className="font-medium">{engine}</span>.
    </p>
    <p className="text-muted-foreground/70 text-xs">
      PostgreSQL, MySQL, ClickHouse, and DuckDB are supported.
    </p>
  </div>
);

export const ExplainErrorState = ({ message }: { message: string }) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
    <TriangleAlert aria-hidden="true" className="size-5 text-destructive" />
    <p className="max-w-md whitespace-pre-wrap font-mono text-destructive/90 text-xs leading-relaxed">
      {message}
    </p>
  </div>
);
