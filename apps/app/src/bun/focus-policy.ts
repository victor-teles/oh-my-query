export type FocusRelease =
  | { kind: "keep" }
  | { kind: "activate"; boardId: string }
  | { kind: "deactivate" }
  | { kind: "hide" };

export interface FocusState {
  focusedBoardId: string | null;
  returnBoardId: string | null;
  openBoardIds: readonly string[];
}

// Deactivating instead of hiding keeps open boards visible when focus goes back.
export const focusAfterLauncherHides = ({
  focusedBoardId,
  returnBoardId,
  openBoardIds,
}: FocusState): FocusRelease => {
  if (focusedBoardId) {
    return { kind: "keep" };
  }
  if (returnBoardId && openBoardIds.includes(returnBoardId)) {
    return { boardId: returnBoardId, kind: "activate" };
  }
  return openBoardIds.length > 0 ? { kind: "deactivate" } : { kind: "hide" };
};
