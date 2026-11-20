import { useEffect, useState } from "react";

import { Reveal } from "@/components/motion/reveal";

const session = { revealed: false };

export const resetFirstRunReveal = () => {
  session.revealed = false;
};

const CLASS_NAME = "flex flex-col gap-0.5 px-4.5 pt-2 pb-3";

function FirstRunCopy() {
  return (
    <>
      <p className="type-body text-foreground">No databases yet</p>
      <p className="type-meta text-panel-muted">
        Add one and it stays a keystroke away.
      </p>
    </>
  );
}

export function FirstRunNote() {
  const [reveal] = useState(() => !session.revealed);

  useEffect(() => {
    session.revealed = true;
  }, []);

  return reveal ? (
    <Reveal className={CLASS_NAME}>
      <FirstRunCopy />
    </Reveal>
  ) : (
    <div className={CLASS_NAME}>
      <FirstRunCopy />
    </div>
  );
}
