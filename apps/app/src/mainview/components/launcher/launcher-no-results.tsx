import { Reveal } from "@/components/motion/reveal";

interface LauncherNoResultsProps {
  query: string;
}

export function LauncherNoResults({ query }: LauncherNoResultsProps) {
  return (
    <Reveal className="flex flex-col items-center gap-1 px-6 pt-5 pb-6 text-center">
      <p className="type-body text-foreground" role="status">
        No matches for “{query.trim()}”
      </p>
      <p className="type-meta text-panel-muted">
        Try a shorter word, or press esc to clear.
      </p>
    </Reveal>
  );
}
