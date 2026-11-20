import type { ReactNode } from "react";

import { Reveal } from "@/components/motion/reveal";

interface BoardMessageProps {
  title: string;
  detail?: string;
  children?: ReactNode;
}

export function BoardMessage({ title, detail, children }: BoardMessageProps) {
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="electrobun-webkit-app-region-drag h-[52px] shrink-0" />
      <Reveal className="flex flex-col items-center gap-2 pt-[20vh] text-center">
        <p className="type-title text-[15px] text-foreground" role="status">
          {title}
        </p>
        {detail ? <p className="type-meta text-panel-muted">{detail}</p> : null}
        {children}
      </Reveal>
    </div>
  );
}
