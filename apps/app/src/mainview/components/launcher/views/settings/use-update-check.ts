import { useCallback, useState } from "react";

import type { AvailableUpdate } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { checkForUpdate, installUpdate } from "@/lib/ipc";

export type UpdateCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "current" }
  | { status: "available"; update: AvailableUpdate }
  | { status: "installing"; update: AvailableUpdate }
  | { status: "failed"; message: string };

export const useUpdateCheck = () => {
  const [check, setCheck] = useState<UpdateCheck>({ status: "idle" });

  const run = useCallback(async () => {
    setCheck({ status: "checking" });
    try {
      const update = await checkForUpdate();
      setCheck(
        update ? { status: "available", update } : { status: "current" }
      );
    } catch (error) {
      const message = getErrorMessage(error, "Could not check for updates.");
      setCheck({ message, status: "failed" });
    }
  }, []);

  const install = useCallback(async (update: AvailableUpdate) => {
    setCheck({ status: "installing", update });
    try {
      await installUpdate();
    } catch (error) {
      const message = getErrorMessage(error, "The update could not install.");
      setCheck({ message, status: "failed" });
    }
  }, []);

  return { check, install, run };
};
