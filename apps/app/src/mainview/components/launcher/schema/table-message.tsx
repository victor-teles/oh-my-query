import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";

interface TableMessageProps {
  title: string;
  detail?: string;
}

export function TableMessage({ title, detail }: TableMessageProps) {
  return (
    <Reveal className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
      <p className="type-body text-foreground" role="status">
        {title}
      </p>
      {detail ? <p className="type-meta text-panel-muted">{detail}</p> : null}
    </Reveal>
  );
}

interface TableErrorProps {
  message: string;
  onRetry: () => void;
}

export function TableError({ message, onRetry }: TableErrorProps) {
  return (
    <Reveal className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="type-body text-foreground" role="alert">
        {message}
      </p>
      <Pressable
        className="rounded-[7px] bg-row-hover px-2.5 py-1 type-meta text-foreground hover:bg-row-active"
        onClick={onRetry}
      >
        Try again
      </Pressable>
    </Reveal>
  );
}
