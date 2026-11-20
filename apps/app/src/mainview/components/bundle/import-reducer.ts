import type {
  ApplyImportRequest,
  Bundle,
  ImportPlan,
  ImportResult,
  ImportSource,
} from "@/lib/ipc";

export interface ReviewData {
  bundle: Bundle;
  plan: ImportPlan;
  connectionMap: Record<string, string | null>;
  unchecked: readonly string[];
  boards: boolean;
  expandedRef: string | null;
}

export type ImportState =
  | { phase: "choose" }
  | { phase: "reading"; source: ImportSource }
  | { phase: "invalid"; source: ImportSource; message: string }
  | ({ phase: "review" } & ReviewData)
  | ({ phase: "importing" } & ReviewData)
  | ({ phase: "error"; message: string } & ReviewData)
  | { phase: "done"; result: ImportResult };

export type ReviewState = Extract<
  ImportState,
  { phase: "review" | "importing" | "error" }
>;

export type ImportAction =
  | { type: "read"; source: ImportSource }
  | { type: "cancelled" }
  | { type: "invalid"; message: string }
  | { type: "loaded"; bundle: Bundle; plan: ImportPlan }
  | { type: "map"; ref: string; connectionId: string | null }
  | { type: "toggleWidget"; ref: string }
  | { type: "toggleBoards" }
  | { type: "toggleSql"; ref: string }
  | { type: "importing" }
  | { type: "imported"; result: ImportResult }
  | { type: "failed"; message: string };

export const INITIAL_IMPORT: ImportState = { phase: "choose" };

export type WidgetChoice = "on" | "off" | "unmapped";

export const isReview = (state: ImportState): state is ReviewState =>
  state.phase === "review" ||
  state.phase === "importing" ||
  state.phase === "error";

const reviewData = ({
  bundle,
  plan,
  connectionMap,
  unchecked,
  boards,
  expandedRef,
}: ReviewData): ReviewData => ({
  boards,
  bundle,
  connectionMap,
  expandedRef,
  plan,
  unchecked,
});

const initialReview = (bundle: Bundle, plan: ImportPlan): ReviewData => ({
  boards: bundle.boards.length > 0,
  bundle,
  connectionMap: Object.fromEntries(
    plan.connections.map((item) => [item.ref, item.suggestedId])
  ),
  expandedRef: null,
  plan,
  unchecked: plan.widgets.flatMap((item) =>
    item.duplicateOfWidgetId ? [item.ref] : []
  ),
});

const connectionRefOf = (review: ReviewData, ref: string): string | null =>
  review.bundle.widgets.find((item) => item.ref === ref)?.connectionRef ?? null;

export const widgetChoice = (review: ReviewData, ref: string): WidgetChoice => {
  const connectionRef = connectionRefOf(review, ref);
  if (!connectionRef || !review.connectionMap[connectionRef]) {
    return "unmapped";
  }
  return review.unchecked.includes(ref) ? "off" : "on";
};

export const isDuplicateHere = (review: ReviewData, ref: string): boolean => {
  const widgetPlan = review.plan.widgets.find((item) => item.ref === ref);
  const connectionRef = connectionRefOf(review, ref);
  const suggested = review.plan.connections.find(
    (item) => item.ref === connectionRef
  )?.suggestedId;
  return (
    Boolean(widgetPlan?.duplicateOfWidgetId) &&
    connectionRef !== null &&
    review.connectionMap[connectionRef] === suggested
  );
};

export const importedTileCount = (
  review: ReviewData,
  boardRef: string
): number => {
  const board = review.bundle.boards.find((item) => item.ref === boardRef);
  return (
    board?.tiles.filter((tile) => widgetChoice(review, tile.widgetRef) === "on")
      .length ?? 0
  );
};

export const importCounts = (review: ReviewData) => {
  const widgets = review.bundle.widgets.filter(
    (item) => widgetChoice(review, item.ref) === "on"
  ).length;
  const boards = review.boards
    ? review.bundle.boards.filter(
        (board) =>
          board.tiles.length === 0 || importedTileCount(review, board.ref) > 0
      ).length
    : 0;
  return { boards, widgets };
};

export const applyRequestOf = (review: ReviewData): ApplyImportRequest => ({
  boards: review.boards,
  bundle: review.bundle,
  connectionMap: review.connectionMap,
  skipWidgetRefs: [...review.unchecked],
});

const toggled = (refs: readonly string[], ref: string): string[] =>
  refs.includes(ref) ? refs.filter((item) => item !== ref) : [...refs, ref];

const editReview = (
  review: ReviewData,
  action: ImportAction
): ReviewData | null => {
  switch (action.type) {
    case "map": {
      return {
        ...review,
        connectionMap: {
          ...review.connectionMap,
          [action.ref]: action.connectionId,
        },
      };
    }
    case "toggleWidget": {
      return widgetChoice(review, action.ref) === "unmapped"
        ? null
        : { ...review, unchecked: toggled(review.unchecked, action.ref) };
    }
    case "toggleBoards": {
      return review.bundle.boards.length === 0
        ? null
        : { ...review, boards: !review.boards };
    }
    case "toggleSql": {
      return {
        ...review,
        expandedRef: review.expandedRef === action.ref ? null : action.ref,
      };
    }
    default: {
      return null;
    }
  }
};

const fromStart = (
  state: ImportState,
  action: ImportAction
): ImportState | null => {
  if (
    action.type === "read" &&
    (state.phase === "choose" || state.phase === "invalid")
  ) {
    return { phase: "reading", source: action.source };
  }
  if (state.phase !== "reading") {
    return null;
  }
  switch (action.type) {
    case "cancelled": {
      return { phase: "choose" };
    }
    case "invalid": {
      return {
        message: action.message,
        phase: "invalid",
        source: state.source,
      };
    }
    case "loaded": {
      return { phase: "review", ...initialReview(action.bundle, action.plan) };
    }
    default: {
      return null;
    }
  }
};

const fromReview = (
  state: ReviewState,
  action: ImportAction
): ImportState | null => {
  if (state.phase === "importing") {
    if (action.type === "imported") {
      return { phase: "done", result: action.result };
    }
    if (action.type === "failed") {
      return { message: action.message, phase: "error", ...reviewData(state) };
    }
    return null;
  }
  if (action.type === "importing") {
    const counts = importCounts(state);
    return counts.widgets + counts.boards > 0
      ? { phase: "importing", ...reviewData(state) }
      : null;
  }
  const edited = editReview(state, action);
  return edited ? { phase: "review", ...reviewData(edited) } : null;
};

export const importReducer = (
  state: ImportState,
  action: ImportAction
): ImportState => {
  const next = isReview(state)
    ? fromReview(state, action)
    : fromStart(state, action);
  return next ?? state;
};
