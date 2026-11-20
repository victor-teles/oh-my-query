import { Reveal } from "@/components/motion/reveal";

interface LookupMessageProps {
  title: string;
  notes?: readonly string[];
  tone: "empty" | "error";
}

export function LookupMessage({ title, notes = [], tone }: LookupMessageProps) {
  return (
    <Reveal className="flex flex-col gap-1 px-4 pt-2 pb-5">
      <p
        className="type-body text-foreground"
        role={tone === "error" ? "alert" : "status"}
      >
        {title}
      </p>
      {notes.map((note) => (
        <p className="type-meta text-panel-muted" key={note}>
          {note}
        </p>
      ))}
    </Reveal>
  );
}
