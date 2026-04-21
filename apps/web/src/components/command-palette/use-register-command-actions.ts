import { useEffect } from "react";

import type { CommandAction } from "@/components/command-palette/types";

import { useCommandPalette } from "@/components/command-palette/command-palette-provider";

export const useRegisterCommandActions = (
  actions: CommandAction[],
  deps: readonly unknown[]
) => {
  const { register } = useCommandPalette();

  useEffect(() => {
    if (actions.length === 0) {
      return;
    }
    const unregister = register(actions);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
