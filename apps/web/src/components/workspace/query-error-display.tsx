import { AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface QueryErrorDisplayProps {
  error: string;
}

export const QueryErrorDisplay = ({ error }: QueryErrorDisplayProps) => (
  <div className="flex flex-col items-center justify-center gap-3 p-8">
    <div className="flex items-center gap-2 text-destructive">
      <AlertCircle className="size-5" />
      <Badge variant="destructive">Error</Badge>
    </div>
    <p className="max-w-lg text-center text-sm text-muted-foreground">
      {error}
    </p>
  </div>
);
