import { SearchX } from "lucide-react";

interface NoResultsStateProps {
  label: "rows" | "documents";
}

export const NoResultsState = ({ label }: NoResultsStateProps) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-muted-foreground">
    <SearchX className="size-5 text-muted-foreground/70" />
    <span className="text-foreground text-sm">No results</span>
    <span className="text-xs">Your query returned no {label}</span>
  </div>
);
