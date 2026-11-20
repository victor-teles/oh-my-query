import { useCallback } from "react";

import type { PillProps } from "./pill-props";

type TargetProps = Pick<PillProps, "index" | "register" | "onFocus">;

export const usePillTarget = ({ index, register, onFocus }: TargetProps) => {
  const ref = useCallback(
    (element: HTMLElement | null) => register(index, element),
    [index, register]
  );
  const handleFocus = useCallback(() => onFocus(index), [index, onFocus]);
  return { handleFocus, ref };
};
